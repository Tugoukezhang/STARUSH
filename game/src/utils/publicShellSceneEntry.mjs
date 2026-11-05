import {getPublicShellRoute} from './publicShellNavigation.mjs';
import {getRehearsalConfig} from './publicRehearsal.mjs';
import {FINALE_TRIAL_CHOICES} from './publicFinaleTrial.mjs';

export function copyPublicRehearsalSetup(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==3
    ||!['chapterId','focus','choices'].every(key=>Object.hasOwn(value,key)))return null;
  const config=getRehearsalConfig({chapterId:value.chapterId,focus:value.focus}),choices=value.choices;
  if(!config||!Array.isArray(choices)||choices.length!==FINALE_TRIAL_CHOICES.length
    ||!FINALE_TRIAL_CHOICES.every((pool,i)=>Object.hasOwn(choices,i)&&pool.includes(choices[i])))return null;
  return {...config,choices:[...choices]};
}

// Menu-only data crosses Scene shutdown. Battle admission and persistence stay with their owners.
export function createPublicShellSceneEntry(page,handoff={},selectionSaveFailed=false){
  if(!getPublicShellRoute(page))return null;
  const source=handoff&&typeof handoff==='object'&&!Array.isArray(handoff)?handoff:{};
  const key=page==='roster'?'IdolRosterScene':page==='tour'?'TourRouteScene':'TitleScene';
  const data={suppressDebugAutoStart:true};
  if(page==='workshop')data.openPreparation=true;
  else if(!['desk','roster','tour'].includes(page))data.openPage=page;
  if(source.arrangementPlan)data.arrangementPlan=source.arrangementPlan;
  if(source.routePlan)data.routePlan=source.routePlan;
  const rehearsalSetup=copyPublicRehearsalSetup(source.rehearsalSetup);
  if(rehearsalSetup)data.rehearsalSetup=rehearsalSetup;
  if(source.shellReturnPage!==page&&getPublicShellRoute(source.shellReturnPage))data.shellReturnPage=source.shellReturnPage;
  if(selectionSaveFailed===true)data.selectionSaveFailed=true;
  return {key,data};
}
