import {nativeWorldMatrices} from './sakuraNativePose.mjs';
import {hasSakuraObliqueViews,sakuraEightDirection} from './sakuraObliqueDirection.mjs';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=v=>v*v*(3-2*v);
export function solveEqualLengthLeg(dx,dy,bend,length){
 const d=clamp(Math.hypot(dx,dy),.01,length*2-.001);
 const a=Math.atan2(-dx,dy)+bend*Math.acos(d/(2*length));
 const b=-bend*(Math.PI-Math.acos(clamp((2*length*length-d*d)/(2*length*length),-1,1)));
 return [a,b,-a-b];
}
const point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
function attackAt(time){
 const t=clamp(time,0,800),phase=t<220?'anticipation':t<440?'release':t<800?'recovery':'rest';
 const key=t<220?ease(t/220):t<440?1:t<800?1-ease((t-440)/360):0;
 const strike=t<220?0:t<440?Math.sin((t-220)/220*Math.PI):0;
 return {phase,upper:.3*key-.65*strike,forearm:.45*key-.85*strike,fan:-.4*key-.5*strike,open:ease(clamp((t-100)/120,0,1))*key};
}
export function sampleRefinedPose({mode='idle',time=0,direction='front',gaitTime=time,travel=null,weight=null,attackTime=time,hurtTime=null,rigs}={}){
 const rig=rigs[direction];if(!rig)throw Error('Unknown study direction '+direction);
 const walking=mode==='walk'||mode==='walk-attack',attacking=mode==='attack'||mode==='walk-attack';
 const w=weight===null?(walking?1:0):clamp(weight,0,1),pose={bones:rig.rest.map(v=>v.slice()),fold:0,clothHem:0};
 pose.bones[2][1]+=Math.sin(time/1900*2*Math.PI)*1.2;
 pose.bones[3][2]=Math.sin(time/2400*2*Math.PI)*.014;
 pose.bones[4][2]=Math.sin(time/2100*2*Math.PI-.7)*.035;
 const rootTravel=travel===null?(walking?40*gaitTime/800:0):travel;pose.bones[0][0]+=rootTravel;
 if(walking){
  const phase=gaitTime/800*2*Math.PI,wave=Math.sin(phase);
  const lateral=direction.includes('left')||direction.includes('right'),sign=direction.includes('left')?-1:1;
  const lean=(lateral?sign*(.065+.015*wave):.012*wave)*w;
  pose.bones[1][1]-=(1-Math.cos(phase*2))*1.6*w;
  pose.bones[2][2]+=lean;pose.bones[3][2]-=lean*.65;
  pose.bones[8][2]=wave*.12*w;
 }
 const feet={};
 for(const [side,index,offset]of [['R',10,0],['L',13,.5]]){
  const baseX=160+rig.rest[index][0],phase=((gaitTime/800+offset)%1+1)%1,stance=!walking||phase<.5;
  const swing=clamp((phase-.5)*2,0,1);
  const dx=walking?(stance?10-40*phase:-10+20*ease(swing))*w:0;
  const target=[rootTravel+baseX+dx,330-(walking&&!stance?8*Math.sin(swing*Math.PI)*w:0)];
  let world=nativeWorldMatrices(rig,pose);const hip=world[index];
  const bend=direction.includes('left')?1:direction.includes('right')?-1:side==='R'?1:-1;
  const angles=solveEqualLengthLeg(target[0]-hip[4],target[1]-hip[5],bend,rig.legLength);
  for(let j=0;j<3;j++)pose.bones[index+j][2]=angles[j];
  world=nativeWorldMatrices(rig,pose);const knee=world[index+1],sole=world[index+2];
  feet[side]={stance,world:target,targetError:Math.hypot(sole[4]-target[0],sole[5]-target[1]),
   lengths:[Math.hypot(knee[4]-hip[4],knee[5]-hip[5]),Math.hypot(sole[4]-knee[4],sole[5]-knee[5])]};
 }
 let phase='rest',fanOpen=0;
 if(attacking){const a=attackAt(attackTime),sign=direction.includes('left')?-1:1;phase=a.phase;fanOpen=a.open;pose.bones[5][2]+=a.upper*sign;pose.bones[6][2]+=a.forearm*sign;pose.bones[7][2]+=a.fan*sign;}
 // Hit reaction overlays the body; an ongoing committed attack still owns fan opening.
 if(hurtTime!==null&&hurtTime<360){const amount=Math.sin(clamp(hurtTime/360,0,1)*Math.PI);pose.bones[2][2]+=.14*amount;pose.bones[3][2]-=.08*amount;phase='hurt';}
 const world=nativeWorldMatrices(rig,pose),hand=point(world[6],...rig.rest[7].slice(0,2)),fanHinge=point(world[7],0,0);
 return {pose,world,rootTravel,feet,phase,fanOpen,fanHinge,hand,gripError:Math.hypot(hand[0]-fanHinge[0],hand[1]-fanHinge[1]),
  direction,blink:!direction.startsWith('back')&&(hurtTime!==null&&hurtTime>=0&&hurtTime<360
   ?hurtTime<120:time%3800>=3000&&time%3800<3130)};
}
export class RefinedActionController{
 constructor(rigs){this.rigs=rigs;this.time=0;this.lastNow=null;this.distance=0;this.gaitTime=0;this.weight=0;this.direction='front';this.attackStart=null;this.hurtStart=null;}
 update(now,dx=0,dy=0,frozen=false){
  const dt=this.lastNow===null?0:Math.max(0,now-this.lastNow);this.lastNow=now;if(frozen)return;
  this.time+=dt;const distance=Math.hypot(dx,dy);
  if(distance>.001){this.distance+=distance;this.gaitTime+=distance/40*800;this.weight=Math.min(1,this.weight+dt/120);
   if(hasSakuraObliqueViews(this.rigs))this.direction=sakuraEightDirection(dx,dy,this.direction);
   else if(Math.abs(dx)>Math.abs(dy)*1.15)this.direction=dx>0?'right':'left';else if(Math.abs(dy)>Math.abs(dx)*1.15)this.direction=dy>0?'front':'back';
  }else this.weight=Math.max(0,this.weight-dt/180);
  if(this.attackStart!==null&&this.time-this.attackStart>=800)this.attackStart=null;
  if(this.hurtStart!==null&&this.time-this.hurtStart>=360)this.hurtStart=null;
 }
 attack(){if(this.attackStart!==null||this.hurtStart!==null)return false;this.attackStart=this.time;return true;}
 hurt(){this.attackStart=null;this.hurtStart=this.time;}
 sample(){return sampleRefinedPose({rigs:this.rigs,mode:this.weight>0?(this.attackStart===null?'walk':'walk-attack'):(this.attackStart===null?'idle':'attack'),time:this.time,direction:this.direction,gaitTime:this.gaitTime,travel:this.distance,weight:ease(this.weight),attackTime:this.attackStart===null?800:this.time-this.attackStart,hurtTime:this.hurtStart===null?null:this.time-this.hurtStart});}
}
export class RefinedClock{
 constructor(){this.time=0;this.lastNow=null;this.paused=false;}
 update(now){const dt=this.lastNow===null?0:clamp(now-this.lastNow,0,100);this.lastNow=now;if(!this.paused)this.time+=dt;}
}
export function foldRefinedFanVertex(vertex,world,openness){
 const dx=vertex[0]-world[4],dy=vertex[1]-world[5],c=world[0],s=world[1];
 const x=(c*dx+s*dy)*clamp(openness,.05,1),y=-s*dx+c*dy;
 return [world[4]+c*x-s*y,world[5]+s*x+c*y];
}

