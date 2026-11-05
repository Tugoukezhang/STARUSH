import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CP_EFFECTS } from '../src/systems/CPComboHandler.js';

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

const battleSource = readSource('../src/scenes/BattleScene.js');
const atmosphereSource = readSource('../src/systems/AtmosphereSystem.js');
const encoreSource = readSource('../src/systems/EncoreSystem.js');
const stageWaveSource = readSource('../src/utils/stageWaves.mjs');

[
  '_isP15CpSweetQuintetEnabled',
  '_hasPink5',
  '_trySweetBloom',
  '_trySweetWish',
  '_trySweetPhantom',
  '_trySweetGuard',
  '_trySweetResonance',
  'onSweetBloom',
  'onSweetWish',
  'onSweetPhantom',
  'onSweetGuard',
  'onSweetResonance',
  '_sweetBloomActive',
  '_shieldHits',
  'playerShield',
  'shieldRing',
  '甜蜜绽放!',
  '甜蜜心愿!',
  '甜蜜守护!',
  '甜蜜共鸣!',
].forEach((retiredSymbol) => {
  assert.equal(
    battleSource.includes(retiredSymbol),
    false,
    `retired CP sweet quintet runtime symbol must be absent: ${retiredSymbol}`
  );
});

const playerHitBlock = sourceBlock(
  battleSource,
  '  _onEnemyHitPlayer(sourceBullet = null) {',
  '  _getPlayerVisualTarget() {'
);
[
  "this._consumeP15HostileProjectile(sourceBullet, 'hit');",
  'if (this._battleEnded) return;',
  'if (this.player.invulnerable) return;',
  'this.battleRecord.playerHitCount',
  'this.player.hp--;',
  'const lethalHit = this.player.hp <= 0;',
  'this._spawnPlayerHitBeatFlash(this.player.x, this.player.y);',
  'this.p17Audio?.playPlayerDamage({ time: this.time?.now, lethal: lethalHit });',
  'this.cameras.main.shake(100, 0.005)',
  'this.player.invulnerable = true;',
  'this.support.gainFromTakeDamage();',
  'if (lethalHit) this._onPlayerDeath();',
].forEach((required) => {
  assert.ok(playerHitBlock.includes(required), `canonical damage contract must remain: ${required}`);
});

assert.equal(playerHitBlock.includes('this.atmosphere.isSlowActive()'), false);
assert.equal(playerHitBlock.includes('Math.random()'), false);
assert.equal(
  (playerHitBlock.match(/this\.player\.hp--;/g) || []).length,
  1,
  'canonical damage contract must remove exactly one HP per accepted collision'
);

assert.equal(Object.keys(CP_EFFECTS).length, 10, 'all ten base two-colour CP definitions must remain');
assert.deepEqual(
  new Set(Object.values(CP_EFFECTS).map((entry) => entry.effectType)),
  new Set(['slow_field', 'crit_burst', 'frost_shine', 'burn_spread', 'dot_chain', 'none'])
);

[
  'triggerFromKill(color)',
  'triggerBlueFromMove()',
  'triggerYellowFromCombo()',
  'isRainbow()',
  'getCritRate()',
].forEach((required) => {
  assert.ok(atmosphereSource.includes(required), `AtmosphereSystem contract must remain: ${required}`);
});

[
  'tryWeakPointBreak(enemy)',
  '_applyEncore(enemy)',
  'calcRainbowDamage(baseDamage, targetIsEncore)',
].forEach((required) => {
  assert.ok(encoreSource.includes(required), `EncoreSystem contract must remain: ${required}`);
});

assert.ok(stageWaveSource.includes('const STAGE_1_INTERVALS_MS'));
assert.ok(stageWaveSource.includes('const STAGE_1_PRACTICE_SEGMENT_DEFS'));
assert.ok(stageWaveSource.includes('normalized.practiceMode === true'));
assert.ok(battleSource.includes('_scheduleStage1WavePressureEvent'));
assert.ok(battleSource.includes('_updateStage1WavePressureEvent'));
assert.ok(battleSource.includes('_isStage15PracticeMode()'));

[
  'load.image',
  'load.audio',
  '.mp3',
  '.ogg',
  'localStorage',
  'Stage 2',
  'gacha',
  'shop',
].forEach((forbidden) => {
  const retirementSurface = playerHitBlock;
  assert.equal(
    retirementSurface.includes(forbidden),
    false,
    `retirement must not introduce unrelated behavior: ${forbidden}`
  );
});

console.log('p15322 CP sweet quintet runtime retirement: all assertions passed');
