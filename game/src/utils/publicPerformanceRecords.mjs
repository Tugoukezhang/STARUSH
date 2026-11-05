import {validRulesetId} from './releaseIdentity.mjs';
import {PUBLIC_CHAPTER_IDS} from './publicChapterContent.mjs';

const MEMBERS = Object.freeze(['sakura', 'kai', 'venus', 'genya', 'enjo']);
const CHAPTERS = PUBLIC_CHAPTER_IDS;
const count = n => Number.isSafeInteger(n) && n >= 0;
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const keyFor = (chapter, member) => CHAPTERS.includes(chapter) && MEMBERS.includes(member)
  ? `${chapter}:${member}` : null;

export function normalizePerformanceSample(value, durationMs) {
  if (!record(value) || !count(value.hitCount) || !count(value.actions)
    || !count(durationMs) || durationMs === 0) return null;
  return {durationMs, hitCount:value.hitCount, actions:value.actions};
}

export function copyPerformanceRecords(value) {
  const copy=entries=>Object.fromEntries(Object.entries(entries)
    .map(([key, entry]) => [key, {bestTime:{...entry.bestTime}, bestHits:{...entry.bestHits}}]));
  return {version:1, records:copy(value.records),...(Object.hasOwn(value,'rulesets')
    ? {rulesets:Object.fromEntries(Object.entries(value.rulesets).map(([id,entries])=>[id,copy(entries)]))} : {})};
}

function normalizeEntries(entries, profile) {
  if(!record(entries))return null;
  const result={};
  for (const [key, entry] of Object.entries(entries)) {
    const [chapter, member]=key.split(':');
    if (keyFor(chapter,member) !== key || !record(entry)
      || !(profile?.campaign?.chapterClears?.[chapter] > 0)
      || !(profile?.clearsByPerformer?.[member] > 0)) return null;
    const bestTime=normalizePerformanceSample(entry.bestTime,entry.bestTime?.durationMs);
    const bestHits=normalizePerformanceSample(entry.bestHits,entry.bestHits?.durationMs);
    if (!bestTime || !bestHits || bestTime.durationMs > bestHits.durationMs
      || bestHits.hitCount > bestTime.hitCount) return null;
    result[key]={bestTime,bestHits};
  }
  return result;
}

export function normalizePerformanceRecords(value, profile) {
  if(!record(value)||value.version!==1)return null;
  const records=normalizeEntries(value.records,profile);if(!records)return null;
  const result={version:1,records};
  if(Object.hasOwn(value,'rulesets')){
    if(!record(value.rulesets))return null;
    result.rulesets={};
    for(const [id,entries] of Object.entries(value.rulesets)){
      if(!validRulesetId(id))return null;
      const normalized=normalizeEntries(entries,profile);if(!normalized)return null;
      result.rulesets[id]=normalized;
    }
  }
  return result;
}

export function getPublicPerformanceRecord(profile, chapterId, performerId, rulesetId = null) {
  const key=keyFor(chapterId,performerId);
  const all=profile?.performance && normalizePerformanceRecords(profile.performance,profile);
  const entry=rulesetId===null ? all?.records[key] : validRulesetId(rulesetId) ? all?.rulesets?.[rulesetId]?.[key] : null;
  return entry ? {bestTime:{...entry.bestTime},bestHits:{...entry.bestHits}} : null;
}

export function updatePerformanceRecord(profile, run) {
  const sample=normalizePerformanceSample(run.performance,run.durationMs);
  const key=keyFor(run.chapterId,run.performerId);
  if (!key || run.victory !== true || !sample) return;
  const all=profile.performance ? copyPerformanceRecords(profile.performance) : {version:1,records:{}};
  if(Object.hasOwn(run,'rulesetId')&&!validRulesetId(run.rulesetId))return;
  let entries=all.records;
  if(run.rulesetId){
    all.rulesets||={};
    if(!Object.hasOwn(all.rulesets,run.rulesetId))all.rulesets[run.rulesetId]={};
    entries=all.rulesets[run.rulesetId];
  }
  const old=entries[key];
  const faster=!old || sample.durationMs < old.bestTime.durationMs
    || (sample.durationMs === old.bestTime.durationMs && sample.hitCount < old.bestTime.hitCount);
  const cleaner=!old || sample.hitCount < old.bestHits.hitCount
    || (sample.hitCount === old.bestHits.hitCount && sample.durationMs < old.bestHits.durationMs);
  entries[key]={bestTime:{...(faster ? sample : old.bestTime)},bestHits:{...(cleaner ? sample : old.bestHits)}};
  profile.performance=all;
}

export function getPerformanceComparison(previous, run) {
  const sample=normalizePerformanceSample(run.performance,run.durationMs);
  if (!sample) return null;
  const won=run.victory===true;
  return {...sample, firstRecord:won && !previous,
    newBestTime:won && !!previous && sample.durationMs < previous.bestTime.durationMs,
    newFewestHits:won && !!previous && sample.hitCount < previous.bestHits.hitCount,
    noHit:won && sample.hitCount===0};
}

export function formatPerformanceTime(ms) {
  return count(ms) && ms>0 ? `${(ms/1000).toFixed(2)}秒` : '未记录';
}
