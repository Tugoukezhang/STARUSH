import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScenes } from './helpers/publicShellHarness.mjs';

function fixture(mode = 'choice') {
  const env = loadScenes();
  const { BattleSurfaceView } = env.loadRuntime('systems/BattleSurfaceView.mjs');
  const chosen = [];
  const scene = { input: { enabled: true, keyboard: { enabled: true, resetKeys() {} }, resetPointers() {} },
    events: { once() {}, off() {} }, sound: null };
  const options = mode === 'choice' ? { mode, member: env.profile.PUBLIC_PERFORMERS[1], number: 1,
    options: ['wide_brush', 'relay', 'tempo'].map(id => env.profile.getRunChoice(id)),
    onChoice: id => chosen.push(id), onLeave: () => chosen.push('leave') }
    : { mode, onResume: () => chosen.push('resume'), onSettings() {}, onRetry() {}, onLeave() {} };
  const view = new BattleSurfaceView(scene, options, env.document);
  const button = view.root.querySelector(mode === 'choice' ? '[data-choice=tempo]' : '[data-pause-action=resume]');
  const event = (type, fields = {}, target = button) => target.dispatchEvent({
    type, bubbles: true, pointerId: 1, isPrimary: true, button: 0, clientX: 68, clientY: 571,
    detail: type === 'click' ? 1 : 0, ...fields });
  return { view, button, chosen, event };
}

test('choice does not consume native click after the observed 52px drag', () => {
  const f = fixture();
  f.event('pointerdown');
  f.event('pointermove', { clientX: 117, clientY: 553 });
  f.event('pointerup', { clientX: 117, clientY: 553 });
  f.event('click', { clientX: 117, clientY: 553 });
  assert.deepEqual(f.chosen, []);
  assert.equal(f.view.busy, false);
  f.event('pointerdown'); f.event('pointerup'); f.event('click');
  assert.deepEqual(f.chosen, ['tempo'], 'next deliberate tap remains usable');
  f.view.destroy();
});

test('choice rejects inherited release, cancel, secondary pointer and drag out-and-back', () => {
  for (const sequence of [
    [['pointerup'], ['click']],
    [['pointerdown'], ['pointercancel'], ['pointerup'], ['click']],
    [['pointerdown'], ['pointermove', { clientX: 100 }], ['pointermove'], ['pointerup'], ['click']],
    [['pointerdown'], ['pointerup', { clientX: 100 }], ['click', { clientX: 100 }]],
    [['pointerdown'], ['pointerleave'], ['pointerup'], ['click']],
    [['pointerdown', { isPrimary: false }], ['pointerup'], ['click']],
    [['pointerdown'], ['pointerdown', { pointerId: 2, isPrimary: false }], ['pointerup'], ['click']],
    [['pointerdown'], ['pointerup'], ['click', { pointerId: 2 }]],
  ]) {
    const f = fixture(); for (const [type, fields] of sequence) f.event(type, fields);
    assert.deepEqual(f.chosen, [], JSON.stringify(sequence)); f.view.destroy();
  }
});

test('small motion on nested icon, keyboard and assistive activation commit exactly once', () => {
  for (const kind of ['pointer', 'keyboard', 'programmatic']) {
    const f = fixture();
    if (kind === 'pointer') {
      f.event('pointerdown', {}, f.button.children[0]);
      f.event('pointerup', { clientX: 74, clientY: 575 }); f.event('click');
    } else if (kind === 'keyboard') {
      f.event('pointerdown'); f.event('pointermove', { clientX: 100 });
      f.event('click', { detail: 0, pointerId: -1 });
    } else f.button.click();
    f.button.click(); assert.deepEqual(f.chosen, ['tempo']); f.view.destroy();
    f.event('click', { detail: 0 }); assert.deepEqual(f.chosen, ['tempo']);
  }
});

test('choice footer also rejects drags without changing pause commands', () => {
  const f = fixture(); const footer = f.view.root.querySelector('[data-action=leave-choice]');
  for (const [type, fields] of [['pointerdown'], ['pointerup', { clientX: 100 }], ['click']]) f.event(type, fields, footer);
  assert.deepEqual(f.chosen, []); footer.click(); assert.deepEqual(f.chosen, ['leave']); f.view.destroy();
  const pause = fixture('pause'); pause.button.click(); assert.deepEqual(pause.chosen, ['resume']); pause.view.destroy();
});

test('leaving before release does not poison a later fresh tap', () => {
  const f = fixture(); f.event('pointerdown'); f.event('pointerleave');
  // The original release occurs outside this button and is not delivered here.
  f.event('pointerdown'); f.event('pointerup'); f.event('click');
  assert.deepEqual(f.chosen, ['tempo']); f.view.destroy();
});

test('non-hover touch leave after pointerup does not invalidate a completed tap', () => {
  const f = fixture(); f.event('pointerdown'); f.event('pointerup'); f.event('pointerleave'); f.event('click');
  assert.deepEqual(f.chosen, ['tempo']); f.view.destroy();
});
