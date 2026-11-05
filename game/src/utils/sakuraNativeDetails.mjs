import {advanceSakuraSecondary} from '../systems/SakuraSecondaryMotion.mjs';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const yaw={down:0,left:2,up:4,right:6};

export class SakuraNativeDetails {
  constructor(){this.lastClock=null;this.hitAt=null;this.hitSequence=0;this.wasHurt=false;this.reaction=0;}
  update(clock,dx,dy,attack,direction,hurt,hitSequence){
    const dt=this.lastClock===null?0:clamp(clock-this.lastClock,0,100);
    this.lastClock=clock;
    const scale=Math.hypot(dx,dy)>40?1:dt>50?50/dt:1;
    advanceSakuraSecondary(this,dt,dx*scale,dy*scale,attack,yaw[direction]??0);
    // ActorPresentation supplies the actual damage sequence, not the duration of its tint.
    const sequenced=Number.isFinite(hitSequence);
    if(sequenced?hitSequence>this.hitSequence:hurt&&!this.wasHurt)this.hitAt=clock;
    if(sequenced)this.hitSequence=Math.max(this.hitSequence,hitSequence);
    this.wasHurt=Boolean(hurt);
    const age=this.hitAt===null?Infinity:Math.max(0,clock-this.hitAt);
    this.reaction=age<45?1-age/90:age<260?.5*((260-age)/215)**2:0;
    return this;
  }
}

export function composeNativeDetails(rig,base,detail){
  const bones=base.bones.map(p=>p.slice()),hair=clamp(detail.secondary?.hair??0,-8,8)*Math.PI/180;
  const reaction=clamp(detail.reaction??0,0,1),sign=rig.direction==='left'?-1:1;
  for(const [i,b]of rig.bones.entries()){
    if(b.name==='hair'||b.name==='pony.root')bones[i][2]+=hair*.7;
    else if(b.name==='pony.tip')bones[i][2]+=hair*.45;
    else if(b.name==='head')bones[i][2]+=sign*.055*reaction;
    else if(b.name==='chest')bones[i][2]-=sign*.028*reaction;
  }
  const hem=detail.secondary?.hem;
  return {...base,bones,clothHem:Number.isFinite(hem)?clamp(hem,-8,8):0};
}

export function nativeExpressionRegion(rig,part,pose,reaction){
  if(part.name!=='head'||!rig.expressions)return part.region;
  if(reaction>0&&rig.expressions.blink)return rig.expressions.blink;
  if(pose.focus&&rig.expressions.focus)return rig.expressions.focus;
  if(pose.blink&&rig.expressions.blink)return rig.expressions.blink;
  return part.region;
}
