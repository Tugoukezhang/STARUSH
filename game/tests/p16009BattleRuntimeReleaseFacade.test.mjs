import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BATTLE_RUNTIME_RELEASE_STEPS,
  BattleRuntimeReleaseFacade,
} from '../src/systems/BattleRuntimeReleaseFacade.mjs';

const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');

function sourceBlock(startNeedle, endNeedle) {
  const start = battleSceneSource.indexOf(startNeedle);
  const end = battleSceneSource.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return battleSceneSource.slice(start, end);
}

assert.deepEqual(BATTLE_RUNTIME_RELEASE_STEPS, [
  'mobile-input',
  'player-feedback',
  'stage-feedback',
  'prototype-control',
  'authored-pressure',
  'projectile-objects',
  'color-status',
  'enemy-readability',
  'hints-and-polish',
]);

{
  const calls = [];
  const handlers = Object.fromEntries(BATTLE_RUNTIME_RELEASE_STEPS.map((step) => [
    step,
    () => calls.push(step),
  ]));
  const facade = new BattleRuntimeReleaseFacade(handlers);
  const first = facade.release('battle-end');
  const repeated = facade.release('result-retry');

  assert.equal(first.released, true);
  assert.deepEqual(first.executed, BATTLE_RUNTIME_RELEASE_STEPS);
  assert.deepEqual(first.missing, []);
  assert.deepEqual(calls, BATTLE_RUNTIME_RELEASE_STEPS);
  assert.equal(repeated.released, false);
  assert.equal(repeated.repeated, true);
  assert.equal(repeated.firstReason, 'battle-end');
  assert.deepEqual(calls, BATTLE_RUNTIME_RELEASE_STEPS, 'repeat release must not replay handlers');
}

{
  const facade = new BattleRuntimeReleaseFacade({
    'mobile-input': () => {},
  });
  const report = facade.release('shutdown');
  assert.equal(report.released, true);
  assert.deepEqual(report.executed, ['mobile-input']);
  assert.deepEqual(report.missing, BATTLE_RUNTIME_RELEASE_STEPS.slice(1));
}

{
  const createBlock = sourceBlock('  create() {', '  _configureCenteredArcadeCircle(sprite, screenRadius) {');
  assert.ok(
    createBlock.includes('this.battleRuntimeReleaseFacade = null;'),
    'every scene create/restart must reset the per-battle release facade'
  );

  const releaseBlock = sourceBlock(
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );
  [
    '_clearMobileInputState()',
    '_clearPlayerDangerPressureRim()',
    '_clearPlayerHitBeatFlashFx()',
    '_clearStage1PerformanceIdentityCueGraphics()',
    '_clearP15SetlistCueChoiceOverlay()',
    '_clearStage15PracticeLightZone()',
    '_clearP15ManualFocusTarget()',
    '_clearP15KaiPrototypeState()',
    '_clearStage1WavePressureEvent()',
    '_clearP15HostileProjectileExperiment()',
    '_clearActivePlayerBulletGraphics()',
    '_clearActiveEnemyProjectileGraphics()',
    '_clearAllPublicStage1BlueTempoControl()',
    '_clearAllPublicStage1PinkBeatAccent()',
    '_clearAllPublicStage1OrangeConfirmations()',
    '_clearPublicStage1SupportPhraseConversion()',
    '_clearPublicStage1AttackCommitment()',
    '_clearEnemyReadabilityOutlines()',
    '_removeFirstPlayHint()',
    '_clearPresentationPolishFx()',
  ].forEach((cleanup) => {
    assert.ok(releaseBlock.includes(cleanup), `release facade must own ${cleanup}`);
  });

  const shutdownBlock = sourceBlock("this.events.once('shutdown', () => {", '    });');
  const endBattleBlock = sourceBlock('  _endBattle(type) {', '  _showP43ResultPreview(preview) {');
  const resultActionBlock = sourceBlock('  _handleBattleResultAction(action) {', '  // =====================');
  assert.ok(shutdownBlock.includes("_releaseBattleRuntimeObjects('shutdown')"));
  assert.ok(endBattleBlock.includes("_releaseBattleRuntimeObjects('battle-end')"));
  assert.ok(resultActionBlock.includes("_releaseBattleRuntimeObjects('result-retry')"));
  assert.ok(resultActionBlock.includes("_releaseBattleRuntimeObjects('result-title')"));
}

console.log('p16009 battle runtime release facade: all assertions passed');
