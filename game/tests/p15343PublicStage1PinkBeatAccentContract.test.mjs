import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DamageCalculator, FORM_TYPE } from '../src/systems/DamageCalculator.js';
import { COLOR_HEX, COLORS } from '../src/utils/config.js';

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

function makeCue() {
  return {
    active: true,
    destroyed: false,
    destroyCount: 0,
    x: 0,
    y: 0,
    setDepth() { return this; },
    lineStyle() { return this; },
    lineBetween() { return this; },
    setPosition(x, y) {
      this.x = x;
      this.y = y;
      return this;
    },
    destroy() {
      this.active = false;
      this.destroyed = true;
      this.destroyCount += 1;
    },
  };
}

function makeHarness({ practiceMode = false } = {}) {
  const cues = [];
  const enemies = [];
  const scene = {
    battleData: { stageId: 1, practiceMode },
    add: {
      graphics() {
        const cue = makeCue();
        cues.push(cue);
        return cue;
      },
    },
    enemies: {
      children: {
        iterate(callback) { enemies.forEach(callback); },
      },
    },
  };
  return { scene, cues, enemies };
}

function installHelpers(scene, helpers) {
  [
    '_consumePublicStage1PinkBeatAccent',
    '_armPublicStage1PinkBeatAccent',
    '_clearPublicStage1PinkBeatAccent',
    '_clearAllPublicStage1PinkBeatAccent',
  ].forEach((name) => { scene[name] = helpers[name]; });
}

function makeDamageCalculator() {
  const atmosphere = {
    activeAtmospheres: { yellow: { active: false, stacks: 0 } },
    isRainbow() { return false; },
  };
  const support = { isCenterStageActive() { return false; } };
  const calculator = new DamageCalculator(atmosphere, {}, support);
  calculator.currentForm = FORM_TYPE.ATTACK;
  return calculator;
}

const helperStart = '  _consumePublicStage1PinkBeatAccent(enemy, bullet) {';
const helperEnd = '  _onEnemyKilled(enemy, killColor) {';
const helpers = compileClassMethods(sourceBlock(helperStart, helperEnd), {
  COLOR_HEX,
  COLORS,
  P15_342_PINK_BEAT_ACCENT_DEPTH: 2.1,
  P15_342_PINK_BEAT_ACCENT_ALPHA: 0.30,
  P15_342_PINK_BEAT_ACCENT_LINE_WIDTH: 1.15,
});

{
  const { scene, cues, enemies } = makeHarness();
  installHelpers(scene, helpers);
  const calculator = makeDamageCalculator();
  const enemy = { active: true, destroyed: false, hp: 30, x: 100, y: 120, drawRadius: 10 };
  enemies.push(enemy);

  const first = { color: COLORS.PINK, isCrit: false, active: true };
  const firstAccent = scene._consumePublicStage1PinkBeatAccent(enemy, first);
  assert.equal(firstAccent, false);
  const firstResult = calculator.calculate(10, enemy, first.isCrit);
  enemy.hp -= firstResult.total;
  if (enemy.hp > 0 && firstAccent !== true) scene._armPublicStage1PinkBeatAccent(enemy);

  assert.equal(firstResult.total, 13);
  assert.equal(enemy.hp, 17);
  assert.equal(enemy.p15PinkBeatAccentArmed, true);
  assert.equal(cues.length, 1);

  const second = { color: COLORS.PINK, isCrit: false, active: true };
  const secondAccent = scene._consumePublicStage1PinkBeatAccent(enemy, second);
  if (secondAccent) second.isCrit = true;
  const secondResult = calculator.calculate(10, enemy, second.isCrit);
  enemy.hp -= secondResult.total;

  assert.equal(secondAccent, true);
  assert.equal(secondResult.total, 19);
  assert.equal(enemy.hp, -2, 'Attack Pink Beat Accent should cross the 30HP two-hit breakpoint');
  assert.equal(enemy.p15PinkBeatAccentArmed, false);
  assert.equal(enemy.p15PinkBeatAccentCue, null);
  assert.equal(cues[0].destroyCount, 1);
}

{
  const { scene } = makeHarness();
  installHelpers(scene, helpers);
  const enemy = { active: true, hp: 30, x: 90, y: 110 };
  const naturalCrit = { color: COLORS.PINK, isCrit: true, active: true };
  assert.equal(scene._consumePublicStage1PinkBeatAccent(enemy, naturalCrit), false);
  scene._armPublicStage1PinkBeatAccent(enemy);
  assert.equal(enemy.p15PinkBeatAccentArmed, true, 'surviving natural first crit should still arm');

  const secondNaturalCrit = { color: COLORS.PINK, isCrit: true, active: true };
  assert.equal(scene._consumePublicStage1PinkBeatAccent(enemy, secondNaturalCrit), true);
  assert.equal(secondNaturalCrit.isCrit, true, 'existing natural crit flag remains one boolean crit path');
  assert.equal(enemy.p15PinkBeatAccentArmed, false);
}

{
  const { scene } = makeHarness();
  installHelpers(scene, helpers);
  const enemy = { active: true, x: 90, y: 110 };
  scene._armPublicStage1PinkBeatAccent(enemy);
  assert.equal(
    scene._consumePublicStage1PinkBeatAccent(
      enemy,
      { color: COLORS.BLUE, isCrit: false, active: true }
    ),
    false
  );
  assert.equal(enemy.p15PinkBeatAccentArmed, false, 'non-Pink direct hit should break sequence');
}

{
  const { scene } = makeHarness();
  installHelpers(scene, helpers);
  const enemyA = { active: true, x: 80, y: 100 };
  const enemyB = { active: true, x: 160, y: 100 };
  scene._armPublicStage1PinkBeatAccent(enemyA);
  assert.equal(
    scene._consumePublicStage1PinkBeatAccent(
      enemyB,
      { color: COLORS.PINK, isCrit: false, active: true }
    ),
    false
  );
  assert.equal(enemyA.p15PinkBeatAccentArmed, true, 'another target cannot consume exact target state');
}

{
  const hidden = makeHarness({ practiceMode: true });
  installHelpers(hidden.scene, helpers);
  const enemy = { active: true, x: 90, y: 110 };
  assert.equal(hidden.scene._armPublicStage1PinkBeatAccent(enemy), false);
  enemy.p15PinkBeatAccentArmed = true;
  assert.equal(
    hidden.scene._consumePublicStage1PinkBeatAccent(
      enemy,
      { color: COLORS.PINK, isCrit: false, active: true }
    ),
    false
  );
}

const bulletHitBlock = sourceBlock(
  '  _onBulletHitEnemy(bullet, enemy) {',
  '  _applyPublicStage1BlueTempoControl(enemy) {'
);
assert.ok(bulletHitBlock.includes('const pinkBeatAccentCritical ='));
assert.ok(bulletHitBlock.includes('this._consumePublicStage1PinkBeatAccent(enemy, bullet)'));
assert.ok(bulletHitBlock.includes('if (pinkBeatAccentCritical) bullet.isCrit = true;'));
assert.ok(
  bulletHitBlock.indexOf('if (pinkBeatAccentCritical) bullet.isCrit = true;')
    < bulletHitBlock.indexOf('this.dmgCalc.calculate(baseDmg, enemy, bullet.isCrit)')
);
assert.ok(bulletHitBlock.includes('effectPlan.armPinkBeatAccent'));
assert.ok(bulletHitBlock.includes('this._armPublicStage1PinkBeatAccent(enemy)'));

const helperBlock = sourceBlock(helperStart, helperEnd);
[
  'this.time',
  'this.tweens',
  'this.add.image',
  'load.image',
  'load.audio',
  '.png',
  '.wav',
  'player.hp',
  'enemy.hp =',
  'score',
  'support',
  'waveSystem',
].forEach((forbidden) => {
  assert.equal(helperBlock.includes(forbidden), false, `Pink Beat Accent helper must exclude: ${forbidden}`);
});

const updateBlock = sourceBlock('  update(time, delta) {', '  _onPlayerDeath() {');
assert.ok(updateBlock.includes('e.p15PinkBeatAccentCue.setPosition(e.x, e.y)'));

const pinkReleaseBlock = sourceBlock(
  "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
  '  _clearActivePlayerBulletGraphics() {'
);
const pinkKillBlock = sourceBlock('  _onEnemyKilled(enemy, killColor) {', '  _onEnemyHitPlayer(sourceBullet = null) {');
const pinkEndBlock = sourceBlock('  _endBattle(type) {', '  _showP43ResultPreview(preview) {');
assert.ok(pinkReleaseBlock.includes('_clearAllPublicStage1PinkBeatAccent'));
assert.ok(pinkKillBlock.includes('_clearPublicStage1PinkBeatAccent'));
assert.ok(pinkEndBlock.includes("_releaseBattleRuntimeObjects('battle-end')"));

console.log('p15343 public Stage 1 Pink Beat Accent contract: all assertions passed');
