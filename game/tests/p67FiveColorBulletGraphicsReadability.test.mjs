import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolveStageWaveDefs, STAGE_1_PRACTICE_TARGET_TYPE } from '../src/utils/stageWaves.mjs';

const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
const baseWaveDefs = [
  { wave: 1, label: 'Wave 1', interval: 1800, enemies: [{ type: 'trainee', count: 4 }] },
  { wave: 2, label: 'Wave 2', interval: 1600, enemies: [{ type: 'trainee', count: 5 }] },
  { wave: 3, label: 'Wave 3', interval: 1500, enemies: [{ type: 'trainee', count: 6 }] },
];

const forbiddenBulletPngs = [
  'pink_heart_bullet.png',
  'cyan_diamond_bullet.png',
  'yellow_star_bullet.png',
  'purple_crescent_bullet.png',
  'orange_triangle_bullet.png',
];

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

function getStageById(stageId) {
  if (Number(stageId) === 1) return { id: 1, name: 'Stage 1', waves: 2 };
  if (Number(stageId) === 2) return { id: 2, name: 'Stage 2', waves: 3 };
  return null;
}

{
  assert.equal(numericConstant('P1_67_BULLET_VISUAL_MAX_SIZE'), 16);
  assert.equal(numericConstant('P1_67_BULLET_VISUAL_DEPTH'), 6);
  assert.equal(numericConstant('P1_67_BULLET_VISUAL_ALPHA'), 0.92);
  assert.equal(
    numericConstant('P1_67_BULLET_VISUAL_ALPHA') >= 0.88 && numericConstant('P1_67_BULLET_VISUAL_ALPHA') <= 0.96,
    true,
    'player bullet visual alpha should stay in the readability target range'
  );
}

{
  const createVisualBlock = sourceBlock(
    '  _createPlayerBulletVisual(x, y, color, hex) {',
    '  _spawnChargeNoteFx(x, y, color) {'
  );

  assert.ok(
    createVisualBlock.includes('this.add.graphics().setDepth(P1_67_BULLET_VISUAL_DEPTH)'),
    '_createPlayerBulletVisual should create a Phaser graphics node at depth 6'
  );
  assert.ok(
    createVisualBlock.includes('setAlpha(P1_67_BULLET_VISUAL_ALPHA)'),
    '_createPlayerBulletVisual should use the locked alpha'
  );
  assert.ok(
    createVisualBlock.includes('_drawReadablePlayerBulletShape(gfx, color, hex)'),
    '_createPlayerBulletVisual should route through the readable five-color shape path'
  );
  assert.ok(
    createVisualBlock.includes('setPosition(x, y)') && createVisualBlock.includes('offsetX: 0') && createVisualBlock.includes('offsetY: 0'),
    'visual anchor should stay at bullet.x / bullet.y'
  );
  assert.equal(createVisualBlock.includes('this.add.image'), false, 'player bullet visual must not use atlas or PNG images');
  assert.equal(createVisualBlock.includes('_hasNoteArtFrame'), false, 'player bullet visual must not prefer note atlas frames');
}

{
  const shapeBlock = sourceBlock(
    '  _drawReadablePlayerBulletShape(gfx, color, hex) {',
    '  _createPlayerBulletVisual(x, y, color, hex) {'
  );
  [
    ['COLORS.PINK', 'pink heart / petal branch'],
    ['COLORS.BLUE', 'cyan diamond branch'],
    ['COLORS.YELLOW', 'yellow four-point star branch'],
    ['COLORS.PURPLE', 'purple crescent branch'],
    ['COLORS.ORANGE', 'orange triangle branch'],
  ].forEach(([color, label]) => {
    assert.ok(shapeBlock.includes(`case ${color}:`), `missing ${label}`);
  });
  assert.ok(shapeBlock.includes('P1_67_BULLET_VISUAL_MAX_SIZE / 2'), 'shape path should use max-size-bounded geometry');
  assert.ok(shapeBlock.includes('fillTriangle'), 'shape path should include filled readable silhouettes');
  assert.ok(shapeBlock.includes('strokePath'), 'purple crescent branch should use an arc stroke, not a PNG');
}

{
  const shootBlock = sourceBlock('  _tryShoot(time) {', '  _setupCollisions() {');
  assert.ok(shootBlock.includes('bullet.body.setCircle(7, 0, 0)'), 'bullet collision body radius must remain 7');
  assert.ok(shootBlock.includes('bullet.moveVx = aimVx * SHOOT_CONFIG.BULLET_SPEED'), 'bullet speed contract must remain config-driven');
  assert.ok(shootBlock.includes('bullet.moveVy = aimVy * SHOOT_CONFIG.BULLET_SPEED'), 'bullet speed contract must remain config-driven');
  assert.ok(shootBlock.includes('this.time.delayedCall(2000'), 'bullet lifetime cleanup timer should stay in place');
  assert.ok(shootBlock.includes("this._disposePlayerProjectile(bullet, 'timeout')"), 'bullet cleanup should stay tied to the bullet timeout');
}

{
  const hitBlock = sourceBlock('  _onBulletHitEnemy(bullet, enemy) {', '  _onEnemyKilled(enemy, killColor) {');
  assert.ok(hitBlock.includes('const baseDmg = 10'), 'bullet damage contract must remain unchanged');
  assert.ok(hitBlock.includes("this._disposePlayerProjectile(bullet, 'hit')"), 'bullet lifecycle should stay tied to hit cleanup');
}

{
  const cleanupBlock = sourceBlock('    // 清理出界（全方向）', '    this.enemyBullets.children.iterate');
  assert.ok(cleanupBlock.includes("this._disposePlayerProjectile(b, 'out-of-bounds')"), 'out-of-bounds cleanup should still dispose bullet graphics');
}

{
  forbiddenBulletPngs.forEach((fileName) => {
    assert.equal(battleSceneSource.includes(fileName), false, `runtime source must not reference deferred P1-38 bullet PNG: ${fileName}`);
  });

  const p138Dir = new URL('../public/art/phase1/p1-38/', import.meta.url);
  if (existsSync(p138Dir)) {
    const files = readdirSync(p138Dir);
    forbiddenBulletPngs.forEach((fileName) => {
      assert.equal(files.includes(fileName), false, `public p1-38 folder must not contain bullet PNG: ${fileName}`);
    });
  }
}

{
  assert.equal(numericConstant('P1_64_PLAYER_MARKER_WIDTH'), 42);
  assert.equal(numericConstant('P1_64_PLAYER_MARKER_Y_OFFSET'), 26);
  assert.ok(
    battleSceneSource.includes('_updatePlayerReadabilityMarker(this.isMoving)'),
    'P1-67 should not remove the P1-64 player readability marker update'
  );
}

{
  const defsBeforeThirdReplay = resolveStageWaveDefs({
    battleData: { stageId: 1, p47Stage1ReplayObjectiveIndex: 1 },
    waveDefs: baseWaveDefs,
    getStageById,
  });
  const defsDuringThirdReplay = resolveStageWaveDefs({
    battleData: { stageId: 1, p47Stage1ReplayObjectiveIndex: 2 },
    waveDefs: baseWaveDefs,
    getStageById,
  });

  assert.deepEqual(defsBeforeThirdReplay, [], 'P1-67 must not restore public kill-waves');
  assert.deepEqual(defsDuringThirdReplay, [], 'public replays stay on the paint round');
  const archivedP167 = [
    'P1-67 should preserve the P1-57 third replay practice target'
  ];
}

{
  const bulletVisualSurface = sourceBlock(
    'const P1_67_BULLET_VISUAL_MAX_SIZE',
    '  _spawnChargeNoteFx(x, y, color) {'
  );

  [
    'reward',
    'XP',
    '掉落',
    '任务系统',
    '红点',
    'Stage 2',
    'shop',
    'gacha',
    'social',
    'backend',
    'analytics',
    'c_position_marker',
    'encore_marker',
  ].forEach((forbidden) => {
    assert.equal(
      bulletVisualSurface.includes(forbidden),
      false,
      `P1-67 bullet-only patch must not add forbidden surface or marker asset: ${forbidden}`
    );
  });
}
