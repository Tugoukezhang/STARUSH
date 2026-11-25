import { PUBLIC_CHAPTERS, getNextPublicChapterId } from './publicCampaign.mjs';
import {getChapterPrerequisiteIds} from './publicChapterContent.mjs';
import { createPublicPreparation, normalizePublicPreparation, applyPreparationCommand } from './publicPreparation.mjs';
import { normalizePerformanceSample, normalizePerformanceRecords, copyPerformanceRecords, updatePerformanceRecord } from './publicPerformanceRecords.mjs';
import {validRulesetId} from './releaseIdentity.mjs';
import {PROFILE_BACKUP_MAX_BYTES} from './publicProfileBackup.mjs';
import {normalizeChapterFieldReport,normalizeChapterReports,chapterReportEntry} from './publicChapterReports.mjs';

export const PUBLIC_PERFORMERS = Object.freeze([
  { id: 'sakura', name: '绯樱', color: 'pink', colorHex: 0xff69b4,
    actionName: '领唱扇奏', actionSummary: '扇形音浪涂染前方区域', identityMark: '樱' },
  { id: 'kai', name: '苍海', color: 'blue', colorHex: 0x00ced1,
    actionName: '校拍疾步', actionSummary: '疾步160毫秒，沿途涂染且仍会受伤', identityMark: '海' },
  { id: 'venus', name: '金星', color: 'yellow', colorHex: 0xffd700,
    actionName: '和声接力', actionSummary: '和声接力涂染附近目标', identityMark: '星' },
  { id: 'genya', name: '幻夜', color: 'purple', colorHex: 0x9370db,
    actionName: '夜色回响', actionSummary: '留下回响，再次涂染目标', identityMark: '夜' },
  { id: 'enjo', name: '炎上', color: 'orange', colorHex: 0xff8c00,
    actionName: '应援爆拍', actionSummary: '近身爆拍，集中涂染周围', identityMark: '炎' },
].map((performer) => Object.freeze(performer)));

export function getPublicPerformer(id) {
  return PUBLIC_PERFORMERS.find((performer) => performer.id === id) ?? PUBLIC_PERFORMERS[0];
}

export const PUBLIC_PROFILE_STORAGE_KEY = 'starush.public-profile';
export const PUBLIC_PROFILE_CORRUPT_BACKUP_KEY = 'starush.public-profile.corrupt-backup';
export const PUBLIC_PROFILE_BEFORE_RESTORE_KEY = 'starush.public-profile.before-restore';
export const PUBLIC_PROFILE_RESTORE_PENDING_KEY = 'starush.public-profile.restore-pending';

// Failed saves stay session-local; neither imports nor loads write to storage.
const pendingProfiles = new WeakMap();
const pendingOperations = new WeakMap();
const lastKnownProfiles = new WeakMap();
const existingSaves = new WeakSet();
const unavailableStorage = {};
const unboundDefaultStorage = {};
let lastDefaultStorage = unboundDefaultStorage;
// The browser entry installs its session lock before any scene can read or write.
let writeAuthority = () => true;

export function configurePublicProfileWriteAuthority(authority) {
  if (typeof authority !== 'function') throw new TypeError('Profile write authority must be a function');
  writeAuthority = authority;
}

function canWriteProfile() {
  try { return writeAuthority() === true; } catch { return false; }
}
// Read-only view of the same single-writer lock for the separate mid-battle checkpoint key.
export function hasPublicProfileWriteAuthority() { return canWriteProfile(); }

function defaultCampaign() {
  return {
    version: 1,
    selectedChapterId: 'opening',
    clearedChapterIds: [],
    chapterClears: Object.fromEntries(PUBLIC_CHAPTERS.map(({ id }) => [id, 0])),
    completed: false,
  };
}

function chapterUnlocked(id, campaign) {
  const prerequisites=getChapterPrerequisiteIds(id);
  return prerequisites!==null&&prerequisites.every(chapterId=>campaign.chapterClears[chapterId]>0);
}

function normalizeCampaign(value, clears, legacy = false) {
  const campaign = defaultCampaign();
  if (legacy) {
    campaign.chapterClears.opening = clears;
    if (clears > 0) campaign.clearedChapterIds.push('opening');
    return campaign;
  }
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.chapterClears)) return campaign;
  let total = 0;
  // Only a sequential, counted clear history can unlock later chapters.
  for (const { id } of PUBLIC_CHAPTERS) {
    const count = value.chapterClears[id];
    if (!isCount(count) || count === 0) break;
    total += count;
    if (!Number.isSafeInteger(total) || total > clears) return defaultCampaign();
    campaign.chapterClears[id] = count;
    campaign.clearedChapterIds.push(id);
  }
  if (chapterUnlocked(value.selectedChapterId, campaign)) campaign.selectedChapterId = value.selectedChapterId;
  campaign.completed = campaign.clearedChapterIds.length === PUBLIC_CHAPTERS.length;
  return campaign;
}

export function getPublicCampaignProgress(profile = loadPublicProfile()) {
  if (!isRecord(profile) || profile.version !== 1 || !isCount(profile.clears)) return defaultCampaign();
  // Only truly pre-campaign profiles may credit the historical opening stage.
  return normalizeCampaign(profile.campaign, profile.clears, !Object.hasOwn(profile, 'campaign'));
}

export function isPublicChapterUnlocked(id, profile = loadPublicProfile()) {
  return chapterUnlocked(id, getPublicCampaignProgress(profile));
}

export function resolvePublicChapterId(id, profile = loadPublicProfile()) {
  const campaign = getPublicCampaignProgress(profile);
  return chapterUnlocked(id, campaign) ? id : campaign.selectedChapterId;
}

function defaultProfile() {
  return {
    version: 1,
    selectedId: 'sakura',
    clears: 0,
    attempts: 0,
    clearsByPerformer: Object.fromEntries(PUBLIC_PERFORMERS.map(({ id }) => [id, 0])),
    lastRun: null,
    recordedRunIds: [],
    campaign: defaultCampaign(),
    preparation: createPublicPreparation(),
  };
}

function copyProfile(profile) {
  return {
    ...profile,
    ...(profile.chapterReports?{chapterReports:normalizeChapterReports(profile.chapterReports,profile)}:{}),
    ...(profile.performance ? {performance:copyPerformanceRecords(profile.performance)} : {}),
    clearsByPerformer: { ...profile.clearsByPerformer },
    lastRun: profile.lastRun ? { ...profile.lastRun, choices: [...profile.lastRun.choices],
      ...(profile.lastRun.performance ? {performance:{...profile.lastRun.performance}} : {}),
      ...(profile.lastRun.fieldReport?{fieldReport:normalizeChapterFieldReport(profile.lastRun.fieldReport,profile.lastRun)}:{}) } : null,
    recordedRunIds: [...profile.recordedRunIds],
    preparation: {
      ...profile.preparation,
      trainingLevels: { ...profile.preparation.trainingLevels },
      equipmentByPerformer: { ...profile.preparation.equipmentByPerformer },
    },
    campaign: {
      ...profile.campaign,
      clearedChapterIds: [...profile.campaign.clearedChapterIds],
      chapterClears: { ...profile.campaign.chapterClears },
    },
  };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRunId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRun(value) {
  if (!isRecord(value) || !normalizeRunId(value.runId) || typeof value.victory !== 'boolean') return null;
  if(Object.hasOwn(value,'rulesetId')&&!validRulesetId(value.rulesetId))return null;
  // Missing chapter is the legacy opening contract; explicit unknown IDs are rejected.
  const chapterId = value.chapterId === undefined ? 'opening' : value.chapterId;
  if (!PUBLIC_CHAPTERS.some(chapter => chapter.id === chapterId)) return null;
  if(Array.isArray(value.choices)&&value.choices.some(id=>{const option=getRunChoice(id);return option?.performerId&&option.performerId!==value.performerId;}))return null;
  const durationMs=nonnegativeInteger(value.durationMs);
  const fieldReport=Object.hasOwn(value,'fieldReport')?normalizeChapterFieldReport(value.fieldReport,{...value,chapterId}):null;
  if(Object.hasOwn(value,'fieldReport')&&!fieldReport)return null;
  const performance=PUBLIC_PERFORMERS.some(member=>member.id===value.performerId)
    ? normalizePerformanceSample(value.performance,durationMs) : null;
  return {
    runId: normalizeRunId(value.runId),
    performerId: getPublicPerformer(value.performerId).id,
    chapterId,
    victory: value.victory,
    choices: normalizeChoices(value.choices,value.performerId),
    durationMs,
    ...(fieldReport?{fieldReport}:{}),
    ...(performance ? {performance:{hitCount:performance.hitCount,actions:performance.actions}} : {}),
    ...(value.rulesetId ? {rulesetId:value.rulesetId} : {}),
  };
}

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function normalizeProfile(value) {
  if (!isRecord(value) || value.version !== 1 || !isCount(value.attempts)
    || !isCount(value.clears) || value.clears > value.attempts
    || !isRecord(value.clearsByPerformer)) return null;
  const profile = defaultProfile();
  for (const { id } of PUBLIC_PERFORMERS) {
    const count = value.clearsByPerformer[id];
    if (!isCount(count)) return null;
    profile.clearsByPerformer[id] = count;
  }
  if (Object.values(profile.clearsByPerformer).reduce((sum, count) => sum + count, 0) !== value.clears) {
    return null;
  }
  const ids = value.recordedRunIds ?? [];
  if (!Array.isArray(ids) || ids.some((id) => !normalizeRunId(id))) return null;
  profile.selectedId = getPublicPerformer(value.selectedId).id;
  profile.attempts = value.attempts;
  profile.clears = value.clears;
  profile.campaign = getPublicCampaignProgress(value);
  profile.preparation = normalizePublicPreparation(value.preparation, profile);
  if (!profile.preparation) return null;
  if (Object.hasOwn(value,'performance')) {
    profile.performance=normalizePerformanceRecords(value.performance,profile);
    if (!profile.performance) return null;
  }
  profile.lastRun = normalizeRun(value.lastRun);
  if(isRecord(value.lastRun)&&Object.hasOwn(value.lastRun,'fieldReport')&&!profile.lastRun)return null;
  profile.recordedRunIds = [...new Set(ids.map(normalizeRunId))];
  if (profile.lastRun && !profile.recordedRunIds.includes(profile.lastRun.runId)) {
    profile.recordedRunIds.push(profile.lastRun.runId);
  }
  if(Object.hasOwn(value,'chapterReports')){
    profile.chapterReports=normalizeChapterReports(value.chapterReports,profile);
    if(!profile.chapterReports)return null;
  }
  return profile;
}

function hasValidCampaignCounts(value, profile, known) {
  if (!Object.hasOwn(value, 'campaign')) return known?.hasCampaign !== true;
  const campaign = value.campaign;
  return isRecord(campaign) && campaign.version === 1 && isRecord(campaign.chapterClears)
    && PUBLIC_CHAPTERS.every(({ id }) => isCount(campaign.chapterClears[id])
      && campaign.chapterClears[id] === profile.campaign.chapterClears[id]);
}

// Explicit released-schema expansion. Loading never writes the original bytes.
function expandThreeChapterProfile(value){
  const counts=value?.campaign?.chapterClears;
  if(!isRecord(counts)||!Object.values(counts).every(isCount))return value;
  const schema=Object.keys(counts).sort().join('|');
  if(schema==='encore|neon|opening')return {...value,campaign:{...value.campaign,chapterClears:{...counts,raincheck:0,homecoming:0},completed:false}};
  if(schema==='encore|neon|opening|raincheck')return {...value,campaign:{...value.campaign,chapterClears:{...counts,homecoming:0},completed:false}};
  return value;
}

function resolveStorage(storage) {
  // Accessing the browser getter can itself throw, before getItem is called.
  try {
    const resolved = storage === undefined ? globalThis.localStorage : storage;
    if (resolved === null || (typeof resolved !== 'object' && typeof resolved !== 'function')) {
      return { target: storage === undefined ? lastDefaultStorage : unavailableStorage, readable: false };
    }
    const target = resolved;
    if (storage === undefined) {
      const unbound = lastDefaultStorage === unboundDefaultStorage
        ? pendingOperations.get(unboundDefaultStorage) : null;
      if (unbound?.length) {
        // Adopt commands only once; the normal read path merges them with disk progress.
        const profile = copyProfile(pendingProfiles.get(target) ?? lastKnownProfiles.get(target)?.profile ?? defaultProfile());
        unbound.forEach(operation => applyProfileOperation(profile, operation));
        pendingProfiles.set(target, profile);
        pendingOperations.set(target, [...(pendingOperations.get(target) ?? []), ...unbound]);
        pendingProfiles.delete(unboundDefaultStorage);
        pendingOperations.delete(unboundDefaultStorage);
      }
      lastDefaultStorage = target;
    }
    return { target, readable: true };
  } catch {
    // Retain identity for session bookkeeping, never bypass the denied getter.
    return { target: lastDefaultStorage, readable: false };
  }
}

function readProfileState(storage) {
  const { target, readable } = resolveStorage(storage);
  const pending = pendingProfiles.get(target);
  const known = lastKnownProfiles.get(target);
  const cached = pending ?? known?.profile;
  const state = {
    storage: target, profile: copyProfile(cached ?? defaultProfile()), persisted: false, writable: false,
    operations: [...(pendingOperations.get(target) ?? [])],
  };
  if (!readable) return state;
  let raw;
  try {
    raw = target.getItem(PUBLIC_PROFILE_STORAGE_KEY);
  } catch {
    return state;
  }
  state.writable = canWriteProfile();
  if (raw === null || raw === undefined) {
    // A removed existing save is a reset; an unsaved first run may still be pending.
    if (existingSaves.has(target)) {
      existingSaves.delete(target);
      lastKnownProfiles.delete(target);
      pendingProfiles.delete(target);
      pendingOperations.delete(target);
      state.operations = [];
      state.profile = defaultProfile();
    }
    return state;
  }
  existingSaves.add(target);
  const protect = (kind = 'corrupt') => {
    state.writable = false;
    state.recovery = { kind, raw };
    return state;
  };
  let decoded;
  try {
    decoded = expandThreeChapterProfile(JSON.parse(raw));
  } catch {
    return protect();
  }
  if (isRecord(decoded) && Object.hasOwn(decoded, 'version') && decoded.version !== 1) {
    return protect('unsupported');
  }
  const profile = normalizeProfile(decoded);
  if (['campaign', 'preparation', 'performance','chapterReports'].some(field => isRecord(decoded?.[field])
    && Object.hasOwn(decoded[field], 'version') && decoded[field].version !== 1)
    ||(isRecord(decoded?.lastRun?.fieldReport)&&decoded.lastRun.fieldReport.version!==1)) {
    if (!cached && profile) state.profile = profile;
    return protect('unsupported');
  }
  if ((Object.hasOwn(decoded ?? {}, 'preparation') && !normalizePublicPreparation(decoded.preparation, profile))
    || (known?.hasPreparation && !Object.hasOwn(decoded ?? {}, 'preparation'))
    || (known?.hasPerformance && !Object.hasOwn(decoded ?? {}, 'performance'))
    || (known?.hasChapterReports && !Object.hasOwn(decoded ?? {}, 'chapterReports'))
    || Object.keys(known?.profile?.chapterReports?.chapters??{}).some(id=>!Object.hasOwn(decoded?.chapterReports?.chapters??{},id))
    || Object.keys(known?.profile?.performance?.rulesets??{}).some(id=>!Object.hasOwn(decoded?.performance?.rulesets??{},id))) {
    return protect();
  }
  if (!profile || !hasValidCampaignCounts(decoded, profile, known)) {
    if (!cached && profile) state.profile = profile;
    return protect();
  }
  lastKnownProfiles.set(target, { profile: copyProfile(profile), hasCampaign: Object.hasOwn(decoded, 'campaign'),
    hasPreparation: Object.hasOwn(decoded, 'preparation'),hasPerformance:Object.hasOwn(decoded,'performance'),hasChapterReports:Object.hasOwn(decoded,'chapterReports') });
  state.profile = profile;
  // Another tab may have saved progress while this page could not write.
  // Replay only this page's unsaved commands over the latest valid profile.
  if (pending) state.operations.forEach(operation => applyProfileOperation(state.profile, operation));
  else state.persisted = state.writable;
  return state;
}

function profileResult(state) {
  const result = { ...copyProfile(state.profile), persisted: state.persisted };
  // Read diagnostics must not leak into profile spreads or serialized save payloads.
  Object.defineProperty(result, 'hasPendingSave', { value: !state.persisted && state.operations.length > 0 });
  if (state.recovery) Object.defineProperty(result, 'recovery', { value: { ...state.recovery } });
  return result;
}

function applyProfileOperation(profile, operation) {
  if (operation.type === 'performer') profile.selectedId = operation.id;
  else if (operation.type === 'chapter') {
    if (chapterUnlocked(operation.id, profile.campaign)) profile.campaign.selectedChapterId = operation.id;
  } else if (operation.type === 'run') {
    const summary = operation.summary;
    if (profile.recordedRunIds.includes(summary.runId) || !chapterUnlocked(summary.chapterId, profile.campaign)
      || profile.attempts === Number.MAX_SAFE_INTEGER
      || (summary.victory && [profile.clears,profile.clearsByPerformer[summary.performerId],
        profile.campaign.chapterClears[summary.chapterId]].includes(Number.MAX_SAFE_INTEGER))) return;
    profile.attempts += 1;
    if (summary.victory) {
      profile.clears += 1;
      profile.clearsByPerformer[summary.performerId] += 1;
      profile.campaign.chapterClears[summary.chapterId] += 1;
      profile.campaign = getPublicCampaignProgress(profile);
      profile.campaign.selectedChapterId = profile.campaign.completed
        ? summary.chapterId : getNextPublicChapterId(summary.chapterId) ?? summary.chapterId;
      updatePerformanceRecord(profile,summary);
    }
    profile.lastRun = { ...summary, choices: [...summary.choices] };
    profile.recordedRunIds.push(summary.runId);
    const entry=chapterReportEntry(summary);
    if(entry)profile.chapterReports={version:1,chapters:{...profile.chapterReports?.chapters,[summary.chapterId]:entry}};
  }
}

function persistProfile(state, operation) {
  // Lost ownership is not a storage failure: never queue new stale-page commands.
  if (!canWriteProfile()) return { ...profileResult(state), persisted: false };
  if (operation) state.operations.push(operation);
  state.persisted = false;
  if (state.writable) {
    try {
      state.storage.setItem(PUBLIC_PROFILE_STORAGE_KEY, JSON.stringify(state.profile));
      state.persisted = true;
    } catch {
      // Keep usable progress in memory, without claiming it survived a reload.
    }
  }
  if (state.persisted) {
    pendingProfiles.delete(state.storage);
    pendingOperations.delete(state.storage);
    existingSaves.add(state.storage);
    lastKnownProfiles.set(state.storage, { profile: copyProfile(state.profile), hasCampaign: true, hasPreparation: true,
      hasPerformance:Object.hasOwn(state.profile,'performance'),hasChapterReports:Object.hasOwn(state.profile,'chapterReports') });
  } else {
    pendingProfiles.set(state.storage, copyProfile(state.profile));
    pendingOperations.set(state.storage, state.operations);
  }
  return profileResult(state);
}

export function loadPublicProfile(storage) {
  return profileResult(readProfileState(storage));
}

// Import is deliberately stricter than legacy loading: never silently repair a file.
function normalizeBackupProfile(value) {
  try {
    value=expandThreeChapterProfile(value);
    const canonical = object => JSON.stringify(object, (_key, item) => isRecord(item)
      ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item);
    const profile = normalizeProfile(value);
    if (!profile || canonical(profile) !== canonical(value)
      || new TextEncoder().encode(JSON.stringify(profile)).length > PROFILE_BACKUP_MAX_BYTES) return null;
    return profile;
  } catch { return null; }
}

function readRestoreCheckpoint(storage) {
  const raw=storage.getItem(PUBLIC_PROFILE_RESTORE_PENDING_KEY);
  if(!raw)return null;
  const value=JSON.parse(raw);
  if(value?.version!==1||typeof value.before!=='string'||typeof value.after!=='string')throw new Error('Invalid checkpoint');
  return {...value,raw};
}
function clearRestoreCheckpoint(storage) {
  if(typeof storage.removeItem==='function')storage.removeItem(PUBLIC_PROFILE_RESTORE_PENDING_KEY);
  else storage.setItem(PUBLIC_PROFILE_RESTORE_PENDING_KEY,'');
}
function supportedLocalBackup(raw) {
  const state=readProfileState({getItem:()=>raw});
  return state.recovery ? null : copyProfile(state.profile);
}
export function getPublicProfileBackupSource({previous=false,staged=false} = {}, storage) {
  const state = readProfileState(storage);
  if (!previous && state.operations.length) return {status:'pending-save'};
  if (!previous && state.recovery) return {status:'protected-save'};
  let raw,checkpoint;
  try {
    raw = state.storage.getItem(previous ? PUBLIC_PROFILE_BEFORE_RESTORE_KEY : PUBLIC_PROFILE_STORAGE_KEY);
    if(previous){
      checkpoint=readRestoreCheckpoint(state.storage);
      if(staged)raw=checkpoint?.before??null;
      else if(checkpoint&&state.storage.getItem(PUBLIC_PROFILE_STORAGE_KEY)===checkpoint.after)raw=checkpoint.before;
    }
  }
  catch { return {status:'read-failed'}; }
  if (raw === null) return {status:'no-save'};
  try {
    const profile = supportedLocalBackup(raw);
    return profile ? {status:'ready', raw, profile,...(staged?{checkpointRaw:checkpoint.raw}:{})} : {status:'invalid-profile'};
  } catch { return {status:'invalid-profile'}; }
}

export function previewPublicProfileRestore(value, storage) {
  const profile = normalizeBackupProfile(value);
  if (!profile) return {status:'invalid-profile'};
  const state = readProfileState(storage);
  if (state.recovery) return {status:'protected-save'};
  if (state.operations.length) return {status:'pending-save'};
  if (!canWriteProfile()) return {status:'write-denied'};
  try {
    const expectedRaw=state.storage.getItem(PUBLIC_PROFILE_STORAGE_KEY),checkpoint=readRestoreCheckpoint(state.storage);
    if(checkpoint&&checkpoint.before!==expectedRaw&&state.storage.getItem(PUBLIC_PROFILE_BEFORE_RESTORE_KEY)!==checkpoint.before)return {status:'backup-pending'};
    return {status:'ready', expectedRaw,
      candidateRaw:JSON.stringify(profile), profile:copyProfile(profile), current:copyProfile(state.profile)};
  } catch { return {status:'read-failed'}; }
}

export function confirmPublicProfileRestore(proposal, storage) {
  if (proposal?.status !== 'ready' || typeof proposal.candidateRaw !== 'string'
    || !(proposal.expectedRaw === null || typeof proposal.expectedRaw === 'string')) return {status:'invalid-profile'};
  let profile;
  try { profile = normalizeBackupProfile(JSON.parse(proposal.candidateRaw)); } catch { /* Reject malformed proposals. */ }
  if (!profile) return {status:'invalid-profile'};
  const state = readProfileState(storage);
  if (state.recovery) return {status:'protected-save'};
  if (state.operations.length) return {status:'pending-save'};
  if (!canWriteProfile()) return {status:'write-denied'};
  try {
    if (state.storage.getItem(PUBLIC_PROFILE_STORAGE_KEY) !== proposal.expectedRaw) return {status:'save-changed'};
    if (proposal.expectedRaw === proposal.candidateRaw) return {status:'unchanged'};
    const checkpoint=readRestoreCheckpoint(state.storage);
    if(checkpoint&&checkpoint.before!==proposal.expectedRaw&&state.storage.getItem(PUBLIC_PROFILE_BEFORE_RESTORE_KEY)!==checkpoint.before)return {status:'backup-pending'};
    if (proposal.expectedRaw !== null) {
      const staged=JSON.stringify({version:1,before:proposal.expectedRaw,after:proposal.candidateRaw});
      state.storage.setItem(PUBLIC_PROFILE_RESTORE_PENDING_KEY,staged);
      if (state.storage.getItem(PUBLIC_PROFILE_RESTORE_PENDING_KEY) !== staged) return {status:'storage-error'};
    }
    if (!canWriteProfile()) return {status:'write-denied'};
    if (state.storage.getItem(PUBLIC_PROFILE_STORAGE_KEY) !== proposal.expectedRaw) return {status:'save-changed'};
    state.storage.setItem(PUBLIC_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch { return {status:'storage-error'}; }
  pendingProfiles.delete(state.storage);pendingOperations.delete(state.storage);existingSaves.add(state.storage);
  lastKnownProfiles.set(state.storage, {profile:copyProfile(profile),hasCampaign:true,hasPreparation:true,hasPerformance:Object.hasOwn(profile,'performance'),hasChapterReports:Object.hasOwn(profile,'chapterReports')});
  // A failed final checkpoint write cannot undo a successful main write or erase the older backup.
  if(proposal.expectedRaw!==null)retryPublicProfileRestoreCheckpoint(storage);
  return {status:'restored'};
}

export function retryPublicProfileRestoreCheckpoint(storage,expectedCheckpointRaw) {
  const state=readProfileState(storage);
  if(!canWriteProfile())return {status:'write-denied'};
  if(state.recovery)return {status:'protected-save'};
  if(state.operations.length)return {status:'pending-save'};
  try{
    const checkpoint=readRestoreCheckpoint(state.storage);if(!checkpoint)return {status:'no-save'};
    if(expectedCheckpointRaw!==undefined&&checkpoint.raw!==expectedCheckpointRaw)return {status:'checkpoint-changed'};
    if(!supportedLocalBackup(checkpoint.before))return {status:'invalid-profile'};
    state.storage.setItem(PUBLIC_PROFILE_BEFORE_RESTORE_KEY,checkpoint.before);
    if(state.storage.getItem(PUBLIC_PROFILE_BEFORE_RESTORE_KEY)!==checkpoint.before)return {status:'storage-error'};
    clearRestoreCheckpoint(state.storage);return {status:'checkpoint-saved'};
  }catch{return {status:'storage-error'};}
}

export function retryPublicProfileSave(storage) {
  const state = readProfileState(storage);
  // Re-read before retrying: merge queued runs, but never resurrect an external reset.
  if (state.persisted || !state.writable || state.operations.length === 0) return profileResult(state);
  return persistProfile(state);
}

// Recovery is explicit and compare-and-rechecked; normal selections never replace bad raw.
export function recoverPublicProfile(expectedRaw, storage) {
  const state = readProfileState(storage);
  const fail = recoveryStatus => ({ ...profileResult(state), recoveryStatus });
  if (!canWriteProfile()) return fail('write-denied');
  let current;
  try { current = state.storage.getItem(PUBLIC_PROFILE_STORAGE_KEY); }
  catch { return fail('read-failed'); }
  if (typeof expectedRaw !== 'string' || current !== expectedRaw) return fail('save-changed');
  if (state.recovery?.kind !== 'corrupt' || state.recovery.raw !== expectedRaw) return fail('not-recoverable');
  try {
    const backup = state.storage.getItem(PUBLIC_PROFILE_CORRUPT_BACKUP_KEY);
    if (backup !== null && backup !== expectedRaw) return fail('backup-conflict');
    if (backup === null) state.storage.setItem(PUBLIC_PROFILE_CORRUPT_BACKUP_KEY, expectedRaw);
    if (state.storage.getItem(PUBLIC_PROFILE_CORRUPT_BACKUP_KEY) !== expectedRaw) return fail('backup-failed');
  } catch { return fail('backup-failed'); }
  try {
    if (state.storage.getItem(PUBLIC_PROFILE_STORAGE_KEY) !== expectedRaw) return fail('save-changed');
  } catch { return fail('read-failed'); }
  if (!canWriteProfile()) return fail('write-denied');
  state.writable = true;
  delete state.recovery;
  const result = persistProfile(state);
  return { ...result, recoveryStatus: result.persisted ? 'recovered' : 'save-failed' };
}

// Purchases are never replayed from pending memory: only a successful write grants them.
function commitPreparation(command, storage) {
  const state = readProfileState(storage);
  if (!state.persisted || !state.writable) return { ...profileResult(state), preparationStatus:'save-required' };
  const candidate = copyProfile(state.profile);
  const status = applyPreparationCommand(candidate, command);
  if (!['trained','equipped','planned','recovered'].includes(status)) return { ...profileResult(state), preparationStatus:status };
  if (!canWriteProfile()) return { ...profileResult(state), persisted:false, preparationStatus:'save-required' };
  try {
    state.storage.setItem(PUBLIC_PROFILE_STORAGE_KEY, JSON.stringify(candidate));
  } catch {
    return { ...profileResult(state), preparationStatus:'storage-error' };
  }
  state.profile = candidate;
  lastKnownProfiles.set(state.storage, {profile:copyProfile(candidate),hasCampaign:true,hasPreparation:true,
    hasPerformance:Object.hasOwn(candidate,'performance'),hasChapterReports:Object.hasOwn(candidate,'chapterReports')});
  return { ...profileResult(state), preparationStatus:status };
}

export function trainPublicPerformer(performerId, expectedRank, storage) {
  return commitPreparation({type:'train',performerId,expectedRank}, storage);
}

export function equipPublicPerformer(performerId, equipmentId, storage) {
  return commitPreparation({type:'equip',performerId,equipmentId}, storage);
}

export function applyPublicPreparationPlan(expected, target, storage) {
  return commitPreparation({type:'plan',performerId:expected?.performerId,expected,target},storage);
}

export function recoverRetiredPublicTraining(expectedRanks, storage) {
  return commitPreparation({type:'recover-retired',expectedRanks},storage);
}

// A replay proposal changes both fields once, without queueing a failed selection.
export function selectPublicReplaySession(target, expected, storage) {
  const state=readProfileState(storage),fail=sessionStatus=>({...profileResult(state),sessionStatus});
  if(!PUBLIC_PERFORMERS.some(m=>m.id===target?.performerId)||!PUBLIC_CHAPTERS.some(c=>c.id===target?.chapterId))return fail('invalid');
  if(!canWriteProfile())return fail('write-denied');
  if(!state.persisted||!state.writable)return fail('save-required');
  if(!chapterUnlocked(target.chapterId,state.profile.campaign))return fail('locked');
  if(expected?.performerId!==state.profile.selectedId||expected?.chapterId!==state.profile.campaign.selectedChapterId)return fail('stale');
  if(!canWriteProfile())return fail('write-denied');
  const candidate=copyProfile(state.profile);
  candidate.selectedId=target.performerId;candidate.campaign.selectedChapterId=target.chapterId;
  try { state.storage.setItem(PUBLIC_PROFILE_STORAGE_KEY,JSON.stringify(candidate)); }
  catch { return fail('storage-error'); }
  state.profile=candidate;
  lastKnownProfiles.set(state.storage,{profile:copyProfile(candidate),hasCampaign:true,hasPreparation:true,
    hasPerformance:Object.hasOwn(candidate,'performance'),hasChapterReports:Object.hasOwn(candidate,'chapterReports')});
  return {...profileResult(state),sessionStatus:'selected'};
}

export function selectPublicPerformer(id, storage) {
  const state = readProfileState(storage);
  state.profile.selectedId = getPublicPerformer(id).id;
  return persistProfile(state, { type: 'performer', id: state.profile.selectedId });
}

export function selectPublicChapter(id, storage) {
  const state = readProfileState(storage);
  if (!chapterUnlocked(id, state.profile.campaign)) return profileResult(state);
  state.profile.campaign.selectedChapterId = id;
  return persistProfile(state, { type: 'chapter', id });
}

// runId must be stable for one finished run, including all settlement retries.
export function recordPublicRun(run, storage) {
  const state = readProfileState(storage);
  const summary = normalizeRun(run);
  if (!summary) return profileResult(state);
  if (state.profile.recordedRunIds.includes(summary.runId)) {
    return state.persisted ? profileResult(state) : persistProfile(state);
  }
  if (!chapterUnlocked(summary.chapterId, state.profile.campaign)) return profileResult(state);
  const operation = { type: 'run', summary };
  applyProfileOperation(state.profile, operation);
  if (!state.profile.recordedRunIds.includes(summary.runId)) return profileResult(state);
  return persistProfile(state, operation);
}

const CHOICE_POOLS = [
  [
    { id: 'wide_brush', label: '宽幅涂染', description: '攻击涂染范围增加40' },
    { id: 'relay', label: '接力涂染', description: '接力涂染160范围内另一目标，追加8涂染' },
    { id: 'tempo', label: '节拍蓄能', description: '事件特殊行动充能1.5倍，不影响安可或计时' },
    { id: 'fanfire', label: '分轨齐射', description: '普通射击变为三列；涂染量中路60%、两翼各20%，射击间隔不变', performerId:'sakura' },
  ],
  [
    { id: 'echo', label: '回响追加', description: '每第三次攻击命中后200毫秒追加回响' },
    { id: 'overdrive', label: '超载演出', description: '主动行动威力变为1.5倍' },
    { id: 'recovery', label: '设施回响', description: '恢复必需设施时恢复1生命，上限5' },
  ],
];

export function getRunChoice(id, performerId=null) {
  for (const pool of CHOICE_POOLS) {
    const option = pool.find((entry) => entry.id === id);
    if (option) {
      if(id==='echo'&&performerId==='kai')return {...option,label:'风铃回响',description:'每第三次有效挥铃后沿原方向追加回风，不追踪、不穿墙'};
      if(id==='echo'&&performerId==='enjo')return {...option,label:'星页回响',description:'每第三次有效命中后从原施法点扩散震波，不穿墙、不递归'};
      return { ...option };
    }
  }
  return null;
}

function nonnegativeInteger(value) {
  return Number.isFinite(value) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value))) : 0;
}

function normalizeChoices(choices,performerId=null) {
  const result = [];
  if (!Array.isArray(choices)) return result;
  for (const pool of CHOICE_POOLS) {
    const id = choices[result.length];
    if (!pool.some((option) => option.id === id&&(!option.performerId||option.performerId===performerId))) break;
    result.push(id);
  }
  return result;
}

export class PublicRunProgression {
  #choices;
  #performerId;

  constructor(options = {}) {
    const { choices = [], shotCount = 0, checkpoints = 0, performerId=null } = options ?? {};
    this.#performerId=performerId;
    this.#choices = normalizeChoices(choices,performerId);
    this.shotCount = nonnegativeInteger(shotCount);
    this.checkpoints = Math.max(this.#choices.length, Math.min(2, nonnegativeInteger(checkpoints)));
  }

  get choices() {
    return [...this.#choices];
  }

  checkpointFor(requiredCount) {
    if (!Number.isFinite(requiredCount)) return null;
    if (this.#choices.length === 0 && requiredCount >= 3) return 1;
    if (this.#choices.length === 1 && requiredCount >= 7) return 2;
    return null;
  }

  getOptions() {
    return (CHOICE_POOLS[this.#choices.length] ?? []).filter(option=>!option.performerId||option.performerId===this.#performerId).map(option=>getRunChoice(option.id,this.#performerId));
  }

  // The battle owns when to open the checkpoint; this contract owns its choice pool.
  choose(id) {
    if (!this.getOptions().some((option) => option.id === id)) return false;
    this.#choices.push(id);
    this.checkpoints = Math.max(this.checkpoints, this.#choices.length);
    return true;
  }

  snapshot() {
    return { choices: this.choices, shotCount: this.shotCount, checkpoints: this.checkpoints };
  }

  effects() {
    return {
      paintRadiusBonus: this.#choices.includes('wide_brush') ? 40 : 0,
      relay: this.#choices.includes('relay'),
      chargeMultiplier: this.#choices.includes('tempo') ? 1.5 : 1,
      echo: this.#choices.includes('echo'),
      actionPower: this.#choices.includes('overdrive') ? 1.5 : 1,
      recoverOnAnchor: this.#choices.includes('recovery'),
    };
  }
}
