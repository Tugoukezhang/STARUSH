import assert from 'node:assert/strict';
import { getP43ResultPreviewFromQuery, withP43ResultPreviewBattleData } from '../src/utils/p43ResultPreview.mjs';
import { getPublicPerformer, loadPublicProfile, getPublicCampaignProgress, resolvePublicChapterId } from '../src/utils/publicRunProgression.mjs';
import { getPublicChapter } from '../src/utils/publicCampaign.mjs';
import { getPreparationSnapshot } from '../src/utils/publicPreparation.mjs';
import { readFileSync } from 'node:fs';
import { resolveStageWaveDefs } from '../src/utils/stageWaves.mjs';

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

const titleSceneSource = readSource('../src/scenes/TitleScene.js');
const battleSceneSource = readSource('../src/scenes/BattleScene.js');
const mainSource = readSource('../src/main.js');
const stageWavesSource = readSource('../src/utils/stageWaves.mjs');
const waveSystemSource = readSource('../src/systems/WaveSystem.js');
const battleResultSource = readSource('../src/utils/battleResult.mjs');

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

function compileClassMethod(block, methodName, globals = {}) {
  const names = Object.keys(globals);
  const values = Object.values(globals);
  return Function(
    ...names,
    `"use strict"; return ({${block.trim()}}).${methodName};`
  )(...values);
}

const titleBuilderBlock = sourceBlock(
  titleSceneSource,
  '  _buildRecommendedBattleData(query',
  '\n}'
);
const buildRecommendedBattleData = compileClassMethod(
  titleBuilderBlock,
  '_buildRecommendedBattleData',
  {
    CHARACTERS: [{
      id: 'sakura',
      name: 'Sakura',
      color: 'pink',
      colorHex: '#FF69B4',
      forms: [{ type: 'attack', name: 'Lead' }],
    }],
    calcStats: () => ({ atk: 60 }),
    getUnlockedForms: (character) => character.forms,
    getStageById: () => ({ id: 1, name: 'Stage 1', waves: 2 }),
    readP15Stage1ClearCount: () => 0,
    readP47Stage1ReplayObjectiveIndex: () => 0,
    getP43ResultPreviewFromQuery,
    withP43ResultPreviewBattleData,
    getPublicPerformer,
    getPublicCampaignProgress,
    resolvePublicChapterId,
    getPublicChapter,
    getPreparationSnapshot,
    loadPublicProfile: () => loadPublicProfile(null),
  }
);

function buildRoute(queryText) {
  return buildRecommendedBattleData.call({}, new URLSearchParams(queryText));
}

const standaloneFields = [
  'p15ManualFocusExperiment',
  'p15KaiPrototypeExperiment',
  'p15PerformanceHighPointArcExperiment',
  'p15SetlistCueExperiment',
  'p15HostileProjectileExperiment',
];

{
  const exact = buildRoute('?debug=&p88Stage15Practice=1&p15IntegratedActionComposition=1');
  assert.equal(exact.practiceMode, true, 'the exact composite route must stay hidden practice');
  assert.equal(
    exact.p15IntegratedActionCompositionExperiment,
    true,
    'the exact query must enable the integrated action composition field'
  );
  assert.equal(exact.p15PerformerPrototypeId, 'kai', 'the composite route must identify Kai');
  standaloneFields.forEach((field) => {
    assert.equal(exact[field], false, `the composite route must not synthesize ${field}`);
  });

  [
    '?p88Stage15Practice=1&p15IntegratedActionComposition=1',
    '?debug=&p15IntegratedActionComposition=1',
    '?debug=&p88Stage15Practice=1',
    '?debug=&p88Stage15Practice=1&p15IntegratedActionComposition=0',
  ].forEach((queryText) => {
    assert.equal(
      buildRoute(queryText).p15IntegratedActionCompositionExperiment,
      false,
      `composite route should fail closed for: ${queryText}`
    );
  });

  const conflicts = [
    ['p15ManualFocus=1', 'p15ManualFocusExperiment', null],
    ['p15KaiPrototype=1', 'p15KaiPrototypeExperiment', 'kai'],
    ['p15PerformanceHighPointArc=1', 'p15PerformanceHighPointArcExperiment', null],
    ['p15SetlistCue=1', 'p15SetlistCueExperiment', null],
    ['p15HostileProjectileExperiment=1', 'p15HostileProjectileExperiment', null],
  ];
  conflicts.forEach(([queryPart, field, performerId]) => {
    const route = buildRoute(
      `?debug=&p88Stage15Practice=1&p15IntegratedActionComposition=1&${queryPart}`
    );
    assert.equal(route[field], true, `${field} should retain its standalone route`);
    assert.equal(
      route.p15IntegratedActionCompositionExperiment,
      false,
      `composite route should reject conflict: ${queryPart}`
    );
    assert.equal(route.p15PerformerPrototypeId, performerId);
  });

  const standaloneRoutes = [
    ['p15ManualFocus=1', 'p15ManualFocusExperiment', null],
    ['p15KaiPrototype=1', 'p15KaiPrototypeExperiment', 'kai'],
    ['p15PerformanceHighPointArc=1', 'p15PerformanceHighPointArcExperiment', null],
    ['p15SetlistCue=1', 'p15SetlistCueExperiment', null],
    ['p15HostileProjectileExperiment=1', 'p15HostileProjectileExperiment', null],
  ];
  standaloneRoutes.forEach(([queryPart, field, performerId]) => {
    const route = buildRoute(`?debug=&p88Stage15Practice=1&${queryPart}`);
    assert.equal(route[field], true, `${field} standalone diagnostic route must remain active`);
    assert.equal(route.p15IntegratedActionCompositionExperiment, false);
    assert.equal(route.p15PerformerPrototypeId, performerId);
  });
}

const compositeGuardBlock = sourceBlock(
  battleSceneSource,
  '  _isP15IntegratedActionCompositionExperimentEnabled() {',
  '  _isP15PerformanceHighPointArcExperimentEnabled() {'
);
const isCompositeEnabled = compileClassMethod(
  compositeGuardBlock,
  '_isP15IntegratedActionCompositionExperimentEnabled'
);
const arcGuardBlock = sourceBlock(
  battleSceneSource,
  '  _isP15PerformanceHighPointArcExperimentEnabled() {',
  '  _resolveP15PerformanceHighPointArcWaveLabel('
);
const isArcEnabled = compileClassMethod(
  arcGuardBlock,
  '_isP15PerformanceHighPointArcExperimentEnabled'
);
const arcResolverBlock = sourceBlock(
  battleSceneSource,
  '  _resolveP15PerformanceHighPointArcWaveLabel(',
  '  _isP15KaiPrototypeEnabled() {'
);
const arcLabels = Object.freeze(['热身', '移动压力', '聚焦舞台', '高光窗口']);
const resolveArcLabel = compileClassMethod(
  arcResolverBlock,
  '_resolveP15PerformanceHighPointArcWaveLabel',
  { P15_240_PERFORMANCE_HIGH_POINT_ARC_LABELS: arcLabels }
);
const kaiGuardBlock = sourceBlock(
  battleSceneSource,
  '  _isP15KaiPrototypeEnabled() {',
  '  _shouldShowP15SetlistCueAfterWarmup('
);
const isKaiEnabled = compileClassMethod(kaiGuardBlock, '_isP15KaiPrototypeEnabled');
const manualGuardBlock = sourceBlock(
  battleSceneSource,
  '  _isP15ManualFocusExperimentEnabled() {',
  '  _isP15ManualFocusEligibleEnemy(enemy) {'
);
const isManualEnabled = compileClassMethod(
  manualGuardBlock,
  '_isP15ManualFocusExperimentEnabled'
);

function enabledCompositeBattleData(overrides = {}) {
  return {
    practiceMode: true,
    stageId: 1,
    p15IntegratedActionCompositionExperiment: true,
    p15PerformerPrototypeId: 'kai',
    p15ManualFocusExperiment: false,
    p15KaiPrototypeExperiment: false,
    p15PerformanceHighPointArcExperiment: false,
    p15SetlistCueExperiment: false,
    p15HostileProjectileExperiment: false,
    ...overrides,
  };
}

function makeCompositeScene(overrides = {}) {
  const battleData = enabledCompositeBattleData(overrides);
  return {
    battleData,
    _isStage15PracticeMode: () => battleData.practiceMode === true,
  };
}

{
  assert.equal(
    isCompositeEnabled.call(makeCompositeScene()),
    true,
    'the exact injected battle data should enable integrated composition'
  );
  [
    { practiceMode: false },
    { stageId: 2 },
    { p15IntegratedActionCompositionExperiment: false },
    { p15PerformerPrototypeId: null },
    { p15PerformerPrototypeId: 'sakura' },
    { p15ManualFocusExperiment: true },
    { p15KaiPrototypeExperiment: true },
    { p15PerformanceHighPointArcExperiment: true },
    { p15SetlistCueExperiment: true },
    { p15HostileProjectileExperiment: true },
  ].forEach((override) => {
    assert.equal(
      isCompositeEnabled.call(makeCompositeScene(override)),
      false,
      `composite guard should fail closed for: ${JSON.stringify(override)}`
    );
  });
}

{
  const compositeChildScene = {
    battleData: enabledCompositeBattleData(),
    _isStage15PracticeMode: () => true,
    _isP15IntegratedActionCompositionExperimentEnabled: () => true,
  };
  assert.equal(isManualEnabled.call(compositeChildScene), true, 'composite should expose Manual Focus');
  assert.equal(isKaiEnabled.call(compositeChildScene), true, 'composite should expose Kai Beat Step');
  assert.equal(isArcEnabled.call(compositeChildScene), true, 'composite should expose the four-label arc');

  assert.equal(isManualEnabled.call({
    battleData: { practiceMode: true, stageId: 1, p15ManualFocusExperiment: true },
  }), true, 'standalone Manual Focus must not require the composite helper fixture');
  assert.equal(isKaiEnabled.call({
    battleData: {
      practiceMode: true,
      stageId: 1,
      p15KaiPrototypeExperiment: true,
      p15PerformerPrototypeId: 'kai',
      p15ManualFocusExperiment: false,
      p15SetlistCueExperiment: false,
    },
  }), true, 'standalone Kai must not require the composite helper fixture');
  assert.equal(isArcEnabled.call({
    battleData: {
      practiceMode: true,
      stageId: 1,
      p15PerformanceHighPointArcExperiment: true,
      p15ManualFocusExperiment: false,
      p15KaiPrototypeExperiment: false,
      p15SetlistCueExperiment: false,
      p15HostileProjectileExperiment: false,
    },
    _isStage15PracticeMode: () => true,
  }), true, 'standalone arc must not require the composite helper fixture');

  assert.equal(isManualEnabled.call({ battleData: { practiceMode: false } }), false);
  assert.equal(isKaiEnabled.call({ battleData: { practiceMode: true, stageId: 1 } }), false);
  assert.equal(isArcEnabled.call({
    battleData: { practiceMode: true, stageId: 1 },
    _isStage15PracticeMode: () => true,
  }), false, 'ordinary hidden practice must remain inactive');
}

{
  const compositeScene = makeCompositeScene();
  compositeScene._isP15IntegratedActionCompositionExperimentEnabled = () => (
    isCompositeEnabled.call(compositeScene)
  );
  compositeScene._isP15PerformanceHighPointArcExperimentEnabled = () => (
    isArcEnabled.call(compositeScene)
  );
  arcLabels.forEach((expected, index) => {
    assert.equal(
      resolveArcLabel.call(compositeScene, index, `Practice ${index + 1}`),
      expected,
      `composite wave ${index} should retain the accepted ${expected} label`
    );
  });
  assert.equal(resolveArcLabel.call(compositeScene, 4, 'fallback'), 'fallback');
}

{
  const waveDefs = Array.from({ length: 4 }, (_, index) => ({
    wave: index + 1,
    label: `Wave ${index + 1}`,
    interval: 1200,
    enemies: [{ type: 'trainee', count: 4 }],
  }));
  const getStageById = () => ({ id: 1, name: 'Stage 1', waves: 2 });
  const normalDefs = resolveStageWaveDefs({
    battleData: { stageId: 1, practiceMode: false },
    waveDefs,
    getStageById,
  });
  const practiceDefs = resolveStageWaveDefs({
    battleData: enabledCompositeBattleData(),
    waveDefs,
    getStageById,
  });

  assert.deepEqual(normalDefs, [], 'public Stage 1 uses the paint round');
  assert.equal(practiceDefs.length, 4, 'the composite must remain four practice waves');
  assert.deepEqual(practiceDefs.map((def) => def.interval), [3000, 2200, 500, 2200]);
  assert.deepEqual(practiceDefs.map((def) => def.minActiveMs), [9000, 12000, 8000, 10000]);
  assert.deepEqual(
    practiceDefs.map((def) => def.enemies.map(({ type, count }) => ({ type, count }))),
    [
      [{ type: 'trainee', count: 2 }],
      [{ type: 'stage15DriftingLightstick', count: 2 }],
      [{ type: 'trainee', count: 1 }, { type: 'stage15StageMarkerTarget', count: 1 }],
      [{ type: 'stage1PracticeTarget', count: 1 }],
    ]
  );

  const allClearBlock = sourceBlock(
    battleSceneSource,
    '  _onAllWavesClear() {',
    '  _onJarDefeat() {'
  );
  assert.ok(allClearBlock.includes('_endBattle(BATTLE_RESULT_TYPES.VICTORY)'));
}

{
  const configBlock = sourceBlock(mainSource, 'const config = {', '\n};');
  assert.match(configBlock, /input\s*:\s*{\s*activePointers\s*:\s*2\s*,?\s*}/);
  assert.equal(mainSource.includes('this.input.addPointer('), false);
  assert.equal(battleSceneSource.includes('this.input.addPointer('), false);

  const setupInputBlock = sourceBlock(
    battleSceneSource,
    '  _setupInput() {',
    '  _setupMobileControls() {'
  );
  assert.ok(setupInputBlock.includes('_touchMovePointerId'));
  assert.ok(setupInputBlock.includes('_endTouchMovement(pointer)'));

  const buttonBlock = sourceBlock(
    battleSceneSource,
    '  _createMobileButton(x, y, color, onTap, key) {',
    '  _setMobileButtonPressed(control, pressed) {'
  );
  assert.ok(buttonBlock.includes('event?.stopPropagation'));

  const focusInputBlock = sourceBlock(
    battleSceneSource,
    '  _bindP15ManualFocusTargetInput(enemy) {',
    '  _selectP15ManualFocusTarget(enemy) {'
  );
  assert.ok(focusInputBlock.includes('event?.stopPropagation'));

  const selectBlock = sourceBlock(
    battleSceneSource,
    '  _selectAutoAimTarget() {',
    '  _tryShoot(time) {'
  );
  assert.ok(
    selectBlock.indexOf('_getValidP15ManualFocusTarget()')
      < selectBlock.indexOf('STAGE_15_STAGE_MARKER_TARGET_TYPE'),
    'manual target must remain ahead of Stage Marker auto-priority'
  );

  const updateBlock = sourceBlock(
    battleSceneSource,
    '  update(time, delta) {',
    '  _onPlayerDeath() {'
  );
  const resolveIndex = updateBlock.indexOf('_resolveP15KaiBeatStepVelocity(vx, vy, delta)');
  const velocityIndex = updateBlock.indexOf('this.player.body.setVelocity(');
  const shootIndex = updateBlock.indexOf('this._tryShoot(time)');
  assert.ok(resolveIndex >= 0 && velocityIndex > resolveIndex && shootIndex > velocityIndex);
}

{
  const shutdownBlock = sourceBlock(
    battleSceneSource,
    "this.events.once('shutdown', () => {",
    '    });'
  );
  const endBattleBlock = sourceBlock(
    battleSceneSource,
    '  _endBattle(type) {',
    '  _showP43ResultPreview(preview) {'
  );
  const actionBlock = sourceBlock(
    battleSceneSource,
    '  _handleBattleResultAction(action) {',
    '  // ====================='
  );
  const releaseBlock = sourceBlock(
    battleSceneSource,
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );
  assert.ok(releaseBlock.includes('_clearMobileInputState()'));
  assert.ok(releaseBlock.includes('_clearP15ManualFocusTarget()'));
  assert.ok(releaseBlock.includes('_clearP15KaiPrototypeState()'));
  assert.ok(shutdownBlock.includes("_releaseBattleRuntimeObjects('shutdown')"));
  assert.ok(endBattleBlock.includes("_releaseBattleRuntimeObjects('battle-end')"));
  assert.ok(actionBlock.includes("_releaseBattleRuntimeObjects('result-retry')"));
  assert.ok(actionBlock.includes("_releaseBattleRuntimeObjects('result-title')"));
  assert.ok(actionBlock.includes('this.scene.restart(this.battleData || {})'));
  assert.ok(actionBlock.includes('suppressDebugAutoStart: this._isStage15PracticeMode() === true'));
}

{
  const titleCompositeBlock = sourceBlock(
    titleSceneSource,
    '    const p15IntegratedActionCompositionExperiment',
    '    const p15KaiPrototypeExperiment'
  );
  const compositeSurface = [
    titleCompositeBlock,
    compositeGuardBlock,
    arcGuardBlock,
    kaiGuardBlock,
    manualGuardBlock,
  ].join('\n').toLowerCase();

  [
    '_shouldshowp15setlist',
    '_maybeshowp15setlist',
    '_isp15hostileprojectile',
    '_maybestartp15hostile',
  ].forEach((dependency) => {
    assert.equal(compositeSurface.includes(dependency), false, `forbidden helper dependency: ${dependency}`);
  });

  [
    'this.add',
    'this.time',
    'this.tweens',
    'physics.add',
    'registry',
    'localstorage',
    'preload',
    'load.image',
    'load.audio',
    '.png',
    '.wav',
    'settimeout',
    'delayedcall',
    'tweens.add',
    '.hp',
    ' hp:',
    'damage =',
    'speed =',
    'firerate =',
    'score =',
    'support =',
    'center_stage',
    'encore',
    'boss',
    'skill',
    'card',
    'buff',
    'reward',
    'task',
    'reddot',
    'stage 2',
  ].forEach((forbidden) => {
    assert.equal(
      compositeSurface.includes(forbidden),
      false,
      `composite surface must not introduce forbidden dependency: ${forbidden}`
    );
  });

  [
    ['stageWaves.mjs', stageWavesSource],
    ['WaveSystem.js', waveSystemSource],
    ['battleResult.mjs', battleResultSource],
    ['main.js', mainSource],
  ].forEach(([name, source]) => {
    assert.equal(
      source.includes('p15IntegratedActionComposition'),
      false,
      `${name} must stay isolated from integrated composition`
    );
  });
}

console.log('p15242c integrated action composition contract: all assertions passed');
