import assert from 'node:assert/strict';
import test from 'node:test';
import { getPreparationResources } from '../src/utils/publicPreparation.mjs';

const moduleUrl = new URL('../src/utils/publicRunProgression.mjs', import.meta.url);
let sequence = 0;
const freshApi = () => import(`${moduleUrl.href}?initial-getter-recovery-${++sequence}`);
const win = (runId, chapterId = 'opening') => ({ runId, chapterId, performerId: 'sakura', victory: true });
function memory() {
  return {
    raw: null, reads: 0, writes: 0, failRead: false, failWrite: false,
    getItem() { this.reads++; if (this.failRead) throw Error('read denied'); return this.raw; },
    setItem(_key, raw) { if (this.failWrite) throw Error('quota'); this.raw = raw; this.writes++; },
  };
}
async function withDeniedGetter(check) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const state = { denied: true, target: memory(), accesses: 0 };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() {
    state.accesses++;
    if (state.denied) throw Error('SecurityError');
    return state.target;
  } });
  try { await check(await freshApi(), state); }
  finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
}

test('initial getter denial retains earned progress on the first readable empty store', () => withDeniedGetter((api, state) => {
  const pending = api.recordPublicRun(win('offline'));
  assert.equal(pending.clears, 1);
  assert.equal(pending.persisted, false);
  assert.equal(state.target.reads, 0, 'denied getter must never be bypassed');
  state.denied = false;
  const loaded = api.loadPublicProfile();
  assert.equal(loaded.clears, 1, 'permission recovery must not discard the pending clear');
  assert.equal(getPreparationResources(loaded).balance, 6);
  assert.equal(loaded.persisted, false);
  assert.equal(state.target.writes, 0, 'adoption and loading must remain read-only');
  const saved = api.retryPublicProfileSave();
  assert.equal(saved.persisted, true);
  assert.deepEqual(saved.recordedRunIds, ['offline']);
  assert.equal(api.retryPublicProfileSave().clears, 1);
  assert.equal(api.recordPublicRun(win('offline')).clears, 1);
  assert.equal(state.target.writes, 1);
}));

test('initial recovery replays commands over unseen progress without dropping training or equipment', () => withDeniedGetter(async (api, state) => {
  const other = await freshApi();
  other.recordPublicRun(win('online'), state.target);
  other.trainPublicPerformer('kai', 1, state.target);
  other.equipPublicPerformer('kai', 'wide_nozzle', state.target);
  api.recordPublicRun(win('offline-opening'));
  api.recordPublicRun(win('offline-neon', 'neon'));
  api.selectPublicPerformer('genya');
  state.denied = false;
  const saved = api.retryPublicProfileSave();
  assert.equal(saved.clears, 3);
  assert.deepEqual(saved.campaign.chapterClears, { opening: 2, neon: 1, encore: 0, raincheck: 0, homecoming: 0 });
  assert.equal(saved.preparation.trainingLevels.kai, 2);
  assert.equal(saved.preparation.equipmentByPerformer.kai, 'wide_nozzle');
  assert.equal(saved.selectedId, 'genya');
  assert.equal(saved.persisted, true);
  assert.equal(new Set(saved.recordedRunIds).size, 3);
}));

test('getter recovery followed by a read failure retains the fallback until storage is readable', () => withDeniedGetter((api, state) => {
  api.recordPublicRun(win('offline'));
  state.target.failRead = true;
  state.denied = false;
  assert.equal(api.loadPublicProfile().clears, 1);
  assert.equal(api.retryPublicProfileSave().persisted, false);
  assert.equal(state.target.writes, 0);
  state.target.failRead = false;
  assert.equal(api.retryPublicProfileSave().clears, 1);
  assert.equal(api.loadPublicProfile().persisted, true);
}));

test('future-version storage remains untouched while initially unbound commands wait', () => withDeniedGetter((api, state) => {
  api.recordPublicRun(win('offline'));
  state.target.raw = '{"version":99,"protected":true}';
  state.denied = false;
  const pending = api.retryPublicProfileSave();
  assert.equal(pending.clears, 1);
  assert.equal(pending.persisted, false);
  assert.equal(state.target.raw, '{"version":99,"protected":true}');
  assert.equal(state.target.writes, 0);
  state.target.raw = null;
  assert.equal(api.retryPublicProfileSave().clears, 0, 'an observed removal must not revive queued wins');
  assert.equal(state.target.raw, null);
}));

test('supported data replacing a future version can merge the initially unbound run once', () => withDeniedGetter(async (api, state) => {
  const other = await freshApi();
  other.recordPublicRun(win('online'), state.target);
  const valid = state.target.raw;
  state.target.raw = '{"version":2}';
  api.recordPublicRun(win('offline'));
  state.denied = false;
  assert.equal(api.loadPublicProfile().clears, 1);
  state.target.raw = valid;
  assert.equal(api.retryPublicProfileSave().clears, 2);
  assert.equal(api.retryPublicProfileSave().clears, 2);
}));

test('repeated write failures after getter recovery neither lose nor duplicate commands', () => withDeniedGetter((api, state) => {
  api.recordPublicRun(win('offline'));
  state.denied = false;
  state.target.failWrite = true;
  for (let i = 0; i < 3; i++) {
    const retry = api.retryPublicProfileSave();
    assert.equal(retry.clears, 1);
    assert.equal(retry.persisted, false);
  }
  state.target.failWrite = false;
  const saved = api.retryPublicProfileSave();
  assert.equal(saved.persisted, true);
  assert.deepEqual(saved.recordedRunIds, ['offline']);
  assert.equal(state.target.writes, 1);
}));

test('explicit unavailable storage never shares initially denied default-storage progress', () => withDeniedGetter((api, state) => {
  api.recordPublicRun(win('explicit-null'), null);
  const pending = api.recordPublicRun(win('default-only'));
  assert.deepEqual(pending.recordedRunIds, ['default-only']);
  state.denied = false;
  assert.deepEqual(api.retryPublicProfileSave().recordedRunIds, ['default-only']);
  assert.deepEqual(api.loadPublicProfile(null).recordedRunIds, ['explicit-null']);
}));

test('explicit access cannot drain pending default commands and its own pending operations survive adoption', () => withDeniedGetter((api, state) => {
  api.recordPublicRun(win('default-offline'));
  api.recordPublicRun(win('explicit-saved'), state.target);
  state.target.failWrite = true;
  api.recordPublicRun(win('explicit-pending'), state.target);
  assert.deepEqual(api.loadPublicProfile().recordedRunIds, ['default-offline']);
  state.target.failWrite = false;
  state.denied = false;
  const saved = api.retryPublicProfileSave();
  assert.equal(saved.clears, 3);
  assert.deepEqual(new Set(saved.recordedRunIds), new Set(['default-offline', 'explicit-saved', 'explicit-pending']));
  assert.equal(saved.persisted, true);
}));

test('removing an adopted save resets both cached progress and pending commands', () => withDeniedGetter((api, state) => {
  api.recordPublicRun(win('offline'));
  state.denied = false;
  assert.equal(api.retryPublicProfileSave().persisted, true);
  state.target.failWrite = true;
  api.recordPublicRun(win('pending-neon', 'neon'));
  state.target.raw = null;
  state.target.failWrite = false;
  assert.equal(api.retryPublicProfileSave().clears, 0);
  assert.equal(state.target.raw, null);
  assert.deepEqual(api.loadPublicProfile().recordedRunIds, []);
}));

test('after a real default target is bound its pending history cannot leak to a replacement target', () => withDeniedGetter((api, state) => {
  state.denied = false;
  const originalTarget = state.target;
  api.recordPublicRun(win('saved'));
  state.denied = true;
  api.recordPublicRun(win('pending'));
  state.target = memory();
  state.denied = false;
  assert.equal(api.loadPublicProfile().clears, 0);
  assert.equal(state.target.raw, null);
  const original = api.retryPublicProfileSave(originalTarget);
  assert.equal(original.clears, 2);
  assert.equal(original.persisted, true);
}));

test('an initially absent default storage object can recover without losing session commands', () => withDeniedGetter((api, state) => {
  const target = state.target;
  state.denied = false;
  state.target = undefined;
  api.recordPublicRun(win('offline'));
  state.target = target;
  assert.equal(api.retryPublicProfileSave().clears, 1);
  assert.equal(api.loadPublicProfile().persisted, true);
}));
