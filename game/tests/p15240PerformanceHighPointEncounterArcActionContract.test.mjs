import assert from 'node:assert/strict';
import { getP43ResultPreviewFromQuery, withP43ResultPreviewBattleData } from '../src/utils/p43ResultPreview.mjs';
import { getPublicPerformer, loadPublicProfile, getPublicCampaignProgress, resolvePublicChapterId } from '../src/utils/publicRunProgression.mjs';
import { getPublicChapter } from '../src/utils/publicCampaign.mjs';
import { getPreparationSnapshot } from '../src/utils/publicPreparation.mjs';
import { readFileSync } from 'node:fs';
import { resolveStageWaveDefs } from '../src/utils/stageWaves.mjs';

const titleSceneSource = readFileSync(
  new URL('../src/scenes/TitleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');
const battleSceneSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');
const stageWavesSource = readFileSync(
  new URL('../src/utils/stageWaves.mjs', import.meta.url),
  'utf8'
);
const waveSystemSource = readFileSync(
  new URL('../src/systems/WaveSystem.js', import.meta.url),
  'utf8'
);
const battleResultSource = readFileSync(
  new URL('../src/utils/battleResult.mjs', import.meta.url),
  'utf8'
);
const mainSource = readFileSync(
  new URL('../src/main.js', import.meta.url),
  'utf8'
);

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

{
  const exact = buildRoute('?debug=&p88Stage15Practice=1&p15PerformanceHighPointArc=1');
  assert.equal(exact.practiceMode, true, 'the exact route must remain hidden Stage 1.5 practice');
  assert.equal(
    exact.p15PerformanceHighPointArcExperiment,
    true,
    'the exact hidden route must enable the performance high-point arc'
  );

  [
    '?p88Stage15Practice=1&p15PerformanceHighPointArc=1',
    '?debug=&p15PerformanceHighPointArc=1',
    '?debug=&p88Stage15Practice=1',
    '?debug=&p88Stage15Practice=1&p15PerformanceHighPointArc=0',
  ].forEach((queryText) => {
    assert.equal(
      buildRoute(queryText).p15PerformanceHighPointArcExperiment,
      false,
      `arc route should fail closed for: ${queryText}`
    );
  });

  const conflicts = [
    ['p15ManualFocus=1', 'p15ManualFocusExperiment'],
    ['p15KaiPrototype=1', 'p15KaiPrototypeExperiment'],
    ['p15SetlistCue=1', 'p15SetlistCueExperiment'],
    ['p15HostileProjectileExperiment=1', 'p15HostileProjectileExperiment'],
  ];
  conflicts.forEach(([queryPart, field]) => {
    const route = buildRoute(
      `?debug=&p88Stage15Practice=1&p15PerformanceHighPointArc=1&${queryPart}`
    );
    assert.equal(route[field], true, `${field} should retain its own existing route`);
    assert.equal(
      route.p15PerformanceHighPointArcExperiment,
      false,
      `arc route should reject conflict: ${queryPart}`
    );
  });
}

const arcGateBlock = sourceBlock(
  battleSceneSource,
  '  _isP15PerformanceHighPointArcExperimentEnabled() {',
  '  _resolveP15PerformanceHighPointArcWaveLabel('
);
const isArcEnabled = compileClassMethod(
  arcGateBlock,
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

function enabledArcBattleData(overrides = {}) {
  return {
    practiceMode: true,
    stageId: 1,
    p15PerformanceHighPointArcExperiment: true,
    p15ManualFocusExperiment: false,
    p15KaiPrototypeExperiment: false,
    p15SetlistCueExperiment: false,
    p15HostileProjectileExperiment: false,
    ...overrides,
  };
}

{
  assert.equal(
    isArcEnabled.call({
      battleData: enabledArcBattleData(),
      _isStage15PracticeMode: () => true,
    }),
    true,
    'only the dedicated conflict-free hidden Stage 1.5 route should enable the arc'
  );

  [
    { practiceMode: false },
    { stageId: 2 },
    { p15PerformanceHighPointArcExperiment: false },
    { p15ManualFocusExperiment: true },
    { p15KaiPrototypeExperiment: true },
    { p15SetlistCueExperiment: true },
    { p15HostileProjectileExperiment: true },
  ].forEach((override) => {
    const battleData = enabledArcBattleData(override);
    assert.equal(
      isArcEnabled.call({
        battleData,
        _isStage15PracticeMode: () => battleData.practiceMode === true,
      }),
      false,
      `battle guard should fail closed for: ${JSON.stringify(override)}`
    );
  });
}

{
  const enabledScene = {
    _isP15PerformanceHighPointArcExperimentEnabled: () => true,
  };
  arcLabels.forEach((expected, index) => {
    assert.equal(
      resolveArcLabel.call(enabledScene, index, `Practice ${index + 1}`),
      expected,
      `wave index ${index} should resolve to ${expected}`
    );
  });
  assert.equal(
    resolveArcLabel.call(enabledScene, 4, 'unchanged fallback'),
    'unchanged fallback',
    'out-of-range indexes must not create a fifth arc label'
  );
  assert.equal(
    resolveArcLabel.call({
      _isP15PerformanceHighPointArcExperimentEnabled: () => false,
    }, 0, 'Practice 1'),
    'Practice 1',
    'ordinary hidden practice must keep its existing wave label'
  );
}

{
  const constantBlock = sourceBlock(
    battleSceneSource,
    'const P15_240_PERFORMANCE_HIGH_POINT_ARC_LABELS',
    'const MOBILE_MOVE_ZONE_RIGHT'
  );
  assert.ok(constantBlock.includes('Object.freeze(['), 'the four-label contract must be immutable');
  arcLabels.forEach((label) => {
    assert.ok(constantBlock.includes(`'${label}'`), `label constant should include ${label}`);
  });

  const waveStartBlock = sourceBlock(
    battleSceneSource,
    '    this.waveSystem.onWaveStart = (idx, label) => {',
    '    this.waveSystem.onWaveClear = (idx) => {'
  );
  assert.ok(
    waveStartBlock.includes(
      'this._showWaveLabel(this._resolveP15PerformanceHighPointArcWaveLabel(idx, label));'
    ),
    'the existing wave label lifecycle should receive only the stateless resolver output'
  );
  assert.equal(
    waveStartBlock.split('_showWaveLabel(').length - 1,
    1,
    'the arc must not create a second wave-label display path'
  );
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
    battleData: enabledArcBattleData(),
    waveDefs,
    getStageById,
  });

  assert.deepEqual(normalDefs, [], 'public Stage 1 uses the paint round');
  assert.equal(practiceDefs.length, 4, 'hidden Stage 1.5 must remain exactly four segments');
  assert.deepEqual(
    practiceDefs.map((def) => def.label),
    ['Practice 1', 'Practice 2', 'Practice 3', 'Practice 4'],
    'wave definitions must remain unchanged beneath the transient arc labels'
  );
}

{
  const allClearBlock = sourceBlock(
    battleSceneSource,
    '  _onAllWavesClear() {',
    '  _onJarDefeat() {'
  );
  assert.ok(
    allClearBlock.includes('_endBattle(BATTLE_RESULT_TYPES.VICTORY)'),
    'Practice 4 must still finish through the existing victory result path'
  );

  [
    ['stageWaves.mjs', stageWavesSource],
    ['WaveSystem.js', waveSystemSource],
    ['battleResult.mjs', battleResultSource],
    ['main.js', mainSource],
  ].forEach(([name, source]) => {
    assert.equal(
      source.includes('p15PerformanceHighPointArc'),
      false,
      `${name} must remain isolated from the arc experiment`
    );
  });
}

{
  const titleArcBlock = sourceBlock(
    titleSceneSource,
    '    const p15PerformanceHighPointArcExperiment',
    '    const battleData = {'
  );
  const arcSurface = [titleArcBlock, arcGateBlock, arcResolverBlock].join('\n').toLowerCase();
  [
    'this.add',
    'this.time',
    'this.tweens',
    'physics',
    'registry',
    'localstorage',
    'preload',
    'load.image',
    'load.audio',
    '.png',
    '.wav',
    'settimeout',
    'delayedcall',
    '.hp',
    ' hp:',
    'hp =',
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
    'red dot',
    'stage 2',
  ].forEach((forbidden) => {
    assert.equal(
      arcSurface.includes(forbidden),
      false,
      `arc surface must not introduce forbidden dependency: ${forbidden}`
    );
  });
}

console.log('p15240 performance high-point encounter arc action contract: all assertions passed');
