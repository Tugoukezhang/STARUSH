import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

assert.match(
  battleSceneSource,
  /const P15_394_STAGE1_CUE_CALLER_ENTRY_Y = 52;/,
  'caller must enter inside the readable viewport band'
);

const spawnBlock = sourceBlock(
  battleSceneSource,
  '  _spawnEnemyByType(type) {',
  '  _attachStage15PressureGraphics(enemy, enemyType, radius) {'
);
assert.ok(spawnBlock.includes('case STAGE_1_CUE_CALLER_TYPE:'));
assert.ok(spawnBlock.includes('radius = 10; hp = ENEMY_TYPES.TRAINEE.hp; speed = ENEMY_TYPES.TRAINEE.speed'));
assert.match(
  spawnBlock,
  /enemyType === STAGE_1_CUE_CALLER_TYPE\s*\? P15_394_STAGE1_CUE_CALLER_ENTRY_Y\s*:\s*0;/,
  'only the caller should receive the readable entry Y'
);
assert.ok(
  spawnBlock.includes('this._maybeBeginStage1CueCallerPressureAction(enemy);'),
  'caller must retain immediate owner-spawn activation'
);

const beginBlock = sourceBlock(
  battleSceneSource,
  '  _beginStage1WavePressureEvent(state) {',
  '  _getStage1WavePressureHorizontalVelocity() {'
);
assert.ok(beginBlock.includes('P15_260_STAGE1_WAVE_PRESSURE_ANNOUNCE_TO_CAPTURE_MS'));
assert.ok(beginBlock.includes('P15_260_STAGE1_WAVE_PRESSURE_CAPTURE_TO_RELEASE_MS'));

const combined = [spawnBlock, beginBlock].join('\n');
[
  'load.image',
  '.png',
  'setInvulnerable',
  'targetFilter',
  'new Phaser.Time',
].forEach((forbidden) => {
  assert.equal(combined.includes(forbidden), false, `forbidden caller entry dependency: ${forbidden}`);
});

assert.equal(stageWavesSource.includes('P15_394_'), false);
assert.equal(waveSystemSource.includes('P15_394_'), false);

console.log('p15394 public Stage 1 W2 cue caller visible entry: all assertions passed');
