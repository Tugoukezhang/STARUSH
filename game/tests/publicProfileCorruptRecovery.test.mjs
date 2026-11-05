import assert from 'node:assert/strict';
import test from 'node:test';
import { loadScenes, storageFixture } from './helpers/publicShellHarness.mjs';

let sequence = 0;
const moduleUrl = new URL('../src/utils/publicRunProgression.mjs', import.meta.url);
const fresh = () => import(`${moduleUrl.href}?corrupt-recovery-${++sequence}`);
const key = 'starush.public-profile';
const backupKey = 'starush.public-profile.corrupt-backup';
const win = { runId: 'session-win', performerId: 'kai', victory: true, chapterId: 'opening' };

for (const raw of ['{broken', 'null', '[]', '7', '{}', '{"version":1}']) {
  test(`cold corrupt save stays intact through selection, settlement and retry: ${raw}`, async () => {
    const api = await fresh();
    const s = storageFixture(); s.setItem(key, raw);
    api.loadPublicProfile(s);
    assert.equal(api.selectPublicPerformer('kai', s).persisted, false);
    assert.equal(api.loadPublicProfile(s).recovery?.kind, 'corrupt');
    assert.equal(api.recordPublicRun(win, s).persisted, false);
    assert.equal(api.retryPublicProfileSave(s).persisted, false);
    assert.equal(s.getItem(key), raw);
    assert.equal(s.getItem(backupKey), null, 'reads/ordinary actions never create backups');
  });
}

test('explicit recovery backs up exact raw before saving session progress, once', async () => {
  const api = await fresh(); const s = storageFixture(); const raw = '{broken';
  s.setItem(key, raw); api.selectPublicPerformer('kai', s); api.recordPublicRun(win, s);
  const writes = []; const set = s.setItem;
  s.setItem = (k, v) => { writes.push(k); set(k, v); };
  const recovered = api.recoverPublicProfile(raw, s);
  assert.equal(recovered.recoveryStatus, 'recovered');
  assert.equal(recovered.persisted, true);
  assert.equal(recovered.clears, 1); assert.equal(recovered.selectedId, 'kai');
  assert.equal(s.getItem(backupKey), raw);
  assert.deepEqual(writes, [backupKey, key]);
  assert.equal(api.retryPublicProfileSave(s).clears, 1);
  assert.equal(api.recordPublicRun(win, s).clears, 1);
  assert.equal(api.recoverPublicProfile(raw, s).recoveryStatus, 'save-changed');
});

test('backup quota failure leaves raw intact; retry preserves the session', async () => {
  const api = await fresh(); const s = storageFixture(); s.setItem(key, '[]');
  api.recordPublicRun(win, s); const set = s.setItem;
  s.setItem = (k, v) => { if (k === backupKey) throw Error('quota'); set(k, v); };
  assert.equal(api.recoverPublicProfile('[]', s).recoveryStatus, 'backup-failed');
  assert.equal(s.getItem(key), '[]');
  s.setItem = set;
  assert.equal(api.recoverPublicProfile('[]', s).clears, 1);
});

test('failed profile write leaves backed-up raw intact and is explicitly retryable', async () => {
  const api = await fresh(); const s = storageFixture(); s.setItem(key, 'null');
  api.recordPublicRun(win, s); const set = s.setItem;
  s.setItem = (k, v) => { if (k === key) throw Error('quota'); set(k, v); };
  assert.equal(api.recoverPublicProfile('null', s).recoveryStatus, 'save-failed');
  assert.equal(s.getItem(key), 'null'); assert.equal(s.getItem(backupKey), 'null');
  s.setItem = set;
  assert.equal(api.recoverPublicProfile('null', s).clears, 1);
});

test('future versions and changed raw cannot be rebuilt or backed up', async () => {
  const api = await fresh(); const s = storageFixture();
  const future = '{"version":99,"payload":"preserve"}'; s.setItem(key, future);
  assert.equal(api.loadPublicProfile(s).recovery?.kind, 'unsupported');
  assert.equal(api.recoverPublicProfile(future, s).recoveryStatus, 'not-recoverable');
  assert.equal(s.getItem(key), future); assert.equal(s.getItem(backupKey), null);
  s.setItem(key, '[]');
  assert.equal(api.recoverPublicProfile('{broken', s).recoveryStatus, 'save-changed');
  assert.equal(s.getItem(key), '[]');
});

test('single writer loss and existing different backup both prevent rebuilding', async () => {
  const api = await fresh(); const s = storageFixture(); s.setItem(key, '[]');
  api.configurePublicProfileWriteAuthority(() => false);
  assert.equal(api.recoverPublicProfile('[]', s).recoveryStatus, 'write-denied');
  assert.equal(s.getItem(backupKey), null);
  api.configurePublicProfileWriteAuthority(() => true);
  s.setItem(backupKey, 'previous evidence');
  assert.equal(api.recoverPublicProfile('[]', s).recoveryStatus, 'backup-conflict');
  assert.equal(s.getItem(key), '[]'); assert.equal(s.getItem(backupKey), 'previous evidence');
});

test('healthy saves are untouched by recovery and retain earned chapter progress', async () => {
  const api = await fresh(); const s = storageFixture(); api.recordPublicRun(win, s);
  const valid = s.getItem(key);
  assert.equal(api.recoverPublicProfile(valid, s).recoveryStatus, 'not-recoverable');
  assert.equal(s.getItem(key), valid); assert.equal(s.getItem(backupKey), null);
  assert.equal(api.loadPublicProfile(s).campaign.chapterClears.opening, 1);
});

test('future nested versions are not treated as corrupt rebuildable progress', async () => {
  for (const field of ['campaign', 'preparation']) {
    const api = await fresh(); const s = storageFixture(); api.recordPublicRun(win, s);
    const profile = JSON.parse(s.getItem(key)); profile[field].version = 99;
    const raw = JSON.stringify(profile); s.setItem(key, raw);
    assert.equal(api.loadPublicProfile(s).recovery.kind, 'unsupported');
    assert.equal(api.recoverPublicProfile(raw, s).recoveryStatus, 'not-recoverable');
    assert.equal(s.getItem(key), raw);
  }
});

test('raw changing during backup aborts replacement without losing the new save', async () => {
  const api = await fresh(); const s = storageFixture(); s.setItem(key, '[]');
  const set = s.setItem;
  s.setItem = (k, v) => { set(k, v); if (k === backupKey) set(key, '{"version":99}'); };
  assert.equal(api.recoverPublicProfile('[]', s).recoveryStatus, 'save-changed');
  assert.equal(s.getItem(key), '{"version":99}'); assert.equal(s.getItem(backupKey), '[]');
});

test('known progress and pending commands survive corrupted disk recovery without duplicate wins', async () => {
  const api = await fresh(); const s = storageFixture(); api.recordPublicRun(win, s);
  s.setItem(key, '{broken');
  api.recordPublicRun({ ...win, runId: 'second', chapterId: 'neon' }, s);
  assert.equal(s.getItem(key), '{broken');
  const recovered = api.recoverPublicProfile('{broken', s);
  assert.equal(recovered.clears, 2);
  assert.equal(api.retryPublicProfileSave(s).clears, 2);
  assert.deepEqual(recovered.recordedRunIds, ['session-win', 'second']);
});

test('all shell pages show protection; cancel is read-only; confirm needs two gestures', () => {
  for (const sceneName of ['TitleScene', 'IdolRosterScene', 'TourRouteScene']) {
    const s = storageFixture(); s.setItem(key, '{broken');
    const loaded = loadScenes({ storage: s }); const view = loaded.harness(loaded[sceneName]);
    view.scene.create();
    assert.match(view.text, /存档损坏/);
    view.click('[data-action=recover-save]');
    assert.equal(s.getItem(key), '{broken');
    view.click('[data-action=cancel-recovery]');
    assert.equal(s.getItem(key), '{broken'); assert.equal(s.getItem(backupKey), null);
    view.click('[data-action=recover-save]'); view.click('[data-action=confirm-recovery]');
    assert.equal(s.getItem(backupKey), '{broken');
    assert.equal(JSON.parse(s.getItem(key)).version, 1);
    assert.match(view.text, /已备份原档/); view.shutdown();
    assert.equal(loaded.document.getElementById('public-shell'), null);
  }
});

test('unsupported save notice offers no destructive recovery control', () => {
  const s = storageFixture(); s.setItem(key, '{"version":99}');
  const loaded = loadScenes({ storage: s }); const view = loaded.harness(loaded.TitleScene);
  view.scene.create(); assert.match(view.text, /版本不兼容/);
  assert.equal(view.query('[data-action=recover-save]'), null);
  view.shutdown();
});
