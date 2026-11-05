import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveStageWaveDefs, STAGE_1_PRACTICE_TARGET_TYPE } from '../src/utils/stageWaves.mjs';

const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');

const baseWaveDefs = [
  { wave: 1, label: 'Wave 1', interval: 1800, enemies: [{ type: 'trainee', count: 4 }] },
  { wave: 2, label: 'Wave 2', interval: 1600, enemies: [{ type: 'trainee', count: 5 }] },
  { wave: 3, label: 'Wave 3', interval: 1500, enemies: [{ type: 'trainee', count: 6 }] },
];

function getStageById(stageId) {
  if (Number(stageId) === 1) return { id: 1, name: 'Stage 1', waves: 2 };
  if (Number(stageId) === 2) return { id: 2, name: 'Stage 2', waves: 3 };
  return null;
}

function sourceBlock(startNeedle, endNeedle) {
  const start = battleSceneSource.indexOf(startNeedle);
  const end = battleSceneSource.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return battleSceneSource.slice(start, end);
}

function numericConstant(name) {
  const match = battleSceneSource.match(new RegExp(`const ${name} = ([0-9.]+);`));
  assert.ok(match, `missing numeric constant: ${name}`);
  return Number(match[1]);
}

{
  assert.equal(numericConstant('P15_108N_HIT_SPARK_DEPTH'), 16);
  assert.equal(numericConstant('P15_108N_HIT_SPARK_DURATION_MS'), 200);
  assert.equal(numericConstant('P15_108N_HIT_SPARK_MAX_ALPHA'), 0.72);
  assert.equal(numericConstant('P15_108N_HIT_SPARK_MAX_SIZE'), 14);
  assert.ok(
    numericConstant('P15_108N_HIT_SPARK_DURATION_MS') >= 180
      && numericConstant('P15_108N_HIT_SPARK_DURATION_MS') <= 220,
    'hit spark should stay inside the short 180-220ms readability window'
  );
  assert.ok(
    numericConstant('P15_108N_HIT_SPARK_MAX_ALPHA') <= 0.72,
    'hit spark alpha cap must stay below reward/Encore brightness'
  );
  assert.ok(
    numericConstant('P15_108N_HIT_SPARK_MAX_SIZE') <= 14,
    'hit spark footprint should remain compact on 375x667'
  );
}

{
  const hitBlock = sourceBlock('  _onBulletHitEnemy(bullet, enemy) {', '  _onEnemyKilled(enemy, killColor) {');
  assert.ok(
    hitBlock.includes('this._spawnImpactNoteFx(enemy.x, enemy.y, bullet.color);'),
    '_onBulletHitEnemy should preserve the enemy-local impact note seam'
  );
  assert.ok(hitBlock.includes('const baseDmg = 10'), 'bullet damage contract should remain unchanged');
  assert.ok(hitBlock.includes('this._spawnGroundHitColorMark(bullet.x, bullet.y, enemy, bullet.color);'));
  assert.ok(hitBlock.includes("this._disposePlayerProjectile(bullet, 'hit')"), 'bullet cleanup should remain at the hit seam');
}

{
  const impactBlock = sourceBlock(
    '  _spawnImpactNoteFx(x, y, color) {',
    '  _showWaveLabel(label) {'
  );

  [
    'const hex = COLOR_HEX[color] || 0xFFFFFF',
    'this.add.graphics()',
    '.setDepth(P15_108N_HIT_SPARK_DEPTH)',
    'setAlpha(P15_108N_HIT_SPARK_MAX_ALPHA)',
    'fillTriangle',
    'lineStyle',
    'lineBetween',
    'setPosition(x, y)',
    'duration: P15_108N_HIT_SPARK_DURATION_MS',
    'onComplete: () => spark.destroy()',
  ].forEach((snippet) => {
    assert.ok(impactBlock.includes(snippet), `_spawnImpactNoteFx should include: ${snippet}`);
  });

  assert.equal(impactBlock.includes('P15_108N_HIT_SPARK_MAX_SIZE / 2'), true, 'shape should derive from the max-size cap');
  assert.equal(impactBlock.includes('0xF7D8E8'), true, 'neutral cream support-note core should be present');
  assert.equal(impactBlock.includes('0x77D6C3'), true, 'mint fragment should be present');
  assert.equal(impactBlock.includes('0xFF6FAE'), true, 'Sakura-pink fragment should be present');

  [
    'this.add.image',
    'this.add.circle',
    'NOTE_ART_FRAMES',
    'NOTE_ART_ATLAS_KEY',
    '_hasNoteArtFrame',
    '.png',
    'impact_note_spark_source',
    'hit_spark_refinement',
    'phase15-p15-108j',
    'this.load',
    'preload',
    'registry',
    'setInteractive',
    'pointerdown',
    'physics',
    'overlap',
    'score',
    'support.addValue',
    'enemy.hp',
    'baseDmg',
    'waveSystem',
    '_spawnGroundHitColorMark',
    '_createPlayerBulletVisual',
    '_spawnCPositionPresentationFx',
    '_spawnEncorePresentationFx',
  ].forEach((forbidden) => {
    assert.equal(impactBlock.includes(forbidden), false, `_spawnImpactNoteFx must not use forbidden path: ${forbidden}`);
  });
}

{
  const impactSurface = [
    sourceBlock('const P15_108N_HIT_SPARK_DEPTH', 'const MOBILE_MOVE_ZONE_RIGHT'),
    sourceBlock('  _spawnImpactNoteFx(x, y, color) {', '  _showWaveLabel(label) {'),
  ].join('\n');

  [
    'reward',
    'XP',
    'drop',
    'currency',
    'task',
    'red dot',
    'claim',
    'shop',
    'gacha',
    'social',
    'backend',
    'analytics',
    'Encore',
    'Stage 2',
    'Setlist',
    'c_position_marker',
    'encore_marker',
  ].forEach((forbidden) => {
    assert.equal(impactSurface.includes(forbidden), false, `hit spark surface must not add forbidden semantics: ${forbidden}`);
  });
}

{
  [
    'impact_note_spark_source',
    'hit_spark_refinement',
    'phase15-p15-108j',
  ].forEach((forbidden) => {
    assert.equal(battleSceneSource.includes(forbidden), false, `runtime source must not reference P15-108J source art: ${forbidden}`);
  });
}

{
  const defs = resolveStageWaveDefs({
    battleData: { stageId: 1, p47Stage1ReplayObjectiveIndex: 2 },
    waveDefs: baseWaveDefs,
    getStageById,
  });

  assert.deepEqual(defs, [], 'public Stage 1 uses the paint round');
}
