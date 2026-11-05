import assert from 'node:assert/strict';
import test from 'node:test';
import * as api from '../src/utils/publicRunProgression.mjs';
import { createPublicPreparation } from '../src/utils/publicPreparation.mjs';

const chapterIds = ['opening', 'neon', 'encore', 'raincheck'];
const emptyCampaign = () => ({ version: 1, selectedChapterId: 'opening', clearedChapterIds: [],
  chapterClears: { opening: 0, neon: 0, encore: 0, raincheck: 0 }, completed: false });
// Storage fixture only: the exact bytes an old three-chapter finisher has on disk.
const oldThreeChapterCampaign = () => ({ version: 1, selectedChapterId: 'encore',
  clearedChapterIds: ['opening', 'neon', 'encore'],
  chapterClears: { opening: 1, neon: 1, encore: 1 }, completed: true });

function campaignApi() {
  for (const name of ['getPublicCampaignProgress', 'isPublicChapterUnlocked',
    'resolvePublicChapterId', 'selectPublicChapter']) {
    assert.equal(typeof api[name], 'function', `${name} is required`);
  }
  return api;
}

function memoryStorage(data = null) {
  const state = { raw: data === null || typeof data === 'string' ? data : JSON.stringify(data),
    reads: 0, writes: 0, failRead: false, failWrite: false };
  state.storage = {
    getItem(key) {
      assert.equal(key, api.PUBLIC_PROFILE_STORAGE_KEY);
      state.reads += 1;
      if (state.failRead) throw new Error('denied');
      return state.raw;
    },
    setItem(key, value) {
      assert.equal(key, api.PUBLIC_PROFILE_STORAGE_KEY);
      state.writes += 1;
      if (state.failWrite) throw new Error('quota');
      state.raw = value;
    },
  };
  return state;
}

function legacyProfile(clears = 3) {
  return { version: 1, selectedId: 'kai', attempts: clears + 2, clears,
    clearsByPerformer: { sakura: 0, kai: clears, venus: 0, genya: 0, enjo: 0 },
    recordedRunIds: ['old-result'],
    lastRun: { runId: 'old-result', performerId: 'kai', victory: false,
      choices: ['tempo', 'echo'], durationMs: 4000 } };
}

function finish(state, chapterId = 'opening', runId = chapterId, victory = true) {
  return api.recordPublicRun({ runId, chapterId, performerId: 'kai', victory,
    choices: ['tempo', 'recovery'], durationMs: 1000 }, state.storage);
}

test('new root-v1 profiles include the exact empty campaign schema', () => {
  const state = memoryStorage();
  const profile = api.loadPublicProfile(state.storage);
  assert.equal(profile.version, 1);
  assert.deepEqual(profile.campaign, emptyCampaign());
  assert.equal(state.writes, 0);
});

test('legacy v1 migration credits historical clears only to opening and preserves root history', () => {
  const original = legacyProfile();
  const state = memoryStorage(original);
  const profile = api.loadPublicProfile(state.storage);
  assert.deepEqual(profile.campaign, { ...emptyCampaign(), clearedChapterIds: ['opening'],
    chapterClears: { opening: 3, neon: 0, encore: 0, raincheck: 0 } });
  for (const key of ['version', 'selectedId', 'attempts', 'clears', 'clearsByPerformer', 'recordedRunIds']) {
    assert.deepEqual(profile[key], original[key]);
  }
  assert.deepEqual(profile.lastRun, { ...original.lastRun, chapterId: 'opening' });
  assert.equal(state.writes, 0, 'migration is read-only until an intentional save');
  assert.equal(state.raw, JSON.stringify(original));
  assert.equal(profile.persisted, true);
});

test('legacy zero-clear records remain at opening with no inferred progress', () => {
  const state = memoryStorage(legacyProfile(0));
  assert.deepEqual(api.loadPublicProfile(state.storage).campaign, emptyCampaign());
});

test('an old completed three-chapter save migrates without writing and still needs a real fourth victory', () => {
  const original = { ...legacyProfile(3), campaign: oldThreeChapterCampaign() };
  const state = memoryStorage(original);
  const loaded = api.loadPublicProfile(state.storage);
  assert.deepEqual(loaded.campaign, { version: 1, selectedChapterId: 'encore',
    clearedChapterIds: ['opening', 'neon', 'encore'],
    chapterClears: { opening: 1, neon: 1, encore: 1, raincheck: 0 }, completed: false });
  assert.equal(loaded.persisted, true);
  assert.equal(api.isPublicChapterUnlocked('raincheck', loaded), true);
  assert.equal(state.writes, 0, 'migration is read-only until an intentional save');
  assert.equal(state.raw, JSON.stringify(original));
  const finished = finish(state, 'raincheck', 'old-save-raincheck');
  assert.deepEqual(finished.campaign, { version: 1, selectedChapterId: 'raincheck',
    clearedChapterIds: chapterIds,
    chapterClears: { opening: 1, neon: 1, encore: 1, raincheck: 1 }, completed: true });
  assert.equal(finished.clears, 4);
  assert.equal(finished.attempts, 6);
  assert.equal(finished.persisted, true);
  assert.equal(state.writes, 1);
  assert.deepEqual(JSON.parse(state.raw).campaign, finished.campaign);
});

test('a future campaign version in old three-chapter shape is never migrated or overwritten', () => {
  const original = { ...legacyProfile(3), campaign: { ...oldThreeChapterCampaign(), version: 2 } };
  const state = memoryStorage(original);
  const loaded = api.loadPublicProfile(state.storage);
  assert.equal(loaded.persisted, false);
  assert.deepEqual(loaded.campaign, emptyCampaign());
  assert.deepEqual(finish(state, 'raincheck', 'future-old-raincheck'), loaded);
  assert.equal(state.writes, 0);
  assert.equal(state.raw, JSON.stringify(original));
});

test('campaign helper returns isolated sanitized data and unlocks only a cleared predecessor chain', () => {
  const { getPublicCampaignProgress, isPublicChapterUnlocked } = campaignApi();
  const profile = api.loadPublicProfile(memoryStorage(legacyProfile()).storage);
  assert.deepEqual(chapterIds.map(id => isPublicChapterUnlocked(id, profile)), [true, true, false, false]);
  for (const id of [null, undefined, '', 'unknown', '__proto__', {}, 1]) {
    assert.equal(isPublicChapterUnlocked(id, profile), false);
  }
  const campaign = getPublicCampaignProgress(profile);
  campaign.chapterClears.neon = 10;
  campaign.clearedChapterIds.push('neon');
  assert.equal(getPublicCampaignProgress(profile).chapterClears.neon, 0);
  assert.equal(isPublicChapterUnlocked('encore', profile), false);
  assert.equal(isPublicChapterUnlocked('raincheck', profile), false);
  assert.deepEqual(getPublicCampaignProgress(null), emptyCampaign());
  assert.deepEqual(getPublicCampaignProgress({ version: 2, clears: 100 }), emptyCampaign());
});

test('locked or unknown chapter selections keep the existing choice without a write', () => {
  const { selectPublicChapter } = campaignApi();
  const state = memoryStorage(legacyProfile());
  const selected = selectPublicChapter('neon', state.storage);
  assert.equal(selected.campaign.selectedChapterId, 'neon');
  const writes = state.writes;
  for (const id of ['encore', 'raincheck', 'unknown', '__proto__', null, undefined]) {
    assert.deepEqual(selectPublicChapter(id, state.storage), selected);
  }
  assert.equal(state.writes, writes);
  assert.equal(JSON.parse(state.raw).version, 1);
  assert.equal(JSON.parse(state.raw).campaign.chapterClears.opening, 3);
  assert.equal(selected.selectedId, 'kai');
});

test('chapter resolution prefers a valid unlocked request then the unlocked selection then opening', () => {
  const { resolvePublicChapterId, selectPublicChapter } = campaignApi();
  const state = memoryStorage(legacyProfile());
  const selected = selectPublicChapter('neon', state.storage);
  assert.equal(resolvePublicChapterId('opening', selected), 'opening');
  assert.equal(resolvePublicChapterId('neon', selected), 'neon');
  for (const id of ['encore', 'raincheck', 'bad', null, undefined]) assert.equal(resolvePublicChapterId(id, selected), 'neon');
  selected.campaign.selectedChapterId = 'encore';
  assert.equal(resolvePublicChapterId('bad', selected), 'opening');
  assert.equal(resolvePublicChapterId('neon', null), 'opening');
});

test('four real victories unlock each next chapter and only the fourth ends the finite campaign', () => {
  const { isPublicChapterUnlocked } = campaignApi();
  const state = memoryStorage();
  let profile = finish(state);
  assert.equal(profile.lastRun.chapterId, 'opening');
  assert.equal(profile.campaign.selectedChapterId, 'neon');
  assert.deepEqual(profile.campaign.clearedChapterIds, ['opening']);
  assert.equal(isPublicChapterUnlocked('encore', profile), false);
  profile = finish(state, 'neon');
  assert.equal(profile.campaign.selectedChapterId, 'encore');
  assert.deepEqual(profile.campaign.clearedChapterIds, ['opening', 'neon']);
  assert.equal(profile.campaign.completed, false);
  assert.equal(isPublicChapterUnlocked('raincheck', profile), false);
  profile = finish(state, 'encore');
  assert.deepEqual(profile.campaign, { version: 1, selectedChapterId: 'raincheck',
    clearedChapterIds: ['opening', 'neon', 'encore'],
    chapterClears: { opening: 1, neon: 1, encore: 1, raincheck: 0 }, completed: false });
  assert.equal(isPublicChapterUnlocked('raincheck', profile), true);
  assert.equal(profile.clears, 3);
  assert.deepEqual(api.loadPublicProfile(memoryStorage(state.raw).storage), profile);
  profile = finish(state, 'raincheck');
  assert.deepEqual(profile.campaign, { version: 1, selectedChapterId: 'raincheck',
    clearedChapterIds: chapterIds, chapterClears: { opening: 1, neon: 1, encore: 1, raincheck: 1 }, completed: true });
  assert.equal(profile.clears, 4);
  assert.equal(profile.attempts, 4);
  assert.equal(profile.clearsByPerformer.kai, 4);
  assert.equal(isPublicChapterUnlocked('fourth', profile), false);
  assert.equal(isPublicChapterUnlocked('fifth', profile), false);
  assert.deepEqual(api.loadPublicProfile(memoryStorage(state.raw).storage), profile);
  assert.deepEqual(finish(state, 'raincheck'), profile, 'the same fourth run cannot count twice');
});

test('fourth-chapter failure or a reused run id cannot complete the campaign', () => {
  const state = memoryStorage();
  let profile;
  for (const id of ['opening', 'neon', 'encore']) profile = finish(state, id);
  const third = profile.campaign;
  assert.deepEqual(finish(state, 'raincheck', 'encore'), profile, 'an already-recorded run id is not a fourth victory');
  const failed = finish(state, 'raincheck', 'raincheck-fail', false);
  assert.deepEqual(failed.campaign, third);
  assert.equal(failed.lastRun.chapterId, 'raincheck');
  assert.equal(failed.attempts, 4);
  assert.equal(failed.clears, 3);
});

test('four clears are not four chapters: replays never skip or complete the fourth chapter', () => {
  const openingOnly = memoryStorage();
  let profile;
  for (const runId of ['o1', 'o2', 'o3', 'o4']) profile = finish(openingOnly, 'opening', runId);
  assert.equal(profile.clears, 4);
  assert.deepEqual(profile.campaign.clearedChapterIds, ['opening']);
  assert.deepEqual(profile.campaign.chapterClears, { opening: 4, neon: 0, encore: 0, raincheck: 0 });
  assert.equal(profile.campaign.completed, false);
  assert.equal(api.isPublicChapterUnlocked('raincheck', profile), false);
  const threeChapters = memoryStorage();
  for (const id of ['opening', 'neon', 'encore']) finish(threeChapters, id);
  profile = finish(threeChapters, 'opening', 'replay-before-fourth');
  assert.equal(profile.clears, 4);
  assert.deepEqual(profile.campaign.clearedChapterIds, ['opening', 'neon', 'encore']);
  assert.deepEqual(profile.campaign.chapterClears, { opening: 2, neon: 1, encore: 1, raincheck: 0 });
  assert.equal(profile.campaign.completed, false);
  assert.equal(api.isPublicChapterUnlocked('raincheck', profile), true);
});

test('failure records its actual chapter but changes no campaign progress or chapter selection', () => {
  campaignApi();
  const state = memoryStorage();
  const firstFailure = finish(state, 'opening', 'fail-opening', false);
  assert.deepEqual(firstFailure.campaign, emptyCampaign());
  const win = finish(state, 'opening', 'win-opening');
  const failure = finish(state, 'neon', 'fail-neon', false);
  assert.deepEqual(failure.campaign, win.campaign);
  assert.equal(failure.lastRun.chapterId, 'neon');
  assert.equal(failure.attempts, 3);
  assert.equal(failure.clears, 1);
});

test('replaying a cleared chapter increments only its own count and never creates a fifth chapter', () => {
  campaignApi();
  const state = memoryStorage();
  for (const id of chapterIds) finish(state, id);
  const replay = finish(state, 'opening', 'replay-opening');
  assert.deepEqual(replay.campaign.chapterClears, { opening: 2, neon: 1, encore: 1, raincheck: 1 });
  assert.deepEqual(replay.campaign.clearedChapterIds, chapterIds);
  assert.equal(replay.campaign.completed, true);
  assert.equal(replay.campaign.selectedChapterId, 'opening');
  assert.equal(replay.clears, 5);
  const finalReplay = finish(state, 'raincheck', 'replay-raincheck');
  assert.deepEqual(finalReplay.campaign.chapterClears, { opening: 2, neon: 1, encore: 1, raincheck: 2 });
  assert.deepEqual(finalReplay.campaign.clearedChapterIds, chapterIds);
  assert.equal(finalReplay.campaign.completed, true);
  assert.equal(finalReplay.campaign.selectedChapterId, 'raincheck');
  assert.equal(finalReplay.clears, 6);
  assert.equal(api.isPublicChapterUnlocked('fifth', finalReplay), false);
  assert.deepEqual(finish(state, 'fifth', 'fifth-run'), finalReplay);
});

test('missing chapter defaults to opening but explicit unknown or locked settlements are rejected', () => {
  campaignApi();
  const state = memoryStorage();
  const before = api.loadPublicProfile(state.storage);
  for (const chapterId of ['neon', 'encore', 'raincheck', 'unknown', '__proto__', '', null, 5]) {
    assert.deepEqual(finish(state, chapterId, `invalid-${chapterId}`), before);
  }
  assert.equal(state.writes, 0);
  const profile = api.recordPublicRun({ runId: 'legacy-input', performerId: 'kai', victory: true }, state.storage);
  assert.equal(profile.lastRun.chapterId, 'opening');
  assert.equal(profile.campaign.chapterClears.opening, 1);
  assert.equal(profile.attempts, 1);
});

test('duplicate run ids cannot count twice across chapters, selection changes or reloads', () => {
  const { selectPublicChapter } = campaignApi();
  const state = memoryStorage();
  finish(state, 'opening', 'shared');
  finish(state, 'neon', 'neon-win');
  const selected = selectPublicChapter('opening', state.storage);
  const reloaded = memoryStorage(state.raw);
  assert.deepEqual(finish(reloaded, 'encore', 'shared'), selected);
  assert.equal(reloaded.writes, 0);
  const legacy = memoryStorage(legacyProfile());
  const migrated = api.loadPublicProfile(legacy.storage);
  assert.deepEqual(finish(legacy, 'opening', 'old-result'), migrated);
  assert.equal(legacy.writes, 0);
});

test('existing corrupt campaign data never turns root clears into invented chapter progress', () => {
  const { getPublicCampaignProgress } = campaignApi();
  for (const campaign of [null, [], {}, { version: 1, chapterClears: null },
    // Old three-key storage shapes stay here on purpose: migration must not launder them.
    { ...emptyCampaign(), chapterClears: { opening: 0, neon: 5, encore: 9 },
      clearedChapterIds: chapterIds, selectedChapterId: 'encore', completed: true },
    { ...emptyCampaign(), chapterClears: { opening: 99, neon: 0, encore: 0 } },
    { ...emptyCampaign(), chapterClears: { opening: -1, neon: '1', encore: 0 } },
    { ...emptyCampaign(), chapterClears: { opening: 0, neon: 5, encore: 9, raincheck: 2 },
      clearedChapterIds: chapterIds, selectedChapterId: 'raincheck', completed: true },
    { ...emptyCampaign(), chapterClears: { opening: 0, neon: 0, encore: 0, raincheck: 1 },
      clearedChapterIds: ['raincheck'], selectedChapterId: 'raincheck', completed: true },
  ]) {
    const original = { ...legacyProfile(), campaign };
    const state = memoryStorage(original);
    const profile = api.loadPublicProfile(state.storage);
    assert.deepEqual(getPublicCampaignProgress(profile), emptyCampaign());
    assert.equal(profile.clears, 3);
    assert.equal(profile.attempts, 5);
    assert.deepEqual(profile.clearsByPerformer, original.clearsByPerformer);
    assert.equal(state.writes, 0);
  }
});

test('campaign sanitization derives ordered clears and completion from validated counts only', () => {
  const { getPublicCampaignProgress, isPublicChapterUnlocked } = campaignApi();
  const profile = { ...legacyProfile(), campaign: { ...emptyCampaign(), selectedChapterId: 'encore',
    chapterClears: { opening: 1, neon: 0, encore: 1, raincheck: 0, unknown: 99 },
    clearedChapterIds: ['encore', 'opening', 'opening', 'unknown'], completed: true, cloud: true } };
  assert.deepEqual(getPublicCampaignProgress(profile), { ...emptyCampaign(),
    clearedChapterIds: ['opening'], chapterClears: { opening: 1, neon: 0, encore: 0, raincheck: 0 } });
  assert.equal(isPublicChapterUnlocked('encore', profile), false);
  assert.equal(profile.campaign.chapterClears.encore, 1, 'sanitization must not mutate caller data');
});

test('claimed completion in a direct helper input needs four ordered counts backed by root clears', () => {
  const { getPublicCampaignProgress, isPublicChapterUnlocked } = campaignApi();
  const claim = chapterClears => ({ ...legacyProfile(), campaign: { ...emptyCampaign(),
    selectedChapterId: 'raincheck', clearedChapterIds: chapterIds, chapterClears, completed: true } });
  const three = claim({ opening: 1, neon: 1, encore: 1, raincheck: 0 });
  assert.deepEqual(getPublicCampaignProgress(three), { version: 1, selectedChapterId: 'raincheck',
    clearedChapterIds: ['opening', 'neon', 'encore'],
    chapterClears: { opening: 1, neon: 1, encore: 1, raincheck: 0 }, completed: false });
  const skipped = claim({ opening: 1, neon: 1, encore: 0, raincheck: 1 });
  assert.deepEqual(getPublicCampaignProgress(skipped), { ...emptyCampaign(),
    clearedChapterIds: ['opening', 'neon'],
    chapterClears: { opening: 1, neon: 1, encore: 0, raincheck: 0 } });
  assert.equal(isPublicChapterUnlocked('raincheck', skipped), false);
  const unbacked = claim({ opening: 1, neon: 1, encore: 1, raincheck: 1 });
  assert.deepEqual(getPublicCampaignProgress(unbacked), emptyCampaign(), 'four counts cannot exceed three root clears');
});

test('future campaign versions preserve raw storage and root stats while refusing writes', () => {
  const { selectPublicChapter, getPublicCampaignProgress } = campaignApi();
  for (const version of [0, 2, '1']) {
    const original = { ...legacyProfile(), campaign: { version, future: ['do-not-drop'] } };
    const state = memoryStorage(original);
    const loaded = api.loadPublicProfile(state.storage);
    assert.equal(loaded.clears, 3);
    assert.equal(loaded.persisted, false);
    assert.deepEqual(getPublicCampaignProgress(loaded), emptyCampaign());
    assert.equal(selectPublicChapter('opening', state.storage).persisted, false);
    assert.equal(api.selectPublicPerformer('enjo', state.storage).persisted, false);
    const result = finish(state, 'opening', 'future-session');
    assert.equal(result.persisted, false);
    assert.equal(result.clears, 4);
    assert.equal(result.campaign.chapterClears.opening, 1);
    assert.equal(state.writes, 0);
    assert.equal(state.raw, JSON.stringify(original));
  }
});

test('corrupt JSON and future root versions stay fail-safe for chapter helpers', () => {
  const { getPublicCampaignProgress, selectPublicChapter } = campaignApi();
  for (const raw of ['broken-json', JSON.stringify({ version: 2, clears: 99, campaign: emptyCampaign() })]) {
    const state = memoryStorage(raw);
    const profile = api.loadPublicProfile(state.storage);
    assert.deepEqual(getPublicCampaignProgress(profile), emptyCampaign());
    assert.deepEqual(selectPublicChapter('neon', state.storage), profile);
    assert.equal(state.raw, raw);
    assert.equal(state.writes, 0);
  }
});

test('storage write failure retains usable session unlocks and retries without counting twice', () => {
  const { selectPublicChapter } = campaignApi();
  const state = memoryStorage();
  state.failWrite = true;
  const unsaved = finish(state);
  assert.equal(unsaved.persisted, false);
  assert.equal(unsaved.campaign.selectedChapterId, 'neon');
  assert.equal(selectPublicChapter('neon', state.storage).campaign.selectedChapterId, 'neon');
  unsaved.campaign.chapterClears.encore = 100;
  unsaved.campaign.clearedChapterIds.push('encore');
  assert.equal(api.loadPublicProfile(state.storage).campaign.chapterClears.encore, 0);
  state.failWrite = false;
  const retried = finish(state);
  assert.equal(retried.persisted, true);
  assert.equal(retried.attempts, 1);
  assert.equal(retried.campaign.chapterClears.opening, 1);
  assert.equal(JSON.parse(state.raw).campaign.selectedChapterId, 'neon');
});

test('a failed save of the fourth victory stays unpersisted and its retry counts once', () => {
  const state = memoryStorage();
  for (const id of ['opening', 'neon', 'encore']) finish(state, id);
  const raw = state.raw;
  state.failWrite = true;
  const unsaved = finish(state, 'raincheck');
  assert.equal(unsaved.persisted, false);
  assert.equal(unsaved.campaign.completed, true);
  assert.equal(state.raw, raw);
  assert.equal(JSON.parse(state.raw).campaign.completed, false, 'disk has not recorded the fourth victory');
  state.failWrite = false;
  const retried = finish(state, 'raincheck');
  assert.equal(retried.persisted, true);
  assert.equal(retried.clears, 4);
  assert.equal(retried.attempts, 4);
  assert.equal(retried.campaign.chapterClears.raincheck, 1);
  assert.equal(JSON.parse(state.raw).campaign.completed, true);
  const writes = state.writes;
  assert.deepEqual(finish(state, 'raincheck'), retried);
  assert.equal(state.writes, writes);
});

test('read-denied storage returns session progress without overwriting unreadable data', () => {
  campaignApi();
  const state = memoryStorage('preserve-unreadable');
  state.failRead = true;
  const profile = finish(state);
  assert.equal(profile.persisted, false);
  assert.equal(profile.campaign.chapterClears.opening, 1);
  assert.equal(finish(state).attempts, 1);
  assert.equal(state.raw, 'preserve-unreadable');
  assert.equal(state.writes, 0);
});

for (const source of ['read', 'write']) {
  test(`last-known-good ${source} keeps a neon settlement session-local during read failure and retries once`, () => {
    const state = source === 'read' ? memoryStorage(legacyProfile(1)) : memoryStorage();
    const known = source === 'read' ? api.loadPublicProfile(state.storage) : finish(state);
    const { attempts, clears } = known;
    const raw = state.raw, writes = state.writes;
    known.campaign.chapterClears.encore = 99;
    known.campaign.clearedChapterIds.push('encore');
    known.recordedRunIds.push('neon-offline');
    state.failRead = true;
    const unsaved = finish(state, 'neon', 'neon-offline');
    assert.equal(unsaved.attempts, attempts + 1);
    assert.equal(unsaved.clears, clears + 1);
    assert.equal(unsaved.clearsByPerformer.kai, clears + 1);
    assert.deepEqual(unsaved.campaign.chapterClears, { opening: 1, neon: 1, encore: 0, raincheck: 0 });
    assert.equal(unsaved.campaign.selectedChapterId, 'encore');
    assert.equal(unsaved.lastRun.chapterId, 'neon');
    assert.equal(unsaved.persisted, false);
    assert.equal(state.raw, raw);
    assert.equal(state.writes, writes);
    assert.deepEqual(finish(state, 'neon', 'neon-offline'), unsaved);
    state.failRead = false;
    assert.equal(api.loadPublicProfile(state.storage).persisted, false, 'Reading the old disk record is not a save');
    const saved = finish(state, 'neon', 'neon-offline');
    assert.deepEqual(saved, { ...unsaved, persisted: true });
    assert.equal(state.writes, writes + 1);
    assert.deepEqual(finish(state, 'neon', 'neon-offline'), saved);
    assert.equal(state.writes, writes + 1);
    assert.deepEqual(api.loadPublicProfile(memoryStorage(state.raw).storage), saved);
  });
}

for (const fault of ['null-campaign', 'missing-counts', 'invalid-counts', 'broken-json']) {
  test(`last-known-good selection survives ${fault} without pretending the repaired run is saved`, () => {
    const state = memoryStorage(legacyProfile(1));
    const known = api.selectPublicChapter('neon', state.storage);
    const raw = state.raw, writes = state.writes;
    const damaged = JSON.parse(raw);
    damaged.campaign = fault === 'null-campaign' ? null
      : fault === 'missing-counts' ? { version: 1 }
        : { ...emptyCampaign(), chapterClears: { opening: -1, neon: 5, encore: 0 } };
    state.raw = fault === 'broken-json' ? '{broken' : JSON.stringify(damaged);
    const damagedRaw = state.raw;
    const fallback = api.loadPublicProfile(state.storage);
    assert.equal(fallback.persisted, false);
    assert.deepEqual(fallback.campaign, known.campaign);
    const unsaved = finish(state, 'neon', 'neon-damaged');
    assert.equal(unsaved.attempts, known.attempts + 1);
    assert.equal(unsaved.clears, known.clears + 1);
    assert.equal(unsaved.campaign.chapterClears.neon, 1);
    assert.equal(unsaved.persisted, false);
    assert.equal(state.raw, damagedRaw);
    assert.equal(state.writes, writes);
    state.raw = raw;
    const saved = finish(state, 'neon', 'neon-damaged');
    assert.deepEqual(saved, { ...unsaved, persisted: true });
    assert.equal(state.writes, writes + 1);
    assert.deepEqual(finish(state, 'neon', 'neon-damaged'), saved);
    assert.equal(state.writes, writes + 1);
  });
}

test('null storage explicitly clears prior good and pending progress without reviving either cache', () => {
  const state = memoryStorage(legacyProfile(1));
  api.selectPublicChapter('neon', state.storage);
  state.failWrite = true;
  assert.equal(finish(state, 'neon', 'before-reset').persisted, false);
  state.raw = null;
  state.failWrite = false;
  const reset = api.loadPublicProfile(state.storage);
  assert.equal(reset.attempts, 0);
  assert.equal(reset.clears, 0);
  assert.deepEqual(reset.campaign, emptyCampaign());
  assert.deepEqual(reset.recordedRunIds, []);
  state.failRead = true;
  assert.deepEqual(finish(state, 'neon', 'before-reset'), reset);
  state.failRead = false;
  assert.equal(finish(state, 'opening', 'new-start').clears, 1);
});

test('null storage also resets pending progress created beside an unreadable future-version file', () => {
  const state = memoryStorage({ version: 2, future: true });
  assert.equal(finish(state, 'opening', 'future-session').attempts, 1);
  assert.equal(state.writes, 0);
  state.raw = null;
  const reset = api.loadPublicProfile(state.storage);
  assert.equal(reset.attempts, 0);
  assert.deepEqual(reset.campaign, emptyCampaign());
  state.failRead = true;
  assert.deepEqual(api.loadPublicProfile(state.storage), reset);
});

test('removing campaign within a known current save cannot remigrate neon clears into opening', () => {
  const state = memoryStorage();
  finish(state, 'opening');
  const known = finish(state, 'neon');
  const damaged = JSON.parse(state.raw);
  delete damaged.campaign;
  state.raw = JSON.stringify(damaged);
  const fallback = api.loadPublicProfile(state.storage);
  assert.equal(fallback.persisted, false);
  assert.deepEqual(fallback.campaign, known.campaign);
  assert.deepEqual(finish(state, 'encore').campaign.chapterClears, { opening: 1, neon: 1, encore: 1, raincheck: 0 });
});

test('a valid replacement profile supersedes the last-known-good unlock history', () => {
  const state = memoryStorage(legacyProfile(1));
  api.selectPublicChapter('neon', state.storage);
  state.raw = JSON.stringify({ ...legacyProfile(0), campaign: emptyCampaign(), preparation: createPublicPreparation() });
  const replacement = api.loadPublicProfile(state.storage);
  assert.deepEqual(replacement.campaign, emptyCampaign());
  state.failRead = true;
  assert.deepEqual(finish(state, 'neon', 'no-old-unlock'), { ...replacement, persisted: false });
});

test('future root and campaign versions remain read-only even with a trusted fallback and pending run', () => {
  for (const scope of ['root', 'campaign']) {
    const state = memoryStorage(legacyProfile(1));
    api.selectPublicChapter('neon', state.storage);
    const raw = state.raw, writes = state.writes;
    const future = JSON.parse(raw);
    (scope === 'root' ? future : future.campaign).version = 2;
    state.raw = JSON.stringify(future);
    const futureRaw = state.raw;
    const unsaved = finish(state, 'neon', 'future-neon');
    assert.equal(unsaved.campaign.chapterClears.neon, 1);
    assert.equal(unsaved.persisted, false);
    assert.deepEqual(finish(state, 'neon', 'future-neon'), unsaved);
    assert.equal(state.raw, futureRaw);
    assert.equal(state.writes, writes);
    state.raw = raw;
    const saved = finish(state, 'neon', 'future-neon');
    assert.deepEqual(saved, { ...unsaved, persisted: true });
    assert.equal(state.writes, writes + 1);
  }
});

test('untrusted or different storage cannot borrow cached progress to accept locked or unknown runs', () => {
  const trusted = memoryStorage(legacyProfile(1));
  api.selectPublicChapter('neon', trusted.storage);
  for (const state of [memoryStorage(), memoryStorage({ ...legacyProfile(1), campaign: null })]) {
    api.loadPublicProfile(state.storage);
    state.failRead = true;
    const fallback = api.loadPublicProfile(state.storage);
    for (const id of ['neon', 'encore', 'raincheck', 'unknown']) {
      const rejected = finish(state, id, `no-trust-${id}`);
      assert.equal(rejected.persisted, false);
      assert.equal(rejected.campaign.chapterClears.neon, 0);
      assert.ok(!rejected.recordedRunIds.includes(`no-trust-${id}`));
      assert.deepEqual(rejected, fallback);
    }
    assert.equal(state.writes, 0);
  }
  trusted.failRead = true;
  for (const id of ['encore', 'raincheck', 'unknown']) {
    assert.equal(finish(trusted, id, `still-locked-${id}`).campaign.chapterClears.neon, 0);
  }
});

test('a later throwing localStorage getter uses only the prior default storage session and retries on recovery', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const state = memoryStorage(legacyProfile(1));
  let denied = false;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true,
    get() { if (denied) throw new Error('SecurityError'); return state.storage; } });
  try {
    const known = api.selectPublicChapter('neon');
    const reads = state.reads, writes = state.writes, raw = state.raw;
    denied = true;
    const run = { runId: 'getter-neon', chapterId: 'neon', performerId: 'kai', victory: true };
    const unsaved = api.recordPublicRun(run);
    assert.equal(unsaved.attempts, known.attempts + 1);
    assert.equal(unsaved.campaign.chapterClears.neon, 1);
    assert.equal(unsaved.persisted, false);
    assert.equal(state.reads, reads, 'Do not bypass the throwing getter using a stale storage handle');
    assert.equal(state.writes, writes);
    assert.equal(state.raw, raw);
    assert.deepEqual(api.recordPublicRun(run), unsaved);
    denied = false;
    const saved = api.recordPublicRun(run);
    assert.deepEqual(saved, { ...unsaved, persisted: true });
    assert.equal(state.writes, writes + 1);
    assert.deepEqual(api.recordPublicRun(run), saved);
    assert.equal(state.writes, writes + 1);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('default profile arguments safely handle a throwing localStorage getter', async () => {
  campaignApi();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true,
    get() { throw new Error('SecurityError'); } });
  try {
    const isolated = await import('../src/utils/publicRunProgression.mjs?campaign-denied');
    assert.deepEqual(isolated.getPublicCampaignProgress(), emptyCampaign());
    assert.equal(isolated.isPublicChapterUnlocked('opening'), true);
    assert.equal(isolated.isPublicChapterUnlocked('neon'), false);
    assert.equal(isolated.isPublicChapterUnlocked('raincheck'), false);
    assert.equal(isolated.resolvePublicChapterId('encore'), 'opening');
    assert.equal(isolated.resolvePublicChapterId('raincheck'), 'opening');
    assert.equal(isolated.selectPublicChapter('opening').persisted, false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('saved campaign is additive metadata and never includes cloud or mid-run state', () => {
  campaignApi();
  const state = memoryStorage();
  finish(state);
  const saved = JSON.parse(state.raw);
  assert.equal(saved.version, 1);
  assert.deepEqual(Object.keys(saved.campaign).sort(),
    ['version', 'selectedChapterId', 'clearedChapterIds', 'chapterClears', 'completed'].sort());
  assert.deepEqual(Object.keys(saved.lastRun).sort(),
    ['runId', 'performerId', 'chapterId', 'victory', 'choices', 'durationMs'].sort());
  assert.equal(Object.hasOwn(saved, 'persisted'), false);
});
