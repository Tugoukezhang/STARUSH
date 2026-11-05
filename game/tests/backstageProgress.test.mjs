import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { configurePublicProfileWriteAuthority } from '../src/utils/publicRunProgression.mjs';

const api = await import('../src/utils/publicBackstageProgress.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
const need = name => {
  assert.equal(typeof api[name], 'function', `${name} must be implemented`);
  return api[name];
};
const KEY = 'starush.backstage.v1';
const members = ['sakura', 'enjo', 'kai'];
const topics = ['greeting', 'rehearsal', 'encore'];
function memory(raw = null) {
  const data = new Map(raw === null ? [] : [[KEY, raw]]);
  const reads = [], writes = [];
  return {
    data, reads, writes,
    getItem(key) { reads.push(key); return data.get(key) ?? null; },
    setItem(key, value) { writes.push([key, value]); data.set(key, value); },
  };
}
const load = storage => need('loadBackstageProgress')(storage);
const update = (command, storage) => need('updateBackstageProgress')(command, storage);
const valid = raw => need('validateBackstageBackup')(raw);
const fresh = () => load(memory()).state;
const talk = (memberId = 'sakura', topicId = 'greeting') => ({ type: 'talk', memberId, topicId });
const assign = (roomId = 'stage', memberId = 'sakura', programId = api.BACKSTAGE_ROOMS?.find(r => r.id === roomId)?.programs[0].id) =>
  ({ type: 'assign', roomId, memberId, programId });
const prepare = (roomId = 'stage') => ({ type: 'prepare', roomId });
afterEach(() => configurePublicProfileWriteAuthority(() => true));

test('exports bounded immutable room/program/topic definitions', () => {
  assert.equal(api.BACKSTAGE_STORAGE_KEY, KEY);
  assert.deepEqual(api.BACKSTAGE_ROOMS?.map(r => r.id), ['stage', 'rehearsal', 'lounge']);
  assert.deepEqual(api.BACKSTAGE_TOPICS?.map(t => t.id), topics);
  assert.ok(Object.isFrozen(api.BACKSTAGE_ROOMS));
  assert.ok(Object.isFrozen(api.BACKSTAGE_TOPICS));
  for (const room of api.BACKSTAGE_ROOMS) {
    assert.deepEqual(Object.keys(room).sort(), ['id', 'name', 'programs']);
    assert.ok(room.name && room.programs.length >= 2);
    assert.ok(Object.isFrozen(room) && Object.isFrozen(room.programs));
    assert.equal(new Set(room.programs.map(p => p.id)).size, room.programs.length);
    for (const program of room.programs) {
      assert.deepEqual(Object.keys(program).sort(), ['id', 'name']);
      assert.ok(program.id && program.name && Object.isFrozen(program));
    }
  }
  for (const topic of api.BACKSTAGE_TOPICS) {
    assert.deepEqual(Object.keys(topic).sort(), ['id', 'label']);
    assert.ok(topic.label && Object.isFrozen(topic));
  }
});

test('missing key creates a fresh exact v2 state without writing', () => {
  const storage = memory(), result = load(storage);
  assert.equal(result.status, 'ready');
  assert.deepEqual(Object.keys(result.state).sort(), ['conversations','rooms','selectedCompanionId','topics','version','visits']);
  assert.equal(result.state.version, 2);
  assert.equal(result.state.selectedCompanionId,null);
  assert.deepEqual(result.state.conversations,{sakura:null,enjo:null,kai:null});
  assert.deepEqual(result.state.visits, { sakura: 0, enjo: 0, kai: 0 });
  assert.deepEqual(result.state.topics, { sakura: null, enjo: null, kai: null });
  for (const room of api.BACKSTAGE_ROOMS) assert.deepEqual(result.state.rooms[room.id], {
    memberId: null, programId: room.programs[0].id, prepared: false,
  });
  assert.equal(valid(JSON.stringify(result.state)), true);
  result.state.visits.sakura = 500;
  assert.equal(load(storage).state.visits.sakura, 0);
  assert.equal(storage.writes.length, 0);
});

test('talk persists only own key, reads back, and records each member/topic independently', () => {
  const storage = memory();
  storage.data.set('starush.public-profile', 'do not touch');
  for (const memberId of members) for (const topicId of topics) {
    const result = update(talk(memberId, topicId), storage);
    assert.equal(result.status, 'saved');
    assert.equal(result.state.topics[memberId], topicId);
  }
  assert.deepEqual(load(storage).state.visits, { sakura: 3, enjo: 3, kai: 3 });
  assert.equal(storage.data.get('starush.public-profile'), 'do not touch');
  assert.ok(storage.reads.length >= storage.writes.length * 2);
  assert.ok(storage.reads.every(key => key === KEY));
  assert.ok(storage.writes.every(([key]) => key === KEY));
  assert.equal(valid(storage.data.get(KEY)), true);
});

test('counts cap at 999; same topic at cap is unchanged but changing topic still saves', () => {
  const state = fresh(); state.visits.sakura = 998; state.topics.sakura = 'greeting';
  const storage = memory(JSON.stringify(state));
  assert.equal(update(talk(), storage).state.visits.sakura, 999);
  assert.equal(update(talk(), storage).status, 'unchanged');
  assert.equal(storage.writes.length, 1);
  assert.equal(update(talk('sakura', 'encore'), storage).status, 'saved');
  assert.equal(load(storage).state.visits.sakura, 999);
});

test('assign/prepare persists; moving clears old assignment and preparation, not its program', () => {
  const storage = memory(), programId = api.BACKSTAGE_ROOMS?.[0].programs[1].id;
  assert.equal(update(prepare(), storage).status, 'unchanged');
  assert.equal(storage.writes.length, 0);
  assert.equal(update(assign('stage', 'sakura', programId), storage).status, 'saved');
  assert.equal(update(prepare(), storage).state.rooms.stage.prepared, true);
  assert.equal(update(prepare(), storage).status, 'unchanged');
  assert.equal(update(assign('stage', 'sakura', programId), storage).state.rooms.stage.prepared, false);
  assert.equal(update(assign('stage', 'sakura', programId), storage).status, 'unchanged');
  update(prepare(), storage);
  const moved = update(assign('rehearsal', 'sakura'), storage);
  assert.deepEqual(moved.state.rooms.stage, { memberId: null, programId, prepared: false });
  assert.equal(moved.state.rooms.rehearsal.memberId, 'sakura');
  assert.equal(moved.state.rooms.rehearsal.prepared, false);
  update(assign('lounge', 'enjo'), storage); update(prepare('lounge'), storage);
  const replaced = update(assign('lounge', 'kai'), storage);
  assert.deepEqual(replaced.state.rooms.lounge, {
    memberId: 'kai', programId: api.BACKSTAGE_ROOMS[2].programs[0].id, prepared: false,
  });
  assert.deepEqual(load(storage).state, replaced.state);
  assert.equal(valid(storage.data.get(KEY)), true);
});

test('commands require exact fields and valid member/room/topic/room-specific program enums', () => {
  const storage = memory();
  const commands = [null, [], {}, 'talk', { type: 'reward' }, { type: 'talk', memberId: 'sakura' },
    talk('venus'), talk('__proto__'), talk('sakura', 'unknown'), { ...talk(), amount: 1 },
    { ...talk(), type: 'toString' }, { ...assign(), roomId: 'unknown' }, { ...assign(), memberId: null },
    { ...assign(), programId: 'unknown' }, { ...assign(), programId: api.BACKSTAGE_ROOMS?.[1].programs[0].id },
    { type: 'assign', roomId: 'stage', memberId: 'sakura' }, prepare('unknown'), { ...prepare(), timer: 10 }];
  for (const command of commands) assert.equal(update(command, storage).status, 'invalid-command', JSON.stringify(command));
  assert.equal(storage.writes.length, 0);
  assert.deepEqual(load(storage).state, fresh());
});

test('each update reads current disk state rather than a previous load or returned snapshot', () => {
  const storage = memory();
  const stale = load(storage).state;
  const other = fresh(); other.visits.sakura = 7; other.topics.sakura = 'encore';
  storage.data.set(KEY, JSON.stringify(other));
  stale.visits.enjo = 999;
  const result = update(talk(), storage);
  assert.equal(result.state.visits.sakura, 8);
  assert.equal(result.state.visits.enjo, 0);
  result.state.visits.sakura = 100;
  assert.equal(load(storage).state.visits.sakura, 8);
});

test('authority loss denies writes and does not queue commands for later ownership', () => {
  const storage = memory();
  configurePublicProfileWriteAuthority(() => false);
  assert.equal(update(talk(), storage).status, 'write-denied');
  assert.equal(storage.writes.length, 0);
  configurePublicProfileWriteAuthority(() => { throw Error('lock failure'); });
  assert.equal(update(talk(), storage).status, 'write-denied');
  configurePublicProfileWriteAuthority(() => true);
  assert.equal(update(talk('enjo'), storage).state.visits.sakura, 0);
});

test('authority is checked after fresh storage read, immediately before persisting', () => {
  const storage = memory(); let owner = true;
  configurePublicProfileWriteAuthority(() => owner);
  const get = storage.getItem;
  storage.getItem = key => { const value = get(key); owner = false; return value; };
  assert.equal(update(talk(), storage).status, 'write-denied');
  assert.equal(storage.writes.length, 0);
});

test('corrupt/future/non-string values are protected and never overwritten', () => {
  const base = fresh();
  for (const raw of ['', '{', 'null', '[]', '1', '{}', JSON.stringify({ ...base, version: 3 }),
    JSON.stringify({ ...base, currency: 100 }), 42, ' '.repeat(32768)]) {
    const storage = memory(raw);
    assert.equal(load(storage).status, 'protected', String(raw).slice(0, 50));
    assert.equal(update(talk(), storage).status, 'protected');
    assert.equal(storage.data.get(KEY), raw);
    assert.equal(storage.writes.length, 0);
  }
});

test('backup validation rejects missing input and enforces strict UTF-8 byte limit below 32KiB', () => {
  const raw = JSON.stringify(fresh());
  for (const input of [undefined, null, fresh(), '', 'null', '[]']) assert.equal(valid(input), false);
  assert.equal(valid(raw + ' '.repeat(32767 - Buffer.byteLength(raw))), true);
  assert.equal(valid(raw + ' '.repeat(32768 - Buffer.byteLength(raw))), false);
  const wide = raw.replace('"version"', '"' + '\u2000'.repeat(12000) + 'version"');
  assert.ok(wide.length < 32768 && Buffer.byteLength(wide) > 32768);
  assert.equal(valid(wide), false);
});

test('backup validation enforces exact nested keys, enums, numeric bounds and room invariants', () => {
  const mutations = [
    s => { delete s.visits.kai; }, s => { s.visits.venus = 0; },
    s => { s.visits.sakura = -1; }, s => { s.visits.sakura = 1000; }, s => { s.visits.sakura = 0.5; },
    s => { s.visits.sakura = '1'; }, s => { s.topics.sakura = 'unknown'; },
    s => { delete s.topics.kai; }, s => { s.topics.venus = null; },
    s => { s.topics.sakura = 'greeting'; }, s => { s.visits.sakura = 1; },
    s => { s.rooms.stage.memberId = 'venus'; }, s => { s.rooms.stage.prepared = 1; },
    s => { s.rooms.stage.prepared = true; }, s => { s.rooms.stage.programId = 'unknown'; },
    s => { s.rooms.stage.programId = api.BACKSTAGE_ROOMS[1].programs[0].id; },
    s => { s.rooms.stage.reward = 1; }, s => { delete s.rooms.stage.programId; },
    s => { s.rooms.extra = { ...s.rooms.stage }; }, s => { delete s.rooms.lounge; },
    s => { s.rooms.stage.memberId = s.rooms.lounge.memberId = 'sakura'; },
  ];
  for (const mutate of mutations) {
    const state = fresh(); mutate(state); const raw = JSON.stringify(state);
    assert.equal(valid(raw), false, mutate.toString());
    const storage = memory(raw);
    assert.equal(update(talk(), storage).status, 'protected', mutate.toString());
    assert.equal(storage.writes.length, 0);
  }
  assert.equal(valid(JSON.stringify({ ...fresh(), ['__proto__']: {} })), false);
});

test('unavailable storage/read errors fail closed without changing state', () => {
  for (const storage of [null, {}, { getItem() { throw Error('privacy'); } }]) {
    assert.equal(load(storage).status, 'unavailable');
    assert.equal(update(talk(), storage).status, 'storage-error');
    assert.deepEqual(update(talk(), storage).state, fresh());
  }
});

test('default browser storage resolves safely even when its getter throws', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    const storage = memory();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    assert.equal(need('loadBackstageProgress')().status, 'ready');
    assert.equal(need('updateBackstageProgress')(talk()).status, 'saved');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('blocked'); } });
    assert.equal(need('loadBackstageProgress')().status, 'unavailable');
    assert.equal(need('updateBackstageProgress')(talk()).status, 'storage-error');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('write failures and silent write drops never report saved or leak speculative state', () => {
  for (const failure of ['throw', 'drop', 'readback-throw', 'replace']) {
    const storage = memory(), get = storage.getItem; let written = false;
    storage.setItem = (key, value) => {
      if (failure === 'throw') throw Error('quota');
      written = true;
      if (failure !== 'drop') storage.data.set(key, failure === 'replace' ? '{}' : value);
    };
    storage.getItem = key => {
      if (failure === 'readback-throw' && written) throw Error('blocked');
      return get(key);
    };
    const result = update(talk(), storage);
    assert.equal(result.status, 'storage-error', failure);
    assert.equal(result.state.visits.sakura, 0, failure);
  }
});

test('dialogue has three distinct authored personalities for every supported topic', () => {
  const line = need('getCompanionLine'), state = fresh(), before = JSON.stringify(state);
  for (const topic of topics) {
    const lines = members.map(member => line(member, topic, null, state));
    assert.equal(new Set(lines).size, 3);
    assert.ok(lines.every(value => typeof value === 'string' && value.length > 10 && value.length < 250));
    assert.deepEqual(members.map(member => line(member, topic, null, state)), lines);
  }
  assert.equal(JSON.stringify(state), before);
  assert.equal(line('venus', 'greeting', null, state), null);
  assert.equal(line('sakura', 'unknown', null, state), null);
  assert.equal(line('__proto__', 'greeting', null, state), null);
});

test('result-aware lines use only an own lastRun boolean fact, never aggregate clears or invented history', () => {
  const line = need('getCompanionLine'), state = fresh();
  for (const member of members) for (const topic of topics) {
    const neutral = line(member, topic, null, state);
    for (const profile of [{ clears: 20 }, { lastRun: null }, { lastRun: { victory: 'true' } },
      Object.create({ lastRun: { victory: true } }), { lastRun: Object.create({ victory: true }) }]) {
      assert.equal(line(member, topic, profile, state), neutral);
    }
    const win = line(member, topic, { lastRun: { victory: true } }, state);
    const loss = line(member, topic, { lastRun: { victory: false } }, state);
    assert.notEqual(win, neutral); assert.notEqual(loss, neutral); assert.notEqual(win, loss);
    assert.match(win, /通关/); assert.match(loss, /未通关/);
    assert.doesNotMatch(neutral, /上次|昨天|今天|记得|想你|通关|999/);
    assert.doesNotMatch(win + loss, /我们.*通关|一起.*通关|昨天|今天|记得|想你/);
  }
});

test('dialogue does not revive superseded legacy cast action identities', () => {
  const line = need('getCompanionLine');
  for (const member of members) for (const topic of topics) {
    assert.doesNotMatch(line(member, topic, null, fresh()), /扇奏|应援爆拍|校拍疾步/);
  }
});

test('Sakura topics use the approved rifle identity rather than the old lead-singer role', () => {
  const line = need('getCompanionLine');
  assert.match(line('sakura', 'greeting', null, fresh()), /步枪|枪械/);
  assert.match(line('sakura', 'rehearsal', null, fresh()), /瞄准/);
  assert.match(line('sakura', 'encore', null, fresh()), /扇面扫射/);
  for (const topic of topics) {
    const text = line('sakura', topic, { lastRun: { victory: true } }, fresh());
    assert.doesNotMatch(text, /唱|歌声|旋律|换气|气息/);
  }
});

test('primary-profile corruption/future versions stay byte-identical; backstage validates independently under the same authority', () => {
  for (const primary of ['{broken', '{"version":99}']) {
    const storage = memory();
    storage.data.set('starush.public-profile', primary);
    const get = storage.getItem;
    storage.getItem = key => {
      assert.equal(key, KEY, 'backstage must never inspect another storage domain');
      return get(key);
    };
    assert.equal(load(storage).status, 'ready');
    assert.equal(update(talk(), storage).status, 'saved');
    assert.equal(valid(storage.data.get(KEY)), true);
    assert.equal(valid(primary), false);
    const before = storage.data.get(KEY);
    configurePublicProfileWriteAuthority(() => false);
    assert.equal(update(talk(), storage).status, 'write-denied');
    assert.equal(storage.data.get(KEY), before);
    configurePublicProfileWriteAuthority(() => true);
    storage.data.set(KEY, '{"version":99}');
    assert.equal(update(talk(), storage).status, 'protected');
    assert.equal(storage.data.get(KEY), '{"version":99}');
    assert.equal(storage.data.get('starush.public-profile'), primary);
    assert.deepEqual(storage.writes.map(([key]) => key), [KEY]);
  }
});
