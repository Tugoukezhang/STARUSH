import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
const titleSceneSource = readFileSync(new URL('../src/scenes/TitleScene.js', import.meta.url), 'utf8');
const stageWavesSource = readFileSync(new URL('../src/utils/stageWaves.mjs', import.meta.url), 'utf8');

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
  assert.equal(stringConstant('P15_113_STABLE_BEAT_CUE_ID'), 'stable_beat');
  assert.equal(numericConstant('P15_113_STABLE_BEAT_DRIFT_TRAIL_ALPHA'), 0.34);
  assert.ok(
    numericConstant('P15_113_STABLE_BEAT_DRIFT_TRAIL_ALPHA') <= 0.34,
    'stable beat drift trail alpha cap must stay at or below 0.34'
  );
}

{
  const helperBlock = sourceBlock(
    battleSceneSource,
    '  _shouldUseStableBeatEncounterEmphasis(enemy) {',
    '  _getStageWaveDefs() {'
  );

  assert.ok(
    helperBlock.includes('this._isStage15PracticeMode() === true'),
    'stable beat emphasis must stay practice-only'
  );
  assert.ok(
    helperBlock.includes("this._p15SetlistCueId === P15_113_STABLE_BEAT_CUE_ID"),
    'stable beat emphasis must require the stable_beat cue id'
  );
  assert.ok(
    helperBlock.includes('enemy?.type === STAGE_15_DRIFTING_LIGHTSTICK_TYPE'),
    'stable beat emphasis must target only Drifting Lightstick enemies'
  );

  ['default_setlist', 'focus_stage', 'hold_highlight'].forEach((cueId) => {
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

  assert.ok(
    graphicsBlock.includes('gfx.lineStyle(2, 0xA892FF, 0.18);'),
    'default Drifting Lightstick trail alpha 0.18 path must remain'
  );
  assert.ok(
    graphicsBlock.includes('this._shouldUseStableBeatEncounterEmphasis(enemy)'),
    'Drifting Lightstick graphics should consult the stable beat emphasis guard'
  );

  const emphasisBlock = sourceBlock(
    graphicsBlock,
    'if (this._shouldUseStableBeatEncounterEmphasis(enemy)) {',
    '      gfx.setAngle'
  );
  assert.ok(
    emphasisBlock.includes('gfx.lineStyle(2, 0xA892FF, P15_113_STABLE_BEAT_DRIFT_TRAIL_ALPHA);'),
    'stable beat emphasis should use the capped trail alpha'
  );
  assert.ok(
    emphasisBlock.includes('gfx.lineBetween(-30, 0, -40, 0);'),
    'stable beat emphasis should include the left lateral dash'
  );
  assert.ok(
    emphasisBlock.includes('gfx.lineBetween(30, 0, 40, 0);'),
    'stable beat emphasis should include the right lateral dash'
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
    'this.tweens',
    'tweens.add',
    'particle',
  ].forEach((forbidden) => {
    assert.equal(emphasisBlock.includes(forbidden), false, `stable beat emphasis must stay graphics-only and restrained: ${forbidden}`);
  });
}

{
  const runtimeSource = `${battleSceneSource}\n${titleSceneSource}\n${stageWavesSource}`;
  [
    'setlist_choice_row_source',
    'cue_timing_tick_source',
    'selected_cue_soft_edge_source',
    'stage_manager_mark_source',
    'phase15-p15-108t',
    'stable_beat.png',
    'drifting_lightstick.png',
  ].forEach((forbidden) => {
    assert.equal(runtimeSource.includes(forbidden), false, `runtime must not reference forbidden Setlist Cue art: ${forbidden}`);
  });
}

{
  const relevantSource = [
    sourceBlock(
      battleSceneSource,
      'const P15_113_STABLE_BEAT_CUE_ID',
      'const MOBILE_MOVE_ZONE_RIGHT'
    ),
    sourceBlock(
      battleSceneSource,
      '  _shouldUseStableBeatEncounterEmphasis(enemy) {',
      '  _getStageWaveDefs() {'
    ),
    sourceBlock(
      battleSceneSource,
      'if (this._shouldUseStableBeatEncounterEmphasis(enemy)) {',
      '      gfx.setAngle'
    ),
  ].join('\n');

  [
    'reward',
    'task',
    'buff',
    'shield',
    'upgrade',
    'Stage 2',
    'shop',
    'gacha',
    'backend',
    'analytics',
    '奖励',
    '任务',
    '红点',
    '商店',
    '抽卡',
    '后端',
  ].forEach((forbidden) => {
    assert.equal(relevantSource.includes(forbidden), false, `stable beat emphasis must not introduce forbidden semantics: ${forbidden}`);
  });
}

console.log('p15113 stable beat encounter emphasis: all assertions passed');
