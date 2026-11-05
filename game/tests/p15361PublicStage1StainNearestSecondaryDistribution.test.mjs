import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAMAGE_ZONES } from '../src/utils/config.js';

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

const helperStart = '  _selectPublicStage1StainSecondary(primaryEnemy) {';
const helperEnd = '  _applyStainSplash(hitX, hitY, bullet, dmgAmount) {';
const helperBlock = sourceBlock(helperStart, helperEnd);
const helpers = compileClassMethods(helperBlock, { DAMAGE_ZONES });

function activeEnemy(overrides = {}) {
  return {
    active: true,
    destroyed: false,
    type: 'trainee',
    x: 0,
    y: 0,
    hp: 30,
    drawRadius: 10,
    ...overrides,
  };
}

function makeScene({ stageId = 1, practiceMode = false, enemies = [] } = {}) {
  const calls = {
    damage: [],
    handoff: [],
    killed: [],
    timers: [],
  };
  const scene = {
    battleData: { stageId, practiceMode },
    enemies: {
      children: {
        iterate(callback) { enemies.forEach(callback); },
      },
    },
    add: {
      circle(x, y, radius) {
        return {
          active: true,
          x,
          y,
          radius,
          setStrokeStyle() { return this; },
          setDepth() { return this; },
          setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this; },
          destroy() { this.active = false; },
        };
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
        calls.timers.push(timer);
        return timer;
      },
    },
    _spawnDamageNumber(...args) { calls.damage.push(args); },
    _spawnPublicStage1StainHandoffFx(...args) { calls.handoff.push(args); },
    _onEnemyKilled(...args) { calls.killed.push(args); },
    _selectPublicStage1StainSecondary: helpers._selectPublicStage1StainSecondary,
    _applyPublicStage1StainDistribution: helpers._applyPublicStage1StainDistribution,
  };
  return { scene, calls };
}

{
  const primary = activeEnemy({ x: 100, y: 100 });
  const tieFirst = activeEnemy({ x: 120, y: 100 });
  const tieSecond = activeEnemy({ x: 80, y: 100 });
  const farther = activeEnemy({ x: 180, y: 100 });
  const duplicatePosition = activeEnemy({ x: 100, y: 100 });
  const ignored = [
    activeEnemy({ x: 101, y: 100, active: false }),
    activeEnemy({ x: 101, y: 100, destroyed: true }),
    activeEnemy({ x: 101, y: 100, type: 'anti' }),
    activeEnemy({ x: Number.NaN, y: 100 }),
  ];
  const { scene } = makeScene({
    enemies: [primary, farther, tieFirst, tieSecond, duplicatePosition, ...ignored],
  });
  assert.equal(scene._selectPublicStage1StainSecondary(primary), duplicatePosition);

  duplicatePosition.destroyed = true;
  assert.equal(
    scene._selectPublicStage1StainSecondary(primary),
    tieFirst,
    'equal distances retain deterministic group order'
  );

  assert.equal(makeScene({ practiceMode: true, enemies: [primary, tieFirst] }).scene
    ._selectPublicStage1StainSecondary(primary), null);
  assert.equal(makeScene({ stageId: 2, enemies: [primary, tieFirst] }).scene
    ._selectPublicStage1StainSecondary(primary), null);
}

{
  const primary = activeEnemy({ x: 100, y: 100 });
  const secondary = activeEnemy({ x: 300, y: 500 });
  const { scene, calls } = makeScene({ enemies: [primary, secondary] });
  const bullet = { active: true, color: 'blue' };

  assert.equal(scene._applyPublicStage1StainDistribution(primary, bullet, 11), true);
  assert.equal(secondary.hp, 26, 'secondary damage is floor(40% of direct damage)');
  assert.equal(secondary.slowFromHit, DAMAGE_ZONES.FORM.STAIN_SLOW);
  assert.equal(calls.damage.length, 1);
  assert.equal(calls.handoff.length, 1);
  assert.equal(calls.killed.length, 0);
  assert.equal(calls.timers.length, 1);
  assert.equal(calls.timers[0].delay, 1500 + DAMAGE_ZONES.FORM.STAIN_DUR);

  const firstTimer = secondary.p15PublicStainSlowTimer;
  assert.equal(scene._applyPublicStage1StainDistribution(primary, bullet, 11), true);
  assert.equal(firstTimer.removed, true, 'a refreshed slow cancels its stale cleanup timer');
  firstTimer.callback();
  assert.equal(
    secondary.slowFromHit,
    DAMAGE_ZONES.FORM.STAIN_SLOW,
    'a stale callback cannot clear the refreshed slow'
  );
  const secondTimer = secondary.p15PublicStainSlowTimer;
  secondTimer.callback();
  assert.equal(secondary.slowFromHit, 0);
  assert.equal(secondary.p15PublicStainSlowTimer, null);
}

{
  const primary = activeEnemy({ x: 100, y: 100 });
  const secondary = activeEnemy({ x: 200, y: 100, hp: 3 });
  const { scene, calls } = makeScene({ enemies: [primary, secondary] });
  const bullet = { active: true, color: 'orange' };
  assert.equal(scene._applyPublicStage1StainDistribution(primary, bullet, 11), true);
  assert.equal(calls.killed.length, 1);
  assert.equal(calls.killed[0][0], secondary);
  assert.equal(calls.killed[0][1], bullet.color, 'secondary kill retains direct bullet color');
}

{
  const primary = activeEnemy({ x: 100, y: 100 });
  const { scene, calls } = makeScene({ enemies: [primary] });
  assert.equal(
    scene._applyPublicStage1StainDistribution(primary, { active: true, color: 'pink' }, 11),
    false
  );
  assert.deepEqual(calls, { damage: [], handoff: [], killed: [], timers: [] });
}

const hitBlock = sourceBlock(
  '  _onBulletHitEnemy(bullet, enemy) {',
  '  _recordPublicStage1SupportPhraseHit(enemy, bullet) {'
);
assert.equal(
  (hitBlock.match(/this\._applyPublicStage1StainDistribution\(enemy, bullet, result\.total\)/g) || []).length,
  1
);
assert.equal(
  (hitBlock.match(/this\._applyStainSplash\(enemy\.x, enemy\.y, bullet, result\.total\)/g) || []).length,
  1,
  'hidden practice retains the legacy radius behavior'
);
assert.ok(hitBlock.includes('COMBAT_STAIN_RESOLUTION_MODES.PRACTICE_SPLASH'));
assert.ok(hitBlock.includes('COMBAT_STAIN_RESOLUTION_MODES.PUBLIC_DISTRIBUTION'));

const fxBlock = sourceBlock(
  '  _spawnPublicStage1StainHandoffFx(primaryEnemy, secondaryEnemy) {',
  '  _applyStainSplash(hitX, hitY, bullet, dmgAmount) {'
);
assert.ok(fxBlock.includes('this.add.graphics()'));
assert.ok(fxBlock.includes('.setDepth(4)'));
assert.ok(fxBlock.includes('0.30'));
assert.ok(fxBlock.includes('duration: 180'));
[
  'load.image',
  'load.audio',
  '.png',
  '.wav',
  'add.sprite',
  'add.image',
  'add.circle',
  'setInteractive',
].forEach((forbidden) => {
  assert.equal(fxBlock.includes(forbidden), false, `handoff FX must exclude: ${forbidden}`);
});

assert.equal(DAMAGE_ZONES.FORM.STAIN_SLOW, 0.20);
assert.equal(DAMAGE_ZONES.FORM.STAIN_DUR, 1000);

console.log('p15361 public Stage 1 Stain nearest secondary distribution: all assertions passed');
