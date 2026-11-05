import {USER_CAST} from './userCast.mjs';
import {PUBLIC_CHAPTERS} from './publicCampaign.mjs';
import {PUBLIC_RULESET_ID} from './releaseIdentity.mjs';
import {getChapterFinalePatterns} from './chapterFinaleContent.mjs';

export function normalizePublicRoutePlan(value,data) {
  if(!value||value.version!==1||!['west','east'].includes(value.id)||value.rulesetId!==PUBLIC_RULESET_ID
    ||data?.practiceMode===true||data?.defenseMode===true||Number(data?.stageId)!==1
    ||!USER_CAST.some(m=>m.id===data.performerId)||!PUBLIC_CHAPTERS.some(c=>c.id===data.campaignChapterId)
    ||value.performerId!==data.performerId||value.chapterId!==data.campaignChapterId)return null;
  return Object.freeze({version:1,id:value.id,performerId:data.performerId,chapterId:data.campaignChapterId,rulesetId:PUBLIC_RULESET_ID});
}
export function createPublicRoutePlan(id,data) {
  return normalizePublicRoutePlan({version:1,id,performerId:data?.performerId,chapterId:data?.campaignChapterId,rulesetId:PUBLIC_RULESET_ID},data);
}
export function getPublicRoutePatterns(data) {
  const base=getChapterFinalePatterns(data?.campaignChapterId);
  return normalizePublicRoutePlan(data?.publicRoutePlan,data)?.id==='east'
    ?Object.freeze([base[1],base[0],base[2]]):base;
}
export function getPublicRouteReview(plan,data) {
  const valid=normalizePublicRoutePlan(plan,data);if(!valid)return null;
  const labels={'captured-line':'定点锁定','momentum-cutoff':'横向预判','momentum-vector':'二维预判'};
  const finaleSteps=Object.freeze(getPublicRoutePatterns({...data,publicRoutePlan:valid}).map(p=>labels[p]));
  return {id:valid.id,title:valid.id==='west'?'预选西线':'预选东线',
    text:'南北两区固定'+(valid.id==='west'?'西':'东')+'侧串场，各完成两站；另一侧不接收涂染。',
    finale:'压轴顺序 · '+finaleSteps.join(' → '),finaleSteps};
}
