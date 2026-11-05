import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PUBLIC_STAGE1_FINALE_OUTCOMES,
  canPublicStage1EndInVictory,
  resolvePublicStage1FinaleResultProgress,
} from '../src/systems/PublicStage1FinaleResultContract.mjs';
import {
  BATTLE_RESULT_ACTIONS,
  BATTLE_RESULT_TYPES,
  getBattleResultConfig,
} from '../src/utils/battleResult.mjs';

const battleSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

assert.deepEqual(PUBLIC_STAGE1_FINALE_OUTCOMES, {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  TIMEOUT: 'timeout',
});

assert.equal(canPublicStage1EndInVictory({
  isPublicStage1: true,
  outcome: PUBLIC_STAGE1_FINALE_OUTCOMES.ACTIVE,
}), false);
assert.equal(canPublicStage1EndInVictory({
  isPublicStage1: true,
  outcome: PUBLIC_STAGE1_FINALE_OUTCOMES.TIMEOUT,
}), false);
assert.equal(canPublicStage1EndInVictory({
  isPublicStage1: true,
  outcome: PUBLIC_STAGE1_FINALE_OUTCOMES.COMPLETED,
}), true);
assert.equal(canPublicStage1EndInVictory({
  isPublicStage1: false,
  outcome: null,
}), true);

assert.deepEqual(resolvePublicStage1FinaleResultProgress({
  isPublicStage1: true,
  objectivesComplete: true,
  outcome: PUBLIC_STAGE1_FINALE_OUTCOMES.COMPLETED,
}), {
  paintRoundComplete: true,
  totalWaves: 2,
  clearedWaveCount: 2,
});
assert.deepEqual(resolvePublicStage1FinaleResultProgress({
  isPublicStage1: true,
  objectivesComplete: true,
  outcome: PUBLIC_STAGE1_FINALE_OUTCOMES.TIMEOUT,
}), {
  paintRoundComplete: false,
  totalWaves: 2,
  clearedWaveCount: 1,
});
assert.deepEqual(resolvePublicStage1FinaleResultProgress({
  isPublicStage1: true,
  objectivesComplete: false,
  outcome: null,
}), {
  paintRoundComplete: false,
  totalWaves: 2,
  clearedWaveCount: 0,
});
assert.deepEqual(resolvePublicStage1FinaleResultProgress({
  isPublicStage1: false,
  fallbackComplete: false,
  fallbackTotalWaves: 4,
  fallbackClearedWaveCount: 3,
}), {
  paintRoundComplete: false,
  totalWaves: 4,
  clearedWaveCount: 3,
});

const timeoutResult = getBattleResultConfig({
  type: BATTLE_RESULT_TYPES.PLAYER_DEFEAT,
  stageId: 1,
  clearedWaveCount: 1,
  totalWaves: 2,
  publicStage1FinaleOutcome: PUBLIC_STAGE1_FINALE_OUTCOMES.TIMEOUT,
});
assert.equal(timeoutResult.title, '压轴未完成');
assert.ok(timeoutResult.descriptionLines.some((line) => line.includes('压轴')));
assert.deepEqual(timeoutResult.buttons.map((button) => button.action), [
  BATTLE_RESULT_ACTIONS.RETRY,
  BATTLE_RESULT_ACTIONS.TITLE,
]);

const setupBlock = sourceBlock(
  battleSource,
  '  _setupPublicPaintWorld() {',
  '  _beginPublicPaintRound() {'
);
const beginBlock = sourceBlock(
  battleSource,
  '  _beginPublicStage1Finale() {',
  '  _drawPublicStage1FinaleBossGfx('
);
const paintBlock = sourceBlock(
  battleSource,
  '  _paintPublicStage1TargetsAt(',
  '  _drawUnlitBlobGfx('
);
const updateBlock = sourceBlock(
  battleSource,
  '  _updatePublicStage1Finale() {',
  "  _clearPublicStage1Finale(reason = 'cleared'"
);
const allClearBlock = sourceBlock(
  battleSource,
  '  _onAllWavesClear() {',
  '  _onJarDefeat() {'
);
const endBlock = sourceBlock(
  battleSource,
  '  _endBattle(type) {',
  '  _showP43ResultPreview('
);
const resultBlock = sourceBlock(
  battleSource,
  '  _showBattleResultPanel(type, preview = null) {',
  '  _createBattleResultButton('
);
const actionBlock = sourceBlock(
  battleSource,
  '  _handleBattleResultAction(action) {',
  '  _switchForm() {'
);

assert.ok(setupBlock.includes('this._publicStage1FinaleOutcome = null'));
assert.ok(beginBlock.includes('PUBLIC_STAGE1_FINALE_OUTCOMES.ACTIVE'));
assert.ok(paintBlock.includes('PUBLIC_STAGE1_FINALE_OUTCOMES.COMPLETED'));
assert.ok(updateBlock.includes('PUBLIC_STAGE1_FINALE_OUTCOMES.TIMEOUT'));
assert.ok(allClearBlock.includes('canPublicStage1EndInVictory'));
assert.ok(endBlock.includes('resolvePublicStage1FinaleResultProgress'));
assert.ok(resultBlock.includes('publicStage1FinaleOutcome'));
assert.ok(actionBlock.includes('this.scene.restart(this.battleData || {})'));
assert.equal(actionBlock.includes('_publicStage1FinaleOutcome'), false);
assert.equal(battleSource.includes('finaleCheckpoint'), false);
assert.equal(battleSource.includes('finaleReward'), false);

console.log('p16019 public Stage 1 finale result boundary: all assertions passed');
