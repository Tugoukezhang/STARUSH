import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_PERFORMERS } from '../src/utils/publicRunProgression.mjs';
import { getUiPerformerArt } from '../src/systems/UiPerformerArt.mjs';
import { RUNTIME_PAYLOAD } from '../scripts/runtime-payload.mjs';
import { loadScenes, plain } from './helpers/publicShellHarness.mjs';
import {createPublicShellSceneEntry} from '../src/utils/publicShellSceneEntry.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const titleSource = fs.readFileSync(path.join(projectRoot, 'src/scenes/TitleScene.js'), 'utf8');
const idolRosterSource = fs.readFileSync(path.join(projectRoot, 'src/scenes/IdolRosterScene.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(projectRoot, 'src/main.js'), 'utf8');

{
  assert.equal((titleSource.match(/startMenuScene\('roster'/g) ?? []).length, 1);
  assert.equal((titleSource.match(/startMenuScene\('tour'/g) ?? []).length, 1);
  assert.doesNotMatch(titleSource, /_createProductionDeskQuietCopy|舞台练习正在准备中/);
  assert.match(idolRosterSource, /new PublicShellView\(this/);
  assert.match(idolRosterSource, /page: 'roster'/);
  assert.ok(idolRosterSource.includes("this._publicShell.startMenuScene('desk',{profile})"));
  assert.deepEqual(createPublicShellSceneEntry('desk'),{key:'TitleScene',data:{suppressDebugAutoStart:true}});
  assert.doesNotMatch(idolRosterSource, /StageScene|BattleScene|CharacterScene|this\.load\.(image|audio)\(|this\.add\.(text|image|rectangle)\(/);
  assert.doesNotMatch(idolRosterSource, /p15IdolRosterArt|p15SetlistCue|Setlist|setlist|公演编排/);
  assert.deepEqual(PUBLIC_PERFORMERS.map(({ id }) => id), ['sakura', 'kai', 'venus', 'genya', 'enjo']);
}

{
  const loaded = loadScenes();
  for (const [index, member] of PUBLIC_PERFORMERS.entries()) {
    loaded.profile.selectPublicPerformer(member.id);
    const view = loaded.harness(loaded.IdolRosterScene);
    view.scene.create();
    assert.equal(view.root.dataset.page, 'roster');
    assert.equal(view.root.getAttribute('aria-label'), '偶像名册');
    assert.equal(view.all('button[data-member]').length, 5);
    assert.equal(view.query('[data-member="' + member.id + '"]').getAttribute('aria-pressed'), 'true');
    const images=view.all('img');
    const portraits = images.filter(img=>!img.className.split(' ').includes('menu-art'));
    const menuImages=images.filter(img=>img.className.split(' ').includes('menu-art'));
    assert.ok(menuImages.every(img=>RUNTIME_PAYLOAD.some(row=>row.group==='owner-ui'&&row.file===img.src)), 'Menu icons use reviewed UI exports, not character/source art');
    assert.equal(portraits.length, 6, 'Five selection portraits and one current preview');
    const approved = new Set(PUBLIC_PERFORMERS.flatMap(p => [getUiPerformerArt(p.id).avatar,getUiPerformerArt(p.id).portrait]));
    assert.ok([...approved].every(file=>RUNTIME_PAYLOAD.some(row=>row.file===file)), 'Every roster consumer remains in the reviewed shipped whitelist');
    assert.ok(portraits.every(img => approved.has(img.src)), 'Only reviewed actor derivatives, never legacy/source portraits');
    const next = PUBLIC_PERFORMERS[(index + 1) % PUBLIC_PERFORMERS.length];
    view.click('[data-member="' + next.id + '"]');
    assert.equal(loaded.profile.loadPublicProfile().selectedId, member.id);
    assert.equal(view.starts.length, 0);
    for (const copy of [next.name, next.actionName, next.actionSummary]) assert.ok(view.text.includes(copy), copy);
    view.scene.scene.start = (...args) => {
      assert.equal(loaded.profile.loadPublicProfile().selectedId, next.id, 'Save precedes route callback');
      assert.equal(loaded.profile.loadPublicProfile().persisted, true);
      view.starts.push(args);
    };
    const confirm = view.click('[data-action=confirm-member]');
    confirm.click();
    assert.deepEqual(plain(view.starts), [['TitleScene', { suppressDebugAutoStart: true }]]);
    view.shutdown();
  }
}

{
  const loaded = loadScenes();
  const view = loaded.harness(loaded.IdolRosterScene);
  view.scene.create();
  view.click('[data-member=kai]');
  view.click('[data-nav=tour]');
  assert.deepEqual(plain(view.starts), [['TourRouteScene', { suppressDebugAutoStart: true }]]);
  assert.equal(loaded.profile.loadPublicProfile().selectedId, 'sakura', 'Cross-navigation cancels preview');
  view.shutdown();
}

{
  const loaded = loadScenes({ search: '?debug&p88Stage15Practice=1' });
  for (const [Scene, page] of [[loaded.TitleScene, 'desk'], [loaded.IdolRosterScene, 'roster'], [loaded.TourRouteScene, 'tour']]) {
    const view = loaded.harness(Scene);
    view.scene.create();
    assert.equal(view.root.dataset.page, page);
    assert.equal(loaded.document.querySelectorAll('#public-shell').length, 1);
    assert.equal(loaded.document.getElementById('hud').style.display, 'none');
    assert.equal(view.scene.input.enabled, false, 'DOM shell owns input instead of canvas');
    assert.equal(view.starts.length, 0, 'Returning from hidden practice cannot auto-start it');
    const staleButtons = view.all('button');
    const saved = JSON.stringify(loaded.profile.loadPublicProfile());
    const shell = view.scene._publicShell;
    const session = view.scene._sessionExperience;
    let shellDisposals = 0;
    let sessionDisposals = 0;
    const destroyShell = shell.destroy.bind(shell);
    const destroySession = session.destroy.bind(session);
    shell.destroy = () => { shellDisposals += 1; destroyShell(); };
    session.destroy = () => { sessionDisposals += 1; destroySession(); };
    view.shutdown();
    view.shutdown();
    assert.equal(shellDisposals, 1);
    assert.equal(sessionDisposals, 1);
    assert.equal(shell.disposed, true);
    assert.equal(session.disposed, true);
    assert.equal(view.root, null);
    assert.equal(view.scene.input.enabled, true, 'Shutdown restores previous input ownership');
    assert.equal(loaded.document.getElementById('hud').style.display, 'none');
    for (const button of staleButtons) button.click();
    assert.equal(view.starts.length, 0, 'Detached controls cannot navigate');
    assert.equal(JSON.stringify(loaded.profile.loadPublicProfile()), saved, 'Detached controls cannot save');
  }
}

{
  [
    '抽卡',
    'gacha',
    '招募',
    'audition',
    'SSR',
    '星级',
    '稀有度',
    'rarity',
    '等级',
    '战力',
    'ATK',
    'DEF',
    'SPD',
    '升级',
    '突破',
    '装备',
    '养成',
    '好感',
    '已上阵',
    '已装备',
    '已获得',
    '未获得',
    '解锁',
    '领取',
    '奖励',
    'reward',
    'XP',
    '经验',
    '任务',
    'task',
    '红点',
    '签到',
    '邮件',
    '通票',
    '商店',
    'shop',
    '社交',
    'social',
    '后端',
    'backend',
    'analytics',
    'Stage 2',
    '头像',
    'avatar',
  ].forEach((token) => {
    const found = token === 'shop' ? /\bshop\b/i.test(idolRosterSource) : idolRosterSource.includes(token);
    assert.equal(found, false, `IdolRosterScene must not expose forbidden roster semantics: ${token}`);
  });
}

{
  assert.equal(mainSource.includes("import { IdolRosterScene } from './scenes/IdolRosterScene.js';"), true, 'main.js should register IdolRosterScene');
  assert.equal(
    mainSource.includes('scene: publicDemoScenes'),
    true,
    'IdolRosterScene should live in the validated public demo registry'
  );
  assert.equal(mainSource.includes("import { CharacterScene }"), false, 'Public runtime must not import legacy CharacterScene');
  assert.equal(mainSource.includes("import { StageScene }"), false, 'Public runtime must not import legacy StageScene');
}

{
  assert.equal(titleSource.includes('p88Stage15Practice'), true, 'Opening the roster must preserve the Stage 1.5 debug route needle');
  assert.equal(titleSource.includes('suppressDebugAutoStart'), true, 'Opening the roster must preserve debug auto-start suppression');
  assert.equal(titleSource.includes("query.has('debug')"), true, 'Opening the roster must preserve the debug query gate');
}


console.log('Roster DOM preview/confirmation, cross-navigation and shared shutdown: all assertions passed.');
