import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadScenes } from './helpers/publicShellHarness.mjs';

function setup({ state = 'suspended', reject = false, throws = false, blocked = false, mode = 'pause' } = {}) {
  const env = loadScenes(), { BattleSurfaceView } = env.loadRuntime('systems/BattleSurfaceView.mjs');
  const calls = [];
  const context = { state, resume() {
    calls.push('audio');
    if (throws) throw new Error('Audio unavailable');
    if (reject) return Promise.reject(new Error('Audio unavailable'));
    this.state = 'running';
    return Promise.resolve();
  } };
  const scene = { sound: { context, locked: false }, input: { enabled: true, keyboard: { enabled: true } },
    events: { once() {}, off() {} }, _sessionExperience: { isBlocking: () => blocked } };
  const view = new BattleSurfaceView(scene, { mode, onResume: () => calls.push('resume'),
    onSettings() {}, onRetry() {}, onLeave() {}, member: env.profile.PUBLIC_PERFORMERS[0],
    number: 1, choices: [], options: [], onChoice() {} }, env.document);
  return { view, context, calls };
}

test('Escape requests suspended audio inside the keyboard command before resuming combat', async () => {
  const f = setup();
  f.view.root.dispatchEvent({ type: 'keydown', key: 'Escape' });
  await Promise.resolve();
  assert.deepEqual(f.calls, ['audio', 'resume']);
  assert.equal(f.context.state, 'running');
  f.view.destroy();
});

test('audio rejection never prevents Escape from restoring controls', async () => {
  const f = setup({ reject: true });
  f.view.root.dispatchEvent({ type: 'keydown', key: 'Escape' });
  await Promise.resolve();
  assert.deepEqual(f.calls, ['audio', 'resume']);
  f.view.destroy();
});

test('synchronous audio failure never prevents restoring controls', () => {
  const f = setup({ throws: true });
  f.view.root.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.deepEqual(f.calls, ['audio', 'resume']);
  f.view.destroy();
});

for (const state of ['running', 'closed']) test(`Escape remains usable with ${state} audio`, () => {
  const f = setup({ state });
  f.view.root.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.deepEqual(f.calls, ['resume']);
  f.view.destroy();
});

test('nested session blocks Escape and audio recovery together', () => {
  const f = setup({ blocked: true });
  f.view.root.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.deepEqual(f.calls, []);
  f.view.destroy();
});

test('Escape cannot resume an active choice', () => {
  const f = setup({ mode: 'choice' });
  f.view.root.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.deepEqual(f.calls, []);
  f.view.destroy();
});
