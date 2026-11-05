import assert from 'node:assert/strict';
import {capturePlayerHitSource} from '../src/utils/playerHitSource.mjs';
import { getP43ResultPreviewFromQuery, withP43ResultPreviewBattleData } from '../src/utils/p43ResultPreview.mjs';
import { getPublicPerformer, loadPublicProfile, getPublicCampaignProgress, resolvePublicChapterId } from '../src/utils/publicRunProgression.mjs';
import { getPublicChapter } from '../src/utils/publicCampaign.mjs';
import { getPreparationSnapshot } from '../src/utils/publicPreparation.mjs';
import { readFileSync } from 'node:fs';
import {
  resolveStageWaveDefs,
  STAGE_15_DRIFTING_LIGHTSTICK_TYPE,
} from '../src/utils/stageWaves.mjs';

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
).replace(/\r\n/g, '\n');
const waveSystemSource = readFileSync(
  new URL('../src/systems/WaveSystem.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

const GAME_WIDTH = 375;
const GAME_HEIGHT = 667;
const PRACTICE_2_INDEX = 1;
const OWNER = 'stage-pressure-emitter';

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

function numericConstant(name) {
  const match = battleSceneSource.match(new RegExp(`const ${name} = ([0-9.]+);`));
  assert.ok(match, `missing numeric constant: ${name}`);
  return Number(match[1]);
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
  const experiment = buildRoute('?debug=&p88Stage15Practice=1&p15HostileProjectileExperiment=1');
  assert.equal(
    experiment.p15HostileProjectileExperiment,
    true,
    'the exact debug + hidden-practice + dedicated flag route should enable the experiment'
  );

  [
    ['', 'normal Stage 1'],
    ['?debug=&p88Stage15Practice=1', 'ordinary hidden practice'],
    ['?p88Stage15Practice=1&p15HostileProjectileExperiment=1', 'route without debug'],
    ['?debug=&p15HostileProjectileExperiment=1', 'route without hidden practice'],
  ].forEach(([query, label]) => {
    assert.equal(
      buildRoute(query).p15HostileProjectileExperiment,
      false,
      `${label} must not enable the hostile-projectile experiment`
    );
  });

  const setlistConflict = buildRoute(
    '?debug=&p88Stage15Practice=1&p15HostileProjectileExperiment=1&p15SetlistCue=1'
  );
  assert.equal(setlistConflict.p15SetlistCueExperiment, true, 'Setlist should keep its own route');
  assert.equal(
    setlistConflict.p15HostileProjectileExperiment,
    false,
    'the hostile-projectile route must fail closed when Setlist is requested'
  );

  const manualCompatibility = buildRoute(
    '?debug=&p88Stage15Practice=1&p15HostileProjectileExperiment=1&p15ManualFocus=1'
  );
  assert.equal(manualCompatibility.p15ManualFocusExperiment, true);
  assert.equal(manualCompatibility.p15HostileProjectileExperiment, true);

  const kaiCompatibility = buildRoute(
    '?debug=&p88Stage15Practice=1&p15HostileProjectileExperiment=1&p15KaiPrototype=1'
  );
  assert.equal(kaiCompatibility.p15KaiPrototypeExperiment, true);
  assert.equal(kaiCompatibility.p15HostileProjectileExperiment, true);
}

const gateBlock = sourceBlock(
  battleSceneSource,
  '  _isP15HostileProjectileExperimentEnabled() {',
  '  _maybeStartP15HostileProjectilePractice2Cycle('
);
const isExperimentEnabled = compileClassMethod(
  gateBlock,
  '_isP15HostileProjectileExperimentEnabled'
);

function enabledBattleData(overrides = {}) {
  return {
    practiceMode: true,
    stageId: 1,
    p15HostileProjectileExperiment: true,
    p15SetlistCueExperiment: false,
    ...overrides,
  };
}

{
  assert.equal(isExperimentEnabled.call({ battleData: enabledBattleData() }), true);
  [
    { practiceMode: false },
    { stageId: 2 },
    { p15HostileProjectileExperiment: false },
    { p15SetlistCueExperiment: true },
  ].forEach((override) => {
    assert.equal(
      isExperimentEnabled.call({ battleData: enabledBattleData(override) }),
      false,
      `BattleScene gate should fail closed for ${JSON.stringify(override)}`
    );
  });
}

const baseWaveDefs = [
  { wave: 1, label: 'Wave 1', interval: 1800, enemies: [{ type: 'trainee', count: 4 }] },
  { wave: 2, label: 'Wave 2', interval: 1600, enemies: [{ type: 'trainee', count: 5 }] },
];
const getStageById = (stageId) => ({ id: Number(stageId), name: `Stage ${stageId}`, waves: 2 });

{
  const normal = resolveStageWaveDefs({
    battleData: { stageId: 1, stageWaves: 2, practiceMode: false },
    waveDefs: baseWaveDefs,
    getStageById,
  });
  assert.deepEqual(normal, [], 'public Stage 1 uses the paint round instead of two kill-waves');

  const practice = resolveStageWaveDefs({
    battleData: { stageId: 1, practiceMode: true },
    waveDefs: baseWaveDefs,
    getStageById,
  });
  assert.equal(practice.length, 4, 'hidden Stage 1.5 must remain four segments');
  assert.deepEqual(practice.map((wave) => wave.interval), [3000, 2200, 500, 2200]);
  assert.deepEqual(practice.map((wave) => wave.minActiveMs), [9000, 12000, 8000, 10000]);
  assert.deepEqual(practice[1].enemies, [{ type: STAGE_15_DRIFTING_LIGHTSTICK_TYPE, count: 2 }]);
}

{
  assert.equal(numericConstant('P15_234_HOSTILE_PROJECTILE_PRACTICE_WAVE_INDEX'), 1);
  assert.equal(numericConstant('P15_234_HOSTILE_PROJECTILE_CYCLE_START_MS'), 2600);
  assert.equal(numericConstant('P15_234_HOSTILE_PROJECTILE_WINDUP_MS'), 900);
  assert.equal(numericConstant('P15_234_HOSTILE_PROJECTILE_LIFETIME_MS'), 2800);
  assert.equal(numericConstant('P15_234_HOSTILE_PROJECTILE_RECOVERY_MS'), 700);
  assert.equal(numericConstant('P15_234_HOSTILE_PROJECTILE_SPEED'), 135);
  assert.equal(numericConstant('P15_234_HOSTILE_PROJECTILE_HIT_RADIUS'), 7);
  assert.equal(numericConstant('P15_234_HOSTILE_PROJECTILE_EMITTER_X'), 22);
  assert.equal(numericConstant('P15_234_HOSTILE_PROJECTILE_PULSE_X'), 30);
  assert.ok(numericConstant('P15_234_HOSTILE_PROJECTILE_EMITTER_DEPTH') < 4);
  assert.ok(numericConstant('P15_234_HOSTILE_PROJECTILE_CUE_DEPTH') < 4);
  assert.ok(numericConstant('P15_234_HOSTILE_PROJECTILE_PULSE_DEPTH') < 6);
}

const startBlock = sourceBlock(
  battleSceneSource,
  '  _maybeStartP15HostileProjectilePractice2Cycle(waveIndex) {',
  '  _beginP15HostileProjectileWindup() {'
);
const maybeStartCycle = compileClassMethod(
  startBlock,
  '_maybeStartP15HostileProjectilePractice2Cycle',
  {
    P15_234_HOSTILE_PROJECTILE_PRACTICE_WAVE_INDEX: PRACTICE_2_INDEX,
    P15_234_HOSTILE_PROJECTILE_CYCLE_START_MS: 2600,
  }
);

function makeStartScene() {
  const timers = [];
  return {
    _battleEnded: false,
    _p15HostileProjectileCycleStarted: false,
    _p15HostileProjectilePractice2Active: false,
    _p15HostileProjectilePhase: 'idle',
    _p15HostileProjectileTimers: [],
    _isP15HostileProjectileExperimentEnabled: () => true,
    _beginP15HostileProjectileWindup() {
      this.windupCount = (this.windupCount || 0) + 1;
    },
    time: {
      delayedCall(delay, callback) {
        const timer = { delay, callback, remove() {} };
        timers.push(timer);
        return timer;
      },
    },
    timers,
  };
}

{
  const scene = makeStartScene();
  assert.equal(maybeStartCycle.call(scene, 0), false, 'Practice 1 must not schedule the cycle');
  assert.equal(maybeStartCycle.call(scene, 1), true, 'Practice 2 should schedule one cycle');
  assert.equal(scene._p15HostileProjectilePhase, 'scheduled');
  assert.equal(scene.timers.length, 1);
  assert.equal(scene.timers[0].delay, 2600);
  assert.equal(maybeStartCycle.call(scene, 1), false, 'Practice 2 must not schedule a second cycle');
  assert.equal(scene.timers.length, 1);
  scene.timers[0].callback();
  assert.equal(scene.windupCount, 1, 'the scheduled cycle should enter wind-up exactly once');

  const disabled = makeStartScene();
  disabled._isP15HostileProjectileExperimentEnabled = () => false;
  assert.equal(maybeStartCycle.call(disabled, 1), false, 'ordinary practice must remain unchanged');
}

{
  const createBlock = sourceBlock(
    battleSceneSource,
    '  _beginP15HostileProjectileWindup() {',
    '  _releaseP15HostileProjectilePulse() {'
  );
  const releaseBlock = sourceBlock(
    battleSceneSource,
    '  _releaseP15HostileProjectilePulse() {',
    '  _consumeP15HostileProjectile(pulse, reason) {'
  );
  const recoveryBlock = sourceBlock(
    battleSceneSource,
    '  _beginP15HostileProjectileRecovery() {',
    '  _clearP15HostileProjectileExperiment() {'
  );

  assert.ok(createBlock.includes("this._p15HostileProjectilePhase = 'windup'"));
  assert.ok(createBlock.includes('this.add.graphics()'), 'emitter and wind-up should use Phaser Graphics');
  assert.ok(createBlock.includes('P15_234_HOSTILE_PROJECTILE_WINDUP_MS'));

  [
    "p15HostileProjectileOwner = P15_234_HOSTILE_PROJECTILE_OWNER",
    'this.enemyBullets.add(pulse)',
    'pulse.setAlpha(0)',
    'pulse.body.setCircle(P15_234_HOSTILE_PROJECTILE_HIT_RADIUS)',
    'pulse.moveVx = P15_234_HOSTILE_PROJECTILE_SPEED',
    'pulse.moveVy = 0',
    "this._p15HostileProjectilePhase = 'travel'",
    'P15_234_HOSTILE_PROJECTILE_LIFETIME_MS',
  ].forEach((snippet) => {
    assert.ok(releaseBlock.includes(snippet), `pulse release should include: ${snippet}`);
  });
  assert.equal(releaseBlock.includes('this.enemies.add'), false, 'emitter/pulse must not enter enemies');
  assert.equal(releaseBlock.includes('_enemyShoot'), false, 'experiment must not call or copy legacy shooting');
  [
    'Math.random',
    'Phaser.Math.Between',
    'spreadAngle',
    'burstCount',
    'homingTarget',
  ].forEach((forbidden) => {
    assert.equal(releaseBlock.includes(forbidden), false, `pulse must stay deterministic: ${forbidden}`);
  });
  assert.ok(recoveryBlock.includes('P15_234_HOSTILE_PROJECTILE_RECOVERY_MS'));
  assert.ok(recoveryBlock.includes("this._p15HostileProjectilePhase = 'complete'"));

  const graphicsNodes = [];
  const tweenConfigs = [];
  const timers = [];
  const enemyBullets = [];
  const makeGraphics = () => {
    const node = {
      active: true,
      setDepth() { return this; },
      setAlpha(value) { this.alpha = value; return this; },
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      lineStyle() { return this; },
      lineBetween() { return this; },
      fillStyle() { return this; },
      fillRoundedRect() { return this; },
      clear() { return this; },
      destroy() { this.active = false; },
    };
    graphicsNodes.push(node);
    return node;
  };
  const makePulse = (x, y) => ({
    x,
    y,
    active: true,
    body: {
      moves: true,
      setCircle(radius) { this.radius = radius; },
    },
    setAlpha() { return this; },
    setDepth() { return this; },
    destroy() { this.active = false; },
  });
  const methodGlobals = {
    GAME_HEIGHT,
    P15_234_HOSTILE_PROJECTILE_WINDUP_MS: 900,
    P15_234_HOSTILE_PROJECTILE_LIFETIME_MS: 2800,
    P15_234_HOSTILE_PROJECTILE_RECOVERY_MS: 700,
    P15_234_HOSTILE_PROJECTILE_SPEED: 135,
    P15_234_HOSTILE_PROJECTILE_HIT_RADIUS: 7,
    P15_234_HOSTILE_PROJECTILE_EMITTER_X: 22,
    P15_234_HOSTILE_PROJECTILE_PULSE_X: 30,
    P15_234_HOSTILE_PROJECTILE_EMITTER_DEPTH: 2.7,
    P15_234_HOSTILE_PROJECTILE_CUE_DEPTH: 3.4,
    P15_234_HOSTILE_PROJECTILE_PULSE_DEPTH: 5,
    P15_234_HOSTILE_PROJECTILE_OWNER: OWNER,
    COMBAT_OBJECT_OWNERS: {
      HIDDEN_STAGE_PRESSURE_PROJECTILE: 'hiddenStagePressureProjectile',
    },
  };
  const beginWindup = compileClassMethod(createBlock, '_beginP15HostileProjectileWindup', methodGlobals);
  const releasePulse = compileClassMethod(releaseBlock, '_releaseP15HostileProjectilePulse', methodGlobals);
  const consumeBlock = sourceBlock(
    battleSceneSource,
    '  _consumeP15HostileProjectile(pulse, reason) {',
    '  _beginP15HostileProjectileRecovery() {'
  );
  const consumePulse = compileClassMethod(consumeBlock, '_consumeP15HostileProjectile', methodGlobals);
  const beginRecovery = compileClassMethod(recoveryBlock, '_beginP15HostileProjectileRecovery', methodGlobals);
  const scene = {
    _battleEnded: false,
    _p15HostileProjectilePractice2Active: true,
    _p15HostileProjectileCycleStarted: true,
    _p15HostileProjectilePhase: 'scheduled',
    _p15HostileProjectileTimers: [],
    _p15HostileProjectileTweens: [],
    _p15HostileProjectileEmitterGfx: null,
    _p15HostileProjectileCueGfx: null,
    _p15HostileProjectilePulse: null,
    add: { graphics: makeGraphics },
    physics: { add: { sprite: makePulse } },
    enemyBullets: { add: (pulse) => enemyBullets.push(pulse) },
    time: {
      delayedCall(delay, callback) {
        const timer = { delay, callback, remove() {} };
        timers.push(timer);
        return timer;
      },
    },
    tweens: {
      add(config) {
        tweenConfigs.push(config);
        return { stop() {}, remove() {} };
      },
    },
    _releaseP15HostileProjectilePulse() { return releasePulse.call(this); },
    _consumeP15HostileProjectile(pulse, reason) { return consumePulse.call(this, pulse, reason); },
    _beginP15HostileProjectileRecovery() { return beginRecovery.call(this); },
    _trackCombatObject() { return true; },
    _disposeEnemyProjectile(pulse) {
      if (pulse.p16Disposed === true) return false;
      pulse.p16Disposed = true;
      pulse.gfx?.destroy?.();
      pulse.gfx = null;
      pulse.destroy?.();
      return true;
    },
  };

  assert.equal(beginWindup.call(scene), true);
  assert.equal(scene._p15HostileProjectilePhase, 'windup');
  assert.equal(timers[0].delay, 900);
  timers[0].callback();
  assert.equal(scene._p15HostileProjectilePhase, 'travel');
  assert.equal(enemyBullets.length, 1, 'one cycle should release exactly one tagged pulse');
  assert.equal(enemyBullets[0].body.radius, 7);
  assert.equal(enemyBullets[0].moveVx, 135);
  assert.equal(enemyBullets[0].moveVy, 0);
  assert.equal(releasePulse.call(scene), null, 'travel phase must reject a second release');

  assert.equal(consumePulse.call(scene, enemyBullets[0], 'hit'), true);
  assert.equal(scene._p15HostileProjectilePhase, 'recovery');
  assert.equal(consumePulse.call(scene, enemyBullets[0], 'hit'), false, 'a pulse may be consumed once');
  const recoveryTween = tweenConfigs.at(-1);
  assert.equal(recoveryTween.duration, 700);
  recoveryTween.onComplete();
  assert.equal(scene._p15HostileProjectilePhase, 'complete');
  assert.equal(graphicsNodes.every((node) => node.active === false), true, 'cycle visuals should self-clean');
}

{
  const hitBlock = sourceBlock(
    battleSceneSource,
    '  _onEnemyHitPlayer(sourceBullet = null, contactEnemy = null) {',
    '  _getPlayerVisualTarget() {'
  );
  const consumeIndex = hitBlock.indexOf("this._consumeP15HostileProjectile(sourceBullet, 'hit');");
  const battleGuardIndex = hitBlock.indexOf('if (this._battleEnded) return;');
  const invulnerableGuardIndex = hitBlock.indexOf('if (this.player.invulnerable) return;');
  assert.ok(consumeIndex >= 0, 'damage entry should consume the exact overlap-source pulse');
  assert.ok(consumeIndex < battleGuardIndex, 'tagged pulse must be consumed before battle-ended guard');
  assert.ok(consumeIndex < invulnerableGuardIndex, 'tagged pulse must be consumed before invulnerability guard');
  assert.equal(hitBlock.includes('Distance.Between'), false, 'exact overlap identity must not be rechecked by coordinates');

  const onEnemyHitPlayer = compileClassMethod(hitBlock, '_onEnemyHitPlayer', {capturePlayerHitSource});
  const exactPulse = { active: true, x: -999, y: -999, p15HostileProjectileOwner: OWNER };
  const consumed = [];
  const scene = {
    _battleEnded: true,
    _consumeP15HostileProjectile(pulse, reason) {
      consumed.push([pulse, reason]);
      return true;
    },
  };
  onEnemyHitPlayer.call(scene, exactPulse);
  assert.equal(consumed.length, 1, 'the exact overlap source should be consumed once');
  assert.equal(consumed[0][0], exactPulse);
  assert.equal(consumed[0][1], 'hit');
}

{
  const cleanupBlock = sourceBlock(
    battleSceneSource,
    '  _clearP15HostileProjectileExperiment() {',
    '\n  // ===================== B5'
  );
  const clearExperiment = compileClassMethod(
    cleanupBlock,
    '_clearP15HostileProjectileExperiment',
    {
      P15_234_HOSTILE_PROJECTILE_OWNER: OWNER,
      COMBAT_OBJECT_OWNERS: {
        HIDDEN_STAGE_PRESSURE_PROJECTILE: 'hiddenStagePressureProjectile',
      },
    }
  );
  const calls = [];
  const makeNode = (name) => ({
    active: true,
    destroy() { calls.push(`destroy:${name}`); this.active = false; },
  });
  const taggedPulse = makeNode('tagged-pulse');
  taggedPulse.p15HostileProjectileOwner = OWNER;
  taggedPulse.gfx = makeNode('tagged-gfx');
  const unrelatedPulse = makeNode('unrelated-pulse');
  unrelatedPulse.p15HostileProjectileOwner = 'legacy';
  const scene = {
    _p15HostileProjectilePractice2Active: true,
    _p15HostileProjectileCycleStarted: true,
    _p15HostileProjectilePhase: 'travel',
    _p15HostileProjectileTimers: [{ remove: () => calls.push('timer:remove') }],
    _p15HostileProjectileTweens: [{ stop: () => calls.push('tween:stop'), remove: () => calls.push('tween:remove') }],
    _p15HostileProjectileEmitterGfx: makeNode('emitter'),
    _p15HostileProjectileCueGfx: makeNode('cue'),
    _p15HostileProjectilePulse: taggedPulse,
    enemyBullets: { children: { iterate: (callback) => [taggedPulse, unrelatedPulse].forEach(callback) } },
    _disposeEnemyProjectile(pulse) {
      if (pulse.p16Disposed === true) return false;
      pulse.p16Disposed = true;
      pulse.gfx?.destroy?.();
      pulse.gfx = null;
      pulse.destroy?.();
      return true;
    },
  };

  clearExperiment.call(scene);
  clearExperiment.call(scene);
  assert.equal(calls.filter((entry) => entry === 'destroy:tagged-pulse').length, 1);
  assert.equal(calls.filter((entry) => entry === 'destroy:tagged-gfx').length, 1);
  assert.equal(calls.includes('destroy:unrelated-pulse'), false, 'cleanup must preserve unrelated enemy bullets');
  assert.equal(scene._p15HostileProjectilePractice2Active, false);
  assert.equal(scene._p15HostileProjectileCycleStarted, false);
  assert.equal(scene._p15HostileProjectilePhase, 'idle');
  assert.deepEqual(scene._p15HostileProjectileTimers, []);
  assert.deepEqual(scene._p15HostileProjectileTweens, []);
  assert.equal(cleanupBlock.includes('enemyBullets.clear'), false, 'cleanup must not clear the shared group');
}

{
  const createLifecycle = sourceBlock(
    battleSceneSource,
    "this.events.once('shutdown'",
    'const sceneData = normalizeBattleData'
  );
  const waveCallbacks = sourceBlock(
    battleSceneSource,
    '    this.waveSystem.onWaveStart =',
    '    this.waveSystem.onInterWaveBreak ='
  );
  const endBattle = sourceBlock(
    battleSceneSource,
    '  _endBattle(type) {',
    '  _showP43ResultPreview(preview) {'
  );
  const resultActions = sourceBlock(
    battleSceneSource,
    '  _handleBattleResultAction(action) {',
    '  _switchForm() {'
  );
  const releaseBlock = sourceBlock(
    battleSceneSource,
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );

  assert.ok(releaseBlock.includes('_clearP15HostileProjectileExperiment()'));
  assert.ok(createLifecycle.includes("_releaseBattleRuntimeObjects('shutdown')"));
  assert.ok(waveCallbacks.includes('_maybeStartP15HostileProjectilePractice2Cycle(idx)'));
  assert.ok(waveCallbacks.includes('idx === P15_234_HOSTILE_PROJECTILE_PRACTICE_WAVE_INDEX'));
  assert.ok(waveCallbacks.includes('_clearP15HostileProjectileExperiment()'));
  assert.ok(endBattle.indexOf("_releaseBattleRuntimeObjects('battle-end')") < endBattle.indexOf('this.physics.pause()'));
  assert.ok(resultActions.includes("_releaseBattleRuntimeObjects('result-retry')"));
  assert.ok(resultActions.includes("_releaseBattleRuntimeObjects('result-title')"));
}

{
  const experimentSurface = [
    titleBuilderBlock,
    sourceBlock(
      battleSceneSource,
      'const P15_234_HOSTILE_PROJECTILE_PRACTICE_WAVE_INDEX',
      'const P15_229_KAI_BEAT_STEP_DISTANCE_PX'
    ),
    sourceBlock(
      battleSceneSource,
      '  _isP15HostileProjectileExperimentEnabled() {',
      '  _createPaintJars() {'
    ),
  ].join('\n');

  [
    'load.image',
    "'.png'",
    "'.wav'",
    "'.mp3'",
    "'.ogg'",
    'preloadP15',
    'registry',
    'localStorage',
    'this.enemies.add',
    '_selectAutoAimTarget',
    '_bindP15ManualFocusTargetInput',
    '_enemyShoot',
    'Stage 2',
  ].forEach((forbidden) => {
    assert.equal(
      experimentSurface.includes(forbidden),
      false,
      `experiment surface must not introduce forbidden dependency: ${forbidden}`
    );
  });

  assert.equal(stageWavesSource.includes('p15HostileProjectileExperiment'), false);
  assert.equal(waveSystemSource.includes('p15HostileProjectileExperiment'), false);
}

console.log('p15234 hidden Stage 1.5 hostile projectile action contract: all assertions passed');
