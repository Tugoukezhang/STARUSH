import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_CHAPTERS } from '../src/utils/publicCampaign.mjs';
import { loadScenes, plain } from './helpers/publicShellHarness.mjs';
import {createPublicShellSceneEntry} from '../src/utils/publicShellSceneEntry.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const titleSource = fs.readFileSync(path.join(projectRoot, 'src/scenes/TitleScene.js'), 'utf8');
const routeSceneSource = fs.readFileSync(path.join(projectRoot, 'src/scenes/TourRouteScene.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(projectRoot, 'src/main.js'), 'utf8');

{
  assert.equal((titleSource.match(/startMenuScene\('tour'/g) ?? []).length, 1);
  assert.match(routeSceneSource, /new PublicShellView\(this/);
  assert.match(routeSceneSource, /page: 'tour'/);
  assert.ok(routeSceneSource.includes("this._publicShell.startMenuScene('desk',{profile})"));
  assert.deepEqual(createPublicShellSceneEntry('desk'),{key:'TitleScene',data:{suppressDebugAutoStart:true}});
  assert.match(routeSceneSource, /keepBattleHudHiddenForScene\(this\)/);
  assert.doesNotMatch(routeSceneSource, /preloadP15TourRouteArtAssets|addP15VenueRecordCard|this\.load\.(image|audio)\(|this\.add\.(text|image)\(/);
  for (const token of ['p15IdolRosterArt', 'roster_member_row', 'p15ProductionDeskArt', 'p15SetlistCue', 'Setlist', 'setlist', '公演编排']) {
    assert.ok(!routeSceneSource.includes(token), token);
  }
}

{
  [
    'Stage 2',
    '下一关',
    '奖励',
    'reward',
    'XP',
    '任务',
    'task',
    '红点',
    '商店',
    'shop',
    '抽卡',
    'gacha',
    '后端',
    'social',
    'backend',
    'analytics',
    'tilemap',
    'pathfinding',
    'collision',
    'walkable',
    'StageScene',
    'CharacterScene',
    'BattleScene',
  ].forEach((token) => {
    const found = token === 'shop' ? /\bshop\b/i.test(routeSceneSource) : routeSceneSource.includes(token);
    assert.equal(found, false, `route surface must not expose forbidden token: ${token}`);
  });
}

{
  assert.equal(mainSource.includes("import { TourRouteScene } from './scenes/TourRouteScene.js';"), true);
  assert.equal(
    mainSource.includes('scene: publicDemoScenes'),
    true,
    'route scene should remain in the validated public demo registry'
  );
  assert.equal(mainSource.includes("import { CharacterScene }"), false, 'Public runtime must not import legacy CharacterScene');
  assert.equal(mainSource.includes("import { StageScene }"), false, 'Public runtime must not import legacy StageScene');
}

{
  ['p88Stage15Practice', 'suppressDebugAutoStart', "query.has('debug')"].forEach((needle) => {
    assert.equal(titleSource.includes(needle), true, `title contract preserved: ${needle}`);
  });
}

{
  assert.deepEqual(PUBLIC_CHAPTERS.map(({ id, name }) => [id, name]), [
    ['opening', '星光初演'], ['neon', '霓虹街口'], ['encore', '终场合奏'],
  ]);
  for (let clearCount = 0; clearCount <= 3; clearCount += 1) {
    const loaded = loadScenes();
    const cleared = PUBLIC_CHAPTERS.slice(0, clearCount).map(chapter => chapter.id);
    const selected = PUBLIC_CHAPTERS[Math.min(clearCount, 2)];
    loaded.seed(cleared, selected.id);
    const view = loaded.harness(loaded.TourRouteScene);
    view.scene.create();
    assert.equal(view.root.dataset.page, 'tour');
    assert.equal(view.root.getAttribute('aria-label'), '巡演路线');
    assert.equal(view.all('button[data-chapter]').length, 3);
    assert.equal(view.all('button[aria-pressed=true]').length, 1);
    assert.equal(view.all('img').filter(img=>!RUNTIME_PAYLOAD.some(row=>row.group==='owner-ui'&&row.file===img.src)).length, 0);
    assert.equal(view.query('[data-chapter="' + selected.id + '"]').getAttribute('aria-pressed'), 'true');
    assert.ok(view.text.includes(clearCount === 3 ? '全程已通关' : '已通关 ' + clearCount + ' / 3'));
    const model = loaded.model();
    for (const [index, chapter] of PUBLIC_CHAPTERS.entries()) {
      const button = view.query('[data-chapter="' + chapter.id + '"]');
      const unlocked = index <= clearCount;
      assert.equal(button.disabled, !unlocked);
      assert.equal(model.chapters[index].unlocked, unlocked);
      assert.equal(model.chapters[index].cleared, index < clearCount);
      for (const text of [chapter.name, chapter.subtitle]) assert.ok(button.textContent.includes(text), text);
      assert.ok(button.getAttribute('aria-label').includes(!unlocked ? '未解锁' : index < clearCount ? '已通关' : '可挑战'));
      if (!unlocked) {
        button.click();
        assert.equal(view.scene._publicShell.selection.chapterId, selected.id);
      }
    }
    for (const copy of ['下一站资料整理中', '舞台练习正在准备中', '路线节点会随制作台进度继续补全',
      '公演记录：星光初演', '后续巡演资料整理中', '场馆资料只读整理中']) assert.ok(!view.text.includes(copy));
    assert.equal(view.starts.length, 0);
    view.shutdown();
  }
}

{
  for (const chapter of PUBLIC_CHAPTERS) {
    const loaded = loadScenes();
    loaded.seed(['opening', 'neon', 'encore']);
    const view = loaded.harness(loaded.TourRouteScene);
    view.scene.create();
    view.click('[data-chapter="' + chapter.id + '"]');
    assert.equal(loaded.profile.getPublicCampaignProgress().selectedChapterId, 'opening', 'Preview alone is not a save');
    view.scene.scene.start = (...args) => {
      assert.equal(loaded.profile.getPublicCampaignProgress().selectedChapterId, chapter.id);
      view.starts.push(args);
    };
    const confirm = view.click('[data-action=confirm-chapter]');
    confirm.click();
    assert.deepEqual(plain(view.starts), [['TitleScene', { suppressDebugAutoStart: true }]]);
    view.shutdown();
    const reopened = loadScenes({ storage: loaded.storage });
    const next = reopened.harness(reopened.TourRouteScene);
    next.scene.create();
    assert.equal(next.query('[data-chapter="' + chapter.id + '"]').getAttribute('aria-pressed'), 'true');
    next.shutdown();
  }
}

{
  for (const [selector, route] of [['[data-action=back]', 'TitleScene'], ['[data-nav=desk]', 'TitleScene'], ['[data-nav=roster]', 'IdolRosterScene']]) {
    const loaded = loadScenes();
    loaded.seed(['opening', 'neon'], 'neon');
    const view = loaded.harness(loaded.TourRouteScene);
    view.scene.create();
    view.click('[data-chapter=encore]');
    view.click(selector);
    assert.deepEqual(plain(view.starts), [[route, { suppressDebugAutoStart: true }]]);
    assert.equal(loaded.profile.getPublicCampaignProgress().selectedChapterId, 'neon', 'Back/cross-navigation cancels chapter preview');
    view.shutdown();
  }
  const loaded = loadScenes();
  loaded.seed(['opening', 'neon'], 'neon');
  const view = loaded.harness(loaded.TourRouteScene);
  view.scene.create();
  const stale = view.query('[data-chapter=encore]');
  loaded.seed([], 'opening');
  stale.click();
  assert.equal(view.scene._publicShell.selection.chapterId, 'neon', 'Preview rechecks unlock before accepting a stale button');
  view.click('[data-action=confirm-chapter]');
  assert.equal(view.starts.length, 0, 'Stale selection cannot pass confirmation');
  assert.equal(loaded.profile.getPublicCampaignProgress().selectedChapterId, 'opening');
  assert.equal(loaded.profile.selectPublicChapter('neon').campaign.selectedChapterId, 'opening');
  view.shutdown();
}

console.log('Tour DOM finite campaign selection, preview cancellation and stale unlock protection: all assertions passed.');
