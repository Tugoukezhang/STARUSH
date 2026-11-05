export const SAKURA_SECONDARY_ART=Object.freeze({
 hair:Object.freeze({key:'sakura-secondary-hair-20260922',path:'art/sakura-secondary-20260922/hair-parts.png',frameWidth:112,frameHeight:112}),
 hem:Object.freeze({key:'sakura-secondary-hem-20260922',path:'art/sakura-secondary-20260922/hem-parts.png',frameWidth:96,frameHeight:32}),
});
const limit=(v,max=8)=>Math.max(-max,Math.min(max,v));
export function advanceSakuraSecondary(state,dt,dx,dy,attack,turnYaw=0){
 const s=state.secondary??={hair:0,hem:0,hairVelocity:0,hemVelocity:0,yaw:turnYaw};
 if(Math.hypot(dx,dy)>40){Object.assign(s,{hair:0,hem:0,hairVelocity:0,hemVelocity:0,yaw:turnYaw});return s;}
 const seconds=Math.max(0,Math.min(50,dt))/1000;
 if(!seconds)return s;
 const vx=dx/seconds,vy=dy/seconds,yawDelta=((turnYaw-s.yaw+12)%8)-4;
 const recoil=attack?.phase==='release'?(attack.direction==='right'?-2:attack.direction==='left'?2:0):0;
 const target=limit(-vx*.032-vy*.004+limit(yawDelta*4,3)+recoil);
 // Exact critically damped response: no perpetual idle oscillation or frame-rate drift.
 for(const [part,rate,gain] of [['hair',18,1],['hem',25,.7]]){
  const velocity=part+'Velocity',t=target*gain,offset=s[part]-t,c=s[velocity]+rate*offset,e=Math.exp(-rate*seconds);
  s[part]=limit(t+(offset+c*seconds)*e);s[velocity]=(s[velocity]-rate*c*seconds)*e;
 }
 s.yaw=turnYaw;return s;
}
export function sakuraSecondaryVariant(value){return Math.max(0,Math.min(4,Math.round((value+8)/4)));}
