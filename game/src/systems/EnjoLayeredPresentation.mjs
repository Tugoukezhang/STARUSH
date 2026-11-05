import {advanceFeet,advanceMovementLag,coherentFacing,solveLeg,projectLegForView,sampleRunPosture,runSoleAngle} from './SakuraFootMotion.mjs';
import {LayeredPoseTransition,LayeredSeamMeshes,layeredActorAlpha,bindLayeredUpperBody} from './LayeredPoseTransition.mjs';
import {LAYERED_UPPER_CONTOURS} from '../utils/layeredUpperContours.mjs';
import {LAYERED_KNEE_CONTOURS} from '../utils/layeredKneeContours.mjs';
import {preloadLayeredOblique,hasLayeredOblique,LayeredObliqueController,applyObliquePose,setLayeredPartFrame} from './LayeredObliquePresentation.mjs';
import {basicShotReleaseWeight} from './PerformerShotFeedback.mjs';
import {layeredAimWeight,sampleLayeredArmMotion} from './LayeredArmMotion.mjs';
import {sampleLayeredActionMotion} from './LayeredActionMotion.mjs';

export const ENJO_ART=Object.freeze({id:'enjo',key:'enjo-layered-20261007',
  rigKey:'enjo-layered-rig-20261007',image:'art/enjo-unified-20261012/enjo-parts.webp',
  data:'art/enjo-unified-20261012/enjo-parts.json'});
const TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Longer visual cycle, same 11.6px planted travel and IK reach.
const RUN_STRIDE=84,RUN_STANCE=11.6/RUN_STRIDE;
const rest=(p,d,i)=>({x:p.x+(i?1:-1)*(d==='left'||d==='right'?1.7:4.2),y:p.y+26});
const feetAt=(p,d)=>[0,1].map(i=>({...rest(p,d,i),contact:true,lift:0,plantId:0,cycle:null}));
const facing=(dx,dy)=>Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
const rotate=(x,y,angle)=>{const r=angle*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
export function preloadEnjoLayered(scene){
  if(!scene.load?.atlas||!scene.load?.json)return false;
  scene.load.atlas(ENJO_ART.key,ENJO_ART.image,ENJO_ART.data);
  scene.load.json(ENJO_ART.rigKey,ENJO_ART.data);preloadLayeredOblique(scene,'enjo');return true;
}
export function hasEnjoLayered(scene){return scene.textures?.exists(ENJO_ART.key)===true
  &&scene.cache?.json?.get(ENJO_ART.rigKey)?.rig?.identity==='enjo';}

// Enjo's short-pants/high-top bind and burst pose own no gameplay clocks.
export class EnjoMotion{
  constructor(player){
    this.facing='down';this.clock=0;this.lastNow=null;this.shot=null;this.aim=null;this.pose=null;
    this.feet={feet:feetAt(player,'down'),mode:'idle',phase:0,travel:0,stopTime:0};
    this.balance=0;this.wasAction=false;this.actionStart=0;
  }
  beginShot(now,dx,dy,interval){
    if(!Number.isFinite(now+dx+dy)||Math.hypot(dx,dy)<.001)return false;
    const duration=Math.min(140,Math.max(80,(Number(interval)||180)*.65));
    this.shot={remaining:duration,duration,facing:facing(dx,dy)};
    this.aim={remaining:clamp(Number(interval)||180,80,1000)+50,facing:this.shot.facing};return true;
  }
  sample({now,player,dx=0,dy=0,hurt=false,action=false,actionFacing=null,frozen=false}){
    const elapsed=this.lastNow===null?0:Math.max(0,now-this.lastNow);
    // Active run time already excludes pause; do not discard slow-frame recovery time.
    const dt=elapsed;this.lastNow=now;
    if(frozen&&this.pose)return this.pose;
    this.clock+=dt;if(this.shot)this.shot.remaining-=dt;
    if(this.aim&&(this.aim.remaining-=dt)<=0)this.aim=null;
    if(action&&!this.wasAction)this.actionStart=this.clock;
    this.wasAction=action;if(this.shot?.remaining<=0)this.shot=null;
    this.facing=coherentFacing(this.facing,dx,dy);
    if(action&&['down','left','right','up'].includes(actionFacing))this.facing=actionFacing;
    else if(this.aim&&!hurt)this.facing=this.aim.facing;
    const legFacing=coherentFacing(this.feet.footDirection??this.facing,dx,dy);
    const moving=Math.hypot(dx,dy)>.05;
    advanceFeet(this.feet,player,dx,dy,dt,legFacing,{restFoot:rest,stride:RUN_STRIDE,stance:RUN_STANCE,lift:2.8});
    for(const foot of this.feet.feet)if(foot.contact)foot.lift=0;
    this.balance=advanceMovementLag(this.balance,dx,elapsed,{gain:1.15,limit:6,responseMs:140});
    this.pose=buildEnjoPose({root:{x:player.x,y:player.y},facing:this.facing,legFacing,
      state:hurt?'hurt':action?'action':this.shot?'attack':moving?'walk':'idle',
      clock:this.clock,phase:this.feet.phase,feet:this.feet.feet.map(f=>({...f})),balance:this.balance,
      gait:sampleRunPosture(this.feet,legFacing,1.15),
      actionProgress:clamp((this.clock-this.actionStart)/260,0,1),
      shotWeight:this.shot?basicShotReleaseWeight(this.shot.remaining,this.shot.duration):0,
      aimWeight:layeredAimWeight(this.aim?.remaining),
      blink:(this.clock%3600)>3480});
    return this.pose;
  }
}

export function buildEnjoPose(input){
  const p={...input},root={...input.root},legFacing=p.legFacing??p.facing;
  const side=p.facing==='left'||p.facing==='right',legSide=legFacing==='left'||legFacing==='right';
  const sign=p.facing==='left'?-1:1,legSign=legFacing==='left'?-1:1,defeat=clamp(p.defeat||0,0,1);
  p.state=defeat?'defeat':p.state;p.legFacing=legFacing;
  const gait=p.state==='hurt'||p.state==='action'||defeat?sampleRunPosture({},legFacing)
    :p.gait??sampleRunPosture({phase:p.phase,gaitWeight:p.state==='walk'?1:0},legFacing,1.15);
  p.gait=gait;
  const feet=p.feet??feetAt(root,legFacing);let pelvis=root.y+5.12+gait.bodyY;
  feet.forEach((f,i)=>{const dx=f.x-(root.x+(i?1:-1)*(legSide?1.7:4.2));
    pelvis=Math.max(pelvis,f.y-f.lift-5-Math.sqrt(Math.max(1,15.88**2-dx**2)));});
  pelvis+=defeat*5.8;
  const action=sampleLayeredActionMotion('enjo',p);
  const bodyY=pelvis-(root.y+5.12)+Math.sin((p.clock||0)/820)*.22+action.bodyY;
  const bodyX=(p.state==='hurt'?-1.2:0)+defeat*3.7;
  const bodyAngle=action.bodyAngle+(p.state==='hurt'?5.5:0)+defeat*22+gait.lean;
  const parts=[],push=(name,part,x,y,width,height,angle=0,originY=.5,order=0,view=p.facing)=>{
    parts.push({name,frame:view+'/'+part,x:root.x+x,y:root.y+y,width,height,angle,originY,order});};
  const legs=feet.map((f,i)=>{
    const hip={x:root.x+(i?1:-1)*(legSide?1.7:4.2),y:pelvis},ankle={x:f.x,y:f.y-f.lift-5};
    const rawLeg=solveLeg(hip,ankle,8.4,7.5,legSide?legSign:(i?-1:1));
    const leg=projectLegForView(rawLeg,legFacing,8.4,7.5);
    const bone=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI-90,label=i?'R':'L',order=legSide?(i?3:1):i+1;
    push('thigh'+label,'thigh'+label,hip.x-root.x,hip.y-root.y,legSide?7.6:8.8,9.8*leg.upperScale,bone(hip,leg.knee),.08,order,legFacing);
    push('shin'+label,'shin'+label,leg.knee.x-root.x,leg.knee.y-root.y,legSide?4.8:5.2,9.4*leg.lowerScale,bone(leg.knee,leg.ankle),.08,order+.1,legFacing);
    push('boot'+label,'boot'+label,f.x-root.x,f.y-root.y-f.lift,legSide?9.6:8.2,6.4,defeat*2+runSoleAngle(f,p.phase??0,i,legFacing,RUN_STANCE,gait.weight),1,order+.2,legFacing);return rawLeg;
  });
  const swing=p.state==='walk'||p.state==='attack'?gait.armSwing*15:Math.sin((p.clock||0)/970)*1.1;
  const arms=sampleLayeredArmMotion(p,swing);
  for(let i=0;i<2;i++){
    const label=i?'R':'L',s=i?1:-1,armX=side?-sign*4:s*9.4;
    const shoulder=rotate(armX,-5.6,bodyAngle);
    const gesture=(i?action.right:action.left)+(i?arms.reach:0);
    const angle=(i?arms.right:arms.left)+gesture+bodyAngle,x=shoulder.x+bodyX,y=-8.4+bodyY+shoulder.y;
    const r=angle*Math.PI/180,foreAngle=angle+(i?arms.rightElbow+action.rightElbow:arms.leftElbow+action.leftElbow);
    push('upperArm'+label,'upperArm'+label,x,y,7.8,11.4,angle,.1,side?(i?8:0):4);
    push('forearm'+label,'forearm'+label,x-Math.sin(r)*9.1,y+Math.cos(r)*9.1,6.8,10.2,foreAngle,.1,side?(i?8.1:.1):4.1);
  }
  push('pelvis','pelvis',0,4.8+bodyY,legSide?16:22,6.6,0,.5,5,legFacing);
  push('torso','torso',bodyX,-8.4+bodyY,side?19.5:24.5,20.8,bodyAngle,.5,6);
  const neck=rotate(0,-22,bodyAngle);
  const headX=bodyX+neck.x*.55,headY=-30.5+bodyY+neck.y+22;
  push('hairCap','hairCap',headX,headY+.3,side?30:32,32.5,bodyAngle*.28+(p.balance||0)*.1,.5,3.7);
  const face=defeat>.1?'closedFace':p.state==='hurt'?'hurtFace':p.blink?'closedFace':'face';
  push('face',face,headX,headY,side?30:32,31.5,bodyAngle*.28,.5,7);
  p.parts=parts.sort((a,b)=>a.order-b.order);p.legs=legs;p.feet=feet;p.root=root;return p;
}

export class EnjoLayeredPresentation{
  constructor(scene){
    this.scene=scene;this.motion=new EnjoMotion(scene.player);this.disposed=false;this.nodes=new Map();
    this.turn=new LayeredPoseTransition();this.seams=new LayeredSeamMeshes(scene,ENJO_ART.key,null,LAYERED_KNEE_CONTOURS.enjo);
    this.oblique=hasLayeredOblique(scene,'enjo')?new LayeredObliqueController():null;
    this.shadow=scene.add.ellipse(scene.player.x,scene.player.y+26,20,5.2,0x20302C,.16);
    const pose=this.motion.sample({now:0,player:scene.player});
    for(const p of pose.parts)this.nodes.set(p.name,scene.add.image(p.x,p.y,ENJO_ART.key,p.frame));
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
    if(this.disposed)return;this.pose=pose;
    alpha=layeredActorAlpha(this.scene.player,alpha);
    this.displayPose=this.turn.sample(bindLayeredUpperBody(this.oblique?applyObliquePose(pose,buildEnjoPose,'enjo'):pose,LAYERED_UPPER_CONTOURS.enjo));
    for(const p of this.displayPose.parts)setLayeredPartFrame(this.nodes.get(p.name),p,ENJO_ART.key).setOrigin(.5,p.originY)
      .setDisplaySize(p.width,p.height).setPosition(p.x,p.y).setAngle(p.angle).setAlpha(alpha)
      .setTint(pose.state==='hurt'?0xF2E2DA:0xFFFFFF).setDepth(this.depth+p.order*.000001);
    this.seams.render(this.displayPose,this.nodes,this.depth,alpha,pose.state==='hurt'?0xF2E2DA:0xFFFFFF);
    this.shadow.setPosition(pose.root.x,pose.root.y+26).setDepth(this.depth-.00001).setAlpha(.16*alpha);
  }
  setWorldDepth(depth){this.depth=depth;if(this.pose)this.render(this.pose,this.upper.alpha);}
  captureDefeat(){return this.pose?{enjo:true,pose:{...structuredClone(this.pose),presentationSeed:structuredClone(this.displayPose)}}:null;}
  destroy(){if(this.disposed)return;this.disposed=true;this.seams.destroy();for(const node of this.nodes.values())node.destroy();this.nodes.clear();this.shadow.destroy();}
}
