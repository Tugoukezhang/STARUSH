import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PUBLIC_STAGE1_ENEMY_ROLES,
  PUBLIC_STAGE1_ENEMY_STATES,
  canEnemyBePublicStage1PaintTarget,
  canEnemyDealContactDamage,
} from '../src/systems/PublicStage1EnemyRoles.mjs';
import {
  PUBLIC_STAGE1_ENCOUNTER_PHASES,
  PublicStage1EncounterDirector,
} from '../src/systems/PublicStage1EncounterDirector.mjs';

const battleSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

assert.equal(
  PUBLIC_STAGE1_ENEMY_ROLES.SPOTLIGHT_CAPTAIN,
  'spotlight-captain',
  'the elite must own one explicit role instead of becoming a fourth generic attacker'
);

const captainWindup = {
  active: true,
  publicStage1EnemyRole: PUBLIC_STAGE1_ENEMY_ROLES.SPOTLIGHT_CAPTAIN,
  publicStage1EnemyState: PUBLIC_STAGE1_ENEMY_STATES.WINDUP,
};
const captainRecovery = {
  ...captainWindup,
  publicStage1EnemyState: PUBLIC_STAGE1_ENEMY_STATES.RECOVERY,
};
assert.equal(canEnemyDealContactDamage({ enemy: captainWindup, isPublicStage1: true }), false);
assert.equal(canEnemyDealContactDamage({ enemy: captainRecovery, isPublicStage1: true }), false);
assert.equal(canEnemyBePublicStage1PaintTarget(captainWindup), false);
assert.equal(canEnemyBePublicStage1PaintTarget(captainRecovery), true);

assert.deepEqual(
  PUBLIC_STAGE1_ENCOUNTER_PHASES.map((phase) => phase.spotlightCaptainEnabled),
  [false, false, false, true],
  'the spotlight captain must remain a single high-point encounter'
);

{
  const director = new PublicStage1EncounterDirector({ stageId: 1, practiceMode: false });
  assert.equal(director.begin({ now: 1000 }), true);
  director.advance(166000, { completed: 8, total: 10 });
  assert.equal(
    director.claimSpotlightCaptainOpportunity(173999),
    false,
    'the high point must retain an eight-second lead'
  );
  assert.equal(
    director.claimSpotlightCaptainOpportunity(174000),
    true
  );
  assert.equal(
    director.claimSpotlightCaptainOpportunity(175000),
    false,
    'the elite is authored once per run'
  );
  director.reset();
  assert.equal(director.claimSpotlightCaptainOpportunity(200000), false);
}

assert.match(
  battleSource,
  /P16_017_SPOTLIGHT_CAPTAIN_PAINT_HP\s*=\s*STAGE1_PAINT_PER_HIT\s*\*\s*3/,
  'the recovery window must require exactly three existing paint hits'
);

const encounterBlock = sourceBlock(
  battleSource,
  '  _updatePublicStage1Encounter() {',
  '  _scheduleNextUnlitSpawn('
);
const drawBlock = sourceBlock(
  battleSource,
  '  _drawPublicStage1SpotlightCaptainGfx(',
  '  _spawnPublicStage1SpotlightCaptain(restore=null) {'
);
const spawnBlock = sourceBlock(
  battleSource,
  '  _spawnPublicStage1SpotlightCaptain(restore=null) {',
  '  _beginPublicStage1SpotlightCaptainDisruption('
);
const disruptionBlock = sourceBlock(
  battleSource,
  '  _beginPublicStage1SpotlightCaptainDisruption(',
  '  _beginPublicStage1SpotlightCaptainCue('
);
const cueBlock = sourceBlock(
  battleSource,
  '  _beginPublicStage1SpotlightCaptainCue(',
  '  _releasePublicStage1SpotlightCaptainCue('
);
const releaseBlock = sourceBlock(
  battleSource,
  '  _releasePublicStage1SpotlightCaptainCue(',
  "  _clearPublicStage1SpotlightCaptain(reason = 'cleared'"
);
const clearBlock = sourceBlock(
  battleSource,
  "  _clearPublicStage1SpotlightCaptain(reason = 'cleared'",
  '  _drawPublicStage1ObjectiveDisruptorGfx('
);
const paintTargetBlock = sourceBlock(
  battleSource,
  '  _paintPublicStage1TargetsAt(',
  '  _drawUnlitBlobGfx('
);
const targetBlock = sourceBlock(
  battleSource,
  '  _selectAutoAimTarget() {',
  '  _tryShoot(time) {'
);
const freezeBlock = sourceBlock(
  battleSource,
  "  _freezePublicPaintRound(reason = 'stopped') {",
  '  _clearPublicPaintRound() {'
);

assert.ok(encounterBlock.includes('getPendingAuthoredRoles'));
assert.ok(encounterBlock.includes('_spawnPublicStage1SpotlightCaptain()'));
assert.ok(encounterBlock.includes('beginAuthoredRole'));
assert.ok(spawnBlock.includes('this._publicStage1SpotlightCaptain?.active'));
assert.ok(spawnBlock.includes('getNearestCurrentZonePaintable'));
assert.ok(spawnBlock.includes('PUBLIC_STAGE1_ENEMY_ROLES.SPOTLIGHT_CAPTAIN'));
assert.ok(spawnBlock.includes('P16_017_SPOTLIGHT_CAPTAIN_PAINT_HP'));
assert.ok(disruptionBlock.includes('setDeviceSuppressed(device, true)'));
assert.ok(cueBlock.includes('setDeviceSuppressed(device, false)'));
assert.ok(cueBlock.includes('publicStage1CueCapture'));
assert.ok(releaseBlock.includes('_spawnPublicStage1StageCuePulse(captain)'));
assert.ok(releaseBlock.includes('PUBLIC_STAGE1_ENEMY_STATES.RECOVERY'));
assert.ok(clearBlock.includes('setDeviceSuppressed(device, false)'));
assert.ok(clearBlock.includes('publicStage1CaptainIntroTimer'));
assert.ok(clearBlock.includes('publicStage1CaptainDisruptionTimer'));
assert.ok(clearBlock.includes('publicStage1CaptainCueTimer'));
assert.ok(clearBlock.includes('publicStage1CaptainRecoveryTimer'));
assert.ok(paintTargetBlock.includes('SPOTLIGHT_CAPTAIN'));
assert.ok(targetBlock.includes('nearestSpotlightCaptain'));
assert.ok(freezeBlock.includes("_clearPublicStage1SpotlightCaptain('round-frozen')"));
assert.ok(drawBlock.includes('lineBetween'));
assert.equal(/load\.(image|audio)|this\.add\.(image|sprite|text)|tweens\./.test(drawBlock), false);
assert.equal(battleSource.includes("load.image('spotlight-captain"), false);
assert.equal(battleSource.includes("load.audio('spotlight-captain"), false);
assert.equal(battleSource.includes('bossHp'), false);

console.log('p16017 public Stage 1 spotlight captain elite encounter: all assertions passed');
