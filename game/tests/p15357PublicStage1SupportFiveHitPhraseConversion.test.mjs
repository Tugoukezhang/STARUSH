import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FORM_TYPE } from '../src/systems/DamageCalculator.js';
import { CENTER_STAGE, SUPPORT_GAIN } from '../src/utils/config.js';

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

const helperStart = '  _recordPublicStage1SupportPhraseHit(enemy, bullet) {';
const helperEnd = '  _applyPublicStage1BlueTempoControl(enemy) {';
const helpers = compileClassMethods(sourceBlock(helperStart, helperEnd), {
  FORM_TYPE,
  P15_356_SUPPORT_PHRASE_REQUIRED_HITS: 5,
});

function makeScene({ stageId = 1, practiceMode = false, form = FORM_TYPE.SUPPORT } = {}) {
  const scene = {
    battleData: { stageId, practiceMode },
    currentForm: form,
    _battleEnded: false,
    _publicStage1SupportPhraseHits: 0,
    conversions: 0,
    support: {
      gainFromHitCombo() { scene.conversions += 1; },
    },
  };
  scene._recordPublicStage1SupportPhraseHit = helpers._recordPublicStage1SupportPhraseHit;
  scene._clearPublicStage1SupportPhraseConversion = helpers._clearPublicStage1SupportPhraseConversion;
  return scene;
}

const activeEnemy = () => ({ active: true, destroyed: false, hp: 30 });
const activeBullet = () => ({ active: true });

{
  const scene = makeScene();
  for (let index = 1; index <= 4; index += 1) {
    assert.equal(scene._recordPublicStage1SupportPhraseHit(activeEnemy(), activeBullet()), false);
    assert.equal(scene._publicStage1SupportPhraseHits, index);
    assert.equal(scene.conversions, 0);
  }
  assert.equal(scene._recordPublicStage1SupportPhraseHit(activeEnemy(), activeBullet()), true);
  assert.equal(scene._publicStage1SupportPhraseHits, 0);
  assert.equal(scene.conversions, 1);
  assert.equal(scene._recordPublicStage1SupportPhraseHit(activeEnemy(), activeBullet()), false);
  assert.equal(scene._publicStage1SupportPhraseHits, 1);
  assert.equal(scene.conversions, 1);
}

{
  const scene = makeScene();
  const lethalAcceptedHit = activeEnemy();
  lethalAcceptedHit.hp = 0;
  scene._publicStage1SupportPhraseHits = 4;
  assert.equal(scene._recordPublicStage1SupportPhraseHit(lethalAcceptedHit, activeBullet()), true);
  assert.equal(scene.conversions, 1, 'a lethal accepted direct hit counts exactly once');
}

for (const scene of [
  makeScene({ form: FORM_TYPE.ATTACK }),
  makeScene({ form: FORM_TYPE.STAIN }),
  makeScene({ practiceMode: true }),
  makeScene({ stageId: 2 }),
]) {
  assert.equal(scene._recordPublicStage1SupportPhraseHit(activeEnemy(), activeBullet()), false);
  assert.equal(scene._publicStage1SupportPhraseHits, 0);
  assert.equal(scene.conversions, 0);
}

{
  const scene = makeScene();
  scene._battleEnded = true;
  assert.equal(scene._recordPublicStage1SupportPhraseHit(activeEnemy(), activeBullet()), false);
  scene._battleEnded = false;
  scene._publicStage1SupportPhraseHits = 3;
  assert.equal(scene._clearPublicStage1SupportPhraseConversion(), true);
  assert.equal(scene._publicStage1SupportPhraseHits, 0);
  assert.equal(scene._clearPublicStage1SupportPhraseConversion(), false);
}

const hitBlock = sourceBlock(
  '  _onBulletHitEnemy(bullet, enemy) {',
  helperStart
);
assert.equal(
  (hitBlock.match(/this\._recordPublicStage1SupportPhraseHit\(enemy, bullet\)/g) || []).length,
  1,
  'one accepted direct hit must enter the Support phrase once'
);
assert.ok(
  hitBlock.indexOf('enemy.hp = damageResult.hpAfter')
    < hitBlock.indexOf('this._recordPublicStage1SupportPhraseHit(enemy, bullet)'),
  'Support conversion resolves after direct damage'
);
assert.ok(
  hitBlock.indexOf('this._recordPublicStage1SupportPhraseHit(enemy, bullet)')
    < hitBlock.indexOf('this._onEnemyKilled(enemy, bullet.color)'),
  'a lethal accepted direct hit must count before enemy destruction'
);

const setFormBlock = sourceBlock(
  '  _setForm(formType) {',
  '  _syncFormDisplay() {'
);
assert.ok(setFormBlock.includes('this._clearPublicStage1SupportPhraseConversion()'));
assert.ok(setFormBlock.includes('const useLegacyPracticeSupport'));
assert.ok(setFormBlock.includes('this._isStage15PracticeMode() === true'));
assert.ok(setFormBlock.includes('this.support.gainMultiplier = useLegacyPracticeSupport'));
assert.ok(setFormBlock.includes('this.atmosphere.teamCritBonus = useLegacyPracticeSupport'));
assert.ok(setFormBlock.includes('this.encore.extraDuration = useLegacyPracticeSupport'));

const helperBlock = sourceBlock(helperStart, helperEnd);
[
  'this.time',
  'this.tweens',
  'this.add',
  'load.image',
  'load.audio',
  '.png',
  '.wav',
  'enemy.hp =',
  'waveSystem',
].forEach((forbidden) => {
  assert.equal(helperBlock.includes(forbidden), false, `Support phrase helper must exclude: ${forbidden}`);
});

const supportReleaseBlock = sourceBlock(
  "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
  '  _clearActivePlayerBulletGraphics() {'
);
const supportEndBlock = sourceBlock('  _endBattle(type) {', '  _showP43ResultPreview(preview) {');
assert.ok(supportReleaseBlock.includes('_clearPublicStage1SupportPhraseConversion'));
assert.ok(supportEndBlock.includes("_releaseBattleRuntimeObjects('battle-end')"));

assert.equal(SUPPORT_GAIN.HIT_COMBO, 5);
assert.equal(CENTER_STAGE.THRESHOLD, 100);
assert.equal(CENTER_STAGE.DURATION, 8000);

console.log('p15357 public Stage 1 Support five-hit phrase conversion: all assertions passed');
