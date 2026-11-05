import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const titleSceneSource = readFileSync(new URL('../src/scenes/TitleScene.js', import.meta.url), 'utf8');
const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
const waveSystemSource = readFileSync(new URL('../src/systems/WaveSystem.js', import.meta.url), 'utf8');

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

{
  const builderBlock = sourceBlock(
    titleSceneSource,
    '  _buildRecommendedBattleData(query',
    '    return withP43ResultPreviewBattleData'
  );

  assert.ok(builderBlock.includes('p15SetlistCueExperiment'), 'TitleScene should expose an explicit hidden Setlist Cue experiment flag');
  assert.ok(builderBlock.includes("query.has('debug')"), 'Setlist Cue experiment must stay behind debug');
  assert.ok(builderBlock.includes("query.get('p88Stage15Practice') === '1'"), 'Setlist Cue experiment must require Stage 1.5 practice');
  assert.ok(builderBlock.includes("query.get('p15SetlistCue') === '1'"), 'Setlist Cue experiment must require the extra p15SetlistCue flag');
}

{
  const waveSystemInitBlock = sourceBlock(
    waveSystemSource,
    '    this.onWaveStart = null;',
    '  }'
  );
  assert.ok(waveSystemInitBlock.includes('this.onInterWaveBreak = null'), 'WaveSystem should expose a default-inactive inter-wave break hook');

  const scheduleBlock = sourceBlock(
    waveSystemSource,
    '  _scheduleNextWaveAfterBreak(clearedWaveIndex) {',
    '  getWaveNumber() {'
  );
  assert.ok(scheduleBlock.includes('nextWaveIndex'), 'inter-wave hook should pass the next wave index');
  assert.ok(scheduleBlock.includes('resumeNextWave'), 'inter-wave hook should provide a resume callback');
  assert.ok(scheduleBlock.includes('this.onInterWaveBreak?.('), 'inter-wave hook should be optional');
  assert.ok(scheduleBlock.includes('handled === true'), 'handled hook should suppress default scheduling');
  assert.ok(scheduleBlock.includes('delayedCall(600'), 'handled cue overlay should resume with a short delay');
  assert.ok(scheduleBlock.includes('delayedCall(3000'), 'default scheduling should remain the existing three-second delay');
}

{
  const createBlock = sourceBlock(
    battleSceneSource,
    '  create() {',
    '    this._drawStageFloor();'
  );
  assert.ok(createBlock.includes('this._p15SetlistCueShown = false'), 'BattleScene should reset the per-run cue shown flag');
  assert.ok(createBlock.includes('this._p15SetlistCueId = null'), 'BattleScene should keep selected cue local to the battle run');
  assert.ok(createBlock.includes('this.waveSystem.onInterWaveBreak'), 'BattleScene should wire the inter-wave cue hook');
  assert.ok(createBlock.includes('_maybeShowP15SetlistCueAfterWarmup'), 'BattleScene should route the hook through the Setlist Cue guard');
}

{
  const guardBlock = sourceBlock(
    battleSceneSource,
    '  _shouldShowP15SetlistCueAfterWarmup(clearedWaveIndex) {',
    '  _maybeShowP15SetlistCueAfterWarmup'
  );
  assert.ok(guardBlock.includes('this._isStage15PracticeMode() === true'), 'Setlist Cue must be practice-only');
  assert.ok(guardBlock.includes('this.battleData?.p15SetlistCueExperiment === true'), 'Setlist Cue must require the explicit experiment flag');
  assert.ok(guardBlock.includes('Number(this.battleData?.stageId || 1) === 1'), 'Setlist Cue must stay Stage 1.5 / Stage 1 venue only');
  assert.ok(guardBlock.includes('clearedWaveIndex === 0'), 'Setlist Cue should appear only after warmup clears');
  assert.ok(guardBlock.includes('this._p15SetlistCueShown !== true'), 'Setlist Cue should show once per run');
  assert.ok(guardBlock.includes('this._battleEnded !== true'), 'Setlist Cue should not show after battle end');
}

{
  const overlayBlock = sourceBlock(
    battleSceneSource,
    '  _showP15SetlistCueChoiceOverlay(resumeNextWave) {',
    '  _clearP15SetlistCueChoiceOverlay() {'
  );
  [
    '公演编排',
    '选择本场练习的节奏方向。',
    '稳住节拍',
    '保持移动，先把节奏接住。',
    '聚焦舞台',
    '看清这轮最该处理的目标。',
    '留出高光',
    '稳住输出，等高光时刻出现。',
    '暂按原编排',
  ].forEach((copy) => {
    assert.ok(overlayBlock.includes(copy), `Setlist Cue overlay should include accepted copy: ${copy}`);
  });

  assert.ok(overlayBlock.includes('this.add.graphics()'), 'overlay may use quiet Phaser graphics primitives');
  assert.ok(overlayBlock.includes('this.add.text'), 'overlay should use live Phaser text');
  assert.ok(overlayBlock.includes('setInteractive({ useHandCursor: true })'), 'choice rows may be interactive only inside the hidden overlay');
  assert.ok(overlayBlock.includes('this._p15SetlistCueId = cue.id'), 'selected cue should stay local to BattleScene');
  assert.ok(overlayBlock.includes('this.battleRecord.setlistCueId = cue.id'), 'selected cue may be recorded only in battleRecord');
  assert.ok(overlayBlock.includes('resumeNextWave?.()'), 'choosing a cue should resume Wave 2');

  [
    'this.add.image',
    'load.image',
    '.png',
    'localStorage',
    'Stage 2',
    'reward',
    'task',
    'gacha',
    'shop',
    'backend',
    'analytics',
    'buff',
    '卡牌',
    '奖励',
    '任务',
    '抽卡',
    '商店',
    '升级',
    '解锁',
  ].forEach((forbidden) => {
    assert.equal(overlayBlock.includes(forbidden), false, `Setlist Cue overlay must not contain forbidden surface: ${forbidden}`);
  });
}

{
  const cleanupBlock = sourceBlock(
    battleSceneSource,
    '  _clearP15SetlistCueChoiceOverlay() {',
    '  _createStage15PracticeLightZone() {'
  );
  assert.ok(cleanupBlock.includes('node.destroy()'), 'overlay cleanup should destroy all overlay nodes');
  assert.ok(cleanupBlock.includes('this._p15SetlistCueOverlay = null'), 'overlay cleanup should clear its node list');

  const shutdownBlock = sourceBlock(
    battleSceneSource,
    "this.events.once('shutdown'",
    'const sceneData = normalizeBattleData'
  );
  const endBattleBlock = sourceBlock(
    battleSceneSource,
    '  _endBattle(type) {',
    '  _showP43ResultPreview(preview) {'
  );
  const actionBlock = sourceBlock(
    battleSceneSource,
    '  _handleBattleResultAction(action) {',
    '  // ====================='
  );
  const releaseBlock = sourceBlock(
    battleSceneSource,
    "  _releaseBattleRuntimeObjects(reason = 'unspecified') {",
    '  _clearActivePlayerBulletGraphics() {'
  );
  assert.ok(releaseBlock.includes('_clearP15SetlistCueChoiceOverlay'), 'release facade should own cue overlay cleanup');
  assert.ok(shutdownBlock.includes("_releaseBattleRuntimeObjects('shutdown')"), 'shutdown should release cue overlay ownership');
  assert.ok(endBattleBlock.includes("_releaseBattleRuntimeObjects('battle-end')"), 'battle end should release cue overlay ownership');
  assert.ok(actionBlock.includes("_releaseBattleRuntimeObjects('result-retry')"), 'retry should release cue overlay ownership');
  assert.ok(actionBlock.includes("_releaseBattleRuntimeObjects('result-title')"), 'title should release cue overlay ownership');
  assert.ok(actionBlock.includes('suppressDebugAutoStart: this._isStage15PracticeMode() === true'), 'return title must preserve debug auto-start suppression');
}

{
  const runtimeSource = `${titleSceneSource}\n${battleSceneSource}\n${waveSystemSource}`;
  [
    'setlist_choice_row_source',
    'cue_timing_tick_source',
    'selected_cue_soft_edge_source',
    'stage_manager_mark_source',
    'phase15-p15-108t',
  ].forEach((forbidden) => {
    assert.equal(runtimeSource.includes(forbidden), false, `runtime must not reference P15-108T source asset: ${forbidden}`);
  });
}

console.log('p15 Setlist Cue hidden practice text-only contract: all assertions passed');
