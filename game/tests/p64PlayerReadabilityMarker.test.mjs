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
  assert.equal(numericConstant('P1_64_PLAYER_MARKER_WIDTH'), 42);
  assert.equal(numericConstant('P1_64_PLAYER_MARKER_HEIGHT'), 14);
  assert.equal(numericConstant('P1_64_PLAYER_MARKER_Y_OFFSET'), 26);
  assert.equal(numericConstant('P1_64_PLAYER_MARKER_DEPTH'), 1.5);
  assert.equal(numericConstant('P1_64_PLAYER_MARKER_IDLE_ALPHA'), 0.22);
  assert.equal(numericConstant('P1_64_PLAYER_MARKER_MOVING_ALPHA'), 0.34);
}

{
  const markerDepth = numericConstant('P1_64_PLAYER_MARKER_DEPTH');
  assert.equal(markerDepth < 2, true, 'marker depth should stay below P1-8 ground hit marks');
  assert.equal(markerDepth < 3, true, 'marker depth should stay below enemies');
  assert.equal(markerDepth < 5, true, 'marker depth should stay below bullets');
  assert.equal(markerDepth < 54, true, 'marker depth should stay below P1-9 C-position / Encore FX');
}

{
  const createBlock = sourceBlock('    // === 玩家 ===', '    // === 弹幕组 ===');
  assert.ok(
    createBlock.includes('_createPlayerReadabilityMarker()'),
    'BattleScene should create a persistent player readability marker near player setup'
  );
}

{
  const createMarkerBlock = sourceBlock(
    '  _createPlayerReadabilityMarker() {',
    '  _updatePlayerReadabilityMarker(isMoving = this.isMoving) {'
  );
  assert.ok(createMarkerBlock.includes('this.add.graphics().setDepth(P1_64_PLAYER_MARKER_DEPTH)'));
  assert.ok(
    createMarkerBlock.includes('fillEllipse(0, 0, P1_64_PLAYER_MARKER_WIDTH, P1_64_PLAYER_MARKER_HEIGHT)'),
    'marker should be an ellipse drawn with Phaser graphics, not a PNG'
  );
  assert.ok(
    createMarkerBlock.includes('strokeEllipse(0, 0, P1_64_PLAYER_MARKER_WIDTH, P1_64_PLAYER_MARKER_HEIGHT)'),
    'marker should read as a low-transparent foot ring'
  );
}

{
  const updateMarkerBlock = sourceBlock(
    '  _updatePlayerReadabilityMarker(isMoving = this.isMoving) {',
    '  _clearPlayerReadabilityMarker() {'
  );
  assert.ok(
    updateMarkerBlock.includes('this.player.y + P1_64_PLAYER_MARKER_Y_OFFSET'),
    'marker anchor should follow player.y + 26'
  );
  assert.ok(
    updateMarkerBlock.includes('isMoving ? P1_64_PLAYER_MARKER_MOVING_ALPHA : P1_64_PLAYER_MARKER_IDLE_ALPHA'),
    'marker alpha should distinguish moving and idle states'
  );

  const updateBlock = sourceBlock('  update(time, delta) {', '  _onPlayerDeath() {');
  assert.ok(
    updateBlock.includes('_updatePlayerReadabilityMarker(this.isMoving)'),
    'update should keep the marker following the player and reflect movement'
  );
}

{
  const cleanupBlock = sourceBlock('  _clearPlayerReadabilityMarker() {', '  _switchColor() {');
  const shutdownBlock = sourceBlock("this.events.once('shutdown', () => {", '    });');
  const endBattleBlock = sourceBlock('  _endBattle(type) {', '  _showP43ResultPreview(preview) {');
  const releaseBlock = sourceBlock(
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );

  assert.ok(cleanupBlock.includes('this.playerReadabilityMarker.destroy()'), 'cleanup should destroy marker graphics');
  assert.ok(cleanupBlock.includes('this.playerReadabilityMarker = null'), 'cleanup should clear marker reference');
  assert.ok(releaseBlock.includes('_clearPlayerReadabilityMarker()'), 'release facade should own player marker cleanup');
  assert.ok(shutdownBlock.includes("_releaseBattleRuntimeObjects('shutdown')"), 'scene shutdown should release player marker ownership');
  assert.ok(endBattleBlock.includes("_releaseBattleRuntimeObjects('battle-end')"), 'result transition should release player marker ownership');
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

  assert.deepEqual(defsBeforeThirdReplay, [], 'P1-64 must not restore public kill-waves');
  assert.deepEqual(defsDuringThirdReplay, [], 'public replays stay on the paint round');
}

{
  const markerSurfaceBlock = sourceBlock(
    'const P1_64_PLAYER_MARKER_WIDTH',
    '  _switchColor() {'
  );

  [
    'player_idol_marker.png',
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
      markerSurfaceBlock.includes(forbidden),
      false,
      `P1-64 marker-only patch must not add forbidden surface or runtime asset: ${forbidden}`
    );
  });
}
