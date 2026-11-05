import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from './helpers/publicShellHarness.mjs';
import * as motion from '../src/systems/MenuPortraitMotion.mjs';
import {getMenuPortraitExpressionArt, menuPortraitExpressionPose} from '../src/systems/MenuPortraitExpression.mjs';
import {mountMenuPortrait} from '../src/systems/MenuPortraitPresentation.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture({id = 'kai', cached = false, reduced = false, canvas = true, presentation = false} = {}) {
 const doc = createDocument(), parent = doc.createElement('button'), body = doc.createElement('img');
 const background = doc.createElement('img'), jobs = new Map(), controls = [], draws = [], listeners = new Set();
 doc.body.append(parent); parent.append(body); body.hidden = false; background.style.transform = 'scale(1.02)';
 let next = 0;
 const stack = [], ctx = {globalAlpha: 1, setTransform(){}, clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, closePath(){}, clip(){}, transform(){},
  save(){stack.push(this.globalAlpha);}, restore(){this.globalAlpha = stack.pop();},
  drawImage(image, ...args){assert(image, 'only decoded registered images may be drawn'); draws.push({image, args, alpha: this.globalAlpha});}};
 const media = {matches: reduced, addEventListener: (_n, f) => listeners.add(f), removeEventListener: (_n, f) => listeners.delete(f)};
 doc.defaultView = {requestAnimationFrame: f => {jobs.set(++next, f); return next;}, cancelAnimationFrame: n => jobs.delete(n), matchMedia: () => media};
 const art = getMenuPortraitExpressionArt(id);
 const view = {doc, element(tag, cls, text, host){
  const node = doc.createElement(tag); node.className = cls; if (text !== undefined) node.textContent = text;
  if (cls === 'menu-portrait-motion') node.getBoundingClientRect = () => ({width: 400, height: 520});
  if (tag === 'canvas') node.getContext = () => canvas ? ctx : null;
  if (tag === 'img') {
   let resolve, reject;
   const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
   const control = {node, resolve, reject, calls: 0}; controls.push(control);
   node.decode = () => {control.calls++; return promise;};
   if (cached) {node.complete = true; node.naturalWidth = art.width; node.naturalHeight = art.height;}
  }
  host.append(node); return node;
 }};
 const dispose = presentation ? mountMenuPortrait(view, parent, id, body, {animate: true, background}) : motion.mountMenuPortraitMotion(view, parent, id, body, background);
 return {doc, view, parent, body, background, controls, jobs, draws, media, listeners, dispose,
  get rig(){return parent.querySelector('.menu-portrait-motion');},
  load(index){const node = controls[index].node; node.naturalWidth = art.width; node.naturalHeight = art.height; node.dispatchEvent({type: 'load'});},
  step(stamp){const pending = [...jobs.values()]; jobs.clear(); pending.forEach(fn => fn(stamp));},
  async ready(){controls.forEach((_c, i) => this.load(i)); controls.forEach(c => c.resolve()); await flush();},
 };
}

test('only the two per-character patches load and both must decode before neutral-to-canvas reveal', async () => {
 for (const id of ['kai', 'enjo']) {
  const f = fixture({id}), art = getMenuPortraitExpressionArt(id);
  assert.deepEqual([art.x, art.y, art.width, art.height], id === 'kai' ? [534, 164, 310, 310] : [394, 244, 330, 330]);
  assert.equal(f.controls.length, 2);
  assert.deepEqual(f.controls.map(c => c.node.src), [art.blink, art.smile]);
  assert(f.controls.every(c => c.node.hidden && c.node.width === art.width && c.node.height === art.height));
  assert.equal(f.parent.dataset.menuMotionState, 'loading'); assert.equal(f.body.hidden, false); assert(f.rig.hidden);
  assert.equal(f.jobs.size, 0); assert.equal(f.parent.querySelector('canvas'), null);
  f.load(0); f.load(0); f.controls[0].resolve(); await flush();
  assert.equal(f.controls[0].calls, 1); assert.equal(f.body.hidden, false); assert.equal(f.jobs.size, 0);
  f.load(1); await flush(); assert.equal(f.body.hidden, false); assert(f.rig.hidden);
  f.controls[1].resolve(); await flush();
  assert.equal(f.parent.dataset.menuMotionState, 'ready'); assert(f.body.hidden); assert.equal(f.rig.hidden, false);
  assert.equal(f.jobs.size, 1); assert.equal(f.draws[0].image, f.body); assert.equal(f.parent.querySelectorAll('canvas').length, 1);
  assert.equal(f.parent.querySelector('.menu-eyelid-source'), null);
  f.dispose();
 }
});

test('cached patches still decode exactly once and cannot reveal early', async () => {
 const f = fixture({cached: true});
 assert.equal(f.controls.length, 2); await flush();
 assert(f.controls.every(c => c.calls === 1)); assert.equal(f.body.hidden, false);
 f.controls.forEach(c => {c.node.dispatchEvent({type: 'load'}); c.resolve();}); await flush();
 assert(f.controls.every(c => c.calls === 1)); assert.equal(f.parent.dataset.menuMotionState, 'ready'); f.dispose();
});

test('actual B252 presentation decodes one source-static body with explicit errors and no legacy expression mounts or Q revival', async () => {
 for (const id of ['kai', 'enjo']) for (const mode of ['ready', 'network', 'dimensions', 'decode', 'sync-decode', 'late-error']) {
  const f = fixture({id, presentation: true}); assert.equal(f.controls.length, 1); assert(f.body.hidden);
  const neutral = f.controls[0];
  assert.equal(neutral.node.src, `art/portrait-base-20261101/${id}.webp`);
  assert.deepEqual([neutral.node.width, neutral.node.height], [1152, 1664]);
  assert.equal(f.parent.dataset.menuPortraitState, 'loading'); assert(neutral.node.hidden);
  assert.equal(f.parent.dataset.portraitBase, 'b252'); assert.equal(f.parent.dataset.portraitMotion, 'source-static');
  neutral.node.naturalWidth = mode === 'dimensions' ? 1 : 1152; neutral.node.naturalHeight = 1664;
  if (mode === 'network') neutral.node.dispatchEvent({type: 'error'});
  else {
   if (mode === 'sync-decode') neutral.node.decode = () => {throw new DOMException('bad source', 'EncodingError');};
   neutral.node.dispatchEvent({type: 'load'});
   if (['ready', 'decode', 'late-error'].includes(mode)) {
    assert(neutral.node.hidden); assert.equal(f.parent.dataset.menuPortraitState, 'loading'); assert.equal(neutral.calls, 1);
   }
   if (mode === 'decode') neutral.reject(new DOMException('bad source', 'EncodingError'));
   else neutral.resolve();
  }
  await flush();
  if (mode === 'late-error') {
   assert.equal(f.parent.dataset.menuPortraitState, 'ready'); assert.equal(neutral.node.hidden, false);
   neutral.node.dispatchEvent({type: 'error'});
  }
  assert(f.body.hidden, 'Q proxy remains suppressed');
  assert.equal(f.parent.dataset.menuPortraitState, mode === 'ready' ? 'ready' : 'unavailable');
  if (mode === 'ready') {assert.equal(neutral.node.hidden, false); assert.equal(neutral.node.parentNode, f.parent); assert.equal(f.parent.querySelector('.menu-portrait-error'), null);}
  else {assert.equal(neutral.node.parentNode, null); const status = f.parent.querySelector('.menu-portrait-error'); assert(status); assert.equal(status.getAttribute('role'), 'status'); assert(status.textContent.length > 0);}
  assert.equal(f.controls.length, 1); assert.equal(f.parent.dataset.menuMotionState, undefined);
  assert.equal(f.rig, null); assert.equal(f.parent.querySelector('canvas'), null); assert.equal(f.parent.querySelector('.menu-expression-source'), null);
  assert.equal(f.jobs.size, 0); assert.equal(f.draws.length, 0); assert.equal(f.listeners.size, 0); assert.equal(f.background.style.transform, 'scale(1.02)');
  f.dispose(); assert.equal(f.body.hidden, false); assert.equal(f.parent.querySelector('.menu-portrait-error'), null);
 }
});

test('network, dimensions and decoder failures visibly report error and retain actual neutral, never Q or ready/static', async () => {
 for (const mode of ['network', 'dimensions', 'decode', 'sync-decode', 'missing-decode']) {
  const f = fixture(); assert.equal(f.controls.length, 2);
  const first = f.controls[0];
  if (mode === 'network') first.node.dispatchEvent({type: 'error'});
  if (mode === 'dimensions') {first.node.naturalWidth = 1; first.node.naturalHeight = 1; first.node.dispatchEvent({type: 'load'});}
  if (mode === 'decode') {f.load(0); first.reject(new DOMException('bad source', 'EncodingError'));}
  if (mode === 'sync-decode') {first.node.decode = () => {throw new DOMException('bad source', 'EncodingError');}; f.load(0);}
  if (mode === 'missing-decode') {delete first.node.decode; f.load(0);}
  await flush();
  assert.equal(f.parent.dataset.menuMotionState, 'error', mode); assert.equal(f.body.hidden, false); assert(f.rig.hidden);
  const status = f.parent.querySelector('.menu-portrait-error'); assert(status); assert.equal(status.hidden, false); assert(status.textContent.length > 0);
  assert.equal(status.getAttribute('role'), 'status'); assert.equal(f.jobs.size, 0); assert.equal(f.parent.querySelector('canvas'), null);
  f.controls.forEach(c => c.resolve()); f.load(1); await flush();
  assert.equal(f.parent.dataset.menuMotionState, 'error'); assert.equal(f.body.hidden, false); f.dispose();
  assert.equal(f.parent.querySelector('.menu-portrait-error'), null);
 }
});

test('late image errors and context loss release the existing canvas and surface an explicit error', async () => {
 for (const mode of ['image', 'context', 'no-context']) {
  const f = fixture({canvas: mode !== 'no-context'}); assert.equal(f.controls.length, 2); await f.ready();
  if (mode === 'image') f.controls[0].node.dispatchEvent({type: 'error'});
  if (mode === 'context') f.parent.querySelector('canvas').dispatchEvent({type: 'contextlost'});
  assert.equal(f.parent.dataset.menuMotionState, 'error'); assert.equal(f.body.hidden, false);
  assert.equal(f.jobs.size, 0); assert.equal(f.listeners.size, 0); assert.equal(f.parent.querySelector('canvas'), null);
  assert.equal(f.parent.querySelector('.menu-portrait-error').hidden, false); assert.equal(f.background.style.transform, 'scale(1.02)'); f.dispose();
 }
});

test('disposal, moved source/rig and disposed views invalidate pending decode completions', async () => {
 for (const mode of ['dispose', 'body', 'rig', 'view']) {
  const f = fixture(); assert.equal(f.controls.length, 2); f.controls.forEach((_c, i) => f.load(i)); await flush();
  if (mode === 'dispose') f.dispose();
  if (mode === 'body') f.body.remove();
  if (mode === 'rig') f.rig.remove();
  if (mode === 'view') f.view.disposed = true;
  f.controls.forEach(c => c.resolve()); await flush();
  assert.equal(f.body.hidden, false); assert.equal(f.jobs.size, 0); assert.equal(f.parent.querySelector('canvas'), null);
  assert.notEqual(f.parent.dataset.menuMotionState, 'ready'); f.dispose(); f.dispose();
  assert.equal(f.parent.querySelector('.menu-expression-source'), null);
 }
});

test('blink and smile draw independently at the exact pinned local crop after unchanged body geometry', () => {
 for (const id of ['kai', 'enjo']) {
  const art = motion.getMenuPortraitMotionArt(id), face = getMenuPortraitExpressionArt(id), body = {}, blink = {}, smile = {}, old = {};
  const images = new Map([['body', body], ['blink', blink], ['smile', smile], ['eyes', old]]);
  const calls = [], stack = [], ctx = {globalAlpha: 1, setTransform(){}, clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, closePath(){}, clip(){}, transform(){},
   save(){stack.push(this.globalAlpha);}, restore(){this.globalAlpha = stack.pop();}, drawImage(image, ...args){calls.push({image, args, alpha: this.globalAlpha});}};
  const base = {breath: 8, hair: .03, tail: .075, lookX: .6, acknowledge: .7, eyelid: 0, blink: false, smileOpacity: 0};
  motion.drawMenuPortraitFrame(ctx, art, images, base, 375, 667); const bodyCalls = [...calls];
  for (const [closed, opacity] of [[true, 0], [false, .4], [true, 1], [false, 0]]) {
   calls.length = 0; motion.drawMenuPortraitFrame(ctx, art, images, {...base, eyelid: closed ? 1 : 0, blink: closed, smileOpacity: opacity}, 375, 667);
   assert.deepEqual(calls.filter(c => c.image === body), bodyCalls); assert.equal(calls.filter(c => c.image === old).length, 0);
   const patches = calls.filter(c => c.image !== body); assert.equal(patches.length, Number(closed) + Number(opacity > 0));
   for (const patch of patches) {assert.deepEqual(patch.args, [face.x, face.y, face.width, face.height]); assert.equal(patch.alpha, patch.image === blink ? 1 : opacity);}
   assert.equal(ctx.globalAlpha, 1);
  }
 }
});

test('menu pose adapter reuses the contract and preserves breath/look/reaction fields', () => {
 for (const id of ['kai', 'enjo']) for (const area of ['head', 'body']) for (const reactionAge of [0, 60, 450, 899, 900]) {
  const pose = {breath: 4, hair: .02, tail: .01, lookX: .3, lookY: -.2, acknowledge: .7};
  const context = {elapsed: 0, reactionAge, area, reduced: false};
  assert.deepEqual(motion.menuPortraitFacePose(id, pose, context), menuPortraitExpressionPose(pose, context));
 }
});

test('real shared Canvas clock controls idle, finite reactions, hidden time and reduced neutrality without extra jobs', async () => {
 for (const id of ['kai', 'enjo']) {
  const f = fixture({id}); assert.equal(f.controls.length, 2); await f.ready();
  const blink = f.controls[0].node, smile = f.controls[1].node;
  const patchDraws = () => f.draws.filter(d => d.image === blink || d.image === smile);
  f.step(0); f.draws.length = 0; f.step(4400); assert(patchDraws().some(d => d.image === blink)); assert.equal(f.jobs.size, 1);
  f.draws.length = 0; f.step(4520); assert.equal(patchDraws().length, 0);
  f.rig.dataset.reaction = 'head'; f.rig.dataset.reactionSequence = '1'; f.draws.length = 0; f.step(4600);
  assert(patchDraws().some(d => d.image === blink));
  f.draws.length = 0; f.step(5050); assert(patchDraws().some(d => d.image === smile && d.alpha === 1));
  f.doc.hidden = true; f.doc.dispatchEvent({type: 'visibilitychange'}); assert.equal(f.jobs.size, 0);
  f.doc.hidden = false; f.draws.length = 0; f.doc.dispatchEvent({type: 'visibilitychange'}); f.step(60000);
  assert(patchDraws().some(d => d.image === smile && d.alpha === 1)); assert.equal(f.jobs.size, 1);
  f.draws.length = 0; f.step(60450); assert.equal(patchDraws().length, 0);
  f.rig.dataset.reaction = 'body'; f.rig.dataset.reactionSequence = '2'; f.draws.length = 0; f.step(60600);
  assert.equal(patchDraws().length, 0); f.draws.length = 0; f.step(61050);
  assert(patchDraws().some(d => d.image === smile && d.alpha === 1)); assert(!patchDraws().some(d => d.image === blink));
  f.draws.length = 0; f.step(61500); assert.equal(patchDraws().length, 0);
  f.media.matches = true; f.draws.length = 0; [...f.listeners].forEach(fn => fn());
  assert.equal(f.jobs.size, 0); assert.equal(patchDraws().length, 0);
  f.dispose(); assert.equal(f.jobs.size, 0); assert.equal(f.listeners.size, 0); assert.equal(f.background.style.transform, 'scale(1.02)');
 }
});

test('reduced mode still validates both patches but paints one neutral frame with no RAF', async () => {
 const f = fixture({reduced: true}); assert.equal(f.controls.length, 2); await f.ready();
 assert.equal(f.parent.dataset.menuMotionState, 'ready'); assert.equal(f.draws.length, 1); assert.equal(f.draws[0].image, f.body);
 assert.equal(f.jobs.size, 0); f.dispose();
});
