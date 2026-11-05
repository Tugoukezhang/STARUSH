import {advanceFeet,advanceMovementLag,coherentFacing,solveLeg,projectLegForView,sampleRunPosture,runSoleAngle} from './SakuraFootMotion.mjs';
import {LayeredPoseTransition,LayeredSeamMeshes,layeredActorAlpha,bindLayeredUpperBody} from './LayeredPoseTransition.mjs';
import {LAYERED_UPPER_CONTOURS} from '../utils/layeredUpperContours.mjs';
import {LAYERED_KNEE_CONTOURS} from '../utils/layeredKneeContours.mjs';
import {preloadLayeredOblique,hasLayeredOblique,LayeredObliqueController,applyObliquePose,setLayeredPartFrame} from './LayeredObliquePresentation.mjs';
import {basicShotReleaseWeight} from './PerformerShotFeedback.mjs';
import {layeredAimWeight,sampleLayeredArmMotion} from './LayeredArmMotion.mjs';
import {sampleLayeredActionMotion} from './LayeredActionMotion.mjs';

export const GENYA_ART=Object.freeze({id:'genya',key:'genya-layered-20261006',
  rigKey:'genya-layered-rig-20261006',image:'art/genya-unified-20261012/genya-parts.webp',
  data:'art/genya-unified-20261012/genya-parts.json'});
const TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Longer visual cycle, same 11.5px planted travel and IK reach.
const RUN_STRIDE=92,RUN_STANCE=11.5/RUN_STRIDE;
const rest=(p,d,i)=>({x:p.x+(i?1:-1)*(d==='left'||d==='right'?1.3:3.2),y:p.y+26});
const feetAt=(p,d)=>[0,1].map(i=>({...rest(p,d,i),contact:true,lift:0,plantId:0,cycle:null}));
const facing=(dx,dy)=>Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
const rotate=(x,y,angle)=>{const r=angle*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
export function preloadGenyaLayered(scene){
  if(!scene.load?.atlas||!scene.load?.json)return false;
  scene.load.atlas(GENYA_ART.key,GENYA_ART.image,GENYA_ART.data);
  scene.load.json(GENYA_ART.rigKey,GENYA_ART.data);preloadLayeredOblique(scene,'genya');return true;
}
export function hasGenyaLayered(scene){return scene.textures?.exists(GENYA_ART.key)===true
  &&scene.cache?.json?.get(GENYA_ART.rigKey)?.rig?.identity==='genya';}

// Genya owns her bind and choreography; only contact/IK arithmetic is shared.
export class GenyaMotion{
  constructor(player){
    this.facing='down';this.clock=0;this.lastNow=null;this.shot=null;this.aim=null;this.pose=null;
    this.feet={feet:feetAt(player,'down'),mode:'idle',phase:0,travel:0,stopTime:0};
    this.hairSway=0;
    this.wasAction=false;this.actionStart=0;
  }
  beginShot(now,dx,dy,interval){
    if(!Number.isFinite(now+dx+dy)||Math.hypot(dx,dy)<.001)return false;
    const duration=Math.min(145,Math.max(80,(Number(interval)||180)*.7));
    this.shot={remaining:duration,duration,facing:facing(dx,dy)};
    this.aim={remaining:clamp(Number(interval)||180,80,1000)+50,facing:this.shot.facing};return true;
  }
  beginActionRelease(){this.actionStart=this.clock;this.wasAction=true;}
  sample({now,player,dx=0,dy=0,hurt=false,action=false,actionFacing=null,frozen=false}){
    const elapsed=this.lastNow===null?0:Math.max(0,now-this.lastNow);
    // Active run time already excludes pause; do not discard slow-frame recovery time.
    const dt=elapsed;this.lastNow=now;
    if(frozen&&this.pose)return this.pose;
    this.clock+=dt;if(this.shot)this.shot.remaining-=dt;
    if(this.aim&&(this.aim.remaining-=dt)<=0)this.aim=null;
    if(action&&!this.wasAction)this.actionStart=this.clock;
    this.wasAction=action;
    if(this.shot?.remaining<=0)this.shot=null;
    this.facing=coherentFacing(this.facing,dx,dy);
    if(action&&['down','left','right','up'].includes(actionFacing))this.facing=actionFacing;
    else if(this.aim&&!hurt)this.facing=this.aim.facing;
    const legFacing=coherentFacing(this.feet.footDirection??this.facing,dx,dy);
    const moving=Math.hypot(dx,dy)>.05;
    advanceFeet(this.feet,player,dx,dy,dt,legFacing,{restFoot:rest,stride:RUN_STRIDE,stance:RUN_STANCE,lift:3.3});
    for(const foot of this.feet.feet)if(foot.contact)foot.lift=0;
    this.hairSway=advanceMovementLag(this.hairSway,dx,elapsed,{gain:-1.35,limit:5,responseMs:180});
    this.pose=buildGenyaPose({root:{x:player.x,y:player.y},facing:this.facing,legFacing,
      state:hurt?'hurt':action?'action':this.shot?'attack':moving?'walk':'idle',
      clock:this.clock,phase:this.feet.phase,feet:this.feet.feet.map(f=>({...f})),hairSway:this.hairSway,
      gait:sampleRunPosture(this.feet,legFacing,.95),
      actionProgress:clamp((this.clock-this.actionStart)/260,0,1),
      shotWeight:this.shot?basicShotReleaseWeight(this.shot.remaining,this.shot.duration):0,
      aimWeight:layeredAimWeight(this.aim?.remaining),
      blink:(this.clock%3500)>3360});
    return this.pose;
  }
}

export function buildGenyaPose(input){
  const p={...input},root={...input.root},legFacing=p.legFacing??p.facing;
  const side=p.facing==='left'||p.facing==='right',legSide=legFacing==='left'||legFacing==='right';
  const sign=p.facing==='left'?-1:1,legSign=legFacing==='left'?-1:1,defeat=clamp(p.defeat||0,0,1);
  p.state=defeat?'defeat':p.state;p.legFacing=legFacing;
  const gait=p.state==='hurt'||p.state==='action'||defeat?sampleRunPosture({},legFacing)
    :p.gait??sampleRunPosture({phase:p.phase,gaitWeight:p.state==='walk'?1:0},legFacing,.95);
  p.gait=gait;
  const feet=p.feet??feetAt(root,legFacing);let pelvis=root.y+7+gait.bodyY;
  feet.forEach((f,i)=>{const dx=f.x-(root.x+(i?1:-1)*(legSide?1.3:3.2));
    pelvis=Math.max(pelvis,f.y-f.lift-4-Math.sqrt(Math.max(1,15.58**2-dx**2)));});
  pelvis+=defeat*7;
  const bodyY=pelvis-(root.y+7)+Math.sin((p.clock||0)/950)*.18;
  const bodyX=(p.state==='hurt'?-1:0)+defeat*4.5;
  const action=sampleLayeredActionMotion('genya',p);
  const bodyAngle=action.bodyAngle+(p.state==='hurt'?4:0)+defeat*23+gait.lean;
  const parts=[],push=(name,part,x,y,width,height,angle=0,originY=.5,order=0,view=p.facing)=>{
    parts.push({name,frame:view+'/'+part,x:root.x+x,y:root.y+y,width,height,angle,originY,order});};
  const legs=feet.map((f,i)=>{
    const hip={x:root.x+(i?1:-1)*(legSide?1.3:3.2),y:pelvis},ankle={x:f.x,y:f.y-f.lift-4};
    const rawLeg=solveLeg(hip,ankle,7.8,7.8,legSide?legSign:(i?-1:1));
    const leg=projectLegForView(rawLeg,legFacing,7.8,7.8);
    const bone=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI-90,label=i?'R':'L',order=legSide?(i?3:1):i+1;
    push('thigh'+label,'thigh'+label,hip.x-root.x,hip.y-root.y,6.2,9.7*leg.upperScale,bone(hip,leg.knee),.08,order,legFacing);
    push('shin'+label,'shin'+label,leg.knee.x-root.x,leg.knee.y-root.y,5.8,9.7*leg.lowerScale,bone(leg.knee,leg.ankle),.08,order+.1,legFacing);
    push('boot'+label,'boot'+label,f.x-root.x,f.y-root.y-f.lift,legSide?7.8:6.4,5,defeat*3+runSoleAngle(f,p.phase??0,i,legFacing,RUN_STANCE,gait.weight),1,order+.2,legFacing);return rawLeg;
  });
  const swing=p.state==='walk'||p.state==='attack'?gait.armSwing*11:Math.sin((p.clock||0)/1100)*.8;
  const arms=sampleLayeredArmMotion(p,swing);
  for(let i=0;i<2;i++){
    const label=i?'R':'L',s=i?1:-1,armX=side?s*2.5:s*8.6;
    const gesture=i?action.right:action.left;
    const shoulder=rotate(armX,-3.5,bodyAngle);
    const angle=(i?arms.right:arms.left)+gesture+(i?arms.reach:0)+bodyAngle,x=shoulder.x+bodyX,y=-8.5+bodyY+shoulder.y,rad=angle*Math.PI/180;
    push('upperArm'+label,'upperArm'+label,x,y,side?6.3:7.1,10.2,angle,.1,side?(i?8:0):4);
    push('forearm'+label,'forearm'+label,x-Math.sin(rad)*8.3,y+Math.cos(rad)*8.3,6.3,9.8,angle-3*s+(i?arms.rightElbow+action.rightElbow:arms.leftElbow+action.leftElbow),.1,side?(i?8.1:.1):4.1);
  }
  push('skirt','skirt',bodyX,7+bodyY,legSide?19:25,11,bodyAngle*.3,.5,5,legFacing);
  push('torso','torso',bodyX,-8.5+bodyY,side?18.5:23,20,bodyAngle,.5,6);
  const headAngle=bodyAngle*.3,neck=rotate(0,-8,bodyAngle),head=rotate(0,-15.5,headAngle);
  const headX=bodyX+neck.x+head.x,headY=-8.5+bodyY+neck.y+head.y,hair=rotate(0,.5,headAngle);
  push('hairCap','hairCap',headX+hair.x,headY+hair.y,side?29:30,32,headAngle,.5,3.7);
  for(let i=0;i<2;i++){
    const s=i?1:-1,label=i?'R':'L',idle=Math.sin((p.clock||0)/820+i)*.9;
    const anchor=rotate(s*(side?12:14.2),3,headAngle);
    push('tail'+label,'tail'+label,headX+anchor.x,headY+anchor.y,side?12:13.5,39,
      (p.hairSway||0)+s*idle+bodyAngle*.45,.12,side?(i?.6:.4):.5);
  }
  const face=defeat>.1?'closedFace':p.state==='hurt'?'hurtFace':p.blink?'closedFace':'face';
  push('face',face,headX,headY,side?28:30,31,headAngle,.5,7);
  p.parts=parts.sort((a,b)=>a.order-b.order);p.legs=legs;p.feet=feet;p.root=root;return p;
}

export class GenyaLayeredPresentation{
  constructor(scene){
    this.scene=scene;this.motion=new GenyaMotion(scene.player);this.disposed=false;this.nodes=new Map();
    this.turn=new LayeredPoseTransition();this.seams=new LayeredSeamMeshes(scene,GENYA_ART.key,null,LAYERED_KNEE_CONTOURS.genya);
    this.oblique=hasLayeredOblique(scene,'genya')?new LayeredObliqueController():null;
    this.shadow=scene.add.ellipse(scene.player.x,scene.player.y+26,19,5,0x20302C,.16);
    const pose=this.motion.sample({now:0,player:scene.player});
    for(const p of pose.parts)this.nodes.set(p.name,scene.add.image(p.x,p.y,GENYA_ART.key,p.frame));
    this.upper=this.nodes.get('face');this.depth=9.8;this.render(pose,1);
  }
  beginShot(...args){
    const accepted=!this.disposed&&this.motion.beginShot(...args);
    if(accepted)this.oblique?.beginShot(args[1],args[2],args[3]);return accepted;
  }
  beginActionRelease(){if(!this.disposed)this.motion.beginActionRelease();}
  update(now,dx,dy,{frozen=false,hurt=false,action=false,actionFacing=null}={}){
    if(this.disposed)return;
    const pose=this.motion.sample({now,player:this.scene.player,dx,dy,frozen,hurt,action,actionFacing});
    if(!frozen)this.render(this.oblique?this.oblique.sample(pose,dx,dy,actionFacing):pose,this.scene.playerGfx?.alpha??1);
  }
  render(pose,alpha=1){
    if(this.disposed)return;this.pose=pose;
    alpha=layeredActorAlpha(this.scene.player,alpha);
    this.displayPose=this.turn.sample(bindLayeredUpperBody(this.oblique?applyObliquePose(pose,buildGenyaPose,'genya'):pose,LAYERED_UPPER_CONTOURS.genya));
    for(const p of this.displayPose.parts)setLayeredPartFrame(this.nodes.get(p.name),p,GENYA_ART.key).setOrigin(.5,p.originY)
      .setDisplaySize(p.width,p.height).setPosition(p.x,p.y).setAngle(p.angle).setAlpha(alpha)
      .setTint(pose.state==='hurt'?0xE8D6F4:0xFFFFFF).setDepth(this.depth+p.order*.000001);
    this.seams.render(this.displayPose,this.nodes,this.depth,alpha,pose.state==='hurt'?0xE8D6F4:0xFFFFFF);
    this.shadow.setPosition(pose.root.x,pose.root.y+26).setDepth(this.depth-.00001).setAlpha(.16*alpha);
  }
  setWorldDepth(depth){this.depth=depth;if(this.pose)this.render(this.pose,this.upper.alpha);}
  captureDefeat(){return this.pose?{genya:true,pose:{...structuredClone(this.pose),presentationSeed:structuredClone(this.displayPose)}}:null;}
  destroy(){if(this.disposed)return;this.disposed=true;this.seams.destroy();for(const node of this.nodes.values())node.destroy();this.nodes.clear();this.shadow.destroy();}
}
