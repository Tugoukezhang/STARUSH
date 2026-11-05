import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DamageCalculator, FORM_TYPE } from '../src/systems/DamageCalculator.js';

const battleSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');
const calculatorSource = readFileSync(
  new URL('../src/systems/DamageCalculator.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

function sourceBlock(source, startNeedle, endNeedle) {
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
    x: 0,
    y: 0,
    setDepth() { return this; },
    lineStyle() { return this; },
    lineBetween() { return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    destroy() { this.active = false; this.destroyed = true; },
  };
}

const helperStart = '  _isPublicStage1AttackCommitmentEnabled() {';
const helperEnd = '  _selectAutoAimTarget() {';
const helperBlock = sourceBlock(battleSource, helperStart, helperEnd);
const helpers = compileClassMethods(helperBlock, { FORM_TYPE });

function makeEnemy(overrides = {}) {
  return {
    active: true,
    destroyed: false,
    type: 'trainee',
    hp: 20,
    x: 100,
    y: 150,
    drawRadius: 10,
    ...overrides,
  };
}

function makeScene({ stageId = 1, practiceMode = false, form = FORM_TYPE.ATTACK } = {}) {
  const enemies = [];
  const cues = [];
  const scene = {
    battleData: { stageId, practiceMode },
    currentForm: form,
    _battleEnded: false,
    _publicStage1AttackCommittedTarget: null,
    _publicStage1AttackCommitmentGfx: null,
    enemies: {
      contains(enemy) { return enemies.includes(enemy); },
      getChildren() { return enemies; },
      children: { iterate(callback) { enemies.forEach(callback); } },
    },
    add: {
      graphics() {
        const cue = makeCue();
        cues.push(cue);
        return cue;
      },
    },
  };
  [
    '_isPublicStage1AttackCommitmentEnabled',
    '_commitPublicStage1AttackTarget',
    '_getValidPublicStage1AttackCommittedTarget',
    '_clearPublicStage1AttackCommitment',
    '_syncPublicStage1AttackCommitmentFx',
  ].forEach((name) => { scene[name] = helpers[name]; });
  return { scene, enemies, cues };
}

{
  const { scene, enemies, cues } = makeScene();
  const target = makeEnemy();
  enemies.push(target);
  assert.equal(scene._commitPublicStage1AttackTarget(target), true);
  assert.equal(scene._publicStage1AttackCommittedTarget, target);
  assert.equal(cues.length, 1);
  assert.equal(scene._getValidPublicStage1AttackCommittedTarget(), target);

  target.x = 130;
  target.y = 180;
  assert.equal(scene._syncPublicStage1AttackCommitmentFx(), true);
  assert.equal(scene._publicStage1AttackCommitmentGfx.x, 130);
  assert.equal(scene._publicStage1AttackCommitmentGfx.y, 180);

  assert.equal(scene._clearPublicStage1AttackCommitment(), true);
  assert.equal(scene._publicStage1AttackCommittedTarget, null);
  assert.equal(scene._publicStage1AttackCommitmentGfx, null);
  assert.equal(cues[0].destroyed, true);
}

for (const { options, enemy } of [
  { options: { practiceMode: true }, enemy: makeEnemy() },
  { options: { stageId: 2 }, enemy: makeEnemy() },
  { options: { form: FORM_TYPE.STAIN }, enemy: makeEnemy() },
  { options: { form: FORM_TYPE.SUPPORT }, enemy: makeEnemy() },
  { options: {}, enemy: makeEnemy({ hp: 0 }) },
  { options: {}, enemy: makeEnemy({ active: false }) },
  { options: {}, enemy: makeEnemy({ destroyed: true }) },
  { options: {}, enemy: makeEnemy({ type: 'anti' }) },
]) {
  const { scene, enemies } = makeScene(options);
  enemies.push(enemy);
  assert.equal(scene._commitPublicStage1AttackTarget(enemy), false);
  assert.equal(scene._publicStage1AttackCommittedTarget, null);
}

{
  const { scene, enemies } = makeScene();
  const target = makeEnemy();
  enemies.push(target);
  scene._commitPublicStage1AttackTarget(target);
  enemies.length = 0;
  assert.equal(scene._getValidPublicStage1AttackCommittedTarget(), null);
  assert.equal(scene._publicStage1AttackCommittedTarget, null);
}

const selectBlock = sourceBlock(
  battleSource,
  '  _selectAutoAimTarget() {',
  '  _tryShoot(time) {'
);
const selectPrototype = compileClassMethods(selectBlock, {
  STAGE_15_STAGE_MARKER_TARGET_TYPE: 'stage15StageMarkerTarget',
});
{
  const manual = makeEnemy({ x: 300, y: 100 });
  const committed = makeEnemy({ x: 20, y: 100 });
  const nearest = makeEnemy({ x: 188, y: 500 });
  const scene = {
    player: { x: 188, y: 560 },
    enemies: { children: { iterate(callback) { [committed, nearest].forEach(callback); } } },
    _isStage15PracticeMode: () => false,
    _getValidP15ManualFocusTarget: () => manual,
    _getValidPublicStage1AttackCommittedTarget: () => committed,
  };
  assert.equal(selectPrototype._selectAutoAimTarget.call(scene), manual);
  scene._getValidP15ManualFocusTarget = () => null;
  assert.equal(selectPrototype._selectAutoAimTarget.call(scene), committed);
  scene._getValidPublicStage1AttackCommittedTarget = () => null;
  assert.equal(selectPrototype._selectAutoAimTarget.call(scene), nearest);
}

const hitBlock = sourceBlock(
  battleSource,
  '  _onBulletHitEnemy(bullet, enemy) {',
  '  _recordPublicStage1SupportPhraseHit(enemy, bullet) {'
);
assert.equal(
  (hitBlock.match(/this\._commitPublicStage1AttackTarget\(enemy\)/g) || []).length,
  1,
  'one accepted direct hit enters the commitment helper exactly once'
);
assert.ok(
  hitBlock.indexOf('enemy.hp = damageResult.hpAfter')
    < hitBlock.indexOf('this._commitPublicStage1AttackTarget(enemy)')
);

{
  const atmosphere = {
    activeAtmospheres: { yellow: { active: false, stacks: 0 } },
    isRainbow() { return false; },
  };
  const support = { isCenterStageActive() { return false; } };
  const calculator = new DamageCalculator(atmosphere, {}, support);
  calculator.currentForm = FORM_TYPE.ATTACK;
  assert.equal(calculator.calculate(10, {}, false).total, 13, 'compatibility default retains Attack bonus');
  calculator.setAttackFormBonusEnabled(false);
  assert.equal(calculator.calculate(10, {}, false).total, 11, 'public contract retires Attack bonus');
  calculator.setAttackFormBonusEnabled(true);
  assert.equal(calculator.calculate(10, {}, false).total, 13);
}

assert.ok(calculatorSource.includes('this.attackFormBonusEnabled = true'));
assert.ok(calculatorSource.includes('setAttackFormBonusEnabled(enabled)'));
const createBlock = sourceBlock(battleSource, '  create() {', '  _configureCenteredArcadeCircle(sprite, screenRadius) {');
assert.ok(createBlock.includes('this.dmgCalc.setAttackFormBonusEnabled('));
assert.ok(createBlock.includes("Number(this.battleData?.stageId) === 1"));
assert.ok(createBlock.includes('this.battleData?.practiceMode !== true'));

const visualBlock = sourceBlock(
  battleSource,
  '  _commitPublicStage1AttackTarget(enemy) {',
  '  _selectAutoAimTarget() {'
);
assert.ok(visualBlock.includes('this.add.graphics()'));
assert.ok(visualBlock.includes('.setDepth(2.2)'));
assert.ok(visualBlock.includes('0.28'));
[
  'this.tweens',
  'this.time',
  'load.image',
  'load.audio',
  '.png',
  '.wav',
  'setInteractive',
  'strokeCircle',
  'add.image',
  'add.sprite',
  '_recordPublicStage1SupportPhraseHit',
  '_applyPublicStage1StainDistribution',
  '_resolvePublicStage1OrangeConfirmation',
].forEach((forbidden) => {
  assert.equal(visualBlock.includes(forbidden), false, `commitment helpers must exclude: ${forbidden}`);
});

const setFormBlock = sourceBlock(battleSource, '  _setForm(formType) {', '  _syncFormDisplay() {');
assert.ok(setFormBlock.includes('this._clearPublicStage1AttackCommitment()'));
const killBlock = sourceBlock(battleSource, '  _onEnemyKilled(enemy, killColor) {', '  _onEnemyHitPlayer(sourceBullet = null) {');
assert.ok(killBlock.includes('enemy === this._publicStage1AttackCommittedTarget'));
assert.ok(killBlock.includes('this._clearPublicStage1AttackCommitment()'));
const attackReleaseBlock = sourceBlock(
  battleSource,
  "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
  '  _clearActivePlayerBulletGraphics() {'
);
const attackShutdownBlock = sourceBlock(battleSource, "this.events.once('shutdown', () => {", '    });');
const attackEndBlock = sourceBlock(battleSource, '  _endBattle(type) {', '  _showP43ResultPreview(preview) {');
assert.ok(attackReleaseBlock.includes('_clearPublicStage1AttackCommitment'));
assert.ok(attackShutdownBlock.includes("_releaseBattleRuntimeObjects('shutdown')"));
assert.ok(attackEndBlock.includes("_releaseBattleRuntimeObjects('battle-end')"));

console.log('p15367 public Stage 1 Attack exact target commitment: all assertions passed');
