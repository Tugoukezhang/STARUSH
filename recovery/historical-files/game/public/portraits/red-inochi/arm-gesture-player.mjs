// Parameter-space gesture clips. Only already modeled parameters are driven.
const ranges=[[-20,20],[-12,12],[-5,5],[0,1],[0,1],[-1,1],[-1,1],[0,1],[-1,1],[-1,1],[-1,1],[-1,1],[-1,1],[-1,1],[-1,1]];
const clamp=(v,i)=>Math.min(ranges[i][1],Math.max(ranges[i][0],v));
const ease=t=>t*t*t*(t*(t*6-15)+10);
export class ArmGesturePlayer {
 constructor(data){this.data=data;this.clear()}
 clear(){this.active=false;this.paused=false;this.time=0;this.name=null;this.frames=[];this.home=null;this.current=null}
 start(name,current,home=this.active?this.home:current){
  const clip=this.data.gestures[name];if(!clip)throw Error('Unknown gesture');
  if(current.length!==15||home.length!==15||[...current,...home].some(v=>!Number.isFinite(v)))throw Error('Finite full pose required');
  this.home=home.map(clamp);this.current=current.map(clamp);this.name=name;this.duration=clip.duration;this.time=0;this.active=true;this.paused=false;
  this.frames=clip.keys.map(k=>({time:k.time,pose:this.home.map((v,i)=>clamp(v+(k.delta[this.data.poseOrder[i]]??0),i))}));
  this.frames[0].pose=this.current.slice();return this.current.slice();
 }
 cancel(){if(!this.active)return;this.frames=[{time:0,pose:this.current.slice()},{time:.35,pose:this.home.slice()}];this.duration=.35;this.time=0;this.name='return';this.paused=false}
 advance(dt){
  if(!Number.isFinite(dt))throw Error('Finite elapsed time required');
  if(!this.active||this.paused)return this.current?.slice();
  this.time=Math.min(this.duration,this.time+Math.max(0,Math.min(.05,dt)));
  if(this.time>=this.duration){this.current=this.home.slice();this.active=false;return this.current.slice()}
  const j=this.frames.findIndex(k=>k.time>this.time),a=this.frames[j-1],b=this.frames[j],t=ease((this.time-a.time)/(b.time-a.time));
  this.current=a.pose.map((v,i)=>clamp(v+(b.pose[i]-v)*t,i));return this.current.slice();
 }
 snapshot(){return {active:this.active,paused:this.paused,name:this.name,time:this.time,duration:this.duration??0,home:this.home?.slice(),pose:this.current?.slice()}}
}
