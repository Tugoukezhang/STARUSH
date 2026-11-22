// Original finite Q81–Q83 movements. No idle oscillator or whole-image motion.
export const ranges = Object.freeze({yaw:[-12,12],pitch:[-8,8],roll:[-4,4],left:[0,1],right:[0,1],gx:[-1,1],gy:[-1,1],close:[0,1],smile:[-1,1],breath:[-1,1],sway:[-1,1],ls:[-2.5,2.5],le:[-3.5,3.5],lw:[-3,3],rs:[-2,2],re:[-3,3],rw:[-3,3],moon:[-1,1],tilt:[-1,1],upperNote:[-1,1],nearNote:[-1,1],arc:[-1,1]});
export const neutral = () => Object.fromEntries(Object.keys(ranges).map(k=>[k,0]));
export function boundedPose(values, base=neutral()) {
  const next={...base};
  for(const [key,value] of Object.entries(values)) {
    if(!Object.hasOwn(ranges,key)||!Number.isFinite(value)) throw TypeError('Unknown or non-finite pose: '+key);
    next[key]=Math.max(ranges[key][0],Math.min(ranges[key][1],value));
  }
  return next;
}
const mix=(a,b,t)=>Object.fromEntries(Object.keys(ranges).map(k=>[k,a[k]+(b[k]-a[k])*t]));
const ease=t=>t*t*(3-2*t);
export class GreenActions {
  constructor(clips) {
    if(clips.version!==1||!clips.actions||!Object.keys(clips.actions).length)throw Error('Invalid action file');
    for(const clip of Object.values(clips.actions)) {
      if(!Number.isFinite(clip.duration)||clip.duration<=0||clip.duration>10)throw Error('Invalid action duration');
      for(const [key,track] of Object.entries(clip.tracks)) {
        if(!Object.hasOwn(ranges,key)||!['pulse','tilt','breath'].includes(track.wave)||!Number.isFinite(track.target)||track.target<ranges[key][0]||track.target>ranges[key][1]||!Number.isFinite(track.delay)||track.delay<0||track.delay>=1)throw Error('Invalid action track');
      }
    }
    this.clips=structuredClone(clips.actions);this.clear();
  }
  clear(){this.active=null;this.elapsed=0;this.base=null;this.from=null;this.current=null;this.canceling=false}
  start(name,pose) {
    if(!Object.hasOwn(this.clips,name))throw Error('Unknown action: '+name);
    const previousBase=this.base;this.from=boundedPose(pose);this.base=previousBase?{...previousBase}:{...this.from};
    this.current={...this.from};this.elapsed=0;this.active=name;this.canceling=false;
  }
  cancel(pose){if(!this.active)return;this.from=boundedPose(pose);this.current={...this.from};this.elapsed=0;this.canceling=true}
  advance(dt) {
    if(!Number.isFinite(dt)||dt<0)throw TypeError('Finite nonnegative dt required');
    if(!this.active)return this.current?{...this.current}:null;
    this.elapsed+=dt;
    const clip=this.clips[this.active],duration=this.canceling?.22:clip.duration;
    const t=Math.min(1,this.elapsed/duration);
    let next={...this.base};
    if(this.canceling)next=mix(this.from,this.base,ease(t));
    else {
      for(const[key,track]of Object.entries(clip.tracks)) {
        const local=Math.max(0,Math.min(1,(t-track.delay)/(1-track.delay))),pulse=Math.sin(Math.PI*local)**2;
        if(track.wave==='breath')next[key]=this.base[key]+(1-Math.abs(this.base[key]))*Math.sin(t*4*Math.PI)*Math.sin(Math.PI*t);
        else next[key]=this.base[key]+((track.wave==='tilt'?track.target*Math.sin(t*2*Math.PI):track.target)-this.base[key])*pulse;
      }
      // Preserve continuity when replacing a currently running action.
      next=mix(this.from,next,ease(Math.min(1,this.elapsed/.16)));
    }
    this.current=boundedPose(next);
    if(t===1){this.current={...this.base};this.active=null;this.base=null;this.canceling=false}
    return {...this.current};
  }
  restore(){const result=this.base?{...this.base}:null;this.clear();return result}
  snapshot(){return {active:this.active,elapsed:this.elapsed,canceling:this.canceling,base:this.base?{...this.base}:null}}
}
