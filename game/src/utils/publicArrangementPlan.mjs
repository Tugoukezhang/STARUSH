import {PublicRunProgression,getRunChoice} from './publicRunProgression.mjs';
import {USER_CAST} from './userCast.mjs';
import {PUBLIC_CHAPTERS} from './publicCampaign.mjs';
import {PUBLIC_RULESET_ID} from './releaseIdentity.mjs';

const fields=['version','performerId','chapterId','rulesetId','choices'];
const experiments=['p15SetlistCueExperiment','p15ManualFocusExperiment','p15HostileProjectileExperiment','p15IntegratedActionCompositionExperiment','p15KaiPrototypeExperiment','p15PerformanceHighPointArcExperiment'];
function validChoices(ids,complete=false,performerId=null){
  if(!Array.isArray(ids)||ids.length>2||(complete&&ids.length!==2))return false;
  const growth=new PublicRunProgression({performerId});return [...ids].every(id=>growth.choose(id));
}
export function normalizeArrangementPlan(value,data){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==fields.length
    ||!fields.every(key=>Object.hasOwn(value,key))||value.version!==1||value.rulesetId!==PUBLIC_RULESET_ID
    ||data?.stageId!==1||data.practiceMode===true||data.defenseMode===true||data.publicFinaleTrial
    ||experiments.some(key=>data[key]===true)
    ||!USER_CAST.some(m=>m.id===data.performerId)||!PUBLIC_CHAPTERS.some(c=>c.id===data.campaignChapterId)
    ||value.performerId!==data.performerId||value.chapterId!==data.campaignChapterId||!validChoices(value.choices,true,data.performerId))return null;
  return Object.freeze({version:1,performerId:data.performerId,chapterId:data.campaignChapterId,rulesetId:PUBLIC_RULESET_ID,choices:Object.freeze([...value.choices])});
}
export function createArrangementPlan(choices,data){
  return normalizeArrangementPlan({version:1,performerId:data?.performerId,chapterId:data?.campaignChapterId,rulesetId:PUBLIC_RULESET_ID,choices},data);
}
export function getArrangementPlanReview(value,data,actual){
  const plan=normalizeArrangementPlan(value,data);if(!plan||!validChoices(actual,false,data.performerId))return null;
  const rows=plan.choices.map((id,index)=>({number:index+1,plannedId:id,planned:getRunChoice(id,plan.performerId).label,
    actualId:actual[index]??null,actual:actual[index]?getRunChoice(actual[index],plan.performerId).label:'尚未选择',
    state:actual[index]===undefined?'pending':actual[index]===id?'matched':'changed'}));
  return {plan,rows,selected:actual.length,matched:rows.filter(row=>row.state==='matched').length};
}

