import {PUBLIC_CHAPTERS} from './publicCampaign.mjs';
import {getPublicPerformanceAccess} from './publicPerformanceAccess.mjs';

export const REHEARSAL_FOCI=Object.freeze([
  Object.freeze({id:'clear',label:'完成压轴',description:'击败本站压轴。'}),
  Object.freeze({id:'clean',label:'零受击',description:'本轮未受击，并完成压轴。'}),
  Object.freeze({id:'action',label:'主动行动',description:'实际使用主动行动，并完成压轴。'}),
]);
export function getRehearsalConfig(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==2
    ||!Object.hasOwn(value,'chapterId')||!Object.hasOwn(value,'focus')
    ||!PUBLIC_CHAPTERS.some(c=>c.id===value.chapterId)||!REHEARSAL_FOCI.some(f=>f.id===value.focus))return null;
  return {chapterId:value.chapterId,focus:value.focus};
}
export function isRehearsalUnlocked(profile,chapterId){
  return !!profile&&getPublicPerformanceAccess(profile,{modeId:'rehearsal',chapterId}).canStart;
}
export function evaluateRehearsal(value,{victory=false,hitCount=0,actions=0}={}){
  const config=getRehearsalConfig(value);
  if(!config||typeof victory!=='boolean'||![hitCount,actions].every(n=>Number.isSafeInteger(n)&&n>=0))return null;
  const focus=REHEARSAL_FOCI.find(f=>f.id===config.focus);
  const condition=focus.id==='clean'?hitCount===0:focus.id==='action'?actions>0:true;
  const state=victory?(condition?'passed':'missed'):focus.id==='clean'&&!condition?'missed':focus.id!=='clear'&&condition?'ready':'active';
  return {id:focus.id,label:focus.label,state,met:victory&&condition,
    progress:focus.id==='clean'?`受击 ${hitCount} 次`:focus.id==='action'?`行动 ${actions} 次`:victory?'压轴已完成':'压轴进行中'};
}
