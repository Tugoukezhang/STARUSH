import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const titleSceneSource = readFileSync(new URL('../src/scenes/TitleScene.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const stageWavesSource = readFileSync(new URL('../src/utils/stageWaves.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

function numericConstant(name) {
  const match = battleSceneSource.match(new RegExp(`const ${name} = ([0-9.]+);`));
  assert.ok(match, `missing numeric constant: ${name}`);
  return Number(match[1]);
}

function stringConstant(name) {
  const match = battleSceneSource.match(new RegExp(`const ${name} = '([^']+)';`));
  assert.ok(match, `missing string constant: ${name}`);
  return match[1];
}

{
  assert.equal(stringConstant('P15_121_HOLD_HIGHLIGHT_CUE_ID'), 'hold_highlight');
  assert.equal(numericConstant('P15_121_HOLD_HIGHLIGHT_WINDOW_ALPHA'), 0.14);
  assert.ok(
    numericConstant('P15_121_HOLD_HIGHLIGHT_WINDOW_ALPHA') <= 0.14,
    'hold highlight optional-window alpha cap must stay at or below 0.14'
  );
  assert.ok(
    numericConstant('P15_121_HOLD_HIGHLIGHT_WINDOW_ALPHA') < numericConstant('P1_73_PRACTICE_TARGET_OUTLINE_ALPHA'),
    'hold highlight cue must stay weaker than the existing practice target outline'
  );
}

{
  const helperBlock = sourceBlock(
    battleSceneSource,
    '  _shouldUseHoldHighlightOptionalWindowCue(enemyType) {',
    '  _getStageWaveDefs() {'
  );

  assert.ok(
    helperBlock.includes('this._isStage15PracticeMode() === true'),
    'hold highlight optional-window cue must stay practice-only'
  );
  assert.ok(
    helperBlock.includes("this._p15SetlistCueId === P15_121_HOLD_HIGHLIGHT_CUE_ID"),
    'hold highlight optional-window cue must require the hold_highlight cue id'
  );
  assert.ok(
    helperBlock.includes('enemyType === STAGE_1_PRACTICE_TARGET_TYPE'),
    'hold highlight optional-window cue must target only stage1PracticeTarget'
  );

  ['default_setlist', 'stable_beat', 'focus_stage'].forEach((cueId) => {
    assert.equal(helperBlock.includes(cueId), false, `guard must not activate for cue: ${cueId}`);
  });
}

{
  const overlayBlock = sourceBlock(
    battleSceneSource,
    '  _showP15SetlistCueChoiceOverlay(resumeNextWave) {',
    '  _clearP15SetlistCueChoiceOverlay() {'
  );

  ['stable_beat', 'default_setlist', 'focus_stage', 'hold_highlight'].forEach((cueId) => {
    assert.ok(overlayBlock.includes(`id: '${cueId}'`), `accepted cue id should remain available: ${cueId}`);
  });
}

{
  const outlineBlock = sourceBlock(
    battleSceneSource,
    '  _attachStage1EnemyReadabilityOutline(enemy, enemyType, radius) {',
    '  _clearEnemyReadabilityOutline(enemy) {'
  );

  assert.ok(
    outlineBlock.includes('enemy.readabilityOutline.strokeCircle(0, 0, radius + P1_73_ENEMY_OUTLINE_PADDING);'),
    'default Stage 1 practice target outline should remain'
  );
  assert.ok(
    outlineBlock.includes('this._shouldUseHoldHighlightOptionalWindowCue(enemyType)'),
    'stage1PracticeTarget outline should consult the hold highlight optional-window guard'
  );

  const emphasisBlock = sourceBlock(
    outlineBlock,
    'if (this._shouldUseHoldHighlightOptionalWindowCue(enemyType)) {',
    '    }'
  );
  assert.ok(
    emphasisBlock.includes('enemy.readabilityOutline.lineStyle(1.25, 0xF7D8E8, P15_121_HOLD_HIGHLIGHT_WINDOW_ALPHA);'),
    'hold highlight cue should use capped soft stage-light line alpha'
  );
  assert.ok(
    emphasisBlock.includes('enemy.readabilityOutline.lineBetween(-18, radius + 9, -7, radius + 9);'),
    'hold highlight cue should include the left open underline'
  );
  assert.ok(
    emphasisBlock.includes('enemy.readabilityOutline.lineBetween(7, radius + 9, 18, radius + 9);'),
    'hold highlight cue should include the right open underline'
  );

  [
    'this.add.image',
    'load.image',
    'this.load',
    'public/art',
    '.png',
    'audio',
    'this.add.text',
    'fillCircle',
    'strokeCircle',
    'strokeRect',
    'fillTriangle',
    'this.tweens',
    'tweens.add',
    'particle',
    'progress',
    'badge',
    'complete',
    'guarantee',
  ].forEach((forbidden) => {
    assert.equal(emphasisBlock.includes(forbidden), false, `hold highlight cue must stay optional and non-objective-like: ${forbidden}`);
  });
}

{
  const stableBeatHelperBlock = sourceBlock(
    battleSceneSource,
    '  _shouldUseStableBeatEncounterEmphasis(enemy) {',
    '  _shouldUseFocusStagePriorityAttention(enemy) {'
  );
  const focusHelperBlock = sourceBlock(
    battleSceneSource,
    '  _shouldUseFocusStagePriorityAttention(enemy) {',
    '  _shouldUseHoldHighlightOptionalWindowCue(enemyType) {'
  );
  assert.equal(stableBeatHelperBlock.includes('P15_121'), false, 'stable beat guard must not include hold highlight logic');
  assert.equal(focusHelperBlock.includes('P15_121'), false, 'focus stage guard must not include hold highlight logic');
}

{
  const runtimeSource = `${battleSceneSource}\n${titleSceneSource}\n${stageWavesSource}`;
  [
    'setlist_choice_row_source',
    'cue_timing_tick_source',
    'selected_cue_soft_edge_source',
    'stage_manager_mark_source',
    'phase15-p15-108t',
    'hold_highlight.png',
    'highlight_window.png',
  ].forEach((forbidden) => {
    assert.equal(runtimeSource.includes(forbidden), false, `runtime must not reference forbidden Setlist Cue art: ${forbidden}`);
  });

  assert.equal(stageWavesSource.includes('P15_121'), false, 'P15-121 should not change stage wave defs');
  assert.equal(stageWavesSource.includes('hold_highlight'), false, 'hold_highlight should not enter wave defs');
}

{
  const relevantSource = [
    sourceBlock(
      battleSceneSource,
      'const P15_121_HOLD_HIGHLIGHT_CUE_ID',
      'const MOBILE_MOVE_ZONE_RIGHT'
    ),
    sourceBlock(
      battleSceneSource,
      '  _shouldUseHoldHighlightOptionalWindowCue(enemyType) {',
      '  _getStageWaveDefs() {'
    ),
    sourceBlock(
      battleSceneSource,
      'if (this._shouldUseHoldHighlightOptionalWindowCue(enemyType)) {',
      '    }'
    ),
  ].join('\n');

  [
    'reward',
    'task',
    'red dot',
    'progress',
    'badge',
    'complete',
    'guarantee',
    'buff',
    'shield',
    'upgrade',
    'Stage 2',
    'shop',
    'gacha',
    'backend',
    'analytics',
    'C-position guarantee',
    'Encore guarantee',
  ].forEach((forbidden) => {
    assert.equal(relevantSource.includes(forbidden), false, `hold highlight cue must not introduce forbidden semantics: ${forbidden}`);
  });
}

console.log('p15121 hold highlight optional window: all assertions passed');
