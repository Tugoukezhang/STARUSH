import {PUBLIC_PERFORMERS,PublicRunProgression,getPublicCampaignProgress} from './publicRunProgression.mjs';
import {PUBLIC_CHAPTERS} from './publicCampaign.mjs';
import {getPublicPerformanceRecord} from './publicPerformanceRecords.mjs';
import {isUserCastEnabled} from './userCast.mjs';
import {PUBLIC_RULESET_ID,validRulesetId} from './releaseIdentity.mjs';

let selection=null;
const validMember=id=>PUBLIC_PERFORMERS.some(row=>row.id===id);
const validChapter=id=>PUBLIC_CHAPTERS.some(row=>row.id===id);
const count=value=>Number.isSafeInteger(value)&&value>=0;
const goalTime=ms=>count(ms)&&ms>0?(ms/1000).toFixed(3)+'秒':'未记录';
const context=profile=>({performerId:profile?.selectedId,chapterId:getPublicCampaignProgress(profile).selectedChapterId,
  ...(isUserCastEnabled()?{rulesetId:PUBLIC_RULESET_ID}:{})});

export function normalizePublicRunGoal(value,binding) {
  if(!value||value.version!==1||!['steady','pace'].includes(value.kind)||!validMember(value.performerId)
    ||!validChapter(value.chapterId)||value.performerId!==binding?.performerId||value.chapterId!==binding?.chapterId
    ||!count(value.target)||(value.kind==='pace'&&value.target===0)
    ||(Object.hasOwn(value,'rulesetId')&&!validRulesetId(value.rulesetId))
    ||(value.rulesetId??null)!==(binding?.rulesetId??null))return null;
  return Object.freeze({version:1,kind:value.kind,performerId:value.performerId,chapterId:value.chapterId,target:value.target,
    ...(value.rulesetId?{rulesetId:value.rulesetId}:{})});
}

export function getPublicRunGoalOptions(profile) {
  const c=context(profile),record=profile?.persisted===true?getPublicPerformanceRecord(profile,c.chapterId,c.performerId,c.rulesetId??null):null;
  return [
    {id:'standard',label:'标准演出',available:true,description:'完成本场巡演'},
    {id:'steady',label:'稳演挑战',available:!!record,description:record?
      (record.bestHits.hitCount===0?'通关并保持无伤':`通关且受击少于 ${record.bestHits.hitCount} 次`):'本成员本站尚无已保存实测纪录'},
    {id:'pace',label:'速演挑战',available:!!record,description:record?'通关用时短于 '+goalTime(record.bestTime.durationMs):'本成员本站尚无已保存实测纪录'},
  ];
}

export function selectPublicRunGoal(profile,kind) {
  if(!getPublicRunGoalOptions(profile).some(row=>row.id===kind&&row.available))return false;
  const c=context(profile),record=kind==='standard'?null:getPublicPerformanceRecord(profile,c.chapterId,c.performerId,c.rulesetId??null);
  selection=kind==='standard'?null:normalizePublicRunGoal({version:1,kind,...c,
    target:kind==='steady'?record.bestHits.hitCount:record.bestTime.durationMs},c);return true;
}

export function capturePublicRunGoal(profile) {
  if(!selection)return null;
  const c=context(profile);
  const record=profile?.persisted===true?getPublicPerformanceRecord(profile,c.chapterId,c.performerId,c.rulesetId??null):null;
  if(!record||selection.performerId!==c.performerId||selection.chapterId!==c.chapterId
    ||(selection.rulesetId??null)!==(c.rulesetId??null)){selection=null;return null;}
  return normalizePublicRunGoal(selection,c);
}

export function describePublicRunGoal(goal) {
  if(!goal)return '标准演出';
  return goal.kind==='steady'?(goal.target===0?'稳演挑战 · 通关且无伤':`稳演挑战 · 通关且受击少于 ${goal.target} 次`)
    :'速演挑战 · 通关短于 '+goalTime(goal.target);
}

export function evaluatePublicRunGoal(value,run) {
  const goal=normalizePublicRunGoal(value,run);if(!goal)return null;
  const actual=goal.kind==='steady'?run.performance?.hitCount:(Number.isFinite(run.durationMs)?Math.floor(run.durationMs):null);
  const measured=count(actual)&&(goal.kind!=='pace'||actual>0);
  const status=run.victory!==true?'missed':!measured?'unmeasured':
    (goal.kind==='steady'&&goal.target===0?actual===0:actual<goal.target)?'met':'missed';
  return {goal:{...goal},label:describePublicRunGoal(goal),status,actual:measured?actual:null,
    actualLabel:!measured?'未取得实测数据':goal.kind==='steady'?'本场受击 '+actual+' 次':'本场用时 '+goalTime(actual)};
}

export function getPublicRunGoalProgress(value,run) {
  const goal=normalizePublicRunGoal(value,run);if(!goal)return null;
  const elapsedMs=Number.isFinite(run.durationMs)&&run.durationMs>=0?Math.floor(run.durationMs):null;
  const actual=goal.kind==='steady'?run.performance?.hitCount:elapsedMs;
  const measured=count(actual);
  const missed=measured&&(goal.kind==='steady'?(goal.target===0?actual>0:actual>=goal.target):actual>=goal.target);
  const finished=typeof run.victory==='boolean';
  const outcome=finished?evaluatePublicRunGoal(goal,run):null;
  const status=outcome?.status||(!measured?'unmeasured':missed?'missed':'active');
  const remainingMs=goal.kind==='pace'&&measured?Math.max(0,goal.target-actual):null;
  const compact=!measured?'目标 · 暂无实测':status==='met'?'本场目标达成'
    :status==='missed'?'本场目标已错过'
    :goal.kind==='steady'?(goal.target===0?'稳演 · 保持无伤':'稳演 · 受击 '+actual+'，需少于 '+goal.target)
    :'速演 · 还剩 '+(Math.ceil(remainingMs/100)/10).toFixed(1)+'秒';
  const detail=(goal.kind==='steady'&&measured?'当前受击 '+actual+' 次':
    elapsedMs===null?'尚无有效计时':'当前用时 '+(elapsedMs/1000).toFixed(3)+'秒')
    +(status==='active'?' · 通关后判定':status==='missed'?' · 仍可继续通关':status==='met'?' · 已通关达成':'');
  return {goal,label:describePublicRunGoal(goal),status,actual:measured?actual:null,elapsedMs,remainingMs,compact,detail};
}

export function getPublicRunGoalHandoff(run,profile) {
  if(!isUserCastEnabled()||run?.recorded!==true||run?.persisted!==true||profile?.persisted!==true
    ||profile.selectedId!==run.performerId||!profile.recordedRunIds?.includes(run.runId)
    ||run.rulesetId!==PUBLIC_RULESET_ID||!validMember(run.performerId)||!validChapter(run.chapterId)
    ||!getPublicPerformanceRecord(profile,run.chapterId,run.performerId,PUBLIC_RULESET_ID))return null;
  return {memberId:run.performerId,chapterId:run.chapterId};
}

export function getArrangementCatalog(performerId=null) {
  const first=new PublicRunProgression({performerId}).getOptions(),next=new PublicRunProgression({performerId});
  next.choose(first[0]?.id);return {first,second:next.getOptions()};
}

export function previewPublicArrangement(firstId,secondId,performerId=null) {
  const preview=new PublicRunProgression({performerId});if(!preview.choose(firstId)||!preview.choose(secondId))return null;
  return {choices:preview.choices,effects:preview.effects()};
}
