import {loadedPerformancePose,PerformerStride,RIFLE_STRIDE} from './PerformancePoseBank.mjs';
import { getUserCastArt } from '../utils/userCast.mjs';
import { SHOOT_CONFIG } from '../utils/config.js';
import {UserWeaponFx} from './UserWeaponFx.mjs';
import {RIFLE_MOVE_SHOOT_LAYERS as MOVE_SHOOT} from '../utils/userCastMotionData.mjs';
import {MELEE_ATTACK_BODY,MELEE_VERTICAL_BODY,selectMeleeAttackBody} from '../utils/meleeAttackArt.mjs';
import {HeavyLimbRig} from './HeavyLimbRig.mjs';
import {getPublicPerformerAction} from '../utils/publicPerformerAction.mjs';

// Barrel tips in the existing 384x320 rifle cels; anticipation13 has no release marker.
const RIFLE_MUZZLES=[
  [272,211],[272,211],[272,210],[272,210],[272,211],[272,211],
  [279,215],[277,215],[276,214],[269,217],[277,215],[274,216],
  [300,192],null,[297,189],[299,191],[301,191],[298,190],
];
// Rifle shoot-bank cel ends as fractions of the shot: release, kick, half recovery, ready (27/121.5/81/40.5ms of 270).
const RIFLE_SHOT_CELS=[.1,.55,.85,1];
const CROSS_SHOULDERS=[6,7,9,10];
// North-facing barrels are hidden by the silhouette. South and signature cels show these tips.
const STAGE_RIFLE_TIPS=[null,null,null,null,[177,135],[184,134],[169,134],[168,134],
  [220,151],[239,118],[222,74],[221,141],[222,135]];
function rifleStrideFrame(recoil, stride, sideFrame) {
  if(stride.axis==='side')return recoil*6+sideFrame;
  return 24+recoil*8+(stride.axis==='up'?0:4)+stride.lastFrame;
}
// Rifle idle keeps ready12 open; the closed-eye cel shows briefly once idle has settled.
const BLINK_AT=3420,BLINK_FOR=120,BLINK_EVERY=3600;
// Rest cels 1..3 hold 600ms each after 400ms of ready12; rest cel0 equals ready12 and is source proof only.
const REST_AT=400,REST_FOR=600;
// The moving-shot upper draws just above its lower body and below weapon FX (+.00002).
const UPPER_DEPTH=.000001;

// Select a pose from the confirmed atlas using the same beats as the actual skill.
function skillCel(id, age, action) {
  if (id === 'sakura') {
    const beats = action.releaseBeats;
    const last = beats[beats.length - 1];
    let beat = 0;
    for (const at of beats) if (at <= age) beat = at;
    if (age - beat < 30) return 14; // Muzzle extension on each shot.
    if (age - beat < 55) return 15;
    if (age < last) return 13;
    return age < last + 85 ? 16 : 17;
  }
  if (id === 'kai') {
    if (age < action.dashMs * .3) return 14;
    if (age < action.dashMs) return 15; // Hold the sweep until the dash ends.
    return age < (action.dashMs + action.presentationMs) / 2 ? 16 : 17;
  }
  // The spell makes contact immediately; let the open book settle for the last half.
  if (age < 48) return 14;
  if (age < 140) return 15;
  return age < 216 ? 16 : 17;
}

export class UserCastPresentation {
  constructor(scene,id){
    this.scene=scene;this.art=getUserCastArt(id);this.disposed=false;this.shotAt=-Infinity;this.depth=9.8;
    this.facesLeft=this.art.motion.facesLeft??(id==='kai');this.flip=this.facesLeft;this.handFlip=this.flip;this.handShotClock=-Infinity;this.lastX=scene.player.x;this.lastY=scene.player.y;
    this.scale=this.art.motion.scale??.5;
    this.height=this.art.motion.frameHeight*this.scale;this.width=this.art.motion.frameWidth*this.scale;this.clock=0;this.lastNow=null;this.wasFrozen=false;this.walkDistance=0;
    this.shotDuration={sakura:270,kai:240,enjo:260}[this.art.id];
    this.skill=getPublicPerformerAction(this.art.id);
    this.expanded=this.art.confirmedDesign?loadedPerformancePose(scene,id):null;
    this.stride=new PerformerStride();
    this.hitDirection={x:0,y:0};
    this.shotVertical=0;
    this.actionDuration=this.skill?.presentationMs??320;
    this.shotClock=-Infinity;this.actionClock=-Infinity;this.hurtClock=-Infinity;this.streakUntil=-Infinity;this.idleClock=0;
    this.actions=scene.publicPerformerRun?.actions||0;this.hits=scene.battleRecord?.playerHitCount||0;
    this.shadow=scene.add.ellipse(scene.player.x,scene.player.y+25,30,9,0x182936,.22).setDepth(9.79);
    this.image=scene.add.image(scene.player.x,scene.player.y+26,this.art.motion.key,12)
      .setOrigin(this.art.motion.originX,this.art.motion.originY).setDisplaySize(this.width,this.height).setDepth(9.8);
    this.state='idle';this.upper=null;this.upperCel=-1;
    this.weaponFx=new UserWeaponFx(scene,id);
    this.heavyRig=id==='enjo'&&!this.art.confirmedDesign?new HeavyLimbRig(scene,this.image):null;
  }
  beginShot(now,dx,dy,interval){
    const s=this.scene;
    if(this.disposed||s._battlePaused||s._battleEnded||s._publicBattleDialog||s.player?.active===false||s.player?.hp<=0||!Number.isFinite(now)||!Number.isFinite(dx))return false;
    const rifle=this.art.id==='sakura',paced=Number.isFinite(interval)&&interval>0;
    const duration={sakura:270,kai:240,enjo:260}[this.art.id];
    this.shotDuration=paced?Math.min(duration,Math.max(80,interval*(rifle ? .82 : .8))):duration;
    this.shotVertical=Number.isFinite(dy)&&Math.abs(dy)>Math.abs(dx)*1.3?Math.sign(dy):0;
    const activeTime=s.publicPerformerRun?.now?.()??now;
    // Physical shot origins retain their existing 140ms facing contract.
    this.handShotClock=this.clock;
    this.shotAt=now;this.shotClock=this.clock+(this.lastNow===null||this.wasFrozen?0:Math.max(0,activeTime-this.lastNow));
    const poseLocked=this.shotClock-this.hurtClock<240||this.shotClock-this.actionClock<320
      ||(s.publicPerformerRun?.actions||0)>this.actions||(s.battleRecord?.playerHitCount||0)>this.hits;
    if(Math.abs(dx)>.15){
      this.handFlip=this.facesLeft?dx>0:dx<0;
      if(!poseLocked)this.flip=this.handFlip;
      // Rifle body keeps this shot side across a firing streak, so movement cannot flip it between same-side shots.
      if(rifle)this.streakUntil=poseLocked?-Infinity:this.shotClock+Math.min(paced?interval:SHOOT_CONFIG.FIRE_RATE,500)+100;
    }else if(rifle&&this.shotClock<=this.streakUntil)this.streakUntil=poseLocked?-Infinity:this.shotClock+Math.min(paced?interval:SHOOT_CONFIG.FIRE_RATE,500)+100;
    return true;
  }
  update(now,frozen){
    if(this.disposed)return;
    const s=this.scene,p=s.player,dx=p.x-this.lastX,dy=p.y-this.lastY;
    this.lastX=p.x;this.lastY=p.y;
    const activeTime=s.publicPerformerRun?.now?.()??now;
    const elapsed=this.lastNow===null?0:Math.max(0,activeTime-this.lastNow);
    this.lastNow=activeTime;
    if(!frozen){
      if(!this.wasFrozen)this.clock+=elapsed;
      const moved=Math.hypot(dx,dy),shooting=this.clock-this.shotClock<this.shotDuration;
      if(Math.abs(dx)>.05&&this.clock-this.handShotClock>=140)this.handFlip=this.facesLeft?dx>0:dx<0;
      const actions=s.publicPerformerRun?.actions||0,hits=s.battleRecord?.playerHitCount||0;
      const startedAction=actions>this.actions,previousState=this.state;
      const run=s.publicPerformerRun;
      if(typeof run?.getActionPresentation==='function'){
        const action=run.getActionPresentation(activeTime);
        this.actionClock=action?.memberId===this.art.id?this.clock-action.age:-Infinity;
      }else if(startedAction)this.actionClock=this.clock;
      if(hits>this.hits){
        this.hurtClock=this.clock;
        const source=s.battleRecord?.lastPlayerHit?.source?.position;
        const distance=source?Math.hypot(p.x-source.x,p.y-source.y):0;
        this.hitDirection=distance>.01?{x:(p.x-source.x)/distance,y:(p.y-source.y)/distance}:{x:0,y:0};
      }
      this.actions=actions;this.hits=hits;
      if(moved>.05&&!this.wasFrozen)this.walkDistance+=Math.min(moved,40);
      this.stride.advance(dx,dy,moved>.05&&!this.wasFrozen,this.clock,this.walkDistance);
      this.state=this.clock-this.hurtClock<240?'hurt':this.clock-this.actionClock<this.actionDuration?'action'
        :moved>.05?(shooting?'move-attack':'move'):shooting?'attack':'idle';
      if(this.state==='idle'&&previousState!=='idle')this.idleClock=this.clock;
      if(this.state==='hurt'||this.state==='action')this.streakUntil=-Infinity;
      if(this.state==='action'&&(startedAction||previousState!=='action')){
        const presentation=s.publicPerformerRun?.actionPresentation;
        if(presentation?.sequence===actions&&['left','right'].includes(presentation.direction))
          this.flip=this.facesLeft?presentation.direction==='right':presentation.direction==='left';
      }else if(this.state!=='hurt'&&this.state!=='action'){
        if((previousState==='hurt'||previousState==='action')&&shooting)this.flip=this.handFlip;
        else if(Math.abs(dx)>.05&&!shooting&&this.clock>=this.streakUntil)this.flip=this.facesLeft?dx>0:dx<0;
      }
    }
    this.wasFrozen=!!frozen;
    const t=this.clock,moving=this.state==='move'||this.state==='move-attack';
    const melee=this.state!=='hurt'&&this.state!=='action'?s.publicPerformerRun?.meleeCombat?.snapshot():null;
    if(melee&&!frozen)this.state=moving?'move-attack':'attack';
    const sample=(frames,age,duration)=>frames[Math.min(frames.length-1,Math.floor(Math.max(0,age)/duration*frames.length))];
    const shotCel=()=>{const progress=Math.max(0,t-this.shotClock)/this.shotDuration,cel=RIFLE_SHOT_CELS.findIndex(end=>progress<end);return cel<0?3:cel;};
    this.meleePose=null;
    let frame=12,key=this.art.motion.key,upperCel=-1;
    if(this.state==='hurt'){
      const hurt=this.art.motion.hurt;
      if(hurt&&s.textures?.exists(hurt.key)){key=hurt.key;frame=sample([0,1,2,3],t-this.hurtClock,240);}
      else frame=sample([18,19,20,21],t-this.hurtClock,240);
    }
    else if(this.state==='action'){
      // Consequences remain owned by the run: hammer is instant; sword dashes for 160ms.
      frame=this.art.confirmedDesign&&this.skill ? skillCel(this.art.id,t-this.actionClock,this.skill)
        : sample([14,15,16,17],t-this.actionClock,this.actionDuration);
    }else if(melee){
      const pose=this.art.confirmedDesign?null:selectMeleeAttackBody(this.art.id,melee,k=>s.textures?.exists(k));
      if(pose){this.meleePose=pose;key=pose.art.key;frame=pose.frame;this.flip=pose.flip;}
      else {frame=this.art.confirmedDesign?(melee.phase==='windup'?13:melee.phase==='release'?(melee.progress<.5?14:15):(melee.progress<.5?16:17))
        :melee.phase==='windup'?14:melee.phase==='release'?(melee.progress<.5?15:16):17;
        this.flip=this.facesLeft?Math.cos(melee.angle)>0:Math.cos(melee.angle)<0;}
    }else if(this.state==='move-attack' && this.art.motion.singleAtlas && t-this.shotClock<this.shotDuration*.65){
      // Show the release on the actual shot, then return to the distance-driven stride.
      frame=sample([14,15,16],t-this.shotClock,this.shotDuration*.65);
    }else if(moving){
      // Every walk bank spans the same 90 world pixels; the original atlas and unloaded banks keep six 15px cels.
      const walk=this.art.motion.walk,banked=walk&&s.textures?.exists(walk.key),cels=banked&&walk.frames||6;
      const phase=Math.floor(this.walkDistance/(90/cels))%cels;
      if(banked){key=walk.key;frame=phase;}
      else frame=6+phase;
      // Rifle move-shot: original shoot upper over this walk lower via native crop; otherwise the old whole-body walk.
      const shoot=this.art.motion.shoot;
      if(this.state==='move-attack'&&banked&&this.art.id==='sakura'&&shoot&&s.textures.exists(shoot.key)&&typeof this.image.setCrop==='function')upperCel=shotCel();
    }
    else if(this.state==='attack'){
      const shoot=this.art.motion.shoot;
      if(shoot&&s.textures?.exists(shoot.key)){key=shoot.key;frame=shotCel();}
      else frame=sample([14,15,16,17],t-this.shotClock,this.shotDuration);
    }
    else if(this.state==='idle'){
      const idle=this.art.motion.idle,rest=this.art.motion.rest,age=(t-this.idleClock)%BLINK_EVERY;
      if(this.art.motion.singleAtlas){
        frame=age>=BLINK_AT&&age<BLINK_AT+BLINK_FOR?0:age<REST_AT?12:[1,2,3,2][Math.floor((age-REST_AT)/750)%4];
      }
      else if(idle&&s.textures?.exists(idle.key)&&age>=BLINK_AT&&age<BLINK_AT+BLINK_FOR){key=idle.key;frame=0;}
      else if(rest&&age>=REST_AT&&age<REST_AT+3*REST_FOR&&s.textures?.exists(rest.key)){key=rest.key;frame=1+Math.floor((age-REST_AT)/REST_FOR);}
    }
    let displayFlip=this.flip;
    const reduced=this.weaponFx.motionPreference?.matches===true;
    let angle=0,offsetX=0,offsetY=0,heightFactor=1;
    if(this.expanded){
      const stride=this.stride,skillAge=t-this.actionClock,rifle=this.art.id==='sakura';
      const forwardStep=Math.floor(this.walkDistance/15)%6;
      const backpedal=rifle&&stride.axis==='side'&&stride.lastSide!==(this.flip?-1:1);
      const strideFrame=backpedal?(6-forwardStep)%6:forwardStep;
      const vertical=stride.axis!=='side';
      const bank=this.expanded.key;
      if(this.state==='action'){
        const phase=skillCel(this.art.id,skillAge,this.skill);
        const specialFrame=rifle?({13:8,14:9,15:10,16:11,17:12})[phase]
          :this.art.id==='kai'?(skillAge<30?8:skillAge<112?9:skillAge<205?10:11)
          :(skillAge<52?9:skillAge<152?10:11);
        key=bank;frame=specialFrame;
        if(rifle&&stride.moving&&this.expanded.strideBounds){
          const recoil=phase===14?1:phase===15?2:phase===16?3:0;
          key=RIFLE_STRIDE;frame=rifleStrideFrame(recoil,stride,strideFrame);
        }
      }else if(rifle&&this.state==='move-attack'&&vertical&&this.shotVertical){
        key=bank;frame=(this.shotVertical<0?0:4)+stride.lastFrame;displayFlip=false;
        const recoil=[0,1,.5,.1][shotCel()]*(reduced ? .4 : 1);
        offsetY=-this.shotVertical*2*recoil;
      }else if(rifle&&this.state==='move-attack'&&this.expanded.strideBounds){
        key=RIFLE_STRIDE;frame=rifleStrideFrame(shotCel(),stride,strideFrame);
      }else if((this.state==='move'||this.state==='idle')&&vertical){
        key=bank;frame=stride.verticalFrame(t);displayFlip=false;
      }else if(key===this.art.motion.key&&frame===17){
        key=bank;frame=12;
      }else if(this.state==='idle'&&!stride.moving&&t-stride.changedAt<84){
        // Keep the planting foot for the first moment after releasing the stick.
        frame=6+strideFrame;
      }
      if(this.state==='move'||this.state==='idle'){
        const weight=stride.settle(t,reduced);
        heightFactor=1-weight*.052;
        angle=vertical?0:weight*stride.lastSide*(stride.moving?3:-5);
      }else if(this.state==='hurt'){
        const kick=Math.max(0,1-(t-this.hurtClock)/240)*(reduced ? .4 : 1);
        angle=this.hitDirection.x*8*kick;
        offsetX=this.hitDirection.x*3*kick;
        offsetY=this.hitDirection.y*3*kick;
      }
    }
    const actionArt=this.meleePose?.art||MELEE_ATTACK_BODY[this.art.id],tallAction=actionArt&&key===actionArt.key;
    const place=(node,k,f)=>node.setTexture(k,f)
      .setOrigin(displayFlip?1-(tallAction?actionArt.originX:this.art.motion.originX):(tallAction?actionArt.originX:this.art.motion.originX),tallAction?actionArt.originY:this.art.motion.originY)
      .setPosition(p.x+offsetX,p.y+26+offsetY)
      .setDisplaySize(tallAction?actionArt.frameWidth*(actionArt.scale??.5):this.width,tallAction?actionArt.frameHeight*(actionArt.scale??.5):this.height*heightFactor).setFlipX(displayFlip).setAngle(angle)
      .setAlpha(this.expanded&&p.hp>0?Math.max(reduced ? .88 : .67,s.playerGfx?.alpha??1):(s.playerGfx?.alpha??1)).setTint(this.state==='hurt'?0xffb7bf:0xffffff);
    place(this.image,key,frame);
    if(upperCel>=0){
      const shootKey=this.art.motion.shoot.key;
      this.upper??=s.add.image(p.x,p.y+26,shootKey,upperCel).setDepth(this.depth+UPPER_DEPTH);
      // Crops follow setTexture/setFlipX so Phaser builds the UVs for the current frame and facing.
      this.image.setCrop(...MOVE_SHOOT.lowerCrop);
      place(this.upper,shootKey,upperCel).setCrop(...MOVE_SHOOT.upperCrop).setVisible?.(true);
    }else if(this.upperCel>=0){
      this.image.setCrop();
      if(this.upper.setVisible)this.upper.setVisible(false);else this.upper.setAlpha(0);
    }
    this.upperCel=upperCel;
    this.heavyRig?.update({clock:t,elapsed,dx,dy,state:this.state,flip:this.flip,frozen,
      attack:this.state==='action'?s.publicPerformerRun?.meleeCombat?.snapshot():melee,
      actionAge:t-this.actionClock,actionSequence:this.actions});
    this.shadow.setPosition(p.x,p.y+25).setAlpha(.22*(s.playerGfx?.alpha??1));
    this.weaponFx.update(activeTime,this);
  }
  setWorldDepth(depth){this.depth=depth;this.image.setDepth(depth);this.upper?.setDepth(depth+UPPER_DEPTH);this.shadow.setDepth(depth-.00001);this.heavyRig?.setDepth(depth);}
  meleeWeaponTipWorld(frame=this.meleePose?.frame){
    if(this.heavyRig?.active)return this.heavyRig.tipWorld();
    const p=this.meleePose,tip=p?.art?.tips?.[frame];
    if(this.disposed||!tip||this.image.texture?.key!==p.art.key)return null;
    const scale=p.art.scale??.5;
    return{x:this.image.x+(this.flip?-1:1)*(tip[0]-p.art.originX*p.art.frameWidth)*scale,y:this.image.y+(tip[1]-p.art.originY*p.art.frameHeight)*scale};
  }
  meleeWeaponTrailWorld(attack=null){
    if(this.heavyRig?.active)return this.heavyRig.trailWorld(attack);
    const p=this.meleePose,to=this.meleeWeaponTipWorld();if(!to)return null;
    if(this.art?.id==='enjo'&&attack&&Number.isFinite(attack.progress)
      &&['windup','release','recovery'].includes(attack.phase)&&(attack.released||attack.progress>=.7)){
      const side=p.art.framesPerDirection===20,bank=side?0:p.frame-p.frame%8;
      const first=bank+(side?6:2),last=bank+(side?10:4);
      return{from:this.meleeWeaponTipWorld(first),to:attack.released?this.meleeWeaponTipWorld(last):to};
    }
    // Keep landmarks inside the selected direction bank, independent of rendered frame history.
    const count=p.art.framesPerDirection||8,from=this.meleeWeaponTipWorld(Math.max(p.frame-p.frame%count,p.frame-2));
    return from?{from,to}:null;
  }
  // Optional normalized target dx lets the rifle query its next shot side with beginShot's deadzone, read-only.
  handWorld(dx){
    const p=this.scene.player,nativeFacing=this.facesLeft?-1:1;
    const aimed=this.art.id==='sakura'&&Number.isFinite(dx);
    // Near-vertical fire keeps its active body side instead of borrowing a retreating hand.
    const flip=aimed&&Math.abs(dx)>.15?dx<0:aimed&&this.clock<=this.streakUntil?this.flip:(this.handFlip??this.flip);
    return {x:p.x+(flip?-1:1)*nativeFacing*16,y:p.y-12};
  }
  muzzleWorld(allowAction=false){
    if(this.disposed||this.art.id!=='sakura'||this.state==='hurt'||(!allowAction&&this.state==='action'))return null;
    const shoot=this.art.motion.shoot,idle=this.art.motion.idle,rest=this.art.motion.rest,walk=this.art.motion.walk,texture=this.image.texture?.key;
    const cel=Number(this.image.frame.name),stride=texture===RIFLE_STRIDE;
    const stage=this.expanded&&texture===this.expanded.key;
    // Registered moving-shot shoulders recoil over the current step, keeping the visible tip anchored.
    const cross=cel>=24,step=cross?CROSS_SHOULDERS[(cel-24)%4]:6+cel%6;
    const recoil=cross?Math.floor((cel-24)/8):Math.floor(cel/6);
    const walkMarker=stride?this.art.motion.muzzles[step]:null;
    const marker=stage?STAGE_RIFLE_TIPS[cel]:walkMarker?[walkMarker[0]-[0,10,5,1][recoil],walkMarker[1]]:this.upperCel>=0?shoot.muzzles[this.upperCel]
      :(this.art.motion.muzzles|| (shoot&&texture===shoot.key?shoot.muzzles:idle&&texture===idle.key?idle.muzzles:rest&&texture===rest.key?rest.muzzles:walk&&texture===walk.key?walk.muzzles:RIFLE_MUZZLES))?.[this.image.frame.name];if(!marker)return null;
    const [x,y]=marker,p=this.scene.player,m=this.art.motion,flip=this.image.flipX??this.flip;
    return {x:(this.image.x??p.x)+(flip?-1:1)*(x-m.originX*m.frameWidth)*this.width/m.frameWidth,
      y:(this.image.y??p.y+26)+(y-m.originY*m.frameHeight)*this.height/m.frameHeight};
  }
  cueExclusionBounds(){
    if(this.disposed)return null;
    if(this.heavyRig?.active)return this.heavyRig.bounds();
    const motion=this.art.motion,walk=motion.walk,hurt=motion.hurt,shoot=motion.shoot,idle=motion.idle,rest=motion.rest;
    const vertical=MELEE_VERTICAL_BODY[this.art.id],attack=this.meleePose?.art||(vertical&&this.image.texture?.key===vertical.key?vertical:MELEE_ATTACK_BODY[this.art.id]);
    const b=this.image.getBounds(),r=this.expanded&&this.image.texture?.key===this.expanded.key
      ?this.expanded.bounds[this.image.frame.name]:this.image.texture?.key===RIFLE_STRIDE?this.expanded.strideBounds[this.image.frame.name]:this.upperCel>=0?this.layerBounds()
      :(attack&&this.image.texture?.key===attack.key?attack.bounds:shoot&&this.image.texture?.key===shoot.key?shoot.bounds:idle&&this.image.texture?.key===idle.key?idle.bounds:rest&&this.image.texture?.key===rest.key?rest.bounds:hurt&&this.image.texture?.key===hurt.key?hurt.bounds:walk&&this.image.texture?.key===walk.key?walk.bounds:motion.bounds)?.[this.image.frame.name];
    if(!r)return {x:b.x,y:b.y,right:b.right,bottom:b.bottom};
    const frameWidth=attack&&this.image.texture?.key===attack.key?attack.frameWidth:motion.frameWidth;
    const flip=this.image.flipX??this.flip;
    const left=flip?frameWidth-r[2]:r[0],right=flip?frameWidth-r[0]:r[2];
    if(this.expanded&&this.image.getWorldTransformMatrix){
      // Include the planted-foot lean, hurt displacement and vertical compression.
      const matrix=this.image.getWorldTransformMatrix(),ox=this.image.displayOriginX,oy=this.image.displayOriginY;
      const a=matrix.transformPoint(left-ox,r[1]-oy),c=matrix.transformPoint(right-ox,r[3]-oy);
      const d=matrix.transformPoint(left-ox,r[3]-oy),e=matrix.transformPoint(right-ox,r[1]-oy);
      return {x:Math.min(a.x,c.x,d.x,e.x),y:Math.min(a.y,c.y,d.y,e.y),
        right:Math.max(a.x,c.x,d.x,e.x),bottom:Math.max(a.y,c.y,d.y,e.y)};
    }
    const scale=attack&&this.image.texture?.key===attack.key?(attack.scale??.5):(this.scale??motion.scale??.5);
    return {x:b.x+left*scale,y:b.y+r[1]*scale,right:b.x+right*scale,bottom:b.y+r[3]*scale};
  }
  // Union of the visible clipped upper and lower bands, in native frame pixels.
  layerBounds(){
    const u=MOVE_SHOOT.upperBounds[this.upperCel],l=MOVE_SHOOT.lowerBounds[this.image.frame.name];
    return [Math.min(u[0],l[0]),Math.min(u[1],l[1]),Math.max(u[2],l[2]),Math.max(u[3],l[3])];
  }
  captureDefeat(){
    const p=this.scene.player,m=this.art.motion;
    if(this.disposed||!m.defeatFrames||!p?.active||!(p.hp<=0)||!Number.isFinite(p.x+p.y))return null;
    const stage=this.expanded;
    return Object.freeze({x:p.x,y:p.y+26,art:m,frames:stage?[18,13,14,15]:m.defeatFrames,
      keys:stage?[m.key,stage.key,stage.key,stage.key]:null,size:this.height,
      originX:this.flip?1-m.originX:m.originX,originY:m.originY,flipX:this.flip});
  }
  destroy(){if(this.disposed)return;this.disposed=true;this.heavyRig?.destroy();this.weaponFx.destroy();this.image.destroy();this.upper?.destroy();this.shadow.destroy();}
}
