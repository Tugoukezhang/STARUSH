const ROLE_BRACE=Object.freeze({
 'unlit-chaser':0,'stage-cue-emitter':-8,'objective-disruptor':5,
 'spotlight-captain':-7,'finale-boss':-5,'finale-weak-point':0,
});
const rad=degrees=>degrees*Math.PI/180;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function createEnemyMotion(role,{now=0,x=0,y=0,state=null}={}) {
 return {role,state,stateAt:now,lastNow:now,x,y,travel:0,pulse:null,releasedAt:null,
  capture:null,fromRotation:0,pose:{rotation:0}};
}

export function notifyEnemyMotionRelease(m,{now,pulse,capture=null,state=null}={}) {
 if(!m||!Number.isFinite(now)||pulse===null||pulse===undefined)return false;
 if(pulse===m.pulse)return false;
 if(state!==null&&state!==m.state){m.fromRotation=m.pose.rotation;m.state=state;m.stateAt=now;}
 m.pulse=pulse;m.releasedAt=now;
 if(capture!==null)m.capture=capture;
 return true;
}

export function advanceEnemyMotion(m,{now,x,y,state,pulse=null,capture=null,chaserState=null,paused=false}={}) {
 if(!m||paused||!Number.isFinite(now+x+y)||now<=m.lastNow)return m?.pose||{rotation:0};
 const distance=Math.hypot(x-m.x,y-m.y);
 if(state!==m.state){
  m.fromRotation=m.pose.rotation;m.state=state;m.stateAt=now;
  if(state==='windup')m.releasedAt=null;
 }
 if(capture!==null&&capture!==m.capture){
  m.capture=capture;m.stateAt=now;m.releasedAt=null;m.fromRotation=m.pose.rotation;
 }
 // A new real projectile is the release edge. Elapsed windup never creates one.
 if(pulse!==null&&pulse!==m.pulse)notifyEnemyMotionRelease(m,{now,pulse,capture});
 const age=Math.max(0,now-m.stateAt),releaseAge=m.releasedAt===null?Infinity:now-m.releasedAt;
 let rotation=0;
 if(m.role==='unlit-chaser'){
  m.travel=(m.travel+distance*0.16)%(Math.PI*2);
  rotation=chaserState==='windup'?-rad(8)*Math.sin(clamp(age/220,0,1)*Math.PI/2)
   :chaserState==='rush'?rad(8):chaserState==='recovery'?m.fromRotation*(1-clamp(age/300,0,1))**2
   :distance>0.001?rad(6)*Math.sin(m.travel):0;
 }else if(releaseAge<300){
  rotation=rad(10)*(1-releaseAge/300)**2;
 }else if(state==='windup'&&m.releasedAt===null){
  rotation=rad(ROLE_BRACE[m.role]||0)*Math.sin(clamp(age/220,0,1)*Math.PI/2);
 }else if(state==='disrupting'&&m.role==='objective-disruptor'){
  rotation=rad(3)*Math.sin(age/180);
 }else if(state==='recovery'){
  rotation=m.fromRotation*(1-clamp(age/300,0,1))**2;
 }
 m.lastNow=now;m.x=x;m.y=y;
 m.pose={rotation:clamp(rotation,-rad(10),rad(10))||0,
  step:m.role==='unlit-chaser'&&distance>.001?(Math.sin(m.travel)>=0?1:2):0,
  releasing:releaseAge>=0&&releaseAge<135};
 return m.pose;
}

export function groundedEnemyPosition(x,y,offset,radius,rotation) {
 // Compensate the rotated image center so its original bottom contact stays fixed.
 return {x:x+offset+radius*Math.sin(rotation),
  y:y+offset+radius*(1-Math.cos(rotation))};
}

