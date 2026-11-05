import {PUBLIC_CHAPTERS} from './publicCampaign.mjs';
import {getChapterContent} from './publicChapterContent.mjs';
import {PUBLIC_RULESET_ID,validRulesetId} from './releaseIdentity.mjs';
import {getChapterSideSetReview} from './chapterSideSets.mjs';
import {normalizeChapterEvent,getChapterEventReview} from './chapterEncounterEvents.mjs';
import {getFinaleResponseSummary} from './chapterFinaleContent.mjs';

const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>record(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const chapter=id=>PUBLIC_CHAPTERS.some(c=>c.id===id);
// These are durable save identities, independent of the UI-cast activation switch.
const owner=id=>['sakura','kai','enjo'].includes(id);
export function normalizeChapterFieldReport(value,binding){
 if(!owner(binding?.performerId)||!chapter(binding?.chapterId)||!validRulesetId(binding.rulesetId)
  ||!exact(value,['version','sideSet','event','finaleResponses'])||value.version!==1)return null;
 const s=value.sideSet;
 if(!exact(s,['chapterId','total','completed','zones'])||!Array.isArray(s.zones)||s.zones.length!==2
  ||![...s.zones].every(z=>exact(z,['zone','branch','completed']))||!getChapterSideSetReview(s,binding.chapterId))return null;
 const e=value.event;
 if(e!==null&&(!exact(e,['id','status'])||!normalizeChapterEvent(e,binding.chapterId)))return null;
 const f=value.finaleResponses;
 if(!Array.isArray(f)||f.length>3||![...f].every((r,i)=>record(r)&&r.index===i
  &&Object.keys(r).every(k=>['index','pattern','outcome','travelMode'].includes(k)))
  ||(f.length&&!getFinaleResponseSummary(f)))return null;
 return {version:1,sideSet:{chapterId:s.chapterId,total:4,completed:s.completed,
  zones:s.zones.map(z=>({zone:z.zone,branch:z.branch,completed:z.completed}))},event:e?{id:e.id,status:e.status}:null,
  finaleResponses:f.map(r=>({index:r.index,pattern:r.pattern,outcome:r.outcome,...(r.travelMode?{travelMode:r.travelMode}:{})}))};
}
export function captureChapterFieldReport(run){
 if(run?.rulesetId!==PUBLIC_RULESET_ID)return null;
 return normalizeChapterFieldReport({version:1,sideSet:run?.chapterSideSet,event:run?.encounterEvent??null,
  finaleResponses:run?.finaleResponses??[]},run);
}
export function chapterReportEntry(run){
 const fieldReport=normalizeChapterFieldReport(run?.fieldReport,run);
 if(!fieldReport||typeof run.runId!=='string'||!run.runId.trim()||typeof run.victory!=='boolean'
  ||!Number.isSafeInteger(run.durationMs)||run.durationMs<0)return null;
 return {runId:run.runId,performerId:run.performerId,chapterId:run.chapterId,rulesetId:run.rulesetId,
  victory:run.victory,durationMs:run.durationMs,fieldReport};
}
export function normalizeChapterReports(value,profile){
 if(!exact(value,['version','chapters'])||value.version!==1||!record(value.chapters)
  ||Object.keys(value.chapters).some(id=>!chapter(id)))return null;
 const chapters={};
 for(const [id,row]of Object.entries(value.chapters)){
  if(!exact(row,['runId','performerId','chapterId','rulesetId','victory','durationMs','fieldReport'])||row.chapterId!==id)return null;
  const entry=chapterReportEntry(row),index=PUBLIC_CHAPTERS.findIndex(c=>c.id===id);
  if(!entry||!profile?.recordedRunIds?.includes(entry.runId)||!Number.isSafeInteger(profile.attempts)||profile.attempts<1
   ||!PUBLIC_CHAPTERS.slice(0,index).every(c=>profile.campaign?.chapterClears?.[c.id]>0)
   ||(entry.victory&&(!(profile.campaign?.chapterClears?.[id]>0)||!(profile.clearsByPerformer?.[entry.performerId]>0)))
   ||(!entry.victory&&profile.attempts<=profile.clears))return null;
  const latest=profile.lastRun?.runId===entry.runId?chapterReportEntry(profile.lastRun):null;
  if(profile.lastRun?.runId===entry.runId&&(!latest||JSON.stringify(latest)!==JSON.stringify(entry)))return null;
  chapters[id]=entry;
 }
 return {version:1,chapters};
}
export function getChapterFieldReview(run){
 const p=normalizeChapterFieldReport(run?.fieldReport,run);if(!p)return null;
 const side=getChapterSideSetReview(p.sideSet,run.chapterId),event=getChapterEventReview(p.event,run.chapterId),finale=getFinaleResponseSummary(p.finaleResponses);
 return {side:side.text,event:event?event.label+' · '+event.text:run.chapterId==='opening'?'本站无联动事件；未记录为打断。'
   :getChapterContent(run.chapterId).encounter.eventId===null?'本章按设计不设联动事件；这里没有记录属正常，不计为打断或完成。':'本场未记录到联动，不推定为打断或完成。',
  finale:finale?finale.beats.map(b=>`${b.index+1}. ${b.label} · ${b.description}`).join('；'):'尚无已结算的压轴攻击记录。',
  resolved:finale?.resolved??0,completed:p.sideSet.completed};
}
