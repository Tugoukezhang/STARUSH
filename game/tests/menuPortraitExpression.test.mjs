import test from 'node:test';
import assert from 'node:assert/strict';
import * as expression from '../src/systems/MenuPortraitExpression.mjs';
import {homePortraitPose, applyPortraitReaction} from '../src/systems/HomePortraitCanvas.mjs';

test('expression art declares exact current-face local rectangles and separate blink/smile paths', () => {
 for (const [id, x, y, width, height] of [['enjo', 394, 244, 330, 330], ['kai', 534, 164, 310, 310]]) {
  const art = expression.getMenuPortraitExpressionArt(id);
  assert.deepEqual(art, {
   id, x, y, width, height,
   blink: `art/menu-expression-20261031/${id}-blink.webp`,
   smile: `art/menu-expression-20261031/${id}-smile.webp`,
  });
  assert(Object.isFrozen(art));
  assert.strictEqual(expression.getMenuPortraitExpressionArt(id), art);
 }
});

test('expression art registry returns null for every unregistered identity without inherited entries', () => {
 for (const id of ['sakura', 'genya', 'venus', 'bogus', 'toString', '__proto__', null, undefined]) {
  assert.equal(expression.getMenuPortraitExpressionArt(id), null);
 }
});

const basePose = Object.freeze({...homePortraitPose(2000, {x: .4, y: -.2}), acknowledge: .7});
const context = Object.freeze({elapsed: 0, reactionAge: -1, area: undefined, reduced: false});
function poseAt(overrides, pose = basePose) {
 assert.equal(typeof expression.menuPortraitExpressionPose, 'function', 'pure expression pose export is required');
 return expression.menuPortraitExpressionPose(pose, {...context, ...overrides});
}

test('idle uses only closed/open frames in a bounded five-second cycle with 120ms holds', () => {
 const holds = [];
 let previous = false;
 for (let elapsed = 0; elapsed < 16000; elapsed++) {
  const pose = poseAt({elapsed});
  assert([0, 1].includes(pose.eyelid));
  assert.equal(pose.blink, pose.eyelid === 1);
  assert.equal(pose.smileOpacity, 0);
  if (pose.blink && !previous) holds.push({start: elapsed, duration: 0});
  if (pose.blink) holds.at(-1).duration++;
  previous = pose.blink;
 }
 assert.equal(holds.length, 3);
 for (let i = 0; i < holds.length; i++) {
  assert.equal(holds[i].duration, 120);
  if (i) assert.equal(holds[i].start - holds[i - 1].start, 5000);
 }
});

test('idle closed-frame interval is half-open and does not inherit the old blink schedule', () => {
 for (const [elapsed, closed] of [[0, false], [4399.999, false], [4400, true], [4519.999, true], [4520, false], [5000, false], [9400, true], [100004400, true]]) {
  const pose = poseAt({elapsed}, {...basePose, blink: !closed, eyelid: .5, smileOpacity: 1});
  assert.equal(pose.eyelid, closed ? 1 : 0);
  assert.equal(pose.blink, closed);
  assert.equal(pose.smileOpacity, 0);
 }
});

test('head and body smiles are finite bounded pulses that finish inside the existing 900ms reaction', () => {
 for (const area of ['head', 'body']) {
  for (let reactionAge = -1; reactionAge <= 1000; reactionAge++) {
   const {smileOpacity} = poseAt({area, reactionAge});
   assert(Number.isFinite(smileOpacity));
   assert(smileOpacity >= 0 && smileOpacity <= 1);
   if (reactionAge <= 0 || reactionAge >= 900) assert.equal(smileOpacity, 0);
   else assert(smileOpacity > 0);
  }
  assert.equal(poseAt({area, reactionAge: 450}).smileOpacity, 1);
  assert(poseAt({area, reactionAge: 899}).smileOpacity < .001);
 }
});

test('no touch smile is synthesized for absent/nonfinite ages or non-touch areas', () => {
 for (const area of ['head', 'body']) for (const reactionAge of [-Infinity, Infinity, NaN, -1, 900, 2000]) {
  assert.equal(poseAt({area, reactionAge}).smileOpacity, 0);
 }
 for (const area of [undefined, 'hair', '']) assert.equal(poseAt({area, reactionAge: 450}).smileOpacity, 0);
});

test('head touch can force a short closed frame but body touch cannot', () => {
 for (const reactionAge of [0, 60, 119.999]) {
  const head = poseAt({area: 'head', reactionAge});
  assert.equal(head.eyelid, 1);
  assert.equal(head.blink, true);
  const body = poseAt({area: 'body', reactionAge});
  assert.equal(body.eyelid, 0);
  assert.equal(body.blink, false);
 }
 for (const reactionAge of [-1, 120, 450, 899, 900]) assert.equal(poseAt({area: 'head', reactionAge}).blink, false);
});

test('reduced motion explicitly neutralizes all expressions even during idle or touch', () => {
 for (const elapsed of [0, 4400]) for (const area of ['head', 'body']) for (const reactionAge of [0, 60, 450, 899]) {
  const source = {...basePose, eyelid: 1, blink: true, smileOpacity: 1};
  assert.deepEqual(poseAt({elapsed, area, reactionAge, reduced: true}, source), {
   ...source, eyelid: 0, blink: false, smileOpacity: 0,
  });
 }
});

test('expression composition preserves every non-expression field of existing canvas reaction poses', () => {
 for (const area of ['head', 'body']) for (const reactionAge of [0, 60, 450, 899, 900]) {
  const source = Object.freeze({...applyPortraitReaction(basePose, reactionAge, area), marker: Object.freeze({same: true})});
  const result = poseAt({area, reactionAge}, source);
  assert.notStrictEqual(result, source);
  for (const key of Object.keys(source).filter(key => key !== 'blink')) assert.strictEqual(result[key], source[key]);
 }
});

test('pure pose evaluation does not mutate or own the caller clock and is order-independent', () => {
 const active = Object.freeze({...context, elapsed: 4400, reactionAge: 60, area: 'head'});
 const expected = poseAt(active);
 for (const elapsed of [10000, 0, 4519, 3000]) poseAt({elapsed});
 assert.deepEqual(expression.menuPortraitExpressionPose(basePose, active), expected);
 assert.deepEqual(active, {...context, elapsed: 4400, reactionAge: 60, area: 'head'});
 assert.deepEqual(basePose, {...homePortraitPose(2000, {x: .4, y: -.2}), acknowledge: .7});
});
