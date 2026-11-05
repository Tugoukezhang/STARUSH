import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadScenes, plain } from './helpers/publicShellHarness.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';

const build = (loaded, query = '') => loaded.TitleScene.prototype._buildRecommendedBattleData.call({}, new URLSearchParams(query));

test('public builder follows all five selected identities without historical stat or form drift', () => {
  const loaded = loadScenes();
  const baseline = build(loaded);
  const baselineStats = loaded.characters.calcStats(loaded.characters.CHARACTERS.find((member) => member.id === 'sakura'), 1);
  assert.equal(baseline.atk, baselineStats.atk);
  for (const performer of loaded.progression.PUBLIC_PERFORMERS) {
    loaded.progression.selectPublicPerformer(performer.id);
    const data = build(loaded);
    assert.equal(data.performerId, performer.id);
    assert.equal(data.characterId, performer.id);
    assert.equal(data.team[0].id, performer.id);
    assert.equal(data.team[0].characterId, performer.id);
    assert.equal(data.name, performer.name);
    assert.equal(data.team[0].name, data.name);
    assert.equal(data.color, performer.color);
    assert.equal(data.team[0].color, data.color);
    const character = loaded.characters.CHARACTERS.find((member) => member.id === performer.id);
    assert.equal(data.colorHex, character.colorHex);
    assert.equal(data.team[0].colorHex, data.colorHex);
    assert.equal(data.atk, baseline.atk);
    assert.equal(data.team[0].atk, baseline.atk);
    assert.equal(data.team[0].form, baseline.team[0].form);
    for (const key of ['hp', 'baseHP', 'spd', 'moveSpeed', 'baseMoveSpeed']) {
      assert.equal(data[key], baseline[key], `${key} remains owned by the battle defaults`);
      assert.equal(data.team[0][key], baseline.team[0][key]);
    }
  }
});

test('missing storage retains default Sakura identity and attack', () => {
  const loaded = loadScenes({ storage: null });
  const data = build(loaded);
  assert.equal(data.performerId, 'sakura');
  assert.equal(data.color, 'pink');
  assert.equal(data.atk, 60);
});

test('every hidden guard combination is independent of public selection', () => {
  const loaded = loadScenes();
  const flags = ['p15ManualFocus', 'p15KaiPrototype', 'p15PerformanceHighPointArc',
    'p15SetlistCue', 'p15HostileProjectileExperiment', 'p15IntegratedActionComposition'];
  for (let mask = 0; mask < 64; mask += 1) {
    const query = 'debug&p88Stage15Practice=1' + flags.filter((_, index) => mask & (1 << index)).map((flag) => `&${flag}=1`).join('');
    loaded.progression.selectPublicPerformer('sakura');
    const expected = build(loaded, query);
    loaded.progression.selectPublicPerformer('enjo');
    const actual = build(loaded, query);
    assert.equal(actual.performerId, 'sakura', query);
    assert.equal(actual.practiceMode, true);
    assert.deepEqual(plain(actual), plain(expected), query);
    const [manual, kai, arc, setlist, hostile, integrated] = flags.map((_, index) => Boolean(mask & (1 << index)));
    assert.equal(actual.p15ManualFocusExperiment, manual);
    assert.equal(actual.p15KaiPrototypeExperiment, kai && !manual && !setlist);
    assert.equal(actual.p15SetlistCueExperiment, setlist);
    assert.equal(actual.p15HostileProjectileExperiment, hostile && !setlist);
    assert.equal(actual.p15PerformanceHighPointArcExperiment, arc && !manual && !kai && !setlist && !hostile);
    assert.equal(actual.p15IntegratedActionCompositionExperiment, integrated && !manual && !kai && !arc && !setlist && !hostile);
  }
});

test('result preview fixtures force Sakura only when the existing debug preview gate accepts them', () => {
  const loaded = loadScenes();
  for (const result of ['victory', 'clear', 'player-defeat', 'fail', 'defense-defeat', 'defense']) {
    loaded.progression.selectPublicPerformer('sakura');
    const query = `debug&p43ResultPreview=${result}`;
    const expected = build(loaded, query);
    loaded.progression.selectPublicPerformer('kai');
    const actual = build(loaded, query);
    assert.equal(actual.performerId, 'sakura');
    assert.deepEqual(plain(actual), plain(expected));
  }
  for (const query of ['', 'debug', 'p43ResultPreview=victory', 'debug&p43ResultPreview=invalid',
    'p88Stage15Practice=1&p15KaiPrototype=1', 'debug&p15KaiPrototype=1']) {
    const actual = build(loaded, query);
    assert.equal(actual.performerId, 'kai', query);
    assert.equal(actual.practiceMode, false);
    assert.equal(actual.p15KaiPrototypeExperiment, false);
  }
});

test('ordinary DOM desk after a hidden return shows the saved public member and starts a public run', () => {
  const loaded = loadScenes({ search: '?debug&p88Stage15Practice=1&p15KaiPrototype=1' });
  for (const performer of loaded.progression.PUBLIC_PERFORMERS) {
    loaded.progression.selectPublicPerformer(performer.id);
    const view = loaded.harness(loaded.TitleScene);
    view.scene.create();
    assert.equal(view.root.dataset.page, 'desk');
    assert.equal(view.starts.length, 0);
    assert.ok(view.text.includes(performer.name));
    assert.ok(view.text.includes(performer.actionName));
    assert.equal(view.query('.lobby-member-visual').dataset.performer,performer.id);
    assert.match(view.query('.lobby-character').src,new RegExp(`${performer.id}-portrait\\.webp$`));
    view.click('[data-action=start]');
    assert.equal(view.starts[0][0], 'BattleScene');
    assert.equal(view.starts[0][1].performerId, performer.id);
    assert.equal(view.starts[0][1].practiceMode, false);
    assert.equal(view.nodes.length, 0, 'No retired canvas identity plate or underbar');
    view.shutdown();
  }
});

test('roster offers all five semantic preview buttons and shows the actual selected action', () => {
  const loaded = loadScenes();
  loaded.progression.selectPublicPerformer('genya');
  const view = loaded.harness(loaded.IdolRosterScene);
  view.scene.create();
  assert.equal(view.root.dataset.page, 'roster');
  assert.equal(view.all('button[data-member]').length, 5);
  assert.equal(view.all('img').filter(img=>!RUNTIME_PAYLOAD.some(row=>row.group==='owner-ui'&&row.file===img.src)).length, 6, 'Five reviewed portraits plus current preview; menu art counted separately');
  const saved = JSON.stringify(loaded.progression.loadPublicProfile());
  for (const performer of loaded.progression.PUBLIC_PERFORMERS) {
    const button = view.query('[data-member="' + performer.id + '"]');
    assert.equal(button.getAttribute('aria-label'), performer.name);
    view.click('[data-member="' + performer.id + '"]');
    assert.equal(view.query('.member-mark-large').querySelector('img').src, 'art/five-q-ui-20261013/'+performer.id+'-portrait.webp');
    assert.equal(view.query('[data-member="' + performer.id + '"]').getAttribute('aria-pressed'), 'true');
    assert.equal(view.all('button[aria-pressed=true]').length, 1);
    for (const copy of [performer.name, performer.actionName, performer.actionSummary]) assert.ok(view.text.includes(copy), copy);
    assert.equal(JSON.stringify(loaded.progression.loadPublicProfile()), saved, 'Preview does not save');
    assert.equal(view.starts.length, 0, 'Preview does not navigate');
  }
  view.shutdown();
});

test('explicit member confirmation saves before returning, survives reload and ignores double clicks', () => {
  const loaded = loadScenes();
  for (const performer of loaded.progression.PUBLIC_PERFORMERS) {
    const view = loaded.harness(loaded.IdolRosterScene);
    view.scene.scene.start = (...args) => {
      assert.equal(loaded.progression.loadPublicProfile().selectedId, performer.id, 'Save before navigation');
      view.starts.push(args);
    };
    view.scene.create();
    view.click('[data-member="' + performer.id + '"]');
    const confirm = view.click('[data-action=confirm-member]');
    confirm.click();
    assert.deepEqual(plain(view.starts), [['TitleScene', { suppressDebugAutoStart: true }]]);
    assert.equal(build(loadScenes({ storage: loaded.storage })).performerId, performer.id);
    view.shutdown();
  }
});

test('roster back cancels a different preview and leaves the saved member unchanged', () => {
  for (const back of ['[data-action=back]', '[data-nav=desk]']) {
    const loaded = loadScenes();
    loaded.progression.selectPublicPerformer('venus');
    const view = loaded.harness(loaded.IdolRosterScene);
    view.scene.create();
    view.click('[data-member=kai]');
    view.click(back);
    assert.equal(loaded.progression.loadPublicProfile().selectedId, 'venus');
    assert.deepEqual(plain(view.starts), [['TitleScene', { suppressDebugAutoStart: true }]]);
    view.shutdown();
    const reopened = loaded.harness(loaded.IdolRosterScene);
    reopened.scene.create();
    assert.equal(reopened.query('[data-member=venus]').getAttribute('aria-pressed'), 'true');
    reopened.shutdown();
  }
});

test('shared model retains actual durable clear count independently of chapter unlock and member previews', () => {
  const loaded = loadScenes();
  const profile = loaded.progression.selectPublicPerformer('venus');
  const saved = { ...profile, clears: 7, attempts: 9,
    clearsByPerformer: { sakura: 2, kai: 1, venus: 4, genya: 0, enjo: 0 } };
  loaded.storage.setItem(loaded.progression.PUBLIC_PROFILE_STORAGE_KEY, JSON.stringify(saved));
  for (const Scene of [loaded.TitleScene, loaded.IdolRosterScene]) {
    const view = loaded.harness(Scene);
    view.scene.create();
    assert.equal(loaded.model().clears, 7);
    assert.equal(loaded.model().clearedCount, 0, 'Historical total clears do not forge campaign completion');
    assert.ok(!/领取|奖励|商店|抽卡/.test(view.text));
    view.shutdown();
  }
});

test('corrupt saves retain a trusted session member; cold or unknown selections fall back safely', () => {
  for (const corrupt of [true, false]) {
    const loaded = loadScenes();
    const profile = loaded.progression.selectPublicPerformer('enjo');
    loaded.storage.setItem(loaded.progression.PUBLIC_PROFILE_STORAGE_KEY,
      corrupt ? '{invalid' : JSON.stringify({ ...profile, selectedId: 'unknown' }));
    assert.equal(build(loaded).performerId, corrupt ? 'enjo' : 'sakura');
    assert.equal(build(loadScenes({ storage: loaded.storage })).performerId, 'sakura', 'Cold corrupt data has no trusted cached identity');
    const view = loaded.harness(loaded.IdolRosterScene);
    view.scene.create();
    assert.equal(view.all('button[data-member]').length, 5);
    assert.equal(view.all('button[aria-pressed=true]').length, 1);
    assert.equal(view.query('[data-member="' + (corrupt ? 'enjo' : 'sakura') + '"]').getAttribute('aria-pressed'), 'true');
    view.shutdown();
  }
});

console.log('P16-039: real scene/view/profile APIs with DOM events; no browser or pixel QA.');
