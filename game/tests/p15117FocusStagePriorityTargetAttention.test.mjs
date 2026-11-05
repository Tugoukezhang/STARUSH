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
  assert.equal(stringConstant('P15_117_FOCUS_STAGE_CUE_ID'), 'focus_stage');
  assert.equal(numericConstant('P15_117_FOCUS_STAGE_ATTENTION_ALPHA'), 0.30);
  assert.ok(
    numericConstant('P15_117_FOCUS_STAGE_ATTENTION_ALPHA') <= 0.30,
    'focus stage attention alpha cap must stay at or below 0.30'
  );
}

{
  const helperBlock = sourceBlock(
    battleSceneSource,
    '  _shouldUseFocusStagePriorityAttention(enemy) {',
    '  _getStageWaveDefs() {'
  );

  assert.ok(
    helperBlock.includes('this._isStage15PracticeMode() === true'),
    'focus stage attention must stay practice-only'
  );
  assert.ok(
    helperBlock.includes("this._p15SetlistCueId === P15_117_FOCUS_STAGE_CUE_ID"),
    'focus stage attention must require the focus_stage cue id'
  );
  assert.ok(
    helperBlock.includes('enemy?.type === STAGE_15_STAGE_MARKER_TARGET_TYPE'),
    'focus stage attention must target only Stage Marker Target enemies'
  );

  ['default_setlist', 'stable_beat', 'hold_highlight'].forEach((cueId) => {
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
  const graphicsBlock = sourceBlock(
    battleSceneSource,
    '  _attachStage15PressureGraphics(enemy, enemyType, radius) {',
    '  _syncStage15PressureGraphics(enemy) {'
  );
  const markerBlock = sourceBlock(
    graphicsBlock,
    '      const ringRadius = Math.max(18, radius + 4);',
    '    enemy.stage15PressureGfx = gfx;'
  );

  assert.ok(
    markerBlock.includes('gfx.strokeCircle(0, 0, ringRadius);'),
    'default Stage Marker Target ring should remain'
  );
  assert.ok(
    markerBlock.includes('this._shouldUseFocusStagePriorityAttention(enemy)'),
    'Stage Marker Target graphics should consult the focus stage attention guard'
  );

  const emphasisBlock = sourceBlock(
    markerBlock,
    'if (this._shouldUseFocusStagePriorityAttention(enemy)) {',
    '      }'
  );
  assert.ok(
    emphasisBlock.includes('gfx.lineStyle(2, 0x77D6C3, P15_117_FOCUS_STAGE_ATTENTION_ALPHA);'),
    'focus stage emphasis should use capped cool-mint line alpha'
  );
  assert.ok(
    emphasisBlock.includes('gfx.lineBetween(-16, ringRadius + 7, -6, ringRadius + 7);'),
    'focus stage emphasis should include the left underline tick'
  );
  assert.ok(
    emphasisBlock.includes('gfx.lineBetween(6, ringRadius + 7, 16, ringRadius + 7);'),
    'focus stage emphasis should include the right underline tick'
  );

  [
    'this.add.image',
    'load.image',
    'this.load',
    'public/art',
    '.png',
    'audio',
    'fillCircle',
    'strokeCircle',
    'strokeRect',
    'fillTriangle',
    'this.tweens',
    'tweens.add',
    'particle',
    'arrow',
    'lock',
  ].forEach((forbidden) => {
    assert.equal(emphasisBlock.includes(forbidden), false, `focus stage emphasis must stay tiny and non-objective-like: ${forbidden}`);
  });
}

{
  const stableBeatHelperBlock = sourceBlock(
    battleSceneSource,
    '  _shouldUseStableBeatEncounterEmphasis(enemy) {',
    '  _shouldUseFocusStagePriorityAttention(enemy) {'
  );
  assert.ok(
    stableBeatHelperBlock.includes('STAGE_15_DRIFTING_LIGHTSTICK_TYPE'),
    'stable beat emphasis should continue to target Drifting Lightstick'
  );
  assert.equal(
    stableBeatHelperBlock.includes('STAGE_15_STAGE_MARKER_TARGET_TYPE'),
    false,
    'stable beat emphasis must not drift onto Stage Marker Target'
  );
}

{
  const runtimeSource = `${battleSceneSource}\n${titleSceneSource}\n${stageWavesSource}`;
  [
    'setlist_choice_row_source',
    'cue_timing_tick_source',
    'selected_cue_soft_edge_source',
    'stage_manager_mark_source',
    'phase15-p15-108t',
    'focus_stage.png',
    'stage_marker_attention.png',
  ].forEach((forbidden) => {
    assert.equal(runtimeSource.includes(forbidden), false, `runtime must not reference forbidden Setlist Cue art: ${forbidden}`);
  });

  assert.equal(stageWavesSource.includes('P15_117'), false, 'P15-117 should not change stage wave defs');
  assert.equal(stageWavesSource.includes('focus_stage'), false, 'focus_stage should not enter wave defs');
}

{
  const relevantSource = [
    sourceBlock(
      battleSceneSource,
      'const P15_117_FOCUS_STAGE_CUE_ID',
      'const MOBILE_MOVE_ZONE_RIGHT'
    ),
    sourceBlock(
      battleSceneSource,
      '  _shouldUseFocusStagePriorityAttention(enemy) {',
      '  _getStageWaveDefs() {'
    ),
    sourceBlock(
      battleSceneSource,
      'if (this._shouldUseFocusStagePriorityAttention(enemy)) {',
      '      }'
    ),
  ].join('\n');

  [
    'reward',
    'task',
    'red dot',
    'lock-on',
    'bounty',
    'buff',
    'shield',
    'upgrade',
    'Stage 2',
    'shop',
    'gacha',
    'backend',
    'analytics',
  ].forEach((forbidden) => {
    assert.equal(relevantSource.includes(forbidden), false, `focus stage attention must not introduce forbidden semantics: ${forbidden}`);
  });
}

console.log('p15117 focus stage priority target attention: all assertions passed');
