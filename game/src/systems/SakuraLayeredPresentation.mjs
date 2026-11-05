import {SAKURA_RIG_ATTACHMENTS} from './SakuraRigAttachments.mjs';
import {advanceFeet,coherentFacing,makeFeet,restFoot,solveLeg} from './SakuraFootMotion.mjs';
import {SAKURA_UPPER_HANDS} from './SakuraUpperRegistration.mjs';
import {advanceSakuraReaction,resolveSakuraUpperFrame} from './SakuraUpperMotion.mjs';
import {SAKURA_TURN_ART,advanceSakuraTurn} from './SakuraTurnMotion.mjs';
import {SAKURA_SECONDARY_ART,advanceSakuraSecondary,sakuraSecondaryVariant} from './SakuraSecondaryMotion.mjs';
import {SAKURA_SECONDARY_REGISTRATION} from './SakuraSecondaryRegistration.mjs';
import {PerformerBodyBalance,rotateUpperOffset} from './PerformerBodyBalance.mjs';
export {advanceSakuraSecondary} from './SakuraSecondaryMotion.mjs';
const BASE = 'art/sakura-secondary-20260922/';
export const SAKURA_LAYER_ART = Object.freeze({
  upper: Object.freeze({key:'sakura-attack-upper-20260922',path:`${BASE}attack-base.png`,frameWidth:256,frameHeight:256}),
});
export const SAKURA_MOTION_ART = Object.freeze({
  idle:Object.freeze({key:'sakura-idle-20260921',path:`${BASE}idle-base.png`,frameWidth:256,frameHeight:256}),
  legs:Object.freeze({key:'sakura-legs-20260921',path:'art/sakura-motion-20260921/leg-parts.png',frameWidth:128,frameHeight:128}),
  reaction:Object.freeze({key:'sakura-reaction-upper-20260922',path:`${BASE}reaction-base.png`,frameWidth:256,frameHeight:256}),
});
export const SAKURA_LAYER_SIZE = 88;
export const SAKURA_LAYER_ORIGIN_Y = 245/256-26/SAKURA_LAYER_SIZE;
const ROW = Object.freeze({down:0,left:1,right:2,up:3});
const VECTOR = Object.freeze({down:[0,1],left:[-1,0],right:[1,0],up:[0,-1]});
export const SAKURA_LAYER_HANDS = SAKURA_UPPER_HANDS;

export function sakuraUpperFrame(attack, direction='down') {
  return resolveSakuraUpperFrame(attack,direction);
}

export function sakuraPresentationHand(player, frame, bob=0) {
  const [x,y]=SAKURA_LAYER_HANDS[frame] ?? SAKURA_LAYER_HANDS[0];
  return {x:player.x+(x-128)*SAKURA_LAYER_SIZE/256,
    y:player.y+(y-245)*SAKURA_LAYER_SIZE/256+26+bob};
}

export class SakuraLayeredPresentation {
  constructor(scene) {
    this.scene=scene;this.disposed=false;this.lastNow=null;this.pausedShift={x:0,y:0};
    this.balance=new PerformerBodyBalance();
    this.state={clock:0,travel:0,phase:0,mode:'idle',movementDirection:'down',lowerDirection:'down',upperDirection:'down',
      lowerFrame:0,upperFrame:0,upperTexture:SAKURA_MOTION_ART.idle.key,moving:false,backpedal:false,bob:0,hurt:false,
      feet:makeFeet(scene.player,'down'),footDirection:'down',stopTime:0,reactionUntil:-1,lastHitId:0,lastHurt:false};
    this.legs=Array.from({length:6},()=>scene.add.image(scene.player.x,scene.player.y,SAKURA_MOTION_ART.legs.key,0).setDepth(9.8));
    const image=()=>scene.add.image(scene.player.x,scene.player.y,SAKURA_MOTION_ART.idle.key,0)
      .setDisplaySize(SAKURA_LAYER_SIZE,SAKURA_LAYER_SIZE)
      .setOrigin(.5,SAKURA_LAYER_ORIGIN_Y).setDepth(9.81);
    this.upper=image();this.upperBlend=image().setAlpha(0);
    this.secondaryNodes=Object.values(SAKURA_SECONDARY_ART).map((art,i)=>scene.add.image(scene.player.x,scene.player.y,art.key,0)
      .setOrigin(0,0).setDisplaySize(art.frameWidth*SAKURA_LAYER_SIZE/256,art.frameHeight*SAKURA_LAYER_SIZE/256).setDepth(9.812+i*.001));
    this.visualRoot={x:scene.player.x,y:scene.player.y};
    this.setWorldDepth(9.81);
  }

  setWorldDepth(depth) {
    if(this.disposed)return;
    this.legs.forEach((node,index)=>node.setDepth(depth-0.000008+index*0.000001));
    this.upper.setDepth(depth+0.000001);
    this.upperBlend.setDepth(depth+0.000001);
    this.secondaryNodes.forEach((node,index)=>node.setDepth(depth+0.000002+index*0.000001));
  }

  update(now,dx,dy,attack,frozen,hurt=false,hitId) {
    if(this.disposed)return;
    const s=this.state,elapsed=this.lastNow===null?0:Math.max(0,now-this.lastNow);
    const dt=Math.min(50,elapsed),turnDt=Math.min(160,elapsed);
    this.lastNow=now;
    if(frozen){this.balance.sample(now,0,0,s.phase,true);this.pausedShift.x+=dx;this.pausedShift.y+=dy;return;}
    if(this.pausedShift.x||this.pausedShift.y){
      for(const foot of [...s.feet,...(s.stopFeet||[])]){foot.x+=this.pausedShift.x;foot.y+=this.pausedShift.y;}
      this.pausedShift={x:0,y:0};
    }
    {
      // now is pause-aware; discrete reactions must not slow with the integration cap.
      s.clock+=elapsed;
      const reactionPose=advanceSakuraReaction(s,hurt,hitId);
      const distance=Math.hypot(dx,dy),moving=distance>.05;
      if(moving)s.movementDirection=coherentFacing(s.movementDirection,dx,dy);
      s.upperDirection=attack?.direction ?? (moving?s.movementDirection:s.upperDirection);
      const [ax,ay]=VECTOR[s.upperDirection];
      s.backpedal=!!attack && moving && (dx*ax+dy*ay)/distance<-.5;
      s.lowerDirection=s.upperDirection;
      const turn=advanceSakuraTurn(s,s.upperDirection,turnDt,!!attack||reactionPose!==null||!this.scene.textures?.exists(SAKURA_TURN_ART.key));
      s.visualDirection=turn.direction;
      const motion=advanceFeet(s,this.scene.player,dx,dy,dt,turn.direction);
      s.moving=moving;
      s.lowerFrame=ROW[s.lowerDirection]*6;
      const idleTime=s.clock%4300;
      const idlePose=idleTime>=3400&&idleTime<3540?2:idleTime<1600?0:idleTime<2900?1:3;
      // Damage never hides a committed fan action or interrupts gameplay; idle can flinch.
      s.upperTexture=attack?SAKURA_LAYER_ART.upper.key:reactionPose!==null?SAKURA_MOTION_ART.reaction.key:SAKURA_MOTION_ART.idle.key;
      s.upperFrame=attack?sakuraUpperFrame(attack,s.upperDirection):reactionPose!==null?ROW[s.upperDirection]*2+reactionPose:ROW[s.upperDirection]*4+idlePose;
      if(!attack&&reactionPose===null){
        s.upperTexture=turn.frame!==null?SAKURA_TURN_ART.key:SAKURA_MOTION_ART.idle.key;
        s.upperFrame=turn.frame??ROW[turn.direction]*4+idlePose;
      }
      s.bob=attack?0:motion.bob;
      const bodyWeight=attack?(attack.kind&&attack.kind!=='basic'?0:.35):reactionPose!==null?0:1;
      s.balanceAngle=this.balance.sample(now,dx,dy,s.phase,false,bodyWeight);
      advanceSakuraSecondary(s,dt,dx,dy,attack,s.turnYaw);
    }
    const p=this.scene.player,alpha=this.scene.playerGfx?.alpha ?? 1;
    const tint=s.hurt?0xFFD1D9:0xFFFFFF,row=ROW[s.visualDirection];
    const sideView=row===1||row===2;
    s.legGeometry=[];
    // Side-view shoes have an oblique ankle-to-sole vector, not a vertical one.
    const ankleAt=(foot,side)=>{
      const meta=SAKURA_RIG_ATTACHMENTS[row*6+side*3+2];
      const scale=5.8/(meta.tail[1]-meta.head[1]);
      return {x:foot.x-(meta.tail[0]-meta.head[0])*scale,y:foot.y-5.8-(foot.lift||0),scale};
    };
    const pelvisFor=feet=>Math.max(p.y,...feet.map((foot,side)=>{
      const ankle=ankleAt(foot,side),hx=p.x+(side?1:-1)*(sideView?1.6:3.8);
      return ankle.y-Math.sqrt(Math.max(1,19.8**2-(ankle.x-hx)**2));
    }));
    const restPelvisY=pelvisFor([0,1].map(side=>restFoot(p,s.visualDirection,side)));
    const pelvisY=Math.max(p.y+s.bob,pelvisFor(s.feet));
    this.visualRoot={x:p.x,y:p.y+(pelvisY-restPelvisY)};
    s.feet.forEach((foot,side)=>{
      const hip={x:p.x+(side?1:-1)*(sideView?1.6:3.8),y:pelvisY};
      const ankle=ankleAt(foot,side);
      const chain=solveLeg(hip,ankle,9.5,10.5,1);
      // Project the unequal-bone knee about the hip-ankle axis, not its midpoint.
      // Front/back flexion is in depth; the existing turn yaw owns the bend plane.
      const dx=chain.ankle.x-hip.x,dy=chain.ankle.y-hip.y;
      const along=((chain.knee.x-hip.x)*dx+(chain.knee.y-hip.y)*dy)/(dx*dx+dy*dy);
      const bx=hip.x+dx*along,by=hip.y+dy*along;
      const kx=chain.knee.x-bx,ky=chain.knee.y-by,plane=Math.sin(s.turnYaw*Math.PI/4);
      chain.knee={x:bx+kx*plane,y:by+ky*plane,
        z:Math.hypot(kx,ky)*Math.sqrt(Math.max(0,1-plane*plane))};
      s.legGeometry.push(chain);
      const points=[hip,chain.knee,ankle];
      for(let part=0;part<3;part++){
        const n=this.legs[side*3+part],meta=SAKURA_RIG_ATTACHMENTS[row*6+side*3+part];
        const start=points[part],end=points[part+1];
        const length=part===0?9.5:part===1?10.5:5.8;
        const projectedLength=part===2?length:Math.hypot(end.x-start.x,end.y-start.y);
        const rotation=part===2?0:Math.atan2(end.y-start.y,end.x-start.x)-Math.atan2(meta.tail[1]-meta.head[1],meta.tail[0]-meta.head[0]);
        n.setFrame(meta.frame).setOrigin(meta.head[0]/128,meta.head[1]/128)
          .setScale(part===2?ankle.scale:length/meta.length,part===2?ankle.scale:projectedLength/meta.length)
          .setPosition(start.x,start.y).setRotation(rotation).setAlpha(alpha).setTint(tint);
      }
    });
    // These are complete cels, not bone poses: alpha mixing duplicates the hands and face.
    this.upper.setTexture(s.upperTexture,s.upperFrame).setPosition(this.visualRoot.x,this.visualRoot.y)
      .setRotation(s.balanceAngle).setAlpha(alpha).setTint(tint);
    this.upperBlend.setAlpha(0);
    const registration=SAKURA_SECONDARY_REGISTRATION[s.upperTexture+':'+s.upperFrame],scale=SAKURA_LAYER_SIZE/256;
    for(const [i,part] of ['hair','hem'].entries()){
      const node=this.secondaryNodes[i],meta=registration?.[part];
      if(!meta){node.setAlpha(0);continue;}
      const offset=rotateUpperOffset((meta.x-128)*scale,(meta.y-SAKURA_LAYER_ORIGIN_Y*256)*scale,s.balanceAngle);
      node.setFrame(registration.global*5+sakuraSecondaryVariant(s.secondary?.[part]??0))
        .setPosition(this.visualRoot.x+offset.x,this.visualRoot.y+offset.y).setRotation(s.balanceAngle)
        .setAlpha(alpha).setTint(tint);
    }
  }

  handWorld(attack) {
    const hand=sakuraPresentationHand({x:0,y:0},sakuraUpperFrame(attack,this.state.upperDirection));
    const offset=rotateUpperOffset(hand.x,hand.y,this.state.balanceAngle??0);
    return {x:this.visualRoot.x+offset.x,y:this.visualRoot.y+offset.y};
  }
  destroy() {
    if(this.disposed)return;this.disposed=true;
    for(const node of [...this.legs,this.upper,this.upperBlend,...this.secondaryNodes])node.destroy();
  }
}
