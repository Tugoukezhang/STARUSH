const define=(releaseBeats,releaseEndMs,dashMs=0)=>Object.freeze({
 releaseBeats:Object.freeze(releaseBeats),releaseEndMs,dashMs,presentationMs:320});
const ACTIONS=Object.freeze({sakura:define([0,100,200],200),kai:define([0],160,160),enjo:define([0],0)});
export function getPublicPerformerAction(id){
 return Object.hasOwn(ACTIONS,id)?ACTIONS[id]:null;
}
// Samples existing run time only. Scheduling and combat consequences stay with the Run.
export function samplePublicPerformerAction(id,presentation,startedAt,now){
 const definition=getPublicPerformerAction(id);
 if(!definition||!Number.isFinite(startedAt)||!Number.isFinite(now)||now<startedAt
  ||!Number.isSafeInteger(presentation?.sequence)||presentation.sequence<1
  ||!['down','left','right','up'].includes(presentation.direction))return null;
 const age=now-startedAt;if(age>=definition.presentationMs)return null;
 return Object.freeze({...presentation,memberId:id,startedAt,age,duration:definition.presentationMs,
  progress:age/definition.presentationMs,phase:age<definition.releaseEndMs?'release':'recovery'});
}
