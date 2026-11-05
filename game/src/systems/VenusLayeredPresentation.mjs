import {advanceFeet,advanceMovementLag,coherentFacing,solveLeg,projectLegForView,sampleRunPosture,runSoleAngle} from './SakuraFootMotion.mjs';
import {LayeredPoseTransition,LayeredSeamMeshes,layeredActorAlpha,bindLayeredUpperBody} from './LayeredPoseTransition.mjs';
import {LAYERED_UPPER_CONTOURS} from '../utils/layeredUpperContours.mjs';
import {LAYERED_KNEE_CONTOURS} from '../utils/layeredKneeContours.mjs';
import {preloadLayeredOblique,hasLayeredOblique,LayeredObliqueController,applyObliquePose,setLayeredPartFrame} from './LayeredObliquePresentation.mjs';
import {basicShotReleaseWeight} from './PerformerShotFeedback.mjs';
import {layeredAimWeight,sampleLayeredArmMotion} from './LayeredArmMotion.mjs';
import {sampleLayeredActionMotion} from './LayeredActionMotion.mjs';

export const VENUS_ART=Object.freeze({id:'venus',key:'venus-layered-20261006',
  rigKey:'venus-layered-rig-20261006',image:'art/venus-unified-20261012/venus-parts.webp',
  data:'art/venus-unified-20261012/venus-parts.json'});
// Measured opaque shirt hems in our eight drawings, excluding the hanging ornament.
export const VENUS_WAIST_HEMS=Object.freeze({
  'down/torso':.813,'left/torso':.806,'up/torso':.949,'right/torso':.926,
  'down-left/torso':.803,'down-right/torso':.803,'up-left/torso':.976,'up-right/torso':.976
});
const TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Longer visual cycle, same 11.52px planted travel and IK reach.
const RUN_STRIDE=96,RUN_STANCE=11.52/RUN_STRIDE;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const rest=(p,d,i)=>({x:p.x+(i?1:-1)*(d==='left'||d==='right'?1.4:3.5),y:p.y+26});
const feetAt=(p,d)=>[0,1].map(i=>({...rest(p,d,i),contact:true,lift:0,plantId:0,cycle:null}));
const facing=(dx,dy)=>Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
const rotate=(x,y,angle)=>{const r=angle*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
export function preloadVenusLayered(scene){
  if(!scene.load?.atlas||!scene.load?.json)return false;
  scene.load.atlas(VENUS_ART.key,VENUS_ART.image,VENUS_ART.data);
  scene.load.json(VENUS_ART.rigKey,VENUS_ART.data);preloadLayeredOblique(scene,'venus');return true;
}
export function hasVenusLayered(scene){
  return scene.textures?.exists(VENUS_ART.key)===true
    && scene.cache?.json?.get(VENUS_ART.rigKey)?.rig?.identity==='venus';
}

// Own bind, cadence and artwork. Only the already-tested contact/IK mathematics is shared.
export class VenusMotion{
  constructor(player){
    this.facing='down';this.clock=0;this.lastNow=null;this.shot=null;this.aim=null;this.pose=null;
    this.feet={feet:feetAt(player,'down'),mode:'idle',phase:0,travel:0,stopTime:0};
    this.sway=0;this.wasAction=false;this.actionStart=0;
  }
  beginShot(now,dx,dy,interval){
    if(!Number.isFinite(now+dx+dy)||Math.hypot(dx,dy)<.001)return false;
    const duration=Math.min(150,Math.max(75,(Number(interval)||180)*.7));
    this.shot={remaining:duration,duration,facing:facing(dx,dy)};
    // Display-only grace bridges shot gaps; attack and foot clocks still release normally.
    this.aim={remaining:clamp(Number(interval)||180,80,1000)+50,facing:this.shot.facing};
    return true;
  }
  sample({now,player,dx=0,dy=0,hurt=false,action=false,actionFacing=null,frozen=false}){
    const elapsed=this.lastNow===null?0:Math.max(0,now-this.lastNow);
    // Active run time already excludes pause; do not discard slow-frame recovery time.
    const dt=elapsed;this.lastNow=now;
    if(frozen&&this.pose)return this.pose;
    this.clock+=dt;if(this.shot)this.shot.remaining-=dt;
    if(action&&!this.wasAction)this.actionStart=this.clock;
    this.wasAction=action;
    if(this.aim&&(this.aim.remaining-=dt)<=0)this.aim=null;
    if(this.shot?.remaining<=0)this.shot=null;
    const moving=Math.hypot(dx,dy)>.05;
    this.facing=coherentFacing(this.facing,dx,dy);
    if(action&&['down','left','right','up'].includes(actionFacing))this.facing=actionFacing;
    else if(this.aim&&!hurt)this.facing=this.aim.facing;
    // Locomotion faces movement; aim never replants a standing foot.
    const legFacing=coherentFacing(this.feet.footDirection??this.facing,dx,dy);
    advanceFeet(this.feet,player,dx,dy,dt,legFacing,{restFoot:rest,stride:RUN_STRIDE,stance:RUN_STANCE,lift:3.6});
    for(const foot of this.feet.feet)if(foot.contact)foot.lift=0;
    this.sway=advanceMovementLag(this.sway,dx,elapsed,{gain:.12,limit:1.1,responseMs:110});
    const state=hurt?'hurt':action?'action':this.shot?'attack':moving?'walk':'idle';
    this.pose=buildVenusPose({root:{x:player.x,y:player.y},facing:this.facing,legFacing,state,
      clock:this.clock,phase:this.feet.phase,feet:this.feet.feet.map(f=>({...f})),sway:this.sway,
      gait:sampleRunPosture(this.feet,legFacing,.85),
      actionProgress:clamp((this.clock-this.actionStart)/260,0,1),
      shotWeight:this.shot?basicShotReleaseWeight(this.shot.remaining,this.shot.duration):0,
      aimWeight:layeredAimWeight(this.aim?.remaining),
      blink:(this.clock%3300)>3160});
    return this.pose;
  }
}

export function buildVenusPose(input){
  const p={...input},root={...input.root},legFacing=p.legFacing??p.facing;
  const side=p.facing==='left'||p.facing==='right',legSide=legFacing==='left'||legFacing==='right';
  const sign=p.facing==='left'?-1:1,legSign=legFacing==='left'?-1:1,defeat=clamp(p.defeat||0,0,1);
  p.state=defeat?'defeat':p.state;p.legFacing=legFacing;
  const gait=p.state==='hurt'||p.state==='action'||defeat?sampleRunPosture({},legFacing)
    :p.gait??sampleRunPosture({phase:p.phase,gaitWeight:p.state==='walk'?1:0},legFacing,.85);
  p.gait=gait;
  const feet=p.feet??feetAt(root,legFacing);
  let pelvis=root.y+7+gait.bodyY;
  feet.forEach((f,i)=>{
    const x=root.x+(i?1:-1)*(legSide?1.4:3.5),dx=f.x-x;
    pelvis=Math.max(pelvis,f.y-f.lift-4-Math.sqrt(Math.max(1,14.98**2-dx**2)));
  });
  pelvis+=defeat*8;
  const offset=pelvis-(root.y+7),breathe=Math.sin((p.clock||0)/900)*.22;
  const action=sampleLayeredActionMotion('venus',p);
  const bodyY=offset+breathe+defeat*2,bodyX=(p.state==='hurt'?-1.1:0)+defeat*5;
  const bodyAngle=action.bodyAngle+(p.state==='hurt'?4:0)+defeat*24+gait.lean;
  const parts=[],push=(name,part,x,y,width,height,angle=0,originY=.5,order=0,view=p.facing)=>{
    parts.push({name,frame:view+'/'+part,x:root.x+x,y:root.y+y,width,height,angle,originY,order});
  };
  const legs=feet.map((f,i)=>{
    const hip={x:root.x+(i?1:-1)*(legSide?1.4:3.5),y:pelvis};
    const ankle={x:f.x,y:f.y-f.lift-4};
    const rawLeg=solveLeg(hip,ankle,7.5,7.5,legSide?legSign:(i?-1:1));
    const leg=projectLegForView(rawLeg,legFacing,7.5,7.5);
    const bone=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI-90;
    const label=i?'R':'L',order=legSide?(i?3:1):i+1;
    push('thigh'+label,'thigh'+label,hip.x-root.x,hip.y-root.y,6.2,9.5*leg.upperScale,bone(hip,leg.knee),.08,order,legFacing);
    push('shin'+label,'shin'+label,leg.knee.x-root.x,leg.knee.y-root.y,5.8,9.5*leg.lowerScale,bone(leg.knee,leg.ankle),.08,order+.1,legFacing);
    push('boot'+label,'boot'+label,f.x-root.x,f.y-root.y-f.lift,legSide?8.0:6.5,4.8,defeat*4+runSoleAngle(f,p.phase??0,i,legFacing,RUN_STANCE,gait.weight),1,order+.2,legFacing);
    return rawLeg;
  });
  const swing=p.state==='walk'||p.state==='attack'?gait.armSwing*12:Math.sin((p.clock||0)/1000)*1.2;
  const arms=sampleLayeredArmMotion(p,swing);
  for(let i=0;i<2;i++){
    const label=i?'R':'L',s=i?1:-1,armX=side?s*2.6:s*9;
    const attack=(i?action.right:action.left)+(i?arms.reach:0);
    const shoulder=rotate(armX,-3.5,bodyAngle);
    const angle=(i?arms.right:arms.left)+attack+bodyAngle,x=shoulder.x+bodyX,shoulderY=-8.5+bodyY+shoulder.y;
    push('upperArm'+label,'upperArm'+label,x,shoulderY,side?6.5:7.3,10.6,angle,.1,side?(i?8:0):4);
    const rad=angle*Math.PI/180,elbowX=x-Math.sin(rad)*8.6;
    const elbowY=shoulderY+Math.cos(rad)*8.6;
    push('forearm'+label,'forearm'+label,elbowX,elbowY,6.5,10.2,angle-4*s+(i?arms.rightElbow+action.rightElbow:arms.leftElbow+action.leftElbow),.1,side?(i?8.1:.1):4.1);
  }
  push('skirt','skirt',bodyX,7+bodyY,legSide?20:26,12,bodyAngle*.35,.5,5,legFacing);
  push('torso','torso',bodyX,-8.5+bodyY,side?19:24,19,bodyAngle,.5,6);
  const hairAngle=bodyAngle*.35+(p.sway||0)*1.5;
  const headAngle=bodyAngle*.3,neck=rotate(0,-8,bodyAngle),head=rotate(0,-15.5,headAngle);
  const headX=bodyX+neck.x+head.x,headY=-8.5+bodyY+neck.y+head.y,hair=rotate(0,1,headAngle);
  push('backHair','backHair',headX+hair.x,headY+hair.y,side?29:32,33,hairAngle,.5,side?6.5:3.5);
  const face=p.state==='hurt'?'hurtFace':defeat>.1||p.blink?'closedFace':'face';
  push('face',face,headX,headY,side?28:30,31,headAngle,.5,7);
  p.parts=parts.sort((a,b)=>a.order-b.order);p.legs=legs;p.feet=feet;p.root=root;
  return p;
}

export class VenusLayeredPresentation{
  constructor(scene){
    this.scene=scene;this.motion=new VenusMotion(scene.player);this.disposed=false;
    this.turn=new LayeredPoseTransition();this.seams=new LayeredSeamMeshes(scene,VENUS_ART.key,VENUS_WAIST_HEMS,LAYERED_KNEE_CONTOURS.venus);
    this.oblique=hasLayeredOblique(scene,'venus')?new LayeredObliqueController():null;
    this.nodes=new Map();this.shadow=scene.add.ellipse(scene.player.x,scene.player.y+26,19,5,0x20302C,.16);
    const pose=this.motion.sample({now:0,player:scene.player});
    for(const part of pose.parts)this.nodes.set(part.name,scene.add.image(part.x,part.y,VENUS_ART.key,part.frame));
    this.upper=this.nodes.get('face');this.depth=9.8;this.render(pose,1);
  }
  beginShot(...args){
    const accepted=!this.disposed&&this.motion.beginShot(...args);
    if(accepted)this.oblique?.beginShot(args[1],args[2],args[3]);return accepted;
  }
  update(now,dx,dy,{frozen=false,hurt=false,action=false,actionFacing=null}={}){
    if(this.disposed)return;
    const pose=this.motion.sample({now,player:this.scene.player,dx,dy,frozen,hurt,action,actionFacing});
    if(!frozen)this.render(this.oblique?this.oblique.sample(pose,dx,dy,actionFacing):pose,this.scene.playerGfx?.alpha??1);
  }
  render(pose,alpha=1){
    if(this.disposed)return;
    alpha=layeredActorAlpha(this.scene.player,alpha);
    this.pose=pose;
    this.displayPose=this.turn.sample(bindLayeredUpperBody(this.oblique?applyObliquePose(pose,buildVenusPose,'venus'):pose,LAYERED_UPPER_CONTOURS.venus));
    for(const p of this.displayPose.parts)setLayeredPartFrame(this.nodes.get(p.name),p,VENUS_ART.key).setOrigin(.5,p.originY)
      .setDisplaySize(p.width,p.height).setPosition(p.x,p.y).setAngle(p.angle)
      .setAlpha(alpha).setTint(pose.state==='hurt'?0xFFD4DB:0xFFFFFF).setDepth(this.depth+p.order*.000001);
    this.seams.render(this.displayPose,this.nodes,this.depth,alpha,pose.state==='hurt'?0xFFD4DB:0xFFFFFF);
    this.shadow.setPosition(pose.root.x,pose.root.y+26).setDepth(this.depth-.00001).setAlpha(.16*alpha);
  }
  setWorldDepth(depth){this.depth=depth;if(this.pose)this.render(this.pose,this.upper.alpha);}
  captureDefeat(){return this.pose?{venus:true,pose:{...structuredClone(this.pose),presentationSeed:structuredClone(this.displayPose)}}:null;}
  destroy(){if(this.disposed)return;this.disposed=true;this.seams.destroy();for(const node of this.nodes.values())node.destroy();
    this.nodes.clear();this.shadow.destroy();}
}
