import {preserveSakuraArmVolume} from './sakuraNativeArmVolume.mjs';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const identity = [1, 0, 0, 1, 0, 0];
const upperBones = new Set(['chest', 'head', 'hair', 'upper.R', 'forearm.R', 'fan', 'upper.L', 'forearm.L']);
const garmentMeshes = new Set(['torso', 'pelvis', 'tab']);

export function multiplyAffine(a, b) {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}
function matrix([x, y, angle, sx, sy]) {
  return [Math.cos(angle)*sx, Math.sin(angle)*sx, -Math.sin(angle)*sy, Math.cos(angle)*sy, x, y];
}
export function sampleNativeClip(clip, time, loop = true) {
  const t = loop ? ((time % clip.duration) + clip.duration) % clip.duration : clamp(time, 0, clip.duration);
  const at = t / clip.duration * (clip.frames.length - 1);
  const i = Math.floor(at), blend = at - i;
  const a = clip.frames[i], b = clip.frames[Math.min(i+1, clip.frames.length-1)];
  return {bones: a.bones.map((pose, bone) => pose.map((v, component) => {
    const to = b.bones[bone][component];
    const delta = component === 2 ? Math.atan2(Math.sin(to-v), Math.cos(to-v)) : to-v;
    return v + delta*blend;
  })), blink: blend < .5 ? a.blink : b.blink, focus: blend < .5 ? a.focus : b.focus,
  fold: a.fold+(b.fold-a.fold)*blend};
}
export function nativeWorldMatrices(rig, pose) {
  const world = [];
  for (let i=0; i<rig.bones.length; i++) {
    const bone=rig.bones[i];
    if (bone.parent>=i) throw Error('Native bones must be topologically ordered');
    world.push(multiplyAffine(bone.parent<0 ? identity : world[bone.parent], matrix(pose.bones[i])));
  }
  return world;
}
export function skinNativeMesh(rig, mesh, pose, world = nativeWorldMatrices(rig, pose)) {
  const transforms = world.map((m, i) => multiplyAffine(m, rig.bones[i].inverseBind));
  const hem=garmentMeshes.has(mesh.name)&&Number.isFinite(pose.clothHem)?clamp(pose.clothHem,-8,8):0;
  const positions = mesh.vertices.map(([vx, vy], i) => {
    let x=vx+(mesh.fold?.[i][0]??0)*pose.fold, y=vy+(mesh.fold?.[i][1]??0)*pose.fold;
    if(hem!==0&&vy>190){
      // Shared bind-space field pins the waist across the front's overlapping parts.
      const t=clamp((vy-190)/33,0,1),angle=-hem*Math.PI/180*t*t*(3-2*t);
      const px=x-160,py=y-190,c=Math.cos(angle),s=Math.sin(angle);
      x=160+px*c-py*s;y=190+px*s+py*c;
    }
    let px=0, py=0;
    for (const [bone, weight] of mesh.weights[i]) {
      const m=transforms[bone];
      px+=(m[0]*x+m[2]*y+m[4])*weight; py+=(m[1]*x+m[3]*y+m[5])*weight;
    }
    return [px, py];
  });
  return preserveSakuraArmVolume(rig, mesh, positions, transforms);
}
export function composeNativePose(rig, base, attack) {
  if (!attack) return base;
  const range = attack.phase==='windup' ? [0, .375] : attack.phase==='release' ? [.375, .625] : [.625, 1];
  const pose=sampleNativeClip(rig.clips.fan, (range[0]+(range[1]-range[0])*clamp(attack.progress,0,1))*rig.clips.fan.duration, false);
  const weight=attack.phase==='windup' ? clamp(attack.progress*5,0,1)
    : attack.phase==='recovery' ? clamp((1-attack.progress)*5,0,1) : 1;
  return {...pose, fold:base.fold+(pose.fold-base.fold)*weight,
    bones:base.bones.map((from,i)=>upperBones.has(rig.bones[i].name)
      ? from.map((v,k)=>{const to=pose.bones[i][k];return v+(k===2 ? Math.atan2(Math.sin(to-v),Math.cos(to-v)) : to-v)*weight;})
      : from)};
}
export function blendNativeLocomotion(idle, walk, weight) {
  const w=clamp(weight,0,1);
  if(w===0)return idle;
  if(w===1)return walk;
  const blend=w*w*(3-2*w);
  return {...idle,fold:idle.fold+(walk.fold-idle.fold)*blend,
    bones:idle.bones.map((from,i)=>from.map((v,k)=>{
      const to=walk.bones[i][k];
      return v+(k===2?Math.atan2(Math.sin(to-v),Math.cos(to-v)):to-v)*blend;
    }))};
}
export function sampleNativeLocomotion(rig,time) {
  const clip=rig.clips.walk,pose=sampleNativeClip(clip,time);
  const roots=rig.bones.map((b,i)=>b.parent===0?i:-1).filter(i=>i>=0);
  const first=clip.frames[0],last=clip.frames.at(-1),phase=((time%clip.duration)+clip.duration)%clip.duration/clip.duration;
  const drift=last.bones[roots[0]].slice(0,2).map((v,k)=>v-first.bones[roots[0]][k]);
  // This source has shared root motion on hip and both IK targets. World movement owns it.
  for(const i of roots){
    for(let k=0;k<2;k++)if(Math.abs(last.bones[i][k]-first.bones[i][k]-drift[k])>.001)throw Error('Native walk has inconsistent root translation');
    for(let k=0;k<2;k++)pose.bones[i][k]-=drift[k]*phase;
  }
  return pose;
}
export class SakuraNativeClock {
  constructor(stride=96) { this.stride=stride; this.clock=0; this.travel=0; this.lastNow=null; this.moving=false; this.settling=false; this.gaitTime=0; this.locomotionWeight=0; }
  update(now, dx, dy, frozen) {
    const dt=this.lastNow==null ? 0 : clamp(now-this.lastNow,0,100);
    this.lastNow=now;
    if (frozen) return;
    this.clock+=dt;
    const distance=Math.hypot(dx,dy);
    this.moving=distance>.05;
    if (this.moving) {
      this.travel+=distance; this.gaitTime=(this.gaitTime+distance/this.stride*1000)%1000;
      this.locomotionWeight=Math.min(1,this.locomotionWeight+dt/120); this.settling=false;
    } else if (this.locomotionWeight>0) {
      this.locomotionWeight=Math.max(0,this.locomotionWeight-dt/180);
      const target=Math.ceil(this.gaitTime/500)*500;
      this.gaitTime=Math.min(target,this.gaitTime+dt*3);
      this.settling=this.locomotionWeight>0;
      // Keep the contact pose while fading; resetting at a half-cycle caused a pop.
      if (!this.settling) this.gaitTime=0;
    }
  }
}
