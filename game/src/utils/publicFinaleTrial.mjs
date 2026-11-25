import {PublicRunProgression} from './publicRunProgression.mjs';
import {getPublicBuildModel} from './publicBuildContent.mjs';
import {getRehearsalConfig,isRehearsalUnlocked,evaluateRehearsal} from './publicRehearsal.mjs';
import {getPublicChapter} from './publicCampaign.mjs';
import {createFreshPublicBattleData} from './publicBattleEntry.mjs';
import {getPublicPerformanceAccess} from './publicPerformanceAccess.mjs';

import {getPublicProductMode} from './publicProductModules.mjs';
export const FINALE_TRIAL_CHAPTERS=getPublicProductMode('finale-trial').requiredChapterIds;
export const FINALE_TRIAL_CHOICES=Object.freeze([Object.freeze(['wide_brush','tempo']),Object.freeze(['echo','overdrive'])]);
const flags=['p15SetlistCueExperiment','p15ManualFocusExperiment','p15HostileProjectileExperiment',
  'p15IntegratedActionCompositionExperiment','p15KaiPrototypeExperiment','p15PerformanceHighPointArcExperiment'];
const count=n=>Number.isSafeInteger(n)&&n>=0;
const validChoices=ids=>Array.isArray(ids)&&ids.length===2&&ids.every((id,i)=>FINALE_TRIAL_CHOICES[i].includes(id));
const validRow=(row,index,chapters=FINALE_TRIAL_CHAPTERS)=>row&&row.chapterId===chapters[index]&&typeof row.victory==='boolean'
  &&Number.isInteger(row.hp)&&row.hp>=0&&row.hp<=5&&(!row.victory||row.hp>0)
  &&Number.isFinite(row.durationMs)&&row.durationMs>=0&&count(row.hitCount)&&count(row.actions);
const validEntry=d=>d&&['sakura','kai','enjo'].includes(d.performerId)&&d.characterId===d.performerId
  &&d.team?.[0]?.characterId===d.performerId&&d.stageId===1&&d.practiceMode===false
  &&d.defenseMode===false&&!flags.some(key=>d[key]===true);

export function isFinaleTrialUnlocked(profile,data){
  if(data?.publicFinaleTrial&&Object.hasOwn(data.publicFinaleTrial,'rehearsal')){
    const state=getFinaleTrialState(data);
    return !!state?.rehearsal&&isRehearsalUnlocked(profile,state.rehearsal.chapterId);
  }
  return getPublicPerformanceAccess(profile,{modeId:'finale-trial'}).canStart;
}
export function getFinaleTrialState(data){
  const state=data?.publicFinaleTrial;
  const rehearsal=state&&Object.hasOwn(state,'rehearsal')?getRehearsalConfig(state.rehearsal):null;
  if(state&&Object.hasOwn(state,'rehearsal')&&!rehearsal)return null;
  const chapters=rehearsal?[rehearsal.chapterId]:FINALE_TRIAL_CHAPTERS;
  if(!validEntry(data)||!state||state.version!==1||!validChoices(state.choices)
    ||!Number.isInteger(state.roundIndex)||state.roundIndex<0||state.roundIndex>=chapters.length
    ||data.campaignChapterId!==chapters[state.roundIndex]
    ||!Array.isArray(state.rounds)||state.rounds.length!==state.roundIndex
    ||!state.rounds.every((row,i)=>validRow(row,i,chapters)&&row.victory)
    ||data.publicRunGoal||data.publicRoutePlan
    ||!getPublicBuildModel(data.publicPreparation,data.performerId,state.choices))return null;
  return {...state,...(rehearsal?{rehearsal}:{}),chapterIds:[...chapters],roundCount:chapters.length,choices:[...state.choices],rounds:state.rounds.map(row=>({...row})),
    startHp:state.roundIndex?state.rounds.at(-1).hp:5};
}
export function createFinaleTrialData(base,choices,profile){
  if(!validEntry(base)||!validChoices(choices)||!isFinaleTrialUnlocked(profile))return null;
  const {publicRunGoal,publicRoutePlan,publicFinaleTrial,publicArrangementPlan,...data}=createFreshPublicBattleData(base);
  const result={...data,campaignChapterId:'opening',
    publicFinaleTrial:{version:1,roundIndex:0,choices:[...choices],rounds:[]}};
  return getFinaleTrialState(result)?result:null;
}
export function createFinaleTrialProgression(data){
  const state=getFinaleTrialState(data);
  return state?new PublicRunProgression({choices:state.choices}):null;
}
export function createRehearsalData(base,choices,profile,options){
  const config=getRehearsalConfig(options);
  if(!config||!validEntry(base)||!validChoices(choices)||!isRehearsalUnlocked(profile,config.chapterId))return null;
  const {publicRunGoal,publicRoutePlan,publicFinaleTrial,publicArrangementPlan,...data}=createFreshPublicBattleData(base);
  const result={...data,campaignChapterId:config.chapterId,stageName:getPublicChapter(config.chapterId).name,
    publicFinaleTrial:{version:1,roundIndex:0,choices:[...choices],rounds:[],rehearsal:config}};
  return getFinaleTrialState(result)?result:null;
}
export function finishFinaleTrialRound(data,row){
  const state=getFinaleTrialState(data),entry={...row,chapterId:data?.campaignChapterId};
  if(!state||!validRow(entry,state.roundIndex,state.chapterIds)||entry.hp>state.startHp)return null;
  const rounds=[...state.rounds,entry];
  return {trial:true,recorded:false,persisted:false,performerId:data.performerId,
    victory:entry.victory,complete:entry.victory&&rounds.length===state.roundCount,roundIndex:state.roundIndex,roundCount:state.roundCount,
    ...(state.rehearsal?{rehearsal:{...state.rehearsal},focusOutcome:evaluateRehearsal(state.rehearsal,{...entry,finished:true})}:{}),
    choices:[...state.choices],rounds,hp:entry.hp,
    durationMs:rounds.reduce((sum,r)=>sum+r.durationMs,0),
    totalHits:rounds.reduce((sum,r)=>sum+r.hitCount,0),actions:rounds.reduce((sum,r)=>sum+r.actions,0)};
}
export function nextFinaleTrialData(data,result){
  const state=getFinaleTrialState(data);
  if(!state||result?.trial!==true||!result.victory||result.complete||result.roundIndex!==state.roundIndex)return null;
  const next={...createFreshPublicBattleData(data),campaignChapterId:FINALE_TRIAL_CHAPTERS[state.roundIndex+1],
    publicFinaleTrial:{version:1,roundIndex:state.roundIndex+1,choices:state.choices,rounds:result.rounds}};
  return getFinaleTrialState(next)?next:null;
}
export function retryFinaleTrialData(data){
  const state=getFinaleTrialState(data);if(!state)return null;
  return {...createFreshPublicBattleData(data),campaignChapterId:state.chapterIds[0],publicFinaleTrial:{version:1,roundIndex:0,choices:state.choices,rounds:[],
    ...(state.rehearsal?{rehearsal:{...state.rehearsal}}:{})}};
}
