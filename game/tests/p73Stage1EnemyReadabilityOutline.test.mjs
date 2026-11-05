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

function numericConstant(name) {
  const match = battleSceneSource.match(new RegExp(`const ${name} = ([0-9.]+|0x[0-9A-Fa-f]+);`));
  assert.ok(match, `missing numeric constant: ${name}`);
  return Number(match[1]);
}

function getStageById(stageId) {
  if (Number(stageId) === 1) return { id: 1, name: 'Stage 1', waves: 2 };
  if (Number(stageId) === 2) return { id: 2, name: 'Stage 2', waves: 3 };
  return null;
}

{
  assert.equal(numericConstant('P1_73_TRAINEE_OUTLINE_COLOR'), 0xFFFFFF);
  assert.equal(numericConstant('P1_73_TRAINEE_OUTLINE_ALPHA'), 0.18);
  assert.equal(numericConstant('P1_73_PRACTICE_TARGET_OUTLINE_COLOR'), 0xFFD700);
  assert.equal(numericConstant('P1_73_PRACTICE_TARGET_OUTLINE_ALPHA'), 0.32);
  assert.equal(numericConstant('P1_73_ENEMY_OUTLINE_DEPTH'), 2.2);
}

{
  const spawnBlock = sourceBlock('  _spawnEnemyByType(type) {', '  _createBossHpBar(enemy, radius) {');
  assert.ok(
    spawnBlock.includes('_attachStage1EnemyReadabilityOutline(enemy, enemyType, radius)'),
    'enemy spawn should attach the Stage 1 readability outline from the spawn seam'
  );
  assert.equal(
    spawnBlock.includes("enemyType === 'anti' || enemyType === 'miniboss' || enemyType === STAGE_1_PRACTICE_TARGET_TYPE"),
    false,
    'practice target should not ride the anti/miniboss outer-ring pass'
  );
  assert.ok(spawnBlock.includes('enemy.setTint(fillColor)'), 'enemy sprite/tint path should remain in place');
  assert.ok(spawnBlock.includes('if (enemyType === STAGE_1_PRACTICE_TARGET_TYPE) enemy.setDisplaySize(radius * 2, radius * 2)'));
}

{
  const attachBlock = sourceBlock(
    '  _attachStage1EnemyReadabilityOutline(enemy, enemyType, radius) {',
    '  _clearEnemyReadabilityOutline(enemy) {'
  );
  assert.ok(attachBlock.includes('Number(this.battleData?.stageId || 1) !== 1'), 'outline should be Stage 1 only');
  assert.ok(
    attachBlock.includes("enemyType !== 'trainee'")
      && attachBlock.includes('enemyType !== STAGE_1_CUE_CALLER_TYPE')
      && attachBlock.includes('enemyType !== STAGE_1_PRACTICE_TARGET_TYPE'),
    'outline should apply only to the trainee family and stage1PracticeTarget'
  );
  assert.ok(attachBlock.includes('this.add.graphics().setDepth(P1_73_ENEMY_OUTLINE_DEPTH)'), 'outline should use Phaser graphics');
  assert.ok(attachBlock.includes('lineStyle(width, color, alpha)'), 'outline should be a single stroke layer');
  assert.ok(attachBlock.includes('strokeCircle(0, 0, radius + P1_73_ENEMY_OUTLINE_PADDING)'), 'outline size should follow enemy radius');
  assert.ok(attachBlock.includes('enemy.readabilityOutline.setPosition(enemy.x, enemy.y)'), 'outline should start anchored to enemy');
}

{
  const updateBlock = sourceBlock('  update(time, delta) {', '  _onPlayerDeath() {');
  assert.ok(
    updateBlock.includes('e.readabilityOutline.setPosition(e.x, e.y)'),
    'enemy readability outline should follow enemy movement in update'
  );
}

{
  const cleanupBlock = sourceBlock(
    '  _clearEnemyReadabilityOutline(enemy) {',
    '  _clearEnemyReadabilityOutlines() {'
  );
  const clearAllBlock = sourceBlock(
    '  _clearEnemyReadabilityOutlines() {',
    '  _createBossHpBar(enemy, radius) {'
  );
  const killBlock = sourceBlock('  _onEnemyKilled(enemy, killColor) {', '  _onEnemyHitPlayer(sourceBullet = null) {');
  const timeoutBlock = sourceBlock('    // 120秒安全兜底', '  _createBossHpBar(enemy, radius) {');
  const assistBlock = sourceBlock('  _scheduleFirstPlayWaveAssist(waveIndex) {', '  _onAllWavesClear() {');
  const shutdownBlock = sourceBlock("this.events.once('shutdown', () => {", '    });');
  const endBattleBlock = sourceBlock('  _endBattle(type) {', '  _showP43ResultPreview(preview) {');
  const releaseBlock = sourceBlock(
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );

  assert.ok(cleanupBlock.includes('enemy.readabilityOutline.destroy()'), 'single enemy cleanup should destroy outline graphics');
  assert.ok(cleanupBlock.includes('enemy.readabilityOutline = null'), 'single enemy cleanup should clear outline reference');
  assert.ok(
    clearAllBlock.includes('const enemyChildren = this.enemies?.children'),
    'bulk outline cleanup should tolerate replay/shutdown paths where this.enemies.children is already unavailable'
  );
  assert.ok(
    clearAllBlock.includes("typeof enemyChildren.iterate !== 'function'"),
    'bulk outline cleanup should no-op when the Phaser children iterator has already been torn down'
  );
  assert.ok(clearAllBlock.includes('enemyChildren.iterate'), 'result/shutdown cleanup should iterate active enemies when available');
  assert.ok(killBlock.includes('_clearEnemyReadabilityOutline(enemy)'), 'normal kill cleanup should clear outline');
  assert.ok(timeoutBlock.includes('_clearEnemyReadabilityOutline(enemy)'), 'timeout fallback cleanup should clear outline');
  assert.equal(assistBlock.includes('enemy.destroy()'), false, 'first-play assist must not auto-destroy Wave 1 enemies');
  assert.ok(releaseBlock.includes('_clearEnemyReadabilityOutlines()'), 'release facade should own enemy outline cleanup');
  assert.ok(shutdownBlock.includes("_releaseBattleRuntimeObjects('shutdown')"), 'scene shutdown should release enemy outline ownership');
  assert.ok(endBattleBlock.includes("_releaseBattleRuntimeObjects('battle-end')"), 'result transition should release enemy outline ownership');
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

  assert.deepEqual(defsBeforeThirdReplay, [], 'P1-73 must not restore public kill-waves');
  assert.deepEqual(defsDuringThirdReplay, [], 'public replays stay on the paint round');
}

{
  const outlineSurface = sourceBlock(
    'const P1_73_TRAINEE_OUTLINE_COLOR',
    '  _createBossHpBar(enemy, radius) {'
  );
  [
    'trainee_enemy.png',
    'anti_enemy.png',
    'miniboss_enemy.png',
    'player_idol_marker.png',
    'hit_spark',
    'ground_marker',
    'c_position_marker',
    'encore_marker',
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
  ].forEach((forbidden) => {
    assert.equal(
      outlineSurface.includes(forbidden),
      false,
      `P1-73 enemy outline patch must not add forbidden surface or runtime asset: ${forbidden}`
    );
  });
}
