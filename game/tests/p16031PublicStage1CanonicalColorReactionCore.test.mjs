import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const contractUrl = new URL('../src/systems/PublicStage1ColorReactionContract.mjs', import.meta.url);
assert.equal(
  existsSync(contractUrl),
  true,
  'P16-031 requires one canonical public Stage 1 color-reaction contract module'
);

const {
  PUBLIC_STAGE1_REACTION_BASE_PAINT,
  PUBLIC_STAGE1_REACTION_BONUS_PAINT,
  PUBLIC_STAGE1_REACTION_COLORS,
  getPublicStage1ReactionColor,
  resolvePublicStage1ColorReaction,
} = await import(contractUrl.href);

assert.deepEqual(
  PUBLIC_STAGE1_REACTION_COLORS.map(({ id, label }) => [id, label]),
  [
    ['pink', '粉'],
    ['blue', '蓝'],
    ['yellow', '黄'],
    ['purple', '紫'],
    ['orange', '橙'],
  ]
);
assert.equal(PUBLIC_STAGE1_REACTION_BASE_PAINT, 14);
assert.equal(PUBLIC_STAGE1_REACTION_BONUS_PAINT, 8);

for (let index = 0; index < PUBLIC_STAGE1_REACTION_COLORS.length; index += 1) {
  assert.equal(
    getPublicStage1ReactionColor(index),
    PUBLIC_STAGE1_REACTION_COLORS[index].id,
    'ordinary targets must expose a deterministic, inspectable color cue'
  );
}
assert.equal(getPublicStage1ReactionColor(5), 'pink');
assert.equal(getPublicStage1ReactionColor(-1), 'orange');

assert.deepEqual(
  resolvePublicStage1ColorReaction({ selectedColor: 'blue', targetColor: 'blue' }),
  {
    selectedColor: 'blue',
    targetColor: 'blue',
    matched: true,
    basePaint: 14,
    bonusPaint: 8,
    totalPaint: 22,
    feedback: '合拍',
  }
);
assert.deepEqual(
  resolvePublicStage1ColorReaction({ selectedColor: 'pink', targetColor: 'blue' }),
  {
    selectedColor: 'pink',
    targetColor: 'blue',
    matched: false,
    basePaint: 14,
    bonusPaint: 0,
    totalPaint: 14,
    feedback: '',
  },
  'a non-matching shot must remain useful instead of becoming immune or invalid'
);

const battleSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

[
  'PublicStage1ColorReactionContract.mjs',
  '_createPublicStage1ColorPalette()',
  '_selectPublicStage1Color(color)',
  '_resolvePublicStage1TargetColorReaction(enemy, selectedColor, basePaint)',
  'enemy.publicStage1ReactionColor = getPublicStage1ReactionColor(',
].forEach((needle) => {
  assert.ok(battleSource.includes(needle), `missing public color-reaction runtime seam: ${needle}`);
});

const publicSwitchStart = battleSource.indexOf('  _switchColor() {');
const publicSwitchEnd = battleSource.indexOf('  _updateMobileControlLabels() {', publicSwitchStart);
assert.ok(publicSwitchStart >= 0 && publicSwitchEnd > publicSwitchStart);
const publicSwitchBlock = battleSource.slice(publicSwitchStart, publicSwitchEnd);
assert.ok(!publicSwitchBlock.includes('this._selectPublicStage1Color(nextColor)'),'public Q cannot recolor an idol independently');
assert.equal(
  publicSwitchBlock.includes('this._switchPublicIdol(next.id)'),
  false,
  'public color input must not masquerade as a performer switch'
);

const mobileStart = battleSource.indexOf('  _setupMobileControls() {');
const mobileEnd = battleSource.indexOf('  _createMobileButton(', mobileStart);
assert.ok(mobileStart >= 0 && mobileEnd > mobileStart);
const mobileBlock = battleSource.slice(mobileStart, mobileEnd);
assert.ok(!mobileBlock.includes('this._createPublicStage1ColorPalette()'),'public controls no longer instantiate a five-color palette');

const detonateStart = battleSource.indexOf('  _detonatePaintBullet(');
const detonateEnd = battleSource.indexOf('  _stampGroundSplat(', detonateStart);
assert.ok(detonateStart >= 0 && detonateEnd > detonateStart);
const detonateBlock = battleSource.slice(detonateStart, detonateEnd);
assert.ok(detonateBlock.includes('STAGE1_UNLIT_HIT_RADIUS + 8 + (this.publicPerformerRun?.effects().paintRadiusBonus || 0),\n        color,'));
assert.ok(detonateBlock.includes('x, y, basePaint, radius, color'));

const paintTargetsStart = battleSource.indexOf('  _paintPublicStage1TargetsAt(');
const paintTargetsEnd = battleSource.indexOf('  _resolvePublicStage1TargetColorReaction(', paintTargetsStart);
assert.ok(paintTargetsStart >= 0 && paintTargetsEnd > paintTargetsStart);
const paintTargetsBlock = battleSource.slice(paintTargetsStart, paintTargetsEnd);
assert.ok(paintTargetsBlock.includes('enemy.hp = Math.max(0'));
assert.ok(paintTargetsBlock.includes('reaction.totalPaint'));

[
  'load.image',
  'load.audio',
  '.png',
  '.wav',
  'reward',
  'gacha',
  'Stage 2',
].forEach((forbidden) => {
  assert.equal(
    readFileSync(contractUrl, 'utf8').includes(forbidden),
    false,
    `color reaction contract must exclude: ${forbidden}`
  );
});

console.log('p16031 public Stage 1 canonical color reaction core: all assertions passed');
