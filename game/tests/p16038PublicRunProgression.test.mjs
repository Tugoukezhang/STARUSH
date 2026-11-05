import assert from 'node:assert/strict';
import test from 'node:test';

const moduleUrl = new URL('../src/utils/publicRunProgression.mjs', import.meta.url);
const api = await import(moduleUrl.href).catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.url === moduleUrl.href) return {};
  throw error;
});

function progression(options) {
  assert.equal(typeof api.PublicRunProgression, 'function', 'public run progression is required');
  return new api.PublicRunProgression(options);
}

const firstIds = ['wide_brush', 'relay', 'tempo'];
const secondIds = ['echo', 'overdrive', 'recovery'];
const baselineEffects = {
  paintRadiusBonus: 0, relay: false, chargeMultiplier: 1,
  echo: false, actionPower: 1, recoverOnAnchor: false,
};

test('public roster has the exact five identities, colors and action names', () => {
  assert.ok(Array.isArray(api.PUBLIC_PERFORMERS), 'public roster is required');
  assert.deepEqual(api.PUBLIC_PERFORMERS.map(({ id, name, color, colorHex, actionName }) =>
    [id, name, color, colorHex, actionName]), [
    ['sakura', '绯樱', 'pink', 0xff69b4, '领唱扇奏'],
    ['kai', '苍海', 'blue', 0x00ced1, '校拍疾步'],
    ['venus', '金星', 'yellow', 0xffd700, '和声接力'],
    ['genya', '幻夜', 'purple', 0x9370db, '夜色回响'],
    ['enjo', '炎上', 'orange', 0xff8c00, '应援爆拍'],
  ]);
  for (const performer of api.PUBLIC_PERFORMERS) {
    assert.deepEqual(Object.keys(performer).sort(),
      ['id', 'name', 'color', 'colorHex', 'actionName', 'actionSummary', 'identityMark'].sort());
    assert.match(performer.actionSummary, /[\u4e00-\u9fff]/u);
    assert.ok(performer.actionSummary.length <= 32);
    assert.equal(typeof performer.identityMark, 'string');
    assert.ok(performer.identityMark.length > 0);
  }
  assert.equal(new Set(api.PUBLIC_PERFORMERS.map((entry) => entry.identityMark)).size, 5);
});

test('roster array and each performer are immutable', () => {
  assert.ok(Array.isArray(api.PUBLIC_PERFORMERS), 'public roster is required');
  assert.ok(Object.isFrozen(api.PUBLIC_PERFORMERS));
  for (const performer of api.PUBLIC_PERFORMERS) assert.ok(Object.isFrozen(performer));
  assert.throws(() => api.PUBLIC_PERFORMERS.push({}), TypeError);
  assert.throws(() => { api.PUBLIC_PERFORMERS[0].colorHex = 0; }, TypeError);
});

test('performer lookup resolves each known id and safely falls back to Sakura', () => {
  assert.equal(typeof api.getPublicPerformer, 'function', 'performer lookup is required');
  for (const performer of api.PUBLIC_PERFORMERS) {
    assert.equal(api.getPublicPerformer(performer.id), performer);
  }
  for (const id of [undefined, null, '', 'missing', '__proto__', {}, 7]) {
    assert.equal(api.getPublicPerformer(id), api.PUBLIC_PERFORMERS[0]);
  }
});

test('checkpoint boundaries depend on completed choices and do not mutate state', () => {
  const run = progression();
  const before = run.snapshot();
  for (const count of [0, 1, 2, -1, NaN, Infinity, '3', null]) {
    assert.equal(run.checkpointFor(count), null);
  }
  for (const count of [3, 6, 7, 10]) assert.equal(run.checkpointFor(count), 1);
  assert.deepEqual(run.snapshot(), before);
  assert.equal(run.choose('relay'), true);
  for (const count of [0, 3, 6]) assert.equal(run.checkpointFor(count), null);
  for (const count of [7, 10]) assert.equal(run.checkpointFor(count), 2);
  assert.equal(run.choose('echo'), true);
  assert.equal(run.checkpointFor(10), null);
});

test('choice pools advance once and stale, future and unknown choices are rejected', () => {
  const run = progression();
  assert.deepEqual(run.getOptions().map(({ id }) => id), firstIds);
  for (const id of ['echo', 'missing', '__proto__', null, undefined]) {
    assert.equal(run.choose(id), false);
    assert.deepEqual(run.snapshot().choices, []);
  }
  assert.equal(run.choose('wide_brush'), true);
  assert.deepEqual(run.getOptions().map(({ id }) => id), secondIds);
  for (const id of firstIds) assert.equal(run.choose(id), false);
  assert.equal(run.choose('overdrive'), true);
  assert.deepEqual(run.getOptions(), []);
  for (const id of [...firstIds, ...secondIds]) assert.equal(run.choose(id), false);
  assert.deepEqual(run.snapshot(), { choices: ['wide_brush', 'overdrive'], shotCount: 0, checkpoints: 2 });
});

test('choice descriptions state concise Chinese consequences', () => {
  const run = progression();
  const options = [...run.getOptions()];
  run.choose('wide_brush');
  options.push(...run.getOptions());
  const expected = {
    wide_brush: /涂染范围.*40/u, relay: /接力/u, tempo: /充能.*1\.5/u,
    echo: /回响/u, overdrive: /威力.*1\.5/u, recovery: /设施.*恢复/u,
  };
  for (const option of options) {
    assert.deepEqual(Object.keys(option).sort(), ['description', 'id', 'label']);
    assert.match(option.label, /[\u4e00-\u9fff]/u);
    assert.match(option.description, expected[option.id]);
    assert.ok(option.description.length <= 36);
  }
});

test('all nine legal builds produce precisely the requested effect combinations', () => {
  assert.deepEqual(progression().effects(), baselineEffects);
  for (const first of firstIds) {
    for (const second of secondIds) {
      const run = progression();
      run.choose(first);
      run.choose(second);
      assert.deepEqual(run.effects(), {
        paintRadiusBonus: first === 'wide_brush' ? 40 : 0,
        relay: first === 'relay', chargeMultiplier: first === 'tempo' ? 1.5 : 1,
        echo: second === 'echo', actionPower: second === 'overdrive' ? 1.5 : 1,
        recoverOnAnchor: second === 'recovery',
      });
    }
  }
});

test('snapshots round-trip choices and counters without sharing mutable references', () => {
  const seed = { choices: ['tempo'], shotCount: 19, checkpoints: 1 };
  const run = progression(seed);
  seed.choices[0] = 'relay';
  assert.deepEqual(run.snapshot(), { choices: ['tempo'], shotCount: 19, checkpoints: 1 });
  const snapshot = run.snapshot();
  snapshot.choices.push('echo');
  snapshot.shotCount = 100;
  run.choices.push('echo');
  const effects = run.effects();
  effects.chargeMultiplier = 8;
  assert.equal(run.effects().chargeMultiplier, 1.5);
  assert.deepEqual(progression(run.snapshot()).snapshot(), run.snapshot());
  run.shotCount += 1;
  assert.equal(run.snapshot().shotCount, 20);
  assert.equal(run.choose('recovery'), true);
  assert.equal(run.snapshot().checkpoints, 2);
});

test('options cannot be used to modify future instances or bypass choice validation', () => {
  const run = progression();
  const options = run.getOptions();
  options[0].id = 'overdrive';
  options.pop();
  assert.deepEqual(run.getOptions().map(({ id }) => id), firstIds);
  assert.deepEqual(progression().getOptions().map(({ id }) => id), firstIds);
  assert.equal(run.choose('overdrive'), false);
});

test('malformed restored choices keep only the valid ordered prefix', () => {
  for (const [choices, expected] of [
    [null, []], [{}, []], [['echo'], []], [['missing', 'wide_brush'], []],
    [['tempo', 'relay', 'echo'], ['tempo']],
    [['wide_brush', 'recovery', 'echo'], ['wide_brush', 'recovery']],
  ]) assert.deepEqual(progression({ choices }).snapshot().choices, expected);
  assert.deepEqual(progression(null).snapshot(), { choices: [], shotCount: 0, checkpoints: 0 });
  assert.deepEqual(progression({ shotCount: -1, checkpoints: NaN }).snapshot(),
    { choices: [], shotCount: 0, checkpoints: 0 });
  assert.equal(progression({ shotCount: 5.8 }).snapshot().shotCount, 5);
});

function profileApi() {
  for (const name of ['loadPublicProfile', 'selectPublicPerformer', 'recordPublicRun']) {
    assert.equal(typeof api[name], 'function', `${name} is required`);
  }
  assert.equal(typeof api.PUBLIC_PROFILE_STORAGE_KEY, 'string');
  return api;
}

function memoryStorage(raw = null) {
  const state = { raw, reads: 0, writes: 0, failRead: false, failWrite: false };
  state.storage = {
    getItem(key) {
      assert.equal(this, state.storage);
      assert.equal(key, api.PUBLIC_PROFILE_STORAGE_KEY);
      state.reads += 1;
      if (state.failRead) throw new Error('Storage access denied');
      return state.raw;
    },
    setItem(key, value) {
      assert.equal(this, state.storage);
      assert.equal(key, api.PUBLIC_PROFILE_STORAGE_KEY);
      state.writes += 1;
      if (state.failWrite) throw new Error('Storage quota exceeded');
      assert.equal(typeof value, 'string');
      state.raw = value;
    },
  };
  return state;
}

function assertDefaultProfile(profile) {
  assert.equal(profile.version, 1);
  assert.equal(profile.selectedId, 'sakura');
  assert.equal(profile.attempts, 0);
  assert.equal(profile.clears, 0);
  assert.deepEqual(profile.clearsByPerformer, { sakura: 0, kai: 0, venus: 0, genya: 0, enjo: 0 });
  assert.equal(profile.lastRun, null);
  assert.deepEqual(profile.recordedRunIds, []);
  assert.equal(profile.persisted, false);
}

const validRun = { runId: 'run-1', performerId: 'kai', chapterId: 'opening', victory: true,
  choices: ['tempo', 'recovery'], durationMs: 12345 };

test('new profiles are usable version-one records and loading never writes', () => {
  const { loadPublicProfile } = profileApi();
  const state = memoryStorage();
  assertDefaultProfile(loadPublicProfile(state.storage));
  assert.equal(state.writes, 0);
  const first = loadPublicProfile(state.storage);
  first.clearsByPerformer.kai = 100;
  first.recordedRunIds.push('fake');
  assertDefaultProfile(loadPublicProfile(state.storage));
});

test('selection persists all five members without adding an attempt or a run', () => {
  const { selectPublicPerformer, loadPublicProfile } = profileApi();
  const state = memoryStorage();
  for (const { id } of api.PUBLIC_PERFORMERS) {
    const profile = selectPublicPerformer(id, state.storage);
    assert.equal(profile.selectedId, id);
    assert.equal(profile.persisted, true);
    assert.equal(profile.attempts, 0);
    assert.equal(profile.lastRun, null);
    assert.deepEqual(loadPublicProfile(state.storage), profile);
  }
  assert.equal(selectPublicPerformer('unknown', state.storage).selectedId, 'sakura');
  assert.equal(Object.hasOwn(JSON.parse(state.raw), 'persisted'), false);
});

test('victory records a detached final summary and the actual performer clear count', () => {
  const { selectPublicPerformer, recordPublicRun, loadPublicProfile } = profileApi();
  const state = memoryStorage();
  selectPublicPerformer('venus', state.storage);
  const input = { ...validRun, choices: [...validRun.choices], durationMs: 12345.9 };
  const profile = recordPublicRun(input, state.storage);
  input.choices[0] = 'relay';
  assert.equal(profile.selectedId, 'venus', 'a result must not change the next selected member');
  assert.equal(profile.attempts, 1);
  assert.equal(profile.clears, 1);
  assert.equal(profile.clearsByPerformer.kai, 1);
  assert.equal(profile.clearsByPerformer.venus, 0);
  assert.deepEqual(profile.lastRun, validRun);
  assert.deepEqual(profile.recordedRunIds, ['run-1']);
  assert.equal(profile.persisted, true);
  profile.lastRun.choices.length = 0;
  profile.clearsByPerformer.kai = 88;
  profile.recordedRunIds.push('fake');
  const loaded = loadPublicProfile(state.storage);
  assert.deepEqual(loaded.lastRun, validRun);
  assert.equal(loaded.clearsByPerformer.kai, 1);
  assert.deepEqual(loaded.recordedRunIds, ['run-1']);
});

test('failure increments attempts only and each clear is attributed to its performer', () => {
  const { recordPublicRun } = profileApi();
  const state = memoryStorage();
  let profile = recordPublicRun({ ...validRun, victory: false }, state.storage);
  assert.equal(profile.attempts, 1);
  assert.equal(profile.clears, 0);
  assert.equal(profile.clearsByPerformer.kai, 0);
  assert.equal(profile.lastRun.victory, false);
  for (const { id } of api.PUBLIC_PERFORMERS) {
    profile = recordPublicRun({ ...validRun, runId: `clear-${id}`, performerId: id }, state.storage);
  }
  assert.equal(profile.attempts, 6);
  assert.equal(profile.clears, 5);
  assert.deepEqual(profile.clearsByPerformer, { sakura: 1, kai: 1, venus: 1, genya: 1, enjo: 1 });
});

test('recording requires a nonempty string runId and an explicit boolean result', () => {
  const { recordPublicRun, loadPublicProfile } = profileApi();
  const state = memoryStorage();
  for (const runId of [undefined, null, '', '   ', 1, {}, []]) {
    assertDefaultProfile(recordPublicRun({ ...validRun, runId }, state.storage));
  }
  for (const victory of [undefined, null, 0, 1, 'false', 'true']) {
    assertDefaultProfile(recordPublicRun({ ...validRun, victory }, state.storage));
  }
  for (const input of [undefined, null, {}, false]) {
    assertDefaultProfile(recordPublicRun(input, state.storage));
  }
  assertDefaultProfile(loadPublicProfile(state.storage));
  assert.equal(state.writes, 0);
});

test('duplicate run ids remain idempotent after another result and a storage reload', () => {
  const { recordPublicRun } = profileApi();
  const state = memoryStorage();
  recordPublicRun(validRun, state.storage);
  const secondRun = { ...validRun, runId: 'run-2', performerId: 'enjo', victory: false };
  const expected = recordPublicRun(secondRun, state.storage);
  const reloaded = memoryStorage(state.raw);
  assert.deepEqual(recordPublicRun({ ...validRun, runId: ' run-1 ', performerId: 'venus' }, reloaded.storage), expected);
  assert.deepEqual(recordPublicRun(secondRun, reloaded.storage), expected);
  assert.equal(reloaded.writes, 0);
});

test('saved payload contains only profile and final-result contracts, never a mid-run save', () => {
  const { recordPublicRun } = profileApi();
  const state = memoryStorage();
  const profile = recordPublicRun({ ...validRun, performerId: '__proto__',
    choices: ['wide_brush', 'tempo', 'echo'], durationMs: Infinity,
    currency: 100, cloud: true, position: { x: 1 }, shotCount: 20 }, state.storage);
  assert.equal(profile.lastRun.performerId, 'sakura');
  assert.deepEqual(profile.lastRun.choices, ['wide_brush']);
  assert.equal(profile.lastRun.durationMs, 0);
  const saved = JSON.parse(state.raw);
  assert.deepEqual(Object.keys(saved).sort(),
    ['version', 'selectedId', 'clears', 'attempts', 'clearsByPerformer', 'lastRun', 'recordedRunIds', 'campaign', 'preparation'].sort());
  assert.deepEqual(Object.keys(saved.lastRun).sort(),
    ['runId', 'performerId', 'chapterId', 'victory', 'choices', 'durationMs'].sort());
});

test('corrupt JSON and malformed current-version profiles fail safe without eager writes', () => {
  const { loadPublicProfile, selectPublicPerformer } = profileApi();
  const seed = memoryStorage();
  selectPublicPerformer('kai', seed.storage);
  const valid = JSON.parse(seed.raw);
  const bad = ['{broken', 'null', '[]', '7', '"text"', '{}',
    JSON.stringify({ ...valid, attempts: -1 }),
    JSON.stringify({ ...valid, attempts: '2' }),
    JSON.stringify({ ...valid, clears: 3 }),
    JSON.stringify({ ...valid, clearsByPerformer: null }),
    JSON.stringify({ ...valid, clearsByPerformer: { ...valid.clearsByPerformer, kai: -2 } }),
    JSON.stringify({ ...valid, recordedRunIds: {} }),
  ];
  for (const raw of bad) {
    const state = memoryStorage(raw);
    assertDefaultProfile(loadPublicProfile(state.storage));
    assert.equal(state.writes, 0);
    assert.equal(state.raw, raw);
    assert.equal(selectPublicPerformer('enjo', state.storage).persisted, false);
    assert.equal(state.raw, raw, 'normal selection cannot replace a corrupt save');
  }
});

test('unknown profile versions are never overwritten by selection or result writes', () => {
  const { loadPublicProfile, selectPublicPerformer, recordPublicRun } = profileApi();
  for (const version of [0, 2, '1']) {
    const raw = JSON.stringify({ version, selectedId: 'venus', futureData: [1, 2, 3] });
    const state = memoryStorage(raw);
    assertDefaultProfile(loadPublicProfile(state.storage));
    const selected = selectPublicPerformer('kai', state.storage);
    assert.equal(selected.selectedId, 'kai');
    assert.equal(selected.persisted, false);
    const result = recordPublicRun(validRun, state.storage);
    assert.equal(result.attempts, 1);
    assert.equal(result.persisted, false);
    assert.equal(state.writes, 0);
    assert.equal(state.raw, raw);
  }
});

test('known version sanitizes unknown identities, extra fields and invalid last-run summaries', () => {
  const { selectPublicPerformer, loadPublicProfile } = profileApi();
  const state = memoryStorage();
  selectPublicPerformer('kai', state.storage);
  const saved = JSON.parse(state.raw);
  saved.selectedId = '__proto__';
  saved.clearsByPerformer.unknown = 999;
  saved.currency = 99;
  saved.lastRun = { runId: 'fake', victory: 'yes' };
  state.raw = JSON.stringify(saved);
  const profile = loadPublicProfile(state.storage);
  assert.equal(profile.selectedId, 'sakura');
  assert.equal(profile.lastRun, null);
  assert.equal(Object.hasOwn(profile, 'currency'), false);
  assert.equal(Object.hasOwn(profile.clearsByPerformer, 'unknown'), false);
});

test('profiles with only lastRun still reject replaying that result', () => {
  const { recordPublicRun } = profileApi();
  const state = memoryStorage();
  recordPublicRun(validRun, state.storage);
  const saved = JSON.parse(state.raw);
  delete saved.recordedRunIds;
  const reloaded = memoryStorage(JSON.stringify(saved));
  const result = recordPublicRun(validRun, reloaded.storage);
  assert.equal(result.attempts, 1);
  assert.equal(result.clears, 1);
  assert.deepEqual(result.recordedRunIds, ['run-1']);
  assert.equal(reloaded.writes, 0);
});

test('write failure retains a detached session profile and retries without duplicate accounting', () => {
  const { selectPublicPerformer, recordPublicRun, loadPublicProfile } = profileApi();
  const state = memoryStorage();
  selectPublicPerformer('venus', state.storage);
  const oldRaw = state.raw;
  state.failWrite = true;
  const unsaved = recordPublicRun(validRun, state.storage);
  assert.equal(unsaved.attempts, 1);
  assert.equal(unsaved.persisted, false);
  assert.equal(state.raw, oldRaw);
  unsaved.lastRun.choices.push('fake');
  unsaved.recordedRunIds.push('fake');
  unsaved.clearsByPerformer.kai = 100;
  assert.deepEqual(loadPublicProfile(state.storage).lastRun, validRun);
  assert.deepEqual(loadPublicProfile(state.storage).recordedRunIds, ['run-1']);
  assert.equal(recordPublicRun(validRun, state.storage).attempts, 1);
  state.failWrite = false;
  const retried = recordPublicRun(validRun, state.storage);
  assert.equal(retried.attempts, 1);
  assert.equal(retried.clearsByPerformer.kai, 1);
  assert.equal(retried.selectedId, 'venus');
  assert.equal(retried.persisted, true);
  assert.deepEqual(loadPublicProfile(memoryStorage(state.raw).storage), retried);
});

test('read errors do not overwrite unreadable data and session fallbacks stay storage-local', () => {
  const { recordPublicRun, loadPublicProfile } = profileApi();
  const state = memoryStorage('unreadable existing data');
  state.failRead = true;
  const profile = recordPublicRun(validRun, state.storage);
  assert.equal(profile.attempts, 1);
  assert.equal(profile.persisted, false);
  assert.equal(recordPublicRun(validRun, state.storage).attempts, 1);
  assert.equal(loadPublicProfile(state.storage).clears, 1);
  assert.equal(state.writes, 0);
  assert.equal(state.raw, 'unreadable existing data');
  assertDefaultProfile(loadPublicProfile(memoryStorage().storage));
});

test('missing storage or throwing storage-method getters return usable profiles', () => {
  const { loadPublicProfile, selectPublicPerformer } = profileApi();
  for (const storage of [null, false, 0, '', {}, { get getItem() { throw new Error('denied'); } }]) {
    const profile = loadPublicProfile(storage);
    assert.equal(profile.version, 1);
    assert.equal(profile.persisted, false);
  }
  const storage = { getItem() { return null; }, get setItem() { throw new Error('denied'); } };
  const profile = selectPublicPerformer('genya', storage);
  assert.equal(profile.selectedId, 'genya');
  assert.equal(profile.persisted, false);
});

test('default storage is resolved lazily and a throwing localStorage getter is contained', async () => {
  profileApi();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let accesses = 0;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true,
    get() { accesses += 1; throw new Error('SecurityError'); } });
  try {
    const isolated = await import(`${moduleUrl.href}?throwing-storage`);
    assert.equal(accesses, 0, 'module import must not access localStorage');
    assert.equal(isolated.loadPublicProfile().persisted, false);
    const selected = isolated.selectPublicPerformer('enjo');
    assert.equal(selected.selectedId, 'enjo');
    assert.equal(selected.persisted, false);
    const profile = isolated.recordPublicRun(validRun);
    assert.equal(profile.selectedId, 'enjo');
    assert.equal(profile.attempts, 1);
    assert.equal(profile.persisted, false);
    assert.equal(isolated.recordPublicRun(validRun).attempts, 1);
    assert.ok(accesses > 0);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('omitted storage uses localStorage and an explicit storage bypasses its getter', () => {
  const { loadPublicProfile, selectPublicPerformer, recordPublicRun } = profileApi();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const state = memoryStorage();
  let accesses = 0;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true,
    get() { accesses += 1; return state.storage; } });
  try {
    selectPublicPerformer('genya');
    assert.equal(recordPublicRun(validRun).persisted, true);
    assert.equal(loadPublicProfile().selectedId, 'genya');
    const before = accesses;
    assertDefaultProfile(loadPublicProfile(memoryStorage().storage));
    assert.equal(accesses, before);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('action and growth copy matches the integrating battle consequences exactly', () => {
  assert.equal(api.getPublicPerformer('kai').actionSummary, '疾步160毫秒，沿途涂染且仍会受伤');
  const run = progression();
  const options = run.getOptions();
  run.choose('wide_brush');
  options.push(...run.getOptions());
  assert.deepEqual(Object.fromEntries(options.map(({ id, description }) => [id, description])), {
    wide_brush: '攻击涂染范围增加40',
    relay: '接力涂染160范围内另一目标，追加8涂染',
    tempo: '事件特殊行动充能1.5倍，不影响安可或计时',
    echo: '每第三次攻击命中后200毫秒追加回响',
    overdrive: '主动行动威力变为1.5倍',
    recovery: '恢复必需设施时恢复1生命，上限5',
  });
});

test('getRunChoice shares pool labels with HUD and results without exposing mutable data', () => {
  assert.equal(typeof api.getRunChoice, 'function', 'shared choice lookup is required');
  const run = progression();
  for (const option of run.getOptions()) assert.deepEqual(api.getRunChoice(option.id), option);
  run.choose('tempo');
  for (const option of run.getOptions()) assert.deepEqual(api.getRunChoice(option.id), option);
  const choice = api.getRunChoice('echo');
  choice.label = 'modified';
  assert.equal(api.getRunChoice('echo').label, '回响追加');
  for (const id of [undefined, null, '', 'unknown', '__proto__', {}]) {
    assert.equal(api.getRunChoice(id), null);
  }
});
