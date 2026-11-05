import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AtmosphereSystem } from '../src/systems/AtmosphereSystem.js';
import { ATMOSPHERE, COLORS, DAMAGE_ZONES } from '../src/utils/config.js';

const battleSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');
const atmosphereSource = readFileSync(
  new URL('../src/systems/AtmosphereSystem.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

function makeAtmosphere() {
  const timers = [];
  const scene = {
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
  return { atmosphere: new AtmosphereSystem(scene), timers };
}

function directHit(atmosphere, color, { killed = false } = {}) {
  atmosphere.triggerFromHit(color, { killed });
  if (killed) atmosphere.triggerFromKill(color);
}

{
  const { atmosphere } = makeAtmosphere();
  for (let index = 0; index < 5; index += 1) {
    directHit(atmosphere, COLORS.PINK);
  }
  assert.equal(atmosphere.combo, 5);
  assert.equal(
    atmosphere.activeAtmospheres.yellow.active,
    false,
    'five non-Yellow hits must not activate Yellow'
  );
}

{
  const { atmosphere } = makeAtmosphere();
  for (let index = 0; index < 4; index += 1) directHit(atmosphere, COLORS.PINK);
  directHit(atmosphere, COLORS.YELLOW);
  assert.equal(atmosphere.combo, 5);
  assert.equal(atmosphere.activeAtmospheres.yellow.active, true);
  assert.equal(atmosphere.activeAtmospheres.yellow.stacks, 1);
}

{
  const { atmosphere } = makeAtmosphere();
  for (let index = 0; index < 4; index += 1) directHit(atmosphere, COLORS.PINK);
  directHit(atmosphere, COLORS.YELLOW, { killed: true });
  assert.equal(atmosphere.combo, 5, 'one lethal direct hit must add one combo');
  assert.equal(
    atmosphere.activeAtmospheres.yellow.stacks,
    1,
    'threshold Yellow kill must activate exactly one Yellow stack'
  );
}

{
  const { atmosphere } = makeAtmosphere();
  directHit(atmosphere, COLORS.PINK, { killed: true });
  assert.equal(atmosphere.combo, 1, 'Pink lethal direct hit must add one combo');
  assert.equal(atmosphere.activeAtmospheres.pink.stacks, 1);
  assert.equal(atmosphere.activeAtmospheres.yellow.active, false);
}

{
  const { atmosphere } = makeAtmosphere();
  atmosphere.triggerFromKill(COLORS.PURPLE);
  assert.equal(atmosphere.combo, 0, 'non-direct kill entry must not add combo');
  assert.equal(atmosphere.activeAtmospheres.purple.stacks, 1);
}

assert.equal(ATMOSPHERE.yellow.comboThreshold, 5);
assert.equal(ATMOSPHERE.yellow.duration, 4000);
assert.equal(ATMOSPHERE.yellow.maxStacks, 3);
assert.equal(DAMAGE_ZONES.SKILL.SHINING_MARK, 0.15);

const triggerFromKillBlock = sourceBlock(
  atmosphereSource,
  '  triggerFromKill(color) {',
  '  /** Combo命中时调用（非击杀） */'
);
assert.equal(triggerFromKillBlock.includes('_addCombo()'), false);

const triggerFromHitBlock = sourceBlock(
  atmosphereSource,
  '  triggerFromHit(color, { killed = false } = {}) {',
  '  /** 移动时触发蓝色 */'
);
assert.ok(triggerFromHitBlock.includes('this._addCombo();'));
assert.ok(triggerFromHitBlock.includes('color === COLORS.YELLOW'));
assert.ok(triggerFromHitBlock.includes('killed !== true'));
assert.ok(triggerFromHitBlock.includes('this.triggerYellowFromCombo();'));

const addComboBlock = sourceBlock(
  atmosphereSource,
  '  _addCombo() {',
  '  /** 检查CP应援和三色联合 */'
);
assert.equal(
  addComboBlock.includes('triggerYellowFromCombo'),
  false,
  'generic combo increment must not activate Yellow'
);

const bulletHitBlock = sourceBlock(
  battleSource,
  '  _onBulletHitEnemy(bullet, enemy) {',
  '  _applyPublicStage1BlueTempoControl(enemy) {'
);
assert.ok(bulletHitBlock.includes('const targetKilledByDirectHit = damageResult.killed;'));
assert.ok(
  bulletHitBlock.includes(
    'this.atmosphere.triggerFromHit(bullet.color, { killed: targetKilledByDirectHit });'
  )
);
assert.equal(
  (bulletHitBlock.match(/this\.atmosphere\.triggerFromHit/g) || []).length,
  1,
  'direct bullet path must record one hit event'
);

[
  'load.image',
  'load.audio',
  '.png',
  '.wav',
  'Stage 2',
  'reward',
  'gacha',
  'shop',
  'backend',
].forEach((forbidden) => {
  assert.equal(triggerFromHitBlock.includes(forbidden), false);
});

console.log('p15338 public Stage 1 Yellow trigger ownership: all assertions passed');
