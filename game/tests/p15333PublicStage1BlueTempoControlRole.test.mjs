import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ATMOSPHERE, COLOR_HEX, COLORS } from '../src/utils/config.js';

const source = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

function sourceBlock(startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

function compileClassMethods(block, globals = {}) {
  return Function(
    ...Object.keys(globals),
    `"use strict"; return (class {${block.trim()}}).prototype;`
  )(...Object.values(globals));
}

function installHelpers(scene, helpers) {
  [
    '_applyPublicStage1BlueTempoControl',
    '_clearPublicStage1BlueTempoControl',
    '_clearAllPublicStage1BlueTempoControl',
  ].forEach((name) => {
    scene[name] = helpers[name];
  });
}

function makeRing() {
  return {
    active: true,
    destroyed: false,
    destroyCount: 0,
    x: 0,
    y: 0,
    setStrokeStyle() { return this; },
    setDepth() { return this; },
    setPosition(x, y) {
      this.x = x;
      this.y = y;
      return this;
    },
    destroy() {
      this.destroyCount += 1;
      this.active = false;
      this.destroyed = true;
    },
  };
}

function makeHarness({ stageId = 1, practiceMode = false } = {}) {
  const timers = [];
  const rings = [];
  const enemies = [];
  const scene = {
    battleData: { stageId, practiceMode },
    enemies: {
      children: {
        iterate(callback) {
          enemies.forEach(callback);
        },
      },
    },
    add: {
      circle(x, y) {
        const ring = makeRing().setPosition(x, y);
        rings.push(ring);
        return ring;
      },
    },
    time: {
      delayedCall(delay, callback) {
        const timer = {
          delay,
          callback,
          removed: false,
          remove() { this.removed = true; },
        };
        timers.push(timer);
        return timer;
      },
    },
  };
  return { scene, enemies, timers, rings };
}

const helperStart = '  _applyPublicStage1BlueTempoControl(enemy) {';
const helperEnd = '  _onEnemyKilled(enemy, killColor) {';
const helpers = compileClassMethods(sourceBlock(helperStart, helperEnd), {
  ATMOSPHERE,
  COLOR_HEX,
  COLORS,
});

{
  const { scene, enemies, timers, rings } = makeHarness();
  installHelpers(scene, helpers);
  const enemy = { active: true, destroyed: false, x: 90, y: 120, drawRadius: 10 };
  enemies.push(enemy);

  assert.equal(scene._applyPublicStage1BlueTempoControl(enemy), true);
  assert.equal(enemy.p15BlueTempoSlowRate, ATMOSPHERE.blue.slowRate);
  assert.equal(timers[0].delay, ATMOSPHERE.blue.duration);
  assert.equal(rings.length, 1, 'Blue Tempo Control should own one target-local ring');
  assert.equal(enemy.p15BlueTempoRing, rings[0]);

  const firstTimer = enemy.p15BlueTempoSlowTimer;
  const firstRing = enemy.p15BlueTempoRing;
  assert.equal(scene._applyPublicStage1BlueTempoControl(enemy), true);
  assert.equal(firstTimer.removed, true, 'repeat Blue hit should refresh the timer');
  assert.equal(enemy.p15BlueTempoRing, firstRing, 'repeat Blue hit should reuse the visual node');
  assert.equal(rings.length, 1, 'repeat Blue hit must not stack rings');

  enemy.p15BlueTempoSlowTimer.callback();
  assert.equal(enemy.p15BlueTempoSlowRate, 0);
  assert.equal(enemy.p15BlueTempoSlowTimer, null);
  assert.equal(enemy.p15BlueTempoRing, null);
  assert.equal(firstRing.destroyCount, 1);
}

{
  const hidden = makeHarness({ practiceMode: true });
  installHelpers(hidden.scene, helpers);
  const enemy = { active: true, x: 90, y: 120 };
  assert.equal(hidden.scene._applyPublicStage1BlueTempoControl(enemy), false);
  assert.equal(hidden.rings.length, 0, 'hidden Stage 1.5 must not receive public Blue Tempo Control');
}

{
  const publicStage = makeHarness();
  installHelpers(publicStage.scene, helpers);
  assert.equal(
    publicStage.scene._applyPublicStage1BlueTempoControl({ active: false, x: 90, y: 120 }),
    false,
    'inactive enemies must reject Blue Tempo Control'
  );
}

{
  const { scene, enemies } = makeHarness();
  installHelpers(scene, helpers);
  const enemyA = { active: true, x: 80, y: 100, drawRadius: 9 };
  const enemyB = { active: true, x: 160, y: 130, drawRadius: 11 };
  enemies.push(enemyA, enemyB);
  scene._applyPublicStage1BlueTempoControl(enemyA);
  scene._applyPublicStage1BlueTempoControl(enemyB);
  assert.equal(scene._clearAllPublicStage1BlueTempoControl(), true);
  [enemyA, enemyB].forEach((enemy) => {
    assert.equal(enemy.p15BlueTempoSlowRate, 0);
    assert.equal(enemy.p15BlueTempoSlowTimer, null);
    assert.equal(enemy.p15BlueTempoRing, null);
  });
}

const bulletHitBlock = sourceBlock(
  '  _onBulletHitEnemy(bullet, enemy) {',
  helperStart
);
assert.ok(bulletHitBlock.includes('effectPlan.applyBlueTempo'));
assert.ok(bulletHitBlock.includes('this._applyPublicStage1BlueTempoControl(enemy)'));

const playerHitBlock = sourceBlock(
  '  _onEnemyHitPlayer(sourceBullet = null) {',
  '  _getPlayerVisualTarget() {'
);
assert.equal(playerHitBlock.includes('this.atmosphere.isSlowActive()'), false);
assert.equal(playerHitBlock.includes('Math.random()'), false);
assert.equal(
  (playerHitBlock.match(/this\.player\.hp--;/g) || []).length,
  1,
  'one accepted collision must remove exactly one HP'
);

const updateBlock = sourceBlock('  update(time, delta) {', '  _onPlayerDeath() {');
assert.ok(updateBlock.includes('e.p15BlueTempoSlowRate'));
assert.ok(updateBlock.includes('e.slowFromHit'), 'Stain slow must remain independent');
assert.ok(updateBlock.includes('e.p15BlueTempoRing.setPosition(e.x, e.y)'));

const blueReleaseBlock = sourceBlock(
  "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
  '  _clearActivePlayerBulletGraphics() {'
);
const blueKillBlock = sourceBlock('  _onEnemyKilled(enemy, killColor) {', '  _onEnemyHitPlayer(sourceBullet = null) {');
const blueEndBlock = sourceBlock('  _endBattle(type) {', '  _showP43ResultPreview(preview) {');
assert.ok(blueReleaseBlock.includes('_clearAllPublicStage1BlueTempoControl'));
assert.ok(blueKillBlock.includes('_clearPublicStage1BlueTempoControl'));
assert.ok(blueEndBlock.includes("_releaseBattleRuntimeObjects('battle-end')"));
assert.equal(
  sourceBlock('  _scheduleFirstPlayWaveAssist(waveIndex) {', '  _onAllWavesClear() {').includes('enemy.destroy()'),
  false,
  'first-play assist must not auto-destroy Wave 1 enemies'
);

const helperBlock = sourceBlock(helperStart, helperEnd);
[
  'load.image',
  'load.audio',
  '.png',
  '.wav',
  'this.sound',
  'this.tweens',
  'score',
  'support',
  'waveSystem',
  'player.hp',
].forEach((forbidden) => {
  assert.equal(helperBlock.includes(forbidden), false, `Blue Tempo helper must exclude: ${forbidden}`);
});

console.log('p15333 public Stage 1 Blue Tempo Control role: all assertions passed');
