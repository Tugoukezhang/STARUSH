import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');

function sourceBlock(startNeedle, endNeedle) {
  const start = battleSceneSource.indexOf(startNeedle);
  const end = battleSceneSource.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return battleSceneSource.slice(start, end);
}

{
  const practiceModeBlock = sourceBlock(
    '  _isStage15PracticeMode() {',
    '  _getStageWaveDefs() {'
  );

  assert.ok(
    practiceModeBlock.includes('this.battleData?.practiceMode === true'),
    'practice guard should use the strict normalized practiceMode boolean'
  );
}

{
  const waveStartBlock = sourceBlock(
    '    this.waveSystem.onWaveStart = (idx, label) => {',
    '    this.waveSystem.onWaveClear ='
  );

  assert.ok(
    waveStartBlock.includes('const suppressFirstPlayAssist = this._isStage15PracticeMode();'),
    'wave start should compute a practice-mode first-play suppression flag'
  );
  assert.ok(
    waveStartBlock.includes('if (idx === 0 && !suppressFirstPlayAssist)'),
    'practice mode should not show the first-wave hint or schedule the first-wave assist'
  );
  assert.ok(
    waveStartBlock.includes('} else if (idx === 1 && !suppressFirstPlayAssist)'),
    'practice mode should not show the second-wave first-play color/form hint'
  );
  assert.ok(waveStartBlock.includes('_showFirstPlayHint'), 'normal Stage 1 first-play hints should remain available');
  assert.equal(
    waveStartBlock.includes('_scheduleFirstPlayWaveAssist(idx)'),
    false,
    'public Stage 1 must not auto-clear wave 1 after 12s'
  );
}

{
  const assistBlock = sourceBlock(
    '  _scheduleFirstPlayWaveAssist(waveIndex) {',
    '  _onAllWavesClear() {'
  );

  const practiceGuardIndex = assistBlock.indexOf('if (this._isStage15PracticeMode()) return;');
  const stageGuardIndex = assistBlock.indexOf('Number(this.battleData?.stageId || 1) !== 1');

  assert.ok(practiceGuardIndex >= 0, 'first-wave assist should no-op in Stage 1.5 practice mode');
  assert.ok(stageGuardIndex > practiceGuardIndex, 'practice guard should run before the Stage 1 auto-clear guard');
  assert.equal(
    assistBlock.includes('this.time.delayedCall(12000'),
    false,
    'public Stage 1 must not keep the 12s wave-1 auto-clear'
  );
}
