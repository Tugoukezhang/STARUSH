import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {isPublicTargetFocusEnabled} from '../src/utils/publicTargetFocus.mjs';
import {syncPublicObjectiveGuidance} from '../src/systems/PublicObjectiveGuidance.mjs';
import {
  STAGE1_PAINT_DEVICES,
  STAGE1_PAINT_SHOT_RANGE,
  STAGE1_PAINT_TIMER_MS,
} from '../src/utils/stage1PaintRound.mjs';

const battleSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

function sourceBlock(startNeedle, endNeedle) {
  const start = battleSource.indexOf(startNeedle);
  const end = battleSource.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return battleSource.slice(start, end);
}

function compileClassMethod(block, methodName, globals = {}) {
  return Function(
    ...Object.keys(globals),
    `"use strict"; return ({${block.trim()}}).${methodName};`
  )(...Object.values(globals));
}

function numberConstant(name) {
  const match = battleSource.match(new RegExp(`const ${name} = ([0-9.]+);`));
  assert.ok(match, `missing numeric constant: ${name}`);
  return Number(match[1]);
}

const targetBlock = sourceBlock(
  '  _getPublicStage1ObjectiveRouteTarget() {',
  '  _updatePublicStage1ObjectiveRouteCue() {'
);
const updateBlock = sourceBlock(
  '  _updatePublicStage1ObjectiveRouteCue() {',
  '  _clearPublicStage1ObjectiveRouteCue() {'
);
const clearBlock = sourceBlock(
  '  _clearPublicStage1ObjectiveRouteCue() {',
  '  _showP15SetlistCueChoiceOverlay('
);
const targetMethod = compileClassMethod(
  targetBlock,
  '_getPublicStage1ObjectiveRouteTarget',
  { STAGE1_PAINT_SHOT_RANGE }
);
const updateMethod = compileClassMethod(
  updateBlock,
  '_updatePublicStage1ObjectiveRouteCue',
  {
    P16_015_OBJECTIVE_ROUTE_CUE_DEPTH: numberConstant('P16_015_OBJECTIVE_ROUTE_CUE_DEPTH'),
    P16_015_OBJECTIVE_ROUTE_CUE_MAX_ALPHA: numberConstant('P16_015_OBJECTIVE_ROUTE_CUE_MAX_ALPHA'),
    P16_015_OBJECTIVE_ROUTE_CUE_LINE_WIDTH: numberConstant('P16_015_OBJECTIVE_ROUTE_CUE_LINE_WIDTH'),
    isPublicTargetFocusEnabled,
    syncPublicObjectiveGuidance,
  }
);

function makeTargetHarness(target = { x: 400, y: 300 }) {
  return {
    _battleEnded: false,
    _isPublicStage1Round: () => true,
    player: { active: true, x: 0, y: 0 },
    paintZone: {
      isComplete: () => false,
      getNearestPaintable: () => target,
    },
  };
}

{
  const farTarget = { x: 400, y: 300 };
  assert.equal(targetMethod.call(makeTargetHarness(farTarget)), farTarget);

  const inRange = makeTargetHarness({ x: STAGE1_PAINT_SHOT_RANGE, y: 0 });
  assert.equal(targetMethod.call(inRange), null, 'auto-shoot range must suppress the route cue');

  const hiddenPractice = makeTargetHarness(farTarget);
  hiddenPractice._isPublicStage1Round = () => false;
  assert.equal(targetMethod.call(hiddenPractice), null, 'hidden practice must stay isolated');

  const complete = makeTargetHarness(farTarget);
  complete.paintZone.isComplete = () => true;
  assert.equal(targetMethod.call(complete), null, 'completed paint rounds must not guide');

  const ended = makeTargetHarness(farTarget);
  ended._battleEnded = true;
  assert.equal(targetMethod.call(ended), null, 'result state must not retain the cue');
}

{
  const calls = [];
  const gfx = {
    destroyed: false,
    clear() { calls.push(['clear']); return this; },
    setVisible(value) { calls.push(['visible', value]); return this; },
    setDepth(value) { calls.push(['depth', value]); return this; },
    setAlpha(value) { calls.push(['alpha', value]); return this; },
    setPosition(x, y) { calls.push(['position', x, y]); return this; },
    setRotation(value) { calls.push(['rotation', value]); return this; },
    lineStyle(width, color, alpha) { calls.push(['lineStyle', width, color, alpha]); return this; },
    lineBetween(x1, y1, x2, y2) { calls.push(['lineBetween', x1, y1, x2, y2]); return this; },
  };
  const target = { x: 130, y: 140 };
  const scene = {
    player: { x: 100, y: 100 },
    _publicStage1ObjectiveRouteCueGfx: null,
    _getPublicStage1ObjectiveRouteTarget: () => target,
    add: { graphics: () => gfx },
  };

  assert.equal(updateMethod.call(scene), true);
  assert.deepEqual(
    calls.find((call) => call[0] === 'position'),
    ['position', 100, 100],
    'the cue must remain player-local'
  );
  assert.ok(
    Math.abs(calls.find((call) => call[0] === 'rotation')[1] - Math.atan2(40, 30)) < 1e-9,
    'the player-local cue must face the incomplete objective'
  );
  assert.ok(calls.filter((call) => call[0] === 'lineBetween').length >= 4);

  scene._getPublicStage1ObjectiveRouteTarget = () => null;
  assert.equal(updateMethod.call(scene), false);
  assert.ok(calls.some((call) => call[0] === 'visible' && call[1] === false));
}

{
  const alphaMatch = battleSource.match(/const P16_015_OBJECTIVE_ROUTE_CUE_MAX_ALPHA = ([0-9.]+);/);
  const depthMatch = battleSource.match(/const P16_015_OBJECTIVE_ROUTE_CUE_DEPTH = ([0-9.]+);/);
  assert.ok(alphaMatch, 'objective cue alpha cap must be explicit');
  assert.ok(depthMatch, 'objective cue depth must be explicit');
  assert.ok(Number(alphaMatch[1]) <= 0.34);
  assert.ok(Number(depthMatch[1]) < 6, 'objective cue must remain below player bullets');
  assert.ok(updateBlock.includes('this.add.graphics()'));
  assert.ok(updateBlock.includes('lineBetween'));
  assert.equal(/add\.(image|sprite|text)|load\.|textures\.|tweens\.|fillTriangle|strokeCircle/.test(updateBlock), false);
  assert.ok(clearBlock.includes('.destroy()'));
  assert.ok(battleSource.includes('this._updatePublicStage1ObjectiveRouteCue();'));
  assert.ok(battleSource.includes("this._clearPublicStage1ObjectiveRouteCue();"));
}

assert.equal(STAGE1_PAINT_DEVICES.length, 28);
assert.equal(STAGE1_PAINT_TIMER_MS, 240000);

console.log('p16015 public Stage 1 objective route guide: all assertions passed');
