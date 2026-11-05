import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveStageWaveDefs, STAGE_1_PRACTICE_TARGET_TYPE } from '../src/utils/stageWaves.mjs';

const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
const baseWaveDefs = [
  { wave: 1, label: 'Wave 1', interval: 1800, enemies: [{ type: 'trainee', count: 4 }] },
  { wave: 2, label: 'Wave 2', interval: 1600, enemies: [{ type: 'trainee', count: 5 }] },
  { wave: 3, label: 'Wave 3', interval: 1500, enemies: [{ type: 'trainee', count: 6 }] },
];

function sourceBlock(startNeedle, endNeedle) {
  const start = battleSceneSource.indexOf(startNeedle);
  const end = battleSceneSource.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return battleSceneSource.slice(start, end);
}

function getStageById(stageId) {
  if (Number(stageId) === 1) return { id: 1, name: 'Stage 1', waves: 2 };
  if (Number(stageId) === 2) return { id: 2, name: 'Stage 2', waves: 3 };
  return null;
}

{
  const cleanupBlock = sourceBlock(
    '  _clearActivePlayerBulletGraphics() {',
    '  _switchColor() {'
  );

  assert.ok(
    cleanupBlock.includes('this.playerBullets.children.each'),
    'result cleanup should walk a snapshot of active player bullets because disposal mutates the Set'
  );
  assert.ok(
    cleanupBlock.includes("this._disposePlayerProjectile(bullet, 'scene-clear')"),
    'result cleanup should use the shared projectile lifecycle disposer'
  );
  assert.equal(cleanupBlock.includes('this.add.graphics'), false, 'cleanup must not create new graphics');
  assert.equal(cleanupBlock.includes('_createPlayerBulletVisual'), false, 'cleanup must not redraw bullet visuals');
}

{
  const endBattleBlock = sourceBlock('  _endBattle(type) {', '  _showP43ResultPreview(preview) {');
  const releaseBlock = sourceBlock(
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );
  const cleanupIndex = endBattleBlock.indexOf("_releaseBattleRuntimeObjects('battle-end')");
  const resultIndex = endBattleBlock.indexOf('_showBattleResultPanel(type)');

  assert.ok(releaseBlock.includes('_clearActivePlayerBulletGraphics()'), 'release facade should own active player bullet cleanup');
  assert.ok(cleanupIndex >= 0, '_endBattle should release active player bullet graphics');
  assert.ok(resultIndex > cleanupIndex, 'active bullet graphics should be cleared before the result panel is shown');
  assert.ok(
    cleanupIndex > endBattleBlock.indexOf('this._battleEnded = true'),
    'cleanup should run after battle end is latched'
  );
}

{
  const shutdownBlock = sourceBlock("this.events.once('shutdown', () => {", '    });');
  assert.ok(
    shutdownBlock.includes("_releaseBattleRuntimeObjects('shutdown')"),
    'scene shutdown should also release active player bullet graphics'
  );
}

{
  const shootBlock = sourceBlock('  _tryShoot(time) {', '  _setupCollisions() {');
  assert.ok(shootBlock.includes('bullet.body.setCircle(7, 0, 0)'), 'bullet collision radius must remain unchanged');
  assert.ok(shootBlock.includes('bullet.moveVx = aimVx * SHOOT_CONFIG.BULLET_SPEED'), 'bullet speed contract must remain unchanged');
  assert.ok(shootBlock.includes('bullet.moveVy = aimVy * SHOOT_CONFIG.BULLET_SPEED'), 'bullet speed contract must remain unchanged');
  assert.ok(shootBlock.includes('this.time.delayedCall(2000'), 'bullet timeout cleanup should stay in place');
}

{
  const hitBlock = sourceBlock('  _onBulletHitEnemy(bullet, enemy) {', '  _onEnemyKilled(enemy, killColor) {');
  assert.ok(hitBlock.includes('const baseDmg = 10'), 'bullet damage contract must remain unchanged');
  assert.ok(hitBlock.includes("this._disposePlayerProjectile(bullet, 'hit')"), 'hit cleanup should use the shared lifecycle disposer');
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

  assert.deepEqual(defsBeforeThirdReplay, [], 'P1-69 must not restore public kill-waves');
  assert.deepEqual(defsDuringThirdReplay, [], 'public replays stay on the paint round');
  const archivedP169 = [
    'P1-69 should preserve the P1-57 third replay practice target'
  ];
}

{
  const cleanupSurface = sourceBlock(
    '  _clearActivePlayerBulletGraphics() {',
    '  _switchColor() {'
  );

  [
    'pink_heart_bullet.png',
    'cyan_diamond_bullet.png',
    'yellow_star_bullet.png',
    'purple_crescent_bullet.png',
    'orange_triangle_bullet.png',
    'reward',
    'XP',
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
      cleanupSurface.includes(forbidden),
      false,
      `P1-69 cleanup must not add forbidden surface or asset: ${forbidden}`
    );
  });
}
