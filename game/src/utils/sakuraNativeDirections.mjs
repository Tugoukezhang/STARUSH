const cardinal=new Set(['down','left','right','up']);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

export function resolveNativeFacing(state,dx,dy,attack,frozen) {
 const held=cardinal.has(state?.direction)?state.direction:'down';
 if(frozen)return held;
 if(Math.hypot(dx,dy)>.05){
  const x=dx<0?'left':'right',y=dy<0?'up':'down';
  if(Math.abs(dx)>.75*Math.abs(dy)&&Math.abs(dy)>.75*Math.abs(dx)&&(held===x||held===y))return held;
  return Math.abs(dx)>Math.abs(dy)?x:y;
 }
 return cardinal.has(attack?.direction)?attack.direction:held;
}

function legAngles(dx,dy,bend,length) {
 const d=clamp(Math.hypot(dx,dy),.01,length*2-.001);
 const a=Math.atan2(-dx,dy)+bend*Math.acos(d/(2*length));
 const b=-bend*(Math.PI-Math.acos(clamp((2*length*length-d*d)/(2*length*length),-1,1)));
 return [a,b,-a-b];
}

// Local rotation deltas: chest, upper arm, elbow, wrist, fan closure.
// Phase endpoints match exactly; combat owns the duration of each phase.
const gestures={
 windup:[[0,0,0,0,0,1],[.5,-.08,-.26,.65,.55,1],[1,.025,.9,-.13,.95,0]],
 release:[[0,.025,.9,-.13,.95,0],[.33,.09,1.45,.17,.84,0],[1,.05,1.15,-.09,.66,0]],
 recovery:[[0,.05,1.15,-.09,.66,0],[.5,0,.32,-.12,.2,.8],[1,0,0,0,0,1]],
};
function directionalGesture(attack){
 const keys=gestures[attack.phase];
 if(!keys)return [0,0,0,0,1];
 const p=clamp(attack.progress??0,0,1);
 const i=Math.min(keys.length-2,Math.max(0,keys.findIndex(k=>k[0]>=p)-1));
 const a=keys[i],b=keys[i+1],t=clamp((p-a[0])/(b[0]-a[0]),0,1),ease=t*t*(3-2*t);
 return a.slice(1).map((v,k)=>v+(b[k+1]-v)*ease);
}

export function sampleDirectionalPose(rig,clock,attack) {
 const bones=rig.rest.map(p=>p.slice()),index=name=>rig.bones.findIndex(b=>b.name===name);
 const w=clamp(clock.locomotionWeight,0,1),t=clock.gaitTime/1000*Math.PI*2;
 const breath=Math.sin(clock.clock/1350*Math.PI*2)*.65;
 bones[index('hip')][1]+=breath*(1-w)-Math.abs(Math.sin(t))*w*.85;
 const side=rig.direction==='left'?1:rig.direction==='right'?-1:1;
 for(const [name,offset]of [['R',0],['L',Math.PI]]){
  const phase=t+offset;
  const travel=(rig.direction==='up'?6:18)*Math.sin(phase)*w;
  const lift=Math.max(0,Math.cos(phase))*5*w;
  const length=rig.rest[index('shin.'+name)][1];
  const [a,b,f]=legAngles(travel,length*2-lift,side,length);
  bones[index('thigh.'+name)][2]=a;bones[index('shin.'+name)][2]=b;bones[index('foot.'+name)][2]=f;
  bones[index('upper.'+name)][2]=Math.sin(phase+.4)*.12*w;
 }
 bones[index('head')][2]=Math.sin(clock.clock/1900*Math.PI*2)*.012*(1-w);
 let fold=1;
 if(attack){
  const [chest,upper,elbow,wrist,closure]=directionalGesture(attack);
  const strength=(attack.kind==='encore'?1.15:attack.kind==='special'?1.1:1)*(rig.direction==='up'?.78:1);
  bones[index('chest')][2]+=side*chest*strength;
  bones[index('head')][2]-=side*chest*strength*.65;
  bones[index('upper.R')][2]+=side*upper*strength;
  bones[index('forearm.R')][2]+=side*elbow*strength;
  bones[index('fan')][2]+=side*wrist*strength;
  bones[index('upper.L')][2]-=side*chest*strength*2;
  fold=closure;
 }
 return {bones,fold,blink:rig.direction!=='up'&&clock.clock%4200>4020,focus:Boolean(attack)};
}
