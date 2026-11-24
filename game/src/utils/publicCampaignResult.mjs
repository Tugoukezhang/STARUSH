import { getPublicChapter, getNextPublicChapterId } from './publicCampaign.mjs';
import { isPublicChapterUnlocked, loadPublicProfile, resolvePublicChapterId } from './publicRunProgression.mjs';
import { getPreparationSnapshot } from './publicPreparation.mjs';
import {PUBLIC_RULESET_ID} from './releaseIdentity.mjs';
import {USER_CAST} from './userCast.mjs';
import {PUBLIC_CHAPTERS} from './publicCampaign.mjs';
import {normalizePublicRoutePlan} from './publicRoutePlan.mjs';
import {normalizeArrangementPlan} from './publicArrangementPlan.mjs';
import {resolvePublicRunContext} from './publicRunContext.mjs';
import {isPublicSettlementSaved} from '../systems/PublicRunSettlement.mjs';
import {createFreshPublicBattleData} from './publicBattleEntry.mjs';

export function hasSavedPublicResult(run,profile) {
  return run?.recorded===true&&isPublicSettlementSaved(run)&&profile?.persisted===true&&profile.hasPendingSave!==true
    &&run.rulesetId===PUBLIC_RULESET_ID&&USER_CAST.some(m=>m.id===run.performerId)
    &&PUBLIC_CHAPTERS.some(c=>c.id===run.chapterId)
    &&typeof run.runId==='string'&&profile.recordedRunIds?.includes(run.runId)===true;
}

export function getSavedCampaignContinuation(run,data,profile=loadPublicProfile()) {
  if(!hasSavedPublicResult(run,profile)||run.persisted!==true
    ||profile.selectedId!==run.performerId||data?.performerId!==run.performerId)return null;
  return getNextCampaignBattleData(run,data,profile);
}

export function getPublicCampaignResult(base, run) {
  const chapter=getPublicChapter(run.chapterId);
  const next=getNextPublicChapterId(chapter.id);
  const tourComplete=run.victory && run.recorded!==false && run.campaignCompleted===true && !next;
  const description=run.recorded===false ? '本场结果未能记入进度，请返回巡演核对。' : run.victory
    ? tourComplete ? '所有站点已点亮，本轮巡演完成。'
      : next ? `下一站：${getPublicChapter(next).name}` : '本场演出完成。'
    : '本场尚未通关，已完成的巡演进度保留。';
  const progress=run.objectiveProgress;
  const failureProgress=run.victory===false && Number.isInteger(progress?.total) && progress.total>0
    && Number.isInteger(progress.completed) && progress.completed>=0 && progress.completed<=progress.total
    ? `设施恢复 ${progress.completed} / ${progress.total}。${progress.finaleReached===true
      ? '压轴尚未完成。' : progress.completed===progress.total ? '尚未进入压轴。' : ''}重试将从本站重新开始。` : null;
  return {...base,
    continuation:run.victory&&run.recorded!==false&&next?{
      chapterId:next,name:getPublicChapter(next).name,
      available:isPublicSettlementSaved(run),persisted:run.persisted===true,
    }:null,
    title:tourComplete ? '巡演完成' : `${chapter.name} · ${run.victory ? '通关' : '未完成'}`,
    descriptionLines:[description,...(failureProgress ? [failureProgress] : [])],objectiveLine:null,supplementLines:[],
    buttons:[
      ...(run.victory && run.recorded!==false && next ? [{label:'下一站准备',action:'campaign-next'}] : []),
      {label:run.victory ? '再演本站' : '重试本站',action:'retry'},
      {label:'返回巡演',action:'campaign-tour'},
    ],
  };
}

export function getNextCampaignBattleData(run, data, profile=loadPublicProfile()) {
  if(run?.victory!==true || run.recorded===false || resolvePublicRunContext(data)?.policy.profileResult!==true || Number(data?.stageId)!==1
    || data.campaignChapterId!==run.chapterId) return null;
  const next=getNextPublicChapterId(run.chapterId);
  if(!next || !isPublicChapterUnlocked(next,profile)) return null;
  return getRetryCampaignBattleData({...data,campaignChapterId:next},profile);
}

export function getRetryCampaignBattleData(data, profile=loadPublicProfile()) {
  if (!data || Object.hasOwn(data,'publicFinaleTrial') || data.practiceMode===true || data.defenseMode===true || Number(data.stageId)!==1) return data;
  const chapterId=resolvePublicChapterId(data.campaignChapterId,profile);
  const {publicRoutePlan,publicArrangementPlan,...base}=createFreshPublicBattleData(data);
  const route=normalizePublicRoutePlan(publicRoutePlan,{...data,campaignChapterId:chapterId});
  const plan=normalizeArrangementPlan(publicArrangementPlan,{...data,campaignChapterId:chapterId});
  return {...base,...(route?{publicRoutePlan:route}:{}),...(plan?{publicArrangementPlan:plan}:{}),campaignChapterId:chapterId,stageName:getPublicChapter(chapterId).name,
    publicPreparation:getPreparationSnapshot(profile,data.performerId)};
}
