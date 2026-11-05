import {getChapterContent} from './publicChapterContent.mjs';

export const PUBLIC_STAGE1_ENCOUNTER_PHASES = Object.freeze([
  Object.freeze({
    id: 'opening-light-check',
    label: '开场校灯',
    requiredCompleted: 0,
    unlitMax: 2,
    unlitSpawnMs: 1800,
    danmakuIntervalMs: 2200,
    stageCueEmitterIntervalMs: null,
    objectiveDisruptorIntervalMs: null,
    spotlightCaptainEnabled: false,
  }),
  Object.freeze({
    id: 'movement-build',
    label: '走位升温',
    requiredCompleted: 2,
    unlitMax: 3,
    unlitSpawnMs: 1500,
    danmakuIntervalMs: 1750,
    stageCueEmitterIntervalMs: 18000,
    objectiveDisruptorIntervalMs: null,
    spotlightCaptainEnabled: false,
  }),
  Object.freeze({
    id: 'pressure-stack',
    label: '压力叠加',
    requiredCompleted: 5,
    unlitMax: 4,
    unlitSpawnMs: 1250,
    danmakuIntervalMs: 1400,
    stageCueEmitterIntervalMs: 15000,
    objectiveDisruptorIntervalMs: 22000,
    spotlightCaptainEnabled: false,
  }),
  Object.freeze({
    id: 'high-point-chase',
    label: '压轴追光',
    requiredCompleted: 8,
    unlitMax: 4,
    unlitSpawnMs: 1100,
    danmakuIntervalMs: 1200,
    stageCueEmitterIntervalMs: 12000,
    objectiveDisruptorIntervalMs: 16000,
    spotlightCaptainEnabled: true,
  }),
]);

export function getChapterEncounterContent(id){
 const chapter=getChapterContent(id);if(!chapter)return null;
 const {roles:order,labels}=chapter.encounter;
 const roles=Object.freeze(order.map((role,index)=>Object.freeze({role,at:PUBLIC_STAGE1_ENCOUNTER_PHASES[index+1].requiredCompleted})));
 const phases=Object.freeze(PUBLIC_STAGE1_ENCOUNTER_PHASES.map((phase,index)=>{
  const available=role=>roles.some(entry=>entry.role===role&&entry.at<=phase.requiredCompleted);
  return Object.freeze({...phase,label:labels[index],
   stageCueEmitterIntervalMs:available('stage-cue-emitter')?phase.stageCueEmitterIntervalMs??PUBLIC_STAGE1_ENCOUNTER_PHASES[1].stageCueEmitterIntervalMs:null,
   objectiveDisruptorIntervalMs:available('objective-disruptor')?phase.objectiveDisruptorIntervalMs??PUBLIC_STAGE1_ENCOUNTER_PHASES[2].objectiveDisruptorIntervalMs:null,
   spotlightCaptainEnabled:available('spotlight-captain')});
 }));
 return Object.freeze({phases,roles});
}
