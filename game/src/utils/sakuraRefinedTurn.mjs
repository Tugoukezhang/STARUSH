const directions=['right','front-right','front','front-left','left','back-left','back','back-right'];
const wrap=i=>(i+8)%8;
const shortest=(a,b)=>{const d=wrap(b-a);return d>4?d-8:d;};
export const REFINED_TURN_STEP_MS=48;
export const REFINED_TURN_POSE_MS=90;
export const REFINED_ATTACK_TURN_END=.85;

// Only visual attachment choice is delayed. No root, input or action state belongs here.
export class RefinedVisualTurn {
 constructor(){this.direction=null;this.requested=null;this.deadline=null;this.sign=1;}
 sample(requested,clock,reset=false){
  const target=directions.indexOf(requested);
  if(target<0)return {direction:requested,requested,active:false};
  if(this.direction===null||reset){this.direction=requested;this.deadline=null;}
  if(requested!==this.requested)this.deadline=null;
  this.requested=requested;
  let current=directions.indexOf(this.direction);
  if(current!==target){
   if(this.deadline===null)this.deadline=clock;
   while(current!==target&&clock>=this.deadline){
    const delta=shortest(current,target);
    const sign=Math.abs(delta)===4?this.sign:Math.sign(delta);
    current=wrap(current+sign);this.sign=sign;this.deadline+=REFINED_TURN_STEP_MS;
   }
   this.direction=directions[current];
  }
  if(current===target)this.deadline=null;
  return {direction:this.direction,requested,active:current!==target,remaining:Math.abs(shortest(current,target))};
 }
}

// Attachment timing follows the existing windup; release never waits for this state.
export class RefinedAttackTurn {
 constructor(){this.reset();}
 reset(){this.action=null;}
 sample(attack,requested,from){
  if(attack?.phase!=='windup'||directions.indexOf(from)<0||directions.indexOf(requested)<0){
   this.reset();return {direction:requested,requested,active:false,weight:0};
  }
  if(this.action?.id!==attack.id){
   const delta=shortest(directions.indexOf(from),directions.indexOf(requested));
   this.action={id:attack.id,from:directions.indexOf(from),target:requested,delta,progress:0};
  }
  const a=this.action;
  a.progress=Math.max(a.progress,Math.max(0,Math.min(1,Number(attack.progress)||0)));
  const t=Math.min(1,a.progress/REFINED_ATTACK_TURN_END),steps=Math.ceil(Math.abs(a.delta)*t);
  return {direction:directions[wrap(a.from+Math.sign(a.delta)*steps)],requested:a.target,
   active:steps<Math.abs(a.delta),weight:1-t*t*(3-2*t)};
 }
}

export function settleRefinedTurnPose(pose,rig,fromOffsets,weight){
 for(let i=2;i<10;i++){
  const to=pose.bones[i][2]-rig.rest[i][2],from=fromOffsets[i];
  pose.bones[i][2]+=Math.atan2(Math.sin(from-to),Math.cos(from-to))*weight;
 }
}
