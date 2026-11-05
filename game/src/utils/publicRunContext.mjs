import {getChapterContent} from './publicChapterContent.mjs';
import {getPublicPerformer} from './publicRunProgression.mjs';
import {getFinaleTrialState} from './publicFinaleTrial.mjs';
import {getPublicProductMode} from './publicProductModules.mjs';

const diagnosticFlags=['p15SetlistCueExperiment','p15ManualFocusExperiment','p15HostileProjectileExperiment',
  'p15IntegratedActionCompositionExperiment','p15KaiPrototypeExperiment','p15PerformanceHighPointArcExperiment'];

// Derived identity only. Existing checkpoint/profile owners retain their serialized formats.
export function resolvePublicRunContext(data={}){
  if(!data||typeof data!=='object'||Array.isArray(data)||data.practiceMode===true||data.defenseMode===true
    ||Number(data.stageId||1)!==1||diagnosticFlags.some(key=>data[key]===true))return null;
  const chapter=getChapterContent(data.campaignChapterId||'opening'),member=getPublicPerformer(data.performerId);
  if(!chapter||(data.performerId!==undefined&&member.id!==data.performerId))return null;
  const explicitTrial=Object.hasOwn(data,'publicFinaleTrial'),trial=explicitTrial?getFinaleTrialState(data):null;
  if(explicitTrial&&!trial)return null;
  const modeId=trial?(trial.rehearsal?'rehearsal':'finale-trial'):'campaign';
  const mode=getPublicProductMode(modeId);if(!mode)return null;
  return Object.freeze({version:1,modeId,contentId:chapter.id,contentRevision:chapter.revision,
    performerId:member.id,roundIndex:trial?.roundIndex??0,roundCount:trial?.roundCount??1,
    startHp:trial?.startHp??5,policy:mode.policy});
}
