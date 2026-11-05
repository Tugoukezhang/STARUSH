import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createPublicProfileSession, PUBLIC_PROFILE_LOCK_NAME } from '../src/utils/publicProfileSession.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
class Locks {
  queue = [];
  active = null;
  request(name, options, callback) {
    assert.equal(name, PUBLIC_PROFILE_LOCK_NAME);
    assert.equal(options.mode, 'exclusive');
    assert.equal(options.steal, undefined);
    return new Promise((resolve, reject) => {
      const job = { callback, resolve, reject, signal: options.signal };
      this.queue.push(job);
      options.signal.addEventListener('abort', () => {
        if (this.active === job) return;
        this.queue = this.queue.filter(value => value !== job);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
      this.pump();
    });
  }
  pump() {
    if (this.active || !this.queue.length) return;
    const job = this.active = this.queue.shift();
    Promise.resolve().then(() => job.callback({ name: PUBLIC_PROFILE_LOCK_NAME })).then(job.resolve, job.reject)
      .finally(() => { this.active = null; this.pump(); });
  }
}
let sequence = 0;
async function profile() {
  return import(`../src/utils/publicRunProgression.mjs?writer-test=${++sequence}`);
}
const win = (runId, chapterId = 'opening') => ({ runId, chapterId, performerId: 'sakura', victory: true });
function memory() {
  let raw = null;
  return { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
}
function session(locks, api, boot = () => () => {}, extra = {}) {
  const value = createPublicProfileSession({ locks, boot, ...extra });
  api?.configurePublicProfileWriteAuthority(() => value.isOwner());
  value.start();
  return value;
}

test('second game cannot boot/write until owner leaves; both runs survive fresh handoff', async () => {
  const locks = new Locks(), storage = memory(), a = await profile(), b = await profile();
  let bBoots = 0;
  const sa = session(locks, a);
  const sb = session(locks, b, () => { bBoots++; return () => {}; });
  await tick();
  assert.equal(sa.isOwner(), true);
  assert.equal(sb.isOwner(), false);
  assert.equal(bBoots, 0);
  assert.equal(a.recordPublicRun(win('A'), storage).persisted, true);
  const bytes = storage.getItem();
  assert.equal(b.recordPublicRun(win('denied'), storage).persisted, false);
  assert.equal(storage.getItem(), bytes);
  sa.dispose();
  await tick();
  assert.equal(bBoots, 1);
  assert.equal(sb.isOwner(), true);
  const final = b.recordPublicRun(win('B', 'neon'), storage);
  assert.deepEqual(final.recordedRunIds, ['A', 'B']);
  assert.equal(final.campaign.chapterClears.opening, 1);
  assert.equal(final.campaign.chapterClears.neon, 1);
  assert.equal(b.recordPublicRun(win('B', 'neon'), storage).clears, 2);
  assert.equal(a.recordPublicRun(win('late-A'), storage).persisted, false);
  assert.equal(b.loadPublicProfile(storage).clears, 2);
  sb.dispose();
});

test('training/equipment re-read on handoff; stale rank cannot spend twice', async () => {
  const locks = new Locks(), storage = memory(), a = await profile(), b = await profile();
  const sa = session(locks, a), sb = session(locks, b);
  await tick();
  a.recordPublicRun(win('earned'), storage);
  assert.equal(a.trainPublicPerformer('sakura', 1, storage).preparationStatus, 'trained');
  assert.equal(a.equipPublicPerformer('sakura', 'wide_nozzle', storage).preparationStatus, 'equipped');
  const bytes = storage.getItem();
  assert.equal(b.trainPublicPerformer('kai', 1, storage).preparationStatus, 'save-required');
  assert.equal(b.equipPublicPerformer('sakura', null, storage).preparationStatus, 'save-required');
  assert.equal(storage.getItem(), bytes);
  sa.dispose();
  await tick();
  assert.notEqual(b.trainPublicPerformer('sakura', 1, storage).preparationStatus, 'trained');
  assert.equal(storage.getItem(), bytes);
  assert.equal(b.trainPublicPerformer('kai', 1, storage).preparationStatus, 'trained');
  const final = b.loadPublicProfile(storage);
  assert.equal(final.preparation.trainingLevels.sakura, 2);
  assert.equal(final.preparation.trainingLevels.kai, 2);
  assert.equal(final.preparation.equipmentByPerformer.sakura, 'wide_nozzle');
  sb.dispose();
});

test('cancel queued tab never boots; disposal revokes authority before cleanup', async () => {
  const locks = new Locks();
  let owner, stopped = 0, unwanted = 0;
  owner = session(locks, null, () => () => { assert.equal(owner.isOwner(), false); stopped++; });
  const queued = session(locks, null, () => { unwanted++; });
  await tick();
  queued.dispose();
  owner.dispose(); owner.dispose();
  await tick();
  assert.equal(stopped, 1);
  assert.equal(unwanted, 0);
});

test('unsupported, lock rejection and boot failure never grant writable game state', async () => {
  for (const locks of [null, { request() { throw new Error('denied'); } }, { request() { return Promise.reject(new Error('denied')); } }]) {
    let boots = 0;
    const states = [];
    const value = session(locks, null, () => { boots++; }, { onState: state => states.push(state) });
    await tick();
    assert.equal(value.isOwner(), false);
    assert.equal(boots, 0);
    assert.ok(states.includes(locks ? 'failed' : 'unsupported'));
    value.dispose();
  }
  const locks = new Locks();
  const failed = session(locks, null, () => { throw new Error('boot failed'); });
  const next = session(locks, null);
  await tick(); await tick();
  assert.equal(failed.isOwner(), false);
  assert.equal(next.isOwner(), true);
  next.dispose();
});

test('pagehide closes session; bfcache return reloads instead of resuming stale game', async () => {
  const events = new EventTarget();
  let reloads = 0;
  const value = session(new Locks(), null, () => () => {}, { eventTarget: events, reload: () => reloads++ });
  await tick();
  events.dispatchEvent(new Event('pagehide'));
  assert.equal(value.isOwner(), false);
  const restored = new Event('pageshow');
  Object.defineProperty(restored, 'persisted', { value: true });
  events.dispatchEvent(restored);
  assert.equal(reloads, 1);
});

test('pagehide flushes the current battle while still owner, before destroy and handoff', async () => {
  const events = new EventTarget(), locks = new Locks(), order = [];
  let owner;
  owner = session(locks, null, () => () => order.push(['destroy', owner.isOwner()]), {
    eventTarget: events, beforeClose: () => order.push(['checkpoint', owner.isOwner()]),
  });
  const next = session(locks, null, () => { order.push(['next-boot']); return () => {}; });
  await tick();
  events.dispatchEvent(new Event('pagehide'));
  await tick();
  assert.deepEqual(order, [['checkpoint', true], ['destroy', false], ['next-boot']]);
  owner.dispose();
  assert.equal(order.length, 3, 'flush runs only once');
  next.dispose();
});

test('failing final flush still revokes authority, destroys game and releases lock', async () => {
  const locks = new Locks(); let stopped = false;
  const owner = session(locks, null, () => () => { stopped = true; }, {
    beforeClose: () => { throw Error('final flush failed'); },
  });
  const next = session(locks, null);
  await tick();
  assert.throws(() => owner.dispose(), /final flush failed/);
  await tick();
  assert.equal(owner.isOwner(), false);
  assert.equal(stopped, true);
  assert.equal(next.isOwner(), true);
  next.dispose();
});

test('save retry after authority loss never queues unauthorized work or grants purchases', async () => {
  const api = await profile();
  const storage = memory();
  let authority = true, denied = true;
  api.configurePublicProfileWriteAuthority(() => authority);
  const failing = { getItem: storage.getItem, setItem(...args) { if (denied) throw Error('quota'); storage.setItem(...args); } };
  assert.equal(api.recordPublicRun(win('pending'), failing).persisted, false);
  authority = false; denied = false;
  assert.equal(api.retryPublicProfileSave(failing).persisted, false);
  assert.equal(storage.getItem(), null);
  api.selectPublicPerformer('kai', failing);
  authority = true;
  const recovered = api.retryPublicProfileSave(failing);
  assert.equal(recovered.persisted, true);
  assert.deepEqual(recovered.recordedRunIds, ['pending']);
  assert.equal(recovered.selectedId, 'sakura');
});

test('production entry installs authority and creates Phaser only inside session boot', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /createPublicProfileSession\(/);
  const boot=main.match(/  boot\(\) \{([\s\S]*?)\n  \},/)[1];
  assert.match(boot,/^\s*const recovery=recoverPublicSaveRestore\(\);/);
  assert.match(boot,/if\(!\['none','recovered'\]\.includes\(recovery.status\)\)\s*\{[\s\S]*?throw new Error\([\s\S]*?\n    \}\s*const game = new Phaser.Game\(config\)/);
  assert.equal((main.match(/new Phaser.Game/g) || []).length, 1);
  assert.match(main, /configurePublicProfileWriteAuthority\(\(\) => profileSession.isOwner\(\)\)/);
  assert.match(main, /beforeClose\(\)\s*\{\s*activeGame\?\.scene\?\.keys\?\.BattleScene\?\._publicBattleCheckpoint\?\.flush\('session-close'\)/);
  assert.ok(main.indexOf('configurePublicProfileWriteAuthority(()') < main.indexOf('profileSession.start()'));
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /hold\(text, retryable/);
});
