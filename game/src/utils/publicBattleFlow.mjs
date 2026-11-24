import {formatPaintObjectiveLine,getStage1RequiredObjectiveCount} from './stage1PaintRound.mjs';
const count=(value,fallback=0)=>Number.isFinite(value)?Math.max(0,Math.floor(value)):fallback;
const BLOCKERS=[['spotlight-captain','_publicStage1SpotlightCaptain'],['objective-disruptor','_publicStage1ObjectiveDisruptor'],['stage-cue-emitter','_publicStage1StageCueEmitter']];

export function isLiveStageBlocker(enemy){
 return enemy?.active===true&&enemy.destroyed!==true&&!(enemy.hp<=0)&&Number.isFinite(enemy.x)&&Number.isFinite(enemy.y);
}

// Read existing owners only. No progression, target selection, timers or saved state.
export function getPublicBattleFlow(scene,{finaleState}={}){
 if(!scene)return null;
 const zone=scene.paintZone;
 const state=finaleState===undefined?scene.publicStage1Finale?.snapshot?.(scene.publicPerformerRun?.now?.()??scene.time?.now??0):finaleState;
 if(!zone&&!state?.active&&!state?.complete&&!state?.failed)return null;
 const weakPointCount=Math.max(1,count(Number(state?.weakPointCount),1));
 const finale=state?Object.freeze({active:state.active===true,phase:typeof state.phase==='string'?state.phase:null,
  complete:state.complete===true,failed:state.failed===true,weakPointCount,
  weakPointsResolved:Math.min(weakPointCount,count(Number(state.weakPointsResolved))),
  remainingMs:Number.isFinite(state.remainingMs)?Math.max(0,state.remainingMs):0,
  attackIndex:count(state.attackIndex),attackPattern:typeof state.attackPattern==='string'?state.attackPattern:null,
  lastAttackOutcome:typeof state.lastAttackOutcome==='string'?state.lastAttackOutcome:null}):null;
 if(finale?.active||finale?.complete||finale?.failed){
  let phase=finale.complete?'complete':finale.failed?'failed'
   :['attack','weak-point','boss-recovery'].includes(finale.phase)?(finale.phase==='boss-recovery'?'boss-recovery':'boss-'+finale.phase):'boss-other';
  const headline=finale.complete||finale.failed?null:finale.phase==='attack'?'压轴返场 · 读招 '+(finale.weakPointsResolved+1)+'/'+finale.weakPointCount
   :finale.phase==='weak-point'?'压轴返场 · 弱点 '+(finale.weakPointsResolved+1)+'/'+finale.weakPointCount:'压轴返场 · 集中喷涂';
  return Object.freeze({phase,headline,facilities:null,side:null,finale,finaleReady:null,blockerRoles:Object.freeze([])});
 }
 const complete=zone?.isComplete?.()===true;
 const facilities=Object.freeze({completed:count(zone?.getPaintedCount?.()),total:count(zone?.getTotalCount?.())||getStage1RequiredObjectiveCount(),complete});
 const sideState=!complete?zone?.sideSet?.snapshot?.(zone.devices):null;
 const side=sideState?Object.freeze({completed:count(sideState.completed),total:count(sideState.total)}):null;
 const blockerRoles=Object.freeze(BLOCKERS.filter(([,key])=>isLiveStageBlocker(scene[key])).map(([role])=>role));
 const ready=complete&&!finale?.active&&!finale?.complete&&!finale?.failed?scene.publicStage1Encounter?.canEnterFinale?.():null;
 const finaleReady=typeof ready==='boolean'?ready:null;
 let phase='restore',headline=side?'设施 '+facilities.completed+'/'+facilities.total+' · 串场 '+side.completed+'/'+side.total
  :scene.oldStreet?'街区设施 '+facilities.completed+'/'+facilities.total:formatPaintObjectiveLine(facilities.completed,facilities.total);
 if(complete){
  phase=finaleReady===false&&blockerRoles.length?'clear-pressure':'to-finale';
  const label=scene.oldStreet?.config?.finaleLabel;
  headline=phase==='clear-pressure'?'街区恢复 · 解除舞台干扰':typeof label==='string'&&label?label:'前往露天剧场';
 }
 return Object.freeze({phase,headline,facilities,side,finale,finaleReady,blockerRoles});
}
