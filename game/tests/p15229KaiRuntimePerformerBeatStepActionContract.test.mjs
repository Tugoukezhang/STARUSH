import assert from 'node:assert/strict';
import { getP43ResultPreviewFromQuery, withP43ResultPreviewBattleData } from '../src/utils/p43ResultPreview.mjs';
import { getPublicPerformer, loadPublicProfile, getPublicCampaignProgress, resolvePublicChapterId } from '../src/utils/publicRunProgression.mjs';
import { getPublicChapter } from '../src/utils/publicCampaign.mjs';
import { getPreparationSnapshot } from '../src/utils/publicPreparation.mjs';
import { readFileSync } from 'node:fs';

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
const charactersSource = readFileSync(
  new URL('../src/data/characters.js', import.meta.url),
  'utf8'
);
const configSource = readFileSync(
  new URL('../src/utils/config.js', import.meta.url),
  'utf8'
);
const battleResultSource = readFileSync(
  new URL('../src/utils/battleResult.mjs', import.meta.url),
  'utf8'
);

const GAME_WIDTH = 375;
const GAME_HEIGHT = 667;
const BEAT_STEP_DISTANCE = 32;
const BEAT_STEP_MIN_AVAILABLE = 8;

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
  const kaiOnly = buildRoute('?debug=&p88Stage15Practice=1&p15KaiPrototype=1');
  assert.equal(
    kaiOnly.p15KaiPrototypeExperiment,
    true,
    'the exact hidden Kai query should enable the explicit prototype experiment field'
  );
  assert.equal(
    kaiOnly.p15PerformerPrototypeId,
    'kai',
    'the exact hidden Kai query should carry a separate explicit performer identity'
  );

  const normal = buildRoute('');
  assert.equal(normal.p15KaiPrototypeExperiment, false, 'normal Stage 1 must not enable Kai');
  assert.equal(normal.p15PerformerPrototypeId, null, 'normal Stage 1 must not carry Kai identity');

  const ordinaryPractice = buildRoute('?debug=&p88Stage15Practice=1');
  assert.equal(ordinaryPractice.p15KaiPrototypeExperiment, false, 'ordinary hidden practice must not enable Kai');
  assert.equal(ordinaryPractice.p15PerformerPrototypeId, null, 'ordinary practice must not infer performer identity');

  const kaiWithoutDebug = buildRoute('?p88Stage15Practice=1&p15KaiPrototype=1');
  assert.equal(kaiWithoutDebug.p15KaiPrototypeExperiment, false, 'Kai must require the debug gate');

  const kaiWithoutPractice = buildRoute('?debug=&p15KaiPrototype=1');
  assert.equal(kaiWithoutPractice.p15KaiPrototypeExperiment, false, 'Kai must require hidden Stage 1.5 practice');

  const kaiAndManual = buildRoute(
    '?debug=&p88Stage15Practice=1&p15KaiPrototype=1&p15ManualFocus=1'
  );
  assert.equal(kaiAndManual.p15ManualFocusExperiment, true, 'Manual Focus should retain its own route');
  assert.equal(kaiAndManual.p15KaiPrototypeExperiment, false, 'Kai + Manual Focus must fail closed for Kai');
  assert.equal(kaiAndManual.p15PerformerPrototypeId, null, 'failed-closed Kai route must not carry performer identity');

  const kaiAndSetlist = buildRoute(
    '?debug=&p88Stage15Practice=1&p15KaiPrototype=1&p15SetlistCue=1'
  );
  assert.equal(kaiAndSetlist.p15SetlistCueExperiment, true, 'Setlist Cue should retain its own route');
  assert.equal(kaiAndSetlist.p15KaiPrototypeExperiment, false, 'Kai + Setlist Cue must fail closed for Kai');
  assert.equal(kaiAndSetlist.p15PerformerPrototypeId, null, 'Setlist conflict must clear Kai identity');
}

const kaiGateBlock = sourceBlock(
  battleSceneSource,
  '  _isP15KaiPrototypeEnabled() {',
  '  _shouldShowP15SetlistCueAfterWarmup('
);
const isKaiPrototypeEnabled = compileClassMethod(
  kaiGateBlock,
  '_isP15KaiPrototypeEnabled'
);

function enabledKaiBattleData(overrides = {}) {
  return {
    practiceMode: true,
    stageId: 1,
    p15KaiPrototypeExperiment: true,
    p15PerformerPrototypeId: 'kai',
    p15ManualFocusExperiment: false,
    p15SetlistCueExperiment: false,
    ...overrides,
  };
}

{
  assert.equal(
    isKaiPrototypeEnabled.call({ battleData: enabledKaiBattleData() }),
    true,
    'all explicit Kai fields should enable the hidden prototype'
  );
  [
    { practiceMode: false },
    { stageId: 2 },
    { p15KaiPrototypeExperiment: false },
    { p15PerformerPrototypeId: null },
    { p15PerformerPrototypeId: 'sakura' },
    { p15ManualFocusExperiment: true },
    { p15SetlistCueExperiment: true },
  ].forEach((override) => {
    assert.equal(
      isKaiPrototypeEnabled.call({ battleData: enabledKaiBattleData(override) }),
      false,
      `Kai gate should fail closed for: ${JSON.stringify(override)}`
    );
  });

  assert.equal(
    isKaiPrototypeEnabled.call({
      battleData: {
        practiceMode: true,
        stageId: 1,
        characterId: 'kai',
        team: [{ id: 'kai', level: 99, rarity: 5, stats: { spd: 999 } }],
        color: 'blue',
        form: 'kai-form',
      },
    }),
    false,
    'legacy character, team, growth, color, and form data must not enable Kai'
  );
}

const movementIntentBlock = sourceBlock(
  battleSceneSource,
  '  _getP15KaiCurrentMovementIntent() {',
  '  _tryStartP15KaiBeatStep() {'
);
const getMovementIntent = compileClassMethod(
  movementIntentBlock,
  '_getP15KaiCurrentMovementIntent'
);
const startBeatStepBlock = sourceBlock(
  battleSceneSource,
  '  _tryStartP15KaiBeatStep() {',
  '  _resolveP15KaiBeatStepVelocity('
);
const tryStartBeatStep = compileClassMethod(
  startBeatStepBlock,
  '_tryStartP15KaiBeatStep',
  {
    GAME_WIDTH,
    GAME_HEIGHT,
    P15_229_KAI_BEAT_STEP_DISTANCE_PX: BEAT_STEP_DISTANCE,
    P15_229_KAI_BEAT_STEP_MIN_AVAILABLE_PX: BEAT_STEP_MIN_AVAILABLE,
  }
);
const resolveBeatStepBlock = sourceBlock(
  battleSceneSource,
  '  _resolveP15KaiBeatStepVelocity(',
  '  _showP15KaiPrototypeIdentityAck() {'
);
const resolveBeatStepVelocity = compileClassMethod(
  resolveBeatStepBlock,
  '_resolveP15KaiBeatStepVelocity'
);

function makeKaiScene({ x = 160, y = 300, vx = 250, vy = 0 } = {}) {
  const scene = {
    battleData: enabledKaiBattleData(),
    _battleEnded: false,
    _p15KaiBeatStepActive: false,
    _p15KaiBeatStepDirectionX: 0,
    _p15KaiBeatStepDirectionY: 0,
    _p15KaiBeatStepSpeed: 0,
    _p15KaiBeatStepRemainingPx: 0,
    player: {
      x,
      y,
      active: true,
      body: {
        velocity: { x: vx, y: vy },
        blocked: { left: false, right: false, up: false, down: false },
      },
    },
    _isP15KaiPrototypeEnabled() {
      return isKaiPrototypeEnabled.call(this);
    },
    _getP15KaiCurrentMovementIntent() {
      return getMovementIntent.call(this);
    },
    _spawnP15KaiBeatStepFeedback() {
      this.feedbackCount = (this.feedbackCount || 0) + 1;
    },
  };
  return scene;
}

{
  const idle = makeKaiScene({ vx: 0, vy: 0 });
  assert.equal(tryStartBeatStep.call(idle), false, 'idle input must not start Beat Step');
  assert.equal(idle.feedbackCount || 0, 0, 'failed idle trigger must not spawn success feedback');

  const moving = makeKaiScene({ vx: 150, vy: 200 });
  assert.equal(tryStartBeatStep.call(moving), true, 'moving input should start Beat Step');
  assert.equal(moving._p15KaiBeatStepActive, true);
  assert.ok(Math.abs(moving._p15KaiBeatStepDirectionX - 0.6) < 1e-9);
  assert.ok(Math.abs(moving._p15KaiBeatStepDirectionY - 0.8) < 1e-9);
  assert.equal(moving._p15KaiBeatStepSpeed, 250, 'Beat Step must capture actual body speed');
  assert.equal(moving._p15KaiBeatStepRemainingPx, 32, 'unblocked Beat Step should commit exactly 32px');
  assert.equal(moving.feedbackCount, 1, 'successful trigger should spawn feedback once');
  assert.equal(tryStartBeatStep.call(moving), false, 'a second trigger while active must be rejected');

  const capturedSpeed = moving._p15KaiBeatStepSpeed;
  let committedDistance = 0;
  let guard = 0;
  while (moving._p15KaiBeatStepActive && guard < 100) {
    const resolved = resolveBeatStepVelocity.call(moving, 0, 0, 16);
    const speed = Math.hypot(resolved.vx, resolved.vy);
    assert.ok(speed <= capturedSpeed + 1e-9, 'Beat Step must never exceed captured actual speed');
    const frameDistance = speed * 0.016;
    committedDistance += frameDistance;
    moving.player.x += resolved.vx * 0.016;
    moving.player.y += resolved.vy * 0.016;
    guard += 1;
  }
  assert.ok(guard < 100, 'Beat Step should finish instead of persisting');
  assert.ok(Math.abs(committedDistance - 32) < 1e-6, 'release-after-trigger should still complete 32px');

  const ordinary = makeKaiScene();
  const ordinaryVelocity = resolveBeatStepVelocity.call(ordinary, 12, -34, 16);
  assert.deepEqual(ordinaryVelocity, { vx: 12, vy: -34 }, 'inactive Beat Step must preserve ordinary movement');
}

{
  const lessThanEight = makeKaiScene({ x: GAME_WIDTH - 21, vx: 250, vy: 0 });
  assert.equal(
    tryStartBeatStep.call(lessThanEight),
    false,
    'less than 8px available before the safe boundary should reject Beat Step'
  );
  assert.equal(lessThanEight.feedbackCount || 0, 0, 'boundary rejection must not spawn feedback');

  const tenAvailable = makeKaiScene({ x: GAME_WIDTH - 26, vx: 250, vy: 0 });
  assert.equal(tryStartBeatStep.call(tenAvailable), true, 'at least 8px available should allow a truncated step');
  assert.equal(tenAvailable._p15KaiBeatStepRemainingPx, 10, 'boundary should truncate the commitment, not teleport');

  const blocked = makeKaiScene();
  assert.equal(tryStartBeatStep.call(blocked), true);
  blocked.player.body.blocked.right = true;
  const blockedVelocity = resolveBeatStepVelocity.call(blocked, 0, 0, 16);
  assert.deepEqual(blockedVelocity, { vx: 0, vy: 0 }, 'blocked boundary should stop the committed step');
  assert.equal(blocked._p15KaiBeatStepActive, false, 'blocked boundary should clear active state');
}

{
  const setupInputBlock = sourceBlock(
    battleSceneSource,
    '  _setupInput() {',
    '  _setupMobileControls() {'
  );
  assert.ok(setupInputBlock.includes("addKey('SPACE')"), 'Kai route should bind Space');
  assert.ok(setupInputBlock.includes('_isP15KaiPrototypeEnabled()'), 'Space binding must require the Kai gate');
  assert.ok(setupInputBlock.includes('_tryStartP15KaiBeatStep()'), 'Space should invoke only Beat Step');
  assert.ok(setupInputBlock.includes('event?.repeat === true'), 'repeated keydown should be ignored');

  const mobileSetupBlock = sourceBlock(
    battleSceneSource,
    '  _setupMobileControls() {',
    '  _createMobileButton(x, y, color, onTap, key) {'
  );
  assert.ok(mobileSetupBlock.includes('P15_229_KAI_MOBILE_CONTROL_X'));
  assert.ok(mobileSetupBlock.includes('P15_229_KAI_MOBILE_CONTROL_Y'));
  assert.ok(mobileSetupBlock.includes("'kai'"));
  assert.ok(mobileSetupBlock.includes("setText('Kai\\n校拍')"), 'hidden control should use the accepted live label');
  assert.ok(mobileSetupBlock.includes('_tryStartP15KaiBeatStep()'));

  const createButtonBlock = sourceBlock(
    battleSceneSource,
    '  _createMobileButton(x, y, color, onTap, key) {',
    '  _setMobileButtonPressed(control, pressed) {'
  );
  assert.ok(createButtonBlock.includes('if (event?.stopPropagation) event.stopPropagation()'));
  assert.ok(
    createButtonBlock.includes("key === 'kai' ? P15_229_KAI_MOBILE_HIT_RADIUS : 32"),
    'only Kai should use the 24px hotspot while color/form remain 32px'
  );
  assert.equal(createButtonBlock.includes('_startTouchMovement'), false);
  assert.equal(createButtonBlock.includes('_setTouchTarget'), false);
  assert.equal(createButtonBlock.includes('_selectP15ManualFocusTarget'), false);
  assert.ok(createButtonBlock.includes('return control'), 'Kai cleanup should retain the existing control handle');
}

{
  const kaiX = GAME_WIDTH - 106;
  const kaiY = GAME_HEIGHT - 124;
  const colorX = GAME_WIDTH - 48;
  const colorY = GAME_HEIGHT - 124;
  const formX = GAME_WIDTH - 48;
  const formY = GAME_HEIGHT - 68;
  assert.equal(kaiX, 269);
  assert.equal(kaiY, 543);
  assert.equal(Math.hypot(kaiX - colorX, kaiY - colorY), 58);
  assert.ok(Math.hypot(kaiX - colorX, kaiY - colorY) > 24 + 32);
  assert.ok(Math.hypot(kaiX - formX, kaiY - formY) > 24 + 32);
  assert.ok(kaiX - 24 > GAME_WIDTH * 0.62, 'Kai hotspot should stay outside the movement zone');
}

const identityAckBlock = sourceBlock(
  battleSceneSource,
  '  _showP15KaiPrototypeIdentityAck() {',
  '  _spawnP15KaiBeatStepFeedback() {'
);
const feedbackBlock = sourceBlock(
  battleSceneSource,
  '  _spawnP15KaiBeatStepFeedback() {',
  '  _clearP15KaiPrototypeState() {'
);
const clearKaiBlock = sourceBlock(
  battleSceneSource,
  '  _clearP15KaiPrototypeState() {',
  '  _createPlayerReadabilityMarker() {'
);

{
  assert.ok(identityAckBlock.includes("'原型成员：Kai｜节拍机动'"));
  assert.ok(identityAckBlock.includes('GAME_WIDTH / 2, 56'));
  assert.ok(identityAckBlock.includes("fontSize: '13px'"));
  assert.ok(identityAckBlock.includes('P15_229_KAI_IDENTITY_ACK_DURATION_MS'));
  assert.equal(identityAckBlock.includes('this.add.image'), false);

  assert.ok(feedbackBlock.includes('this.add.graphics()'));
  assert.ok(feedbackBlock.includes('lineBetween'));
  assert.ok(feedbackBlock.includes('P15_229_KAI_BEAT_STEP_FX_ALPHA'));
  assert.ok(feedbackBlock.includes('P15_229_KAI_BEAT_STEP_FX_DEPTH'));
  assert.ok(feedbackBlock.includes('P15_229_KAI_BEAT_STEP_FX_DURATION_MS'));
  assert.equal(feedbackBlock.includes('strokeCircle'), false);
  assert.equal(feedbackBlock.includes('fillCircle'), false);
  assert.equal(feedbackBlock.includes('this.add.image'), false);
}

{
  const updateBlock = sourceBlock(
    battleSceneSource,
    '  update(time, delta) {',
    '  _onPlayerDeath() {'
  );
  const resolveIndex = updateBlock.indexOf('_resolveP15KaiBeatStepVelocity(vx, vy, delta)');
  const setVelocityIndex = updateBlock.indexOf('this.player.body.setVelocity(');
  const shootIndex = updateBlock.indexOf('this._tryShoot(time)');
  assert.ok(resolveIndex >= 0, 'ordinary movement should flow through the Beat Step resolver');
  assert.ok(setVelocityIndex > resolveIndex, 'final body velocity should be set once after resolution');
  assert.ok(shootIndex > setVelocityIndex, 'auto-shoot should continue after movement resolution');

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
  const resultActionBlock = sourceBlock(
    battleSceneSource,
    '  _handleBattleResultAction(action) {',
    '  // ====================='
  );
  const releaseBlock = sourceBlock(
    battleSceneSource,
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );
  assert.ok(releaseBlock.includes('_clearP15KaiPrototypeState()'));
  assert.ok(shutdownBlock.includes("_releaseBattleRuntimeObjects('shutdown')"));
  assert.ok(endBattleBlock.includes("_releaseBattleRuntimeObjects('battle-end')"));
  assert.ok(resultActionBlock.includes("_releaseBattleRuntimeObjects('result-retry')"));
  assert.ok(resultActionBlock.includes("_releaseBattleRuntimeObjects('result-title')"));

  assert.ok(clearKaiBlock.includes(".off('down', this._p15KaiBeatStepKeyHandler)"));
  assert.ok(clearKaiBlock.includes('removeKey(this._p15KaiBeatStepKey'));
  assert.ok(clearKaiBlock.includes('_p15KaiBeatStepActive = false'));
  assert.ok(clearKaiBlock.includes('_p15KaiBeatStepRemainingPx = 0'));
  assert.ok(clearKaiBlock.includes('_p15KaiPrototypeAckText = null'));
  assert.ok(clearKaiBlock.includes('_p15KaiBeatStepFx = null'));
  assert.ok(clearKaiBlock.includes('_setMobileButtonPressed(this._p15KaiMobileControl, false)'));
  assert.equal(clearKaiBlock.includes('_clearP15ManualFocusTarget'), false);
  assert.equal(clearKaiBlock.includes('_clearP15SetlistCueChoiceOverlay'), false);
}

{
  const kaiSurface = [
    kaiGateBlock,
    movementIntentBlock,
    startBeatStepBlock,
    resolveBeatStepBlock,
    identityAckBlock,
    feedbackBlock,
    clearKaiBlock,
  ].join('\n');

  [
    'characterId',
    'team',
    'level',
    'rarity',
    'stats',
    '_p15SetlistCueId',
    'PLAYER.SPEED',
    'load.image',
    'load.audio',
    '.png',
    '.wav',
    '.mp3',
    '.ogg',
    'preload',
    'registry',
    'localStorage',
    'cooldown',
    'shield',
    'invulnerable = true',
    'support.add',
    'score +=',
    'Stage 2',
    'reward',
    'task',
    'gacha',
    'shop',
    'backend',
    'analytics',
  ].forEach((forbidden) => {
    assert.equal(
      kaiSurface.includes(forbidden),
      false,
      `Kai prototype surface must not introduce forbidden dependency: ${forbidden}`
    );
  });

  assert.equal(stageWavesSource.includes('p15Kai'), false, 'Kai must not change wave definitions');
  assert.equal(waveSystemSource.includes('p15Kai'), false, 'Kai must not change WaveSystem');
  assert.equal(charactersSource.includes('p15Kai'), false, 'Kai prototype must not change character data');
  assert.equal(configSource.includes('P15_229'), false, 'Kai prototype must not change shared config values');
  assert.equal(battleResultSource.includes('p15Kai'), false, 'Kai must not add result semantics');
}

console.log('p15229 Kai runtime performer Beat Step action contract: all assertions passed');
