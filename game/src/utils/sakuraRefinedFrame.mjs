import {RefinedActionController,sampleRefinedPose} from './sakuraRefinedMotion.mjs';
import {nativeWorldMatrices} from './sakuraNativePose.mjs';
import {WorldContactPlanner} from './sakuraRefinedContact.mjs';
import {RefinedSecondaryMotion} from './sakuraRefinedDetails.mjs';
import {hasSakuraObliqueViews,sakuraEightDirection} from './sakuraObliqueDirection.mjs';
import {RefinedVisualTurn,RefinedAttackTurn,REFINED_TURN_POSE_MS,settleRefinedTurnPose} from './sakuraRefinedTurn.mjs';
const facing={down:'front',up:'back',left:'left',right:'right'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const REFINED_WORLD_SCALE=.24;
export function studyAttackSampleTime(attack){
 if(!attack)return 800;const p=clamp(Number(attack.progress)||0,0,1);
 return attack.phase==='windup'?220*p:attack.phase==='release'?220+220*p:440+360*p;
}
export function studyElbowWeights(point,shoulder,elbow,upper,lower){
 const dx=elbow[0]-shoulder[0],dy=elbow[1]-shoulder[1],length=Math.hypot(dx,dy);
 const t=clamp(((point[0]-elbow[0])*dx+(point[1]-elbow[1])*dy)/length/16+.5,0,1),w=t*t*(3-2*t);
 return [[upper,1-w],[lower,w]];
}
export function refineStudyElbows(rigs){
 const result=structuredClone(rigs);
 for(const rig of Object.values(result)){
  const world=nativeWorldMatrices(rig,{bones:rig.rest});
  for(const part of rig.meshes){
   if(part.name.startsWith('leg.')&&(!rig.direction||rig.direction==='back'))part.jointProjection='sagittal-depth';
   if(!part.name.startsWith('arm.'))continue;
   const upper=part.name==='arm.R'?5:8,lower=upper+1;
   part.weights=part.vertices.map(v=>studyElbowWeights(v,world[upper].slice(4,6),world[lower].slice(4,6),upper,lower));
   part.jointRegistration='actual bound elbow axis, 16 source-unit smooth transition';
  }
 }
 return result;
}
export class SakuraRefinedWorldFrame{
 constructor(rigs){this.rigs=rigs;this.controller=new RefinedActionController(rigs);this.contact=new WorldContactPlanner();this.secondary=new RefinedSecondaryMotion();this.turn=new RefinedVisualTurn();this.turnPose=null;this.actionTurn=new RefinedAttackTurn();this.actionPose=null;this.returnTurn=new RefinedVisualTurn();this.returning=false;this.last=null;this.clock=0;this.hitCount=0;this.hurtAt=null;this.previous=null;this.recovery=null;}
 update({now,x,y,attack=null,hitCount=0,frozen=false}){
  const previous=this.last,dx=previous?x-previous.x:0,dy=previous?y-previous.y:0,dt=previous?Math.max(0,now-previous.now):0;
  this.last={now,x,y};if(frozen&&this.previous)return this.previous;
  this.clock+=dt;
  // Preserve the current game's 64 world-pixel cadence contract, not the lab's 40 source units.
  this.controller.update(now,dx*40/64,dy*40/64,false);
  if(hitCount>this.hitCount)this.hurtAt=this.clock;this.hitCount=hitCount;
  const hurt=this.hurtAt!==null&&this.clock-this.hurtAt<360;
  if(attack||hurt)this.recovery=null;
  else if(this.previous?.attackId!==null&&this.previous?.attackId!==undefined){this.recovery={at:this.clock,direction:this.previous.upperDirection,bones:(this.previous.layers[0].baseBones??this.previous.layers[0].pose.bones).map(b=>b.slice()),fanOpen:this.previous.layers[0].fanOpen};}
  if(this.recovery&&this.clock-this.recovery.at>=140)this.recovery=null;
  const visualRecovery=!!this.recovery;
  const eightViews=hasSakuraObliqueViews(this.rigs);
  const visualTurn=eightViews?this.turn.sample(this.controller.direction,this.clock,Math.hypot(dx,dy)>40)
   :{direction:this.controller.direction,requested:this.controller.direction,active:false};
  const lowerDirection=visualTurn.direction;
  const attackDirection=attack&&eightViews&&Number.isFinite(attack.angle)
   ?sakuraEightDirection(Math.cos(attack.angle),Math.sin(attack.angle),null):facing[attack?.direction];
  let upperDirection=attackDirection||this.recovery?.direction||lowerDirection;
  let visualActionTurn={direction:upperDirection,requested:upperDirection,active:false,weight:0,poseBlend:false};
  let visualReturn={direction:upperDirection,requested:lowerDirection,active:false};
  if(eightViews&&!hurt&&attack){
   visualActionTurn={poseBlend:false,...this.actionTurn.sample(attack,attackDirection,this.previous?.upperDirection??lowerDirection)};
   upperDirection=visualActionTurn.direction;this.returning=false;
   if(attack.phase==='windup'&&this.previous&&this.actionPose?.id!==attack.id){
    const before=this.previous.layers[0],bind=this.rigs[before.direction].rest;
    this.actionPose={id:attack.id,offsets:(before.baseBones??before.pose.bones).map((b,i)=>b[2]-bind[i][2]),fanOpen:before.fanOpen};
   }
  }else{
   this.actionTurn.reset();this.actionPose=null;
   if(!eightViews||hurt||this.recovery)this.returning=false;
   else{
    if(this.previous?.visualRecovery){this.returning=true;this.returnTurn.sample(this.previous.upperDirection,this.clock,true);}
    if(this.returning){visualReturn=this.returnTurn.sample(lowerDirection,this.clock,Math.hypot(dx,dy)>40);upperDirection=visualReturn.direction;this.returning=visualReturn.active;}
   }
  }
  const secondary=this.secondary.sample(this.clock,dx,dy,upperDirection,attack);
  const moving=this.controller.weight>0,mode=moving?(attack?'walk-attack':'walk'):(attack?'attack':'idle');
  const options={mode,time:this.clock,gaitTime:this.controller.gaitTime,travel:this.controller.distance,weight:this.controller.weight,attackTime:studyAttackSampleTime(attack),hurtTime:hurt?this.clock-this.hurtAt:null};
  const upper=sampleRefinedPose({rigs:this.rigs,...options,direction:upperDirection}),lower=sampleRefinedPose({rigs:this.rigs,...options,direction:lowerDirection});
  if(this.actionPose&&visualActionTurn.weight>0){
   settleRefinedTurnPose(upper.pose,this.rigs[upperDirection],this.actionPose.offsets,visualActionTurn.weight);
   upper.fanOpen+=(this.actionPose.fanOpen-upper.fanOpen)*visualActionTurn.weight;visualActionTurn.poseBlend=true;
  }else this.actionPose=null;
  if(!eightViews||attack||hurt||visualRecovery)this.turnPose=null;
  else if(this.previous&&!this.previous.hurt&&this.previous.attackId===null&&this.previous.upperDirection!==upperDirection){
   const before=this.previous.layers[0],bind=this.rigs[before.direction].rest;
   this.turnPose={at:this.clock,offsets:(before.baseBones??before.pose.bones).map((b,i)=>b[2]-bind[i][2])};
  }
  if(this.turnPose){
   const t=clamp((this.clock-this.turnPose.at)/REFINED_TURN_POSE_MS,0,1);
   settleRefinedTurnPose(upper.pose,this.rigs[upperDirection],this.turnPose.offsets,1-t*t*(3-2*t));
   if(t===1)this.turnPose=null;
  }
  visualTurn.poseBlend=!!this.turnPose;
  if(this.recovery){
   const t=clamp((this.clock-this.recovery.at)/140,0,1),weight=1-t*t*(3-2*t);
   for(let i=2;i<10;i++){const to=upper.pose.bones[i][2],from=this.recovery.bones[i][2];upper.pose.bones[i][2]=weight===1?from:to+Math.atan2(Math.sin(from-to),Math.cos(from-to))*weight;}
   upper.fanOpen=this.recovery.fanOpen*weight;upper.phase='visual-recovery';
  }
  // Keep the authored hair root fixed; only its free surface receives inertia.
  upper.pose.bones[4][2]=0;upper.baseBones=upper.pose.bones.map(b=>b.slice());
  upper.pose.bones[2][2]+=secondary.balance;upper.pose.bones[3][2]-=secondary.balance*.65;
  upper.pose.secondaryHair=secondary.hair;upper.pose.clothHem=secondary.hem;
  const contacts=this.contact.apply(lower,this.rigs[lowerDirection],{x,y,dx,dy,clock:this.clock,weight:this.controller.weight,scale:REFINED_WORLD_SCALE});
  for(let i=0;i<2;i++)upper.pose.bones[1][i]+=lower.world[1][4+i]-upper.world[1][4+i];
  if(upperDirection===lowerDirection){for(let i=10;i<16;i++)upper.pose.bones[i]=lower.pose.bones[i].slice();upper.feet=lower.feet;}
  upper.world=nativeWorldMatrices(this.rigs[upperDirection],upper.pose);
  const m=upper.world[7],hand={x:x+(m[4]-upper.rootTravel-160)*REFINED_WORLD_SCALE,y:y+26+(m[5]-333)*REFINED_WORLD_SCALE};
  const layers=upperDirection===lowerDirection?[{...upper,selection:'all'}]:[{...upper,selection:'upper'},{...lower,selection:'lower'}];
  const result={root:{x,y},groundY:y+26,scale:REFINED_WORLD_SCALE,depth:9.2+(y+26)/10000,clock:this.clock,distance:this.controller.distance,lowerDirection,upperDirection,attackId:attack?.id??null,attackPhase:attack?.phase??null,attackSampleTime:studyAttackSampleTime(attack),visualRecovery,visualRecoveryMs:this.recovery?this.clock-this.recovery.at:0,hurt,hand,contacts,layers,secondary,visualTurn,visualActionTurn,visualReturn};
  this.previous=result;return result;
 }
}

