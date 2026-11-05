import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ATMOSPHERE } from '../src/utils/config.js';

function read(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

const battleSource = read('../src/scenes/BattleScene.js');
const atmosphereSource = read('../src/systems/AtmosphereSystem.js');
const configSource = read('../src/utils/config.js');
const titleSource = read('../src/scenes/TitleScene.js');
const shellSource = read('../src/systems/PublicShellView.mjs');
const retirementTestSource = read('./p15322CpSweetQuintetRuntimeRetirement.test.mjs');

[
  [battleSource, 'triggerPurpleFromStand'],
  [battleSource, 'standTime'],
  [atmosphereSource, 'triggerPurpleFromStand'],
  [configSource, 'standTime:'],
  [titleSource, '站定→紫色'],
  [shellSource, '站定→紫色'],
  [retirementTestSource, 'triggerPurpleFromStand()'],
].forEach(([source, forbidden]) => {
  assert.equal(source.includes(forbidden), false, `retired Purple owner must be absent: ${forbidden}`);
});

assert.equal(
  titleSource.includes('蓝色跟随移动 · 紫色腐蚀 · 黄弹连击 · 击杀触发对应氛围'),
  false,
  'Production Desk must not keep the unreadable colour dump on the public desk'
);
// P16-056 moves the entry to the shared shell; chapter rules live in the existing briefing.
assert.match(titleSource, /new PublicShellView\(/);
assert.doesNotMatch(shellSource, /蓝色跟随移动 · 紫色腐蚀 · 黄弹连击 · 击杀触发对应氛围/);

const purpleHitStart = battleSource.indexOf('if (effectPlan.addCorrosion) {');
const purpleHitEnd = battleSource.indexOf('// 灼烧中的目标', purpleHitStart);
assert.ok(purpleHitStart >= 0 && purpleHitEnd > purpleHitStart, 'direct Purple hit block must remain');
const purpleHitBlock = battleSource.slice(purpleHitStart, purpleHitEnd);
assert.ok(purpleHitBlock.includes('enemy.corrosionStacks = (enemy.corrosionStacks || 0) + 1'));
assert.ok(purpleHitBlock.includes('delay: 1000, loop: true'));
assert.ok(purpleHitBlock.includes('enemy.hp -= dotDmg'));
assert.ok(purpleHitBlock.includes('this._onEnemyKilled(enemy, COLORS.PURPLE)'));

assert.deepEqual(
  {
    duration: ATMOSPHERE.purple.duration,
    dotRate: ATMOSPHERE.purple.dotRate,
    maxStacks: ATMOSPHERE.purple.maxStacks,
    slowPerStack: ATMOSPHERE.purple.slowPerStack,
  },
  { duration: 5000, dotRate: 0.02, maxStacks: 5, slowPerStack: 0.10 }
);
assert.equal('standTime' in ATMOSPHERE.purple, false);

assert.ok(battleSource.includes('this.atmosphere.triggerBlueFromMove()'));
assert.ok(atmosphereSource.includes("color === COLORS.YELLOW && killed !== true"));
assert.ok(battleSource.includes('this._consumePublicStage1PinkBeatAccent(enemy, bullet)'));
assert.ok(battleSource.includes('if (effectPlan.applyBurn)'));

console.log('p15348 public Stage 1 Purple ownership removal: all assertions passed');
