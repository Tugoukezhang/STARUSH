import {advanceSakuraSecondary} from '../systems/SakuraSecondaryMotion.mjs';
import {sakuraVisualYaw} from './sakuraObliqueDirection.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const empty=()=>({hair:0,hem:0,balance:0});

export class RefinedSecondaryMotion {
  constructor(){this.lastClock=null;this.state={};this.value=empty();}
  sample(clock,dx,dy,direction,attack=null){
    const dt=this.lastClock===null?0:clock-this.lastClock;this.lastClock=clock;
    if(!Number.isFinite(dt)||!Number.isFinite(dx)||!Number.isFinite(dy)||dt>100||Math.hypot(dx,dy)>40){
      this.state={secondary:{hair:0,hem:0,hairVelocity:0,hemVelocity:0,yaw:sakuraVisualYaw(direction)}};
      return this.value=empty();
    }
   if(dt<=0){
     this.state.secondary??={hair:0,hem:0,hairVelocity:0,hemVelocity:0,yaw:sakuraVisualYaw(direction)};
     return this.value;
   }
   const yaw=sakuraVisualYaw(direction);
   const spring=this.state.secondary??={hair:0,hem:0,hairVelocity:0,hemVelocity:0,yaw};
   const turn=clamp((((yaw-spring.yaw+12)%8)-4)*4,-3,3);
   // A realized orientation change is an impulse, not a force lasting one render frame.
   spring.hairVelocity+=turn*18*18/60;
   spring.hemVelocity+=turn*25*25*.7/60;
   spring.yaw=yaw;
    // Reuse the existing 50ms solver without dropping time or overstating the measured speed.
    const steps=Math.ceil(dt/50);let s;
    for(let i=0;i<steps;i++)s=advanceSakuraSecondary(this.state,dt/steps,dx/steps,dy/steps,attack,yaw);
    return this.value={hair:clamp(s.hair*1.5,-12,12),hem:clamp(s.hem*1.3,-8,8),balance:clamp(s.hem*.006,-.034,.034)};
  }
}

export function deformRefinedSecondary(_rig,mesh,positions,pose,world){
  const hair=mesh.name==='hair',hem=mesh.name==='pelvis';
  const amount=hair?clamp(pose.secondaryHair??0,-12,12):hem?clamp(pose.clothHem??0,-8,8):0;
  if(!amount)return positions;
  const pinned=hair ? .35 : .45,m=world[hair?4:1];
  return positions.map((point,i)=>{
    const t=clamp((mesh.uv[i][1]-pinned)/(1-pinned),0,1),weight=t*t*(3-2*t);
    if(!weight)return point;
    return [point[0]+m[0]*amount*weight,point[1]+m[1]*amount*weight];
  });
}
