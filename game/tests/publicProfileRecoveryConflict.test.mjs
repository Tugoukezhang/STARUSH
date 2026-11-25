import assert from 'node:assert/strict';
import test from 'node:test';

const moduleUrl = new URL('../src/utils/publicRunProgression.mjs', import.meta.url);
let sequence = 0;
async function pair() {
  const a = await import(`${moduleUrl.href}?tab-a-${++sequence}`);
  const b = await import(`${moduleUrl.href}?tab-b-${sequence}`);
  const state = { raw: null, failA: false, failReadA: false, writes: 0 };
  const storage = blocked => ({
    getItem() { if (blocked && state.failReadA) throw Error('denied'); return state.raw; },
    setItem(_, raw) { if (blocked && state.failA) throw Error('quota'); state.raw = raw; state.writes++; },
  });
  return { a, b, state, sa: storage(true), sb: storage(false) };
}
const win = (runId, chapterId = 'opening', performerId = 'sakura') =>
  ({ runId, chapterId, performerId, victory: true, durationMs: 40000, choices: ['wide_brush', 'echo'] });

test('pending selection never overwrites a different tab earned clear', async () => {
  const { a, b, state, sa, sb } = await pair();
  a.selectPublicPerformer('sakura', sa);
  state.failA = true;
  assert.equal(a.selectPublicPerformer('kai', sa).persisted, false);
  b.recordPublicRun(win('other-tab-win'), sb);
  state.failA = false;
  const recovered = a.selectPublicPerformer('kai', sa);
  assert.equal(recovered.clears, 1, 'earned progress must survive stale selection retry');
  assert.equal(recovered.selectedId, 'kai');
  assert.equal(recovered.campaign.chapterClears.opening, 1);
  assert.deepEqual(recovered.recordedRunIds, ['other-tab-win']);
  assert.equal(recovered.persisted, true);
});

test('pending results replay once on latest valid profile, preserving both tabs', async () => {
  const { a, b, state, sa, sb } = await pair();
  a.selectPublicPerformer('sakura', sa);
  state.failA = true;
  a.recordPublicRun(win('offline-opening'), sa);
  a.recordPublicRun(win('offline-neon', 'neon', 'kai'), sa);
  b.recordPublicRun(win('online-opening', 'opening', 'venus'), sb);
  state.failA = false;
  const writes = state.writes;
  assert.equal(a.loadPublicProfile(sa).clears, 3);
  assert.equal(state.writes, writes, 'read must not write');
  const recovered = a.recordPublicRun(win('offline-neon', 'neon', 'kai'), sa);
  assert.equal(recovered.clears, 3);
  assert.equal(recovered.attempts, 3);
  assert.deepEqual(recovered.campaign.chapterClears, { opening: 2, neon: 1, encore: 0, raincheck: 0, homecoming: 0 });
  assert.equal(recovered.clearsByPerformer.venus, 1);
  assert.equal(recovered.clearsByPerformer.kai, 1);
  assert.equal(recovered.persisted, true);
  assert.equal(a.recordPublicRun(win('offline-neon', 'neon', 'kai'), sa).clears, 3);
});

test('read denial on first load cannot erase an unseen existing save after recovery', async () => {
  const { a, b, state, sa, sb } = await pair();
  b.recordPublicRun(win('existing-opening'), sb);
  state.failReadA = true;
  assert.equal(a.selectPublicPerformer('enjo', sa).persisted, false);
  state.failReadA = false;
  const recovered = a.selectPublicPerformer('enjo', sa);
  assert.equal(recovered.clears, 1);
  assert.equal(recovered.campaign.chapterClears.opening, 1);
  assert.equal(recovered.selectedId, 'enjo');
});

test('a pending result already saved elsewhere cannot count or replace it twice', async () => {
  const { a, b, state, sa, sb } = await pair();
  a.selectPublicPerformer('sakura', sa);
  state.failA = true;
  a.recordPublicRun(win('shared'), sa);
  b.recordPublicRun(win('shared'), sb);
  b.recordPublicRun(win('next', 'neon'), sb);
  state.failA = false;
  const recovered = a.recordPublicRun(win('shared'), sa);
  assert.equal(recovered.clears, 2);
  assert.equal(recovered.lastRun.runId, 'next');
  assert.equal(recovered.campaign.chapterClears.neon, 1);
});

test('repeated failed merge reads and writes never duplicate either tab results', async () => {
  const { a, b, state, sa, sb } = await pair();
  a.selectPublicPerformer('sakura', sa);
  state.failA = true;
  a.recordPublicRun(win('offline'), sa);
  b.recordPublicRun(win('online'), sb);
  for (let i = 0; i < 3; i++) {
    const p = a.recordPublicRun(win('offline'), sa);
    assert.equal(p.clears, 2);
    assert.equal(p.persisted, false);
    assert.equal(a.loadPublicProfile(sa).clears, 2);
  }
  state.failA = false;
  assert.equal(a.selectPublicChapter('neon', sa).clears, 2);
  assert.equal(JSON.parse(state.raw).campaign.selectedChapterId, 'neon');
});

test('an explicit reset removes pending commands rather than resurrecting old wins', async () => {
  const { a, state, sa } = await pair();
  a.selectPublicPerformer('sakura', sa);
  state.failA = true;
  a.recordPublicRun(win('discarded'), sa);
  state.raw = null;
  assert.equal(a.loadPublicProfile(sa).clears, 0);
  state.failA = false;
  a.selectPublicPerformer('venus', sa);
  assert.equal(a.loadPublicProfile(sa).clears, 0);
  assert.equal(a.recordPublicRun(win('new'), sa).clears, 1);
  assert.deepEqual(JSON.parse(state.raw).recordedRunIds, ['new']);
});

test('future versions stay protected until an actually supported save is readable', async () => {
  const { a, b, state, sa, sb } = await pair();
  b.recordPublicRun(win('existing'), sb);
  const valid = state.raw;
  a.loadPublicProfile(sa);
  state.raw = JSON.stringify({ version: 2, future: 'preserve' });
  const future = state.raw;
  assert.equal(a.selectPublicPerformer('kai', sa).persisted, false);
  assert.equal(state.raw, future);
  state.raw = valid;
  assert.equal(a.selectPublicPerformer('kai', sa).clears, 1);
});
