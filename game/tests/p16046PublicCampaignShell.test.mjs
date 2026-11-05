import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadScenes, plain } from './helpers/publicShellHarness.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';

const build = (loaded, query = '') => loaded.TitleScene.prototype._buildRecommendedBattleData.call({}, new URLSearchParams(query));

test('desk renders chapter name and start as distinct DOM elements without a legacy CTA bitmap', () => {
  const loaded = loadScenes();
  for (const chapter of loaded.campaign.PUBLIC_CHAPTERS) {
    loaded.seed(['opening', 'neon', 'encore'], chapter.id);
    const view = loaded.harness(loaded.TitleScene);
    view.scene.create();
    assert.equal(view.query('h2').textContent, chapter.name);
    assert.equal(view.query('[data-action=start]').tagName, 'BUTTON');
    assert.equal(view.query('h2').contains(view.query('[data-action=start]')), false);
    const props=chapter.id==='opening'?loaded.loadRuntime('utils/oldStreetMap.mjs').OLD_STREET_PROPS
      :chapter.id==='neon'?loaded.loadRuntime('utils/neonStreetMap.mjs').NEON_STREET_PROPS:chapter.id==='raincheck'?loaded.loadRuntime('utils/rooftopMap.mjs').ROOFTOP_PROPS:loaded.loadRuntime('utils/harborStageMap.mjs').HARBOR_STAGE_PROPS;
    const base=chapter.id==='opening'?'art/street-perspective-20261009/':chapter.id==='neon'?'art/neon-cohesion-20261009/':'art/harbor-cohesion-20261009/';
    assert.equal(view.all('img').filter(img=>!RUNTIME_PAYLOAD.some(row=>row.group==='owner-ui'&&row.file===img.src)).length, props.length+2, 'Actual chapter layers and selected member; explicit UI background/icons counted separately');
    assert.equal(view.query('.shell-map-ground').src, chapter.id==='raincheck'?'art/rooftop-20261103/neutral.webp':`art/map-presentation-20261018/${chapter.id}-neutral.webp`);
    assert.match(view.query('.lobby-character').src, /five-q-ui-20261013\/sakura-portrait\.webp$/);
    assert.deepEqual(view.all('.shell-map-prop').map(img=>img.src),Array.from(props,p=>chapter.id==='opening'?loaded.loadRuntime('systems/StreetMaterialPresentation.mjs').oldStreetMaterialPath(p.materialVariant||p.art):chapter.id==='raincheck'&&p.art==='stage'?'art/roof-broadcast-20261103/stage.webp':`${base}${p.art}.webp`));
    assert.equal(view.nodes.length, 0);
    view.shutdown();
  }
});

test('actual title builder defaults to opening and keeps the existing stage engine and performer stats', () => {
  const loaded = loadScenes();
  assert.equal(build(loaded).campaignChapterId, 'opening');
  loaded.profile.selectPublicPerformer('kai');
  loaded.seed(['opening', 'neon'], 'encore');
  const route = build(loaded);
  assert.equal(route.campaignChapterId, 'encore');
  assert.equal(route.stageId, 1);
  assert.equal(route.stageName, loaded.campaign.getPublicChapter('encore').name);
  assert.equal(route.performerId, 'kai');
  assert.equal(route.team[0].characterId, 'kai');
  assert.equal(route.atk, 60);
  assert.equal(route.practiceMode, false);
});


test('title CTA rereads the current unlocked chapter after the title was created', () => {
  const loaded = loadScenes({ search: '?debug&p88Stage15Practice=1' });
  loaded.seed(['opening', 'neon'], 'neon');
  const view = loaded.harness(loaded.TitleScene);
  view.scene.create();
  assert.equal(view.query('h2').textContent, loaded.campaign.getPublicChapter('neon').name);
  loaded.profile.selectPublicChapter('encore');
  view.click('[data-action=start]');
  assert.equal(view.starts.length, 1);
  assert.equal(view.starts[0][0], 'BattleScene');
  assert.equal(view.starts[0][1].campaignChapterId, 'encore');
  assert.equal(view.starts[0][1].practiceMode, false);
  view.shutdown();
});

test('desk and model reflect four chapter states and finite completion without a fifth chapter', () => {
  const loaded = loadScenes();
  loaded.seed(['opening'], 'neon');
  let view = loaded.harness(loaded.TitleScene);
  view.scene.create();
  for (const chapter of loaded.campaign.PUBLIC_CHAPTERS) assert.ok(view.text.includes(chapter.name));
  assert.deepEqual(plain(loaded.model().chapters.map(c => [c.id, c.selected, c.unlocked, c.cleared])), [
    ['opening', false, true, true], ['neon', true, true, false], ['encore', false, false, false], ['raincheck',false,false,false],
  ]);
  assert.equal(view.all('.shell-progress-step').length, 4);
  assert.equal(view.all('.is-current').length, 1);
  assert.equal(view.all('.is-cleared').length, 1);
  view.shutdown();
  loaded.seed(['opening', 'neon', 'encore', 'raincheck'], 'raincheck');
  view = loaded.harness(loaded.TitleScene);
  view.scene.create();
  assert.ok(view.text.includes('巡演已完成'));
  assert.equal(view.all('.is-cleared').length, 4);
  assert.equal(loaded.model().completed, true);
  assert.equal(loaded.campaign.PUBLIC_CHAPTERS.length, 4);
  view.shutdown();
});

test('hidden practice combinations and diagnostic previews always use opening and preserve every guard', () => {
  const loaded = loadScenes();
  loaded.seed(['opening', 'neon'], 'encore');
  loaded.profile.selectPublicPerformer('enjo');
  const flags = ['p15ManualFocus', 'p15KaiPrototype', 'p15PerformanceHighPointArc',
    'p15SetlistCue', 'p15HostileProjectileExperiment', 'p15IntegratedActionComposition'];
  for (let mask = 0; mask < 64; mask += 1) {
    const query = 'debug&p88Stage15Practice=1' + flags.filter((_, i) => mask & (1 << i)).map((flag) => `&${flag}=1`).join('');
    const route = build(loaded, query);
    assert.equal(route.campaignChapterId, 'opening');
    assert.equal(route.performerId, 'sakura');
    assert.equal(route.stageId, 1);
    assert.equal(route.practiceMode, true);
    const [manual, kai, arc, setlist, hostile, integrated] = flags.map((_, i) => Boolean(mask & (1 << i)));
    assert.equal(route.p15ManualFocusExperiment, manual);
    assert.equal(route.p15KaiPrototypeExperiment, kai && !manual && !setlist);
    assert.equal(route.p15SetlistCueExperiment, setlist);
    assert.equal(route.p15HostileProjectileExperiment, hostile && !setlist);
    assert.equal(route.p15PerformanceHighPointArcExperiment, arc && !manual && !kai && !setlist && !hostile);
    assert.equal(route.p15IntegratedActionCompositionExperiment, integrated && !manual && !kai && !arc && !setlist && !hostile);
    assert.equal(route.p15PerformerPrototypeId, route.p15KaiPrototypeExperiment || route.p15IntegratedActionCompositionExperiment ? 'kai' : null);
  }
  for (const result of ['victory', 'clear', 'player-defeat', 'fail', 'defense-defeat', 'defense']) {
    const route = build(loaded, `debug&p43ResultPreview=${result}`);
    assert.equal(route.campaignChapterId, 'opening');
    assert.equal(route.performerId, 'sakura');
    assert.ok(route.p43ResultPreview);
  }
  for (const query of ['debug', 'p88Stage15Practice=1', 'p43ResultPreview=victory', 'debug&p43ResultPreview=invalid']) {
    assert.equal(build(loaded, query).campaignChapterId, 'encore');
  }
});


test('tour disables locked chapter buttons and ignores both normal and synthetic clicks', () => {
  const loaded = loadScenes();
  const view = loaded.harness(loaded.TourRouteScene);
  view.scene.create();
  const rows = view.all('button[data-chapter]');
  assert.equal(rows.length, 4);
  assert.equal(rows[0].disabled, false);
  for (const row of rows.slice(1)) {
    assert.equal(row.disabled, true);
    assert.ok(row.getAttribute('aria-label').includes('未解锁'));
    row.click();
    row.dispatchEvent({ type: 'click', bubbles: true });
  }
  assert.equal(view.starts.length, 0);
  assert.equal(view.scene._publicShell.selection.chapterId, 'opening');
  assert.equal(loaded.profile.getPublicCampaignProgress().selectedChapterId, 'opening');
  view.shutdown();
});

test('tour preview is unsaved until explicit confirmation, which saves once before returning and survives reload', () => {
  const loaded = loadScenes();
  for (const chapter of loaded.campaign.PUBLIC_CHAPTERS) {
    loaded.seed(['opening', 'neon', 'encore'], 'opening');
    const view = loaded.harness(loaded.TourRouteScene);
    view.scene.scene.start = (...args) => {
      assert.equal(loaded.profile.getPublicCampaignProgress().selectedChapterId, chapter.id);
      view.starts.push(args);
    };
    view.scene.create();
    view.click('[data-chapter="' + chapter.id + '"]');
    assert.equal(loaded.profile.getPublicCampaignProgress().selectedChapterId, 'opening');
    assert.equal(view.starts.length, 0);
    assert.equal(view.query('[data-chapter="' + chapter.id + '"]').getAttribute('aria-pressed'), 'true');
    const confirm = view.click('[data-action=confirm-chapter]');
    confirm.click();
    assert.deepEqual(plain(view.starts), [['TitleScene', { suppressDebugAutoStart: true }]]);
    assert.equal(build(loadScenes({ storage: loaded.storage })).campaignChapterId, chapter.id);
    view.shutdown();
  }
});

test('tour confirmation rechecks stale unlocks, resets invalid preview and back never changes chapter', () => {
  const loaded = loadScenes();
  loaded.seed(['opening', 'neon'], 'neon');
  const view = loaded.harness(loaded.TourRouteScene);
  view.scene.create();
  view.click('[data-chapter=encore]');
  assert.equal(view.scene._publicShell.selection.chapterId, 'encore');
  loaded.seed([], 'opening');
  view.click('[data-action=confirm-chapter]');
  assert.equal(view.starts.length, 0, 'An earned preview cannot bypass a later lock');
  assert.equal(loaded.profile.getPublicCampaignProgress().selectedChapterId, 'opening');
  assert.equal(view.query('[data-chapter=encore]').disabled, true);
  view.click('[data-nav=desk]');
  assert.deepEqual(plain(view.starts), [['TitleScene', { suppressDebugAutoStart: true }]]);
  assert.equal(loaded.profile.getPublicCampaignProgress().selectedChapterId, 'opening');
  view.shutdown();
});

test('tour uses semantic chapter labels with no legacy bitmap or canvas hit rectangles', () => {
  const loaded = loadScenes();
  const view = loaded.harness(loaded.TourRouteScene);
  view.scene.create();
  assert.equal(view.root.dataset.page, 'tour');
  assert.equal(view.all('img').filter(img=>!RUNTIME_PAYLOAD.some(row=>row.group==='owner-ui'&&row.file===img.src)).length, 0);
  assert.equal(view.nodes.length, 0);
  for (const chapter of loaded.campaign.PUBLIC_CHAPTERS) {
    const button = view.query('[data-chapter="' + chapter.id + '"]');
    for (const label of [chapter.name, chapter.subtitle]) assert.ok(button.textContent.includes(label), label);
    assert.ok(button.getAttribute('aria-label').includes(chapter.name));
  }
  assert.equal(view.all('button[aria-pressed=true]').length, 1);
  view.shutdown();
});

test('obsolete title replay teaser is absent in every chapter but builder session metadata survives unchanged', () => {
  const loaded = loadScenes();
  loaded.bridge.writeP15Stage1ClearCount(1);
  loaded.objectives.writeP47Stage1ReplayObjectiveIndex(1);
  const objective = loaded.objectives.getStage1ReplayObjectiveTitleLine({ stageId: 1, stage1ClearCount: 1, stage1ReplayObjectiveIndex: 1 });
  assert.ok(objective);
  for (const chapter of loaded.campaign.PUBLIC_CHAPTERS) {
    loaded.seed(['opening', 'neon', 'encore'], chapter.id);
    const view = loaded.harness(loaded.TitleScene);
    view.scene.create();
    assert.ok(!view.text.includes(objective));
    assert.ok(!view.text.includes('舞台练习正在准备中'));
    const data = build(loaded);
    assert.equal(data.p15Stage1ClearCount, 1, 'Builder keeps raw session metadata; Battle owns chapter isolation');
    assert.equal(data.p47Stage1ReplayObjectiveIndex, 1);
    assert.equal(loaded.bridge.readP15Stage1ClearCount(), 1, 'Browsing chapters must not advance replay counters');
    assert.equal(loaded.objectives.readP47Stage1ReplayObjectiveIndex(), 1);
    view.shutdown();
  }
});

console.log('P16-046: real scene/view/campaign/profile APIs with DOM events; no browser or pixel QA.');
