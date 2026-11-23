import { SAKURA_LAYER_ART, SAKURA_MOTION_ART, SakuraLayeredPresentation } from './SakuraLayeredPresentation.mjs';
import { advanceSakuraTurn } from './SakuraTurnMotion.mjs';
import { SAKURA_SECONDARY_ART } from './SakuraSecondaryMotion.mjs';
import { PUBLIC_CAMERA_INSETS } from '../utils/publicCameraFrame.mjs';
import { PerformerCelMotion } from './PerformerCelMotion.mjs';
import { PerformerFootRig, performerFootArt } from './PerformerFootRig.mjs';
import { PerformerSecondarySurface } from './PerformerSecondarySurface.mjs';
import { PerformerBodyBalance } from './PerformerBodyBalance.mjs';
import { preloadSakuraNative, SakuraNativePresentation } from './SakuraNativePresentation.mjs';
import {preloadSakuraRefined,preloadSakuraOblique,SakuraRefinedPresentation} from './SakuraRefinedPresentation.mjs';
import { performerVisualMetrics, performerVisualY } from '../utils/performerVisualMetrics.mjs';
import {VENUS_ART,hasVenusLayered,preloadVenusLayered,VenusLayeredPresentation} from './VenusLayeredPresentation.mjs';
import {GENYA_ART,hasGenyaLayered,preloadGenyaLayered,GenyaLayeredPresentation} from './GenyaLayeredPresentation.mjs';
import {KAI_ART,hasKaiLayered,preloadKaiLayered,KaiLayeredPresentation} from './KaiLayeredPresentation.mjs';
import {ENJO_ART,hasEnjoLayered,preloadEnjoLayered,EnjoLayeredPresentation} from './EnjoLayeredPresentation.mjs';
import {PerformerShotFeedback} from './PerformerShotFeedback.mjs';
import {drawEnemyStateCue} from './EnemyAttackPresentation.mjs';
import {canEnemyBePublicStage1PaintTarget} from './PublicStage1EnemyRoles.mjs';
import {createEnemyMotion,advanceEnemyMotion,notifyEnemyMotionRelease} from './EnemyEnsembleMotion.mjs';
import {enemyGroundPose,performerGroundFeet,WorldGroundContacts} from './WorldGroundingPresentation.mjs';
import {qRebaseTrialRequested,preloadQRebaseTrial,QRebaseTrialView} from './QRebaseTrialPresentation.mjs';
import {getActiveUserCastArt as getUserCastArt} from '../utils/userCast.mjs';
import {UserCastPresentation} from './UserCastPresentation.mjs';
import {preloadHeavyLimbRig} from './HeavyLimbRig.mjs';
import {preloadUserWeaponFx} from './UserWeaponFx.mjs';
import {preloadMeleeAttackArt} from '../utils/meleeAttackArt.mjs';
import {preloadHarborGroundStrike} from './HarborGroundStrike.mjs';
import {isPublicTargetFocusEnabled} from '../utils/publicTargetFocus.mjs';

// Bounded rollback keeps the reviewed legacy bank, without loading both at once.
export const USE_REFINED_SAKURA=true;

const BASE = 'art/enemy-ensemble-20261009/';
const MEMBER_BASE = 'art/performer-motion-20260922/';
const PORTRAIT_BASE = 'art/performer-portraits-20260925/';
const SAKURA_ART = Object.freeze({id:'sakura',...SAKURA_LAYER_ART.upper,
  portrait:'art/sakura-native-20261004/avatar.webp',fullPortrait:'art/sakura-native-20261004/portrait.webp'});
const MEMBERS = Object.freeze(['sakura', 'venus', 'genya', 'kai', 'enjo']);
const REACTION_DIRECTIONS = ['down','left','right','up'];
const reactionArt = id => MEMBERS.includes(id) && id !== 'sakura'
  ? {key:`performer-${id}-reactions`,path:`art/performer-reactions-20260924/${id}-reactions.webp`} : null;
const basicShotArt = id => MEMBERS.includes(id) && id !== 'sakura'
  ? {key:`performer-${id}-basic`,path:`art/performer-basic-20260925/${id}-basic.webp`} : null;
const turnArt = id => MEMBERS.includes(id) && id !== 'sakura'
  ? {key:`performer-${id}-turn`,path:`art/performer-turn-20260925/${id}-turn.webp`} : null;
const ENEMIES = Object.freeze({
  'unlit-chaser': ['runner', 36, 12],
  'stage-cue-emitter': ['emitter', 42, 14],
  'objective-disruptor': ['jammer', 42, 13],
  'spotlight-captain': ['captain', 48, 16],
  'finale-boss': ['conductor', 64, 20],
  'finale-weak-point': ['relay', 36, 12],
});
const COLORS = {pink:0xFF69B4, blue:0x00CED1, yellow:0xFFD700, purple:0x9370DB, orange:0xFF8C00};

export function getPerformerArt(id) {
  if (id === 'sakura') return SAKURA_ART;
  return MEMBERS.includes(id) ? {id, key:`performer-${id}-walk`, path:`${MEMBER_BASE}${id}-walk.webp`,
    portrait:`${PORTRAIT_BASE}${id}-avatar.webp`,fullPortrait:`${PORTRAIT_BASE}${id}-portrait.webp`,frameCount:48} : null;
}

export function performerPortraitCss(id, baseURI) {
  const art=getPerformerArt(id);
  return art ? `url("${new URL(art.portrait,baseURI).href}")` : 'none';
}

// The roster's stage body must agree with the cast seen in combat.
export function getPerformerRosterVisual(id) {
  const art=getPerformerArt(id);
  if(!art)return null;
  return id==='sakura'||id==='venus'||id==='genya'||id==='kai'||id==='enjo'
    ? {id,kind:'portrait',source:art.fullPortrait,width:512,height:768}
    : {id,kind:'cel',source:art.path,width:512,height:2048,frame:16,columns:4,rows:16,frameSize:128};
}

export function getEnemyArt(role) {
  const row = ENEMIES[role];
  return row ? {key:`stage-actor-${row[0]}`,path:`${BASE}${row[0]}.webp`,size:row[1],radius:row[2],offset:role==='unlit-chaser'?12:0} : null;
}

export function preloadActorPresentation(scene, data = {}) {
  scene._userCastPresentation=false;
  scene._qRebaseTrialRequested = typeof __Q_REBASE_TRIAL__ !== 'undefined' && __Q_REBASE_TRIAL__
    && qRebaseTrialRequested(data, globalThis.location?.href, true);
  if (data.practiceMode === true || Number(data.stageId || 1) !== 1) return;
  const ownerArt=getUserCastArt(data.performerId||'sakura');
  if(ownerArt){
    scene._userCastPresentation=true;scene._qRebaseTrialRequested=false;
    scene.load.image(ownerArt.key,ownerArt.battle);
    scene.load.spritesheet(ownerArt.motion.key,ownerArt.motion.path,{frameWidth:ownerArt.motion.frameWidth,frameHeight:ownerArt.motion.frameHeight});
    if(ownerArt.motion.walk)scene.load.spritesheet(ownerArt.motion.walk.key,ownerArt.motion.walk.path,{frameWidth:ownerArt.motion.frameWidth,frameHeight:ownerArt.motion.frameHeight});
    if(ownerArt.motion.hurt)scene.load.spritesheet(ownerArt.motion.hurt.key,ownerArt.motion.hurt.path,{frameWidth:ownerArt.motion.frameWidth,frameHeight:ownerArt.motion.frameHeight});
    if(ownerArt.motion.shoot)scene.load.spritesheet(ownerArt.motion.shoot.key,ownerArt.motion.shoot.path,{frameWidth:ownerArt.motion.frameWidth,frameHeight:ownerArt.motion.frameHeight});
    if(ownerArt.motion.idle)scene.load.spritesheet(ownerArt.motion.idle.key,ownerArt.motion.idle.path,{frameWidth:ownerArt.motion.frameWidth,frameHeight:ownerArt.motion.frameHeight});
    if(ownerArt.motion.rest)scene.load.spritesheet(ownerArt.motion.rest.key,ownerArt.motion.rest.path,{frameWidth:ownerArt.motion.frameWidth,frameHeight:ownerArt.motion.frameHeight});
    preloadUserWeaponFx(scene,ownerArt.id);
    if(!ownerArt.confirmedDesign)preloadMeleeAttackArt(scene,ownerArt.id);
    preloadHeavyLimbRig(scene,ownerArt.id);
    if(data.campaignChapterId==='encore'&&!data.defenseMode&&!data.publicFinaleTrial)preloadHarborGroundStrike(scene);
    for(const role of Object.keys(ENEMIES)){const art=getEnemyArt(role);scene.load.image(art.key,art.path);}
    return;
  }
  const actor = getPerformerArt(data.performerId || 'sakura');
  if (!actor) return;
  if(scene._qRebaseTrialRequested)preloadQRebaseTrial(scene,actor.id);
  const layeredVenus=actor.id==='venus'&&preloadVenusLayered(scene);
  const layeredGenya=actor.id==='genya'&&preloadGenyaLayered(scene);
  const layeredKai=actor.id==='kai'&&preloadKaiLayered(scene);
  const layeredEnjo=actor.id==='enjo'&&preloadEnjoLayered(scene);
  const layeredMember=layeredVenus||layeredGenya||layeredKai||layeredEnjo;
  if(actor===SAKURA_ART){if(USE_REFINED_SAKURA){preloadSakuraRefined(scene);preloadSakuraOblique(scene);}else preloadSakuraNative(scene);}
  else if(!layeredMember)scene.load.spritesheet(actor.key, actor.path, {frameWidth:actor.frameWidth || 128, frameHeight:actor.frameHeight || 128,endFrame:47});
  const legs=performerFootArt(actor.id);
  if(legs&&!layeredMember)scene.load.spritesheet(legs.key,legs.path,{frameWidth:128,frameHeight:128,endFrame:11});
  const reaction=reactionArt(actor.id);
  if(reaction&&!layeredMember)scene.load.spritesheet(reaction.key,reaction.path,{frameWidth:128,frameHeight:128});
  const basic=basicShotArt(actor.id);
  if(basic&&!layeredMember)scene.load.spritesheet(basic.key,basic.path,{frameWidth:128,frameHeight:128});
  const turn=turnArt(actor.id);
  if(turn&&!layeredMember)scene.load.spritesheet(turn.key,turn.path,{frameWidth:128,frameHeight:128});
  for (const role of Object.keys(ENEMIES)) {
    const art = getEnemyArt(role);scene.load.image(art.key, art.path);
  }
}

// Camera-only margin: leave the physical world and pointer transform untouched.
export function framePublicActorCamera(scene, width, height) {
  const {left,right,top,bottom}=PUBLIC_CAMERA_INSETS;
  scene.cameras.main.setBounds(-left,-top,width+left+right,height+top+bottom);
}

// The reviewed POT banks retain their frame pixels; only selected-member sampling changes.
export function preparePerformerSampler(scene,key) {
  const gl=scene.game?.renderer?.gl,wrapper=scene.textures?.get?.(key)?.source?.[0]?.glTexture;
  const pot=n=>Number.isInteger(n)&&n>0&&(n&(n-1))===0;
  if(!gl||!wrapper?.update||!pot(wrapper.width)||!pot(wrapper.height)
    ||wrapper.minFilter===gl.LINEAR_MIPMAP_LINEAR)return false;
  wrapper.update(wrapper.pixels,wrapper.width,wrapper.height,wrapper.flipY,wrapper.wrapS,wrapper.wrapT,
    gl.LINEAR_MIPMAP_LINEAR,wrapper.magFilter,wrapper.format);
  return true;
}

export class ActorPresentation {
  constructor(scene) {
    this.scene=scene;this.enemies=new Map();this.playerImage=null;this.disposed=false;
    this.actions=scene.publicPerformerRun?.actions || 0;this.hp=scene.player?.hp;
    this.observedHits=scene.battleRecord?.playerHitCount || 0;
    this.actionUntil=-1;this.actionFacing=null;this.hurtUntil=-1;this.hitSequence=0;this.state='idle';
    this.direction='down';this.lastX=scene.player?.x;this.lastY=scene.player?.y;
    const data=scene.battleData || {};
    if(scene._userCastPresentation && data.practiceMode!==true && Number(data.stageId||1)===1 && getUserCastArt(data.performerId||'sakura')){
      this.userCastView=new UserCastPresentation(scene,data.performerId||'sakura');
      this.playerImage=this.userCastView.image;
      this.groundContacts=scene.add?.graphics?new WorldGroundContacts(scene):null;
      this.postUpdatePlayerFrame=()=>this.flushPlayerFrame();
      scene.events.on('postupdate',this.postUpdatePlayerFrame);
      return;
    }
    const actor=data.practiceMode!==true && Number(data.stageId||1)===1
      ? getPerformerArt(scene.publicPerformerRun?.member.id || data.performerId || 'sakura') : null;
    this.freshSakura=actor === SAKURA_ART;
    this.visualMetrics=performerVisualMetrics(actor?.id);
    this.controlBand=null;
    this.nativeSakura=this.freshSakura && scene._sakuraNativePresentationRequested===true;
    if(actor?.id==='venus'&&hasVenusLayered(scene)){
      preparePerformerSampler(scene,VENUS_ART.key);
      this.venusView=new VenusLayeredPresentation(scene);this.playerImage=this.venusView.upper;
    }else if(actor?.id==='genya'&&hasGenyaLayered(scene)){
      preparePerformerSampler(scene,GENYA_ART.key);
      this.genyaView=new GenyaLayeredPresentation(scene);this.playerImage=this.genyaView.upper;
    }else if(actor?.id==='kai'&&hasKaiLayered(scene)){
      preparePerformerSampler(scene,KAI_ART.key);
      this.kaiView=new KaiLayeredPresentation(scene);this.playerImage=this.kaiView.upper;
    }else if(actor?.id==='enjo'&&hasEnjoLayered(scene)){
      preparePerformerSampler(scene,ENJO_ART.key);
      this.enjoView=new EnjoLayeredPresentation(scene);this.playerImage=this.enjoView.upper;
    }else if(this.nativeSakura) {
      this.sakuraView=scene._sakuraRefinedPresentationRequested===true
        ? new SakuraRefinedPresentation(scene) : new SakuraNativePresentation(scene,this.visualMetrics);
      this.playerImage=this.sakuraView.upper;
    }else if(this.freshSakura && scene.textures?.exists(actor.key) && [...Object.values(SAKURA_MOTION_ART),...Object.values(SAKURA_SECONDARY_ART)].every(art=>scene.textures?.exists(art.key))) {
      this.sakuraView=new SakuraLayeredPresentation(scene);this.playerImage=this.sakuraView.upper;
    }else if (!this.freshSakura && actor && scene.textures?.exists(actor.key)) {
      for(const art of [actor,performerFootArt(actor.id),reactionArt(actor.id),basicShotArt(actor.id),turnArt(actor.id)])
        if(art&&scene.textures.exists(art.key))preparePerformerSampler(scene,art.key);
      this.playerShadow=scene.add.ellipse?.(scene.player.x,scene.player.y+26,25*2/3,7*2/3,0x1D2930,.16)
        .setDepth(9.79);
      this.celMotion=new PerformerCelMotion();
      this.bodyBalance=new PerformerBodyBalance();
      this.turnState={};this.turnLastNow=null;
      const size=this.visualMetrics.displaySize;
      this.playerImage=scene.add.image(scene.player.x,scene.player.y,actor.key,16)
        .setDisplaySize(size,size).setOrigin(0.5,0.5).setDepth(9.8);
      this.playerLegs=scene.add.image(scene.player.x,scene.player.y,actor.key,0)
        .setDisplaySize(size,size).setOrigin(0.5,0.5).setDepth(9.8).setVisible(false);
      if(scene.textures.exists(performerFootArt(actor.id).key))this.footRig=new PerformerFootRig(scene,actor.id,this.visualMetrics.scale);
      this.reactionArt=reactionArt(actor.id);
      if(scene.textures.exists(this.reactionArt.key))this.reactionImage=scene.add.image(scene.player.x,scene.player.y,this.reactionArt.key,0)
        .setDisplaySize(size,size).setOrigin(0.5,0.5).setDepth(9.8).setVisible(false);
      const basic=basicShotArt(actor.id);
      if(scene.textures.exists(basic.key))this.basicShotImage=scene.add.image(scene.player.x,scene.player.y,basic.key,0)
        .setDisplaySize(size,size).setOrigin(0.5,0.5).setDepth(9.8).setVisible(false);
      const turn=turnArt(actor.id);
      if(scene.textures.exists(turn.key))this.turnImage=scene.add.image(scene.player.x,scene.player.y,turn.key,0)
        .setDisplaySize(size,size).setOrigin(0.5,0.5).setDepth(9.8).setVisible(false);
      if(this.footRig)this.secondarySurface=new PerformerSecondarySurface(scene,actor.id);
    }
    this.groundContacts=actor&&scene.add?.graphics?new WorldGroundContacts(scene):null;
    if(scene._qRebaseTrialRequested&&actor){
      try{this.qRebaseView=new QRebaseTrialView(this,actor.id);}
      catch(error){this.qRebaseFallback=String(error.message);}
    }
    this.pendingPlayerFrame=null;
    if(this.playerImage?.active && scene.events?.on && scene.events?.off){
      // Arcade registers its Sprite writeback at boot, before this render subscriber.
      this.postUpdatePlayerFrame=()=>this.flushPlayerFrame();
      scene.events.on('postupdate',this.postUpdatePlayerFrame);
    }
  }

  // Notification only: the projectile already exists. No combat timers or callbacks.
  notifyBasicShot(now,dx,dy,interval) {
    if(this.userCastView)return this.userCastView.beginShot(now,dx,dy,interval);
    this.lastBasicShotAccepted=false;
    const s=this.scene;
    if(this.disposed||(!this.venusView&&!this.genyaView&&!this.kaiView&&!this.enjoView&&!this.basicShotImage?.active)||!s.player?.active||s.player.hp<=0
      ||s._battlePaused||s._battleEnded||s._publicBattleDialog||s.player.hp<this.hp
      ||(s.battleRecord?.playerHitCount || 0)>this.observedHits
      ||now<this.hurtUntil||now<this.actionUntil||(s.publicPerformerRun?.actions||0)>this.actions)return false;
    const view=this.venusView||this.genyaView||this.kaiView||this.enjoView;
    this.lastBasicShotAccepted=view?view.beginShot(now,dx,dy,interval):this.celMotion.beginShot(now,dx,dy,interval);
    return this.lastBasicShotAccepted;
  }

  queueBasicShotFx(bullet,now) {
    if(this.userCastView&&!this.disposed)return this.userCastView.weaponFx.shot(bullet,now,this.userCastView);
    const view=this.venusView||this.genyaView||this.kaiView||this.enjoView;
    if(this.disposed||!view||!this.scene.add?.graphics||bullet?.paintShot!==true)return false;
    // True means this layered owner handled the release, including priority suppression.
    if(!this.lastBasicShotAccepted)return true;
    this.lastBasicShotAccepted=false;
    if(!this.shotFeedback)this.shotFeedback=new PerformerShotFeedback(this.scene);
    this.shotFeedback.queue(bullet,now);return true;
  }

  setWorldDepth(depth) {
    if(this.disposed)return;
    if(this.userCastView){this.userCastView.setWorldDepth(depth);return;}
    this.qRebaseView?.setWorldDepth(depth);
    this.shotFeedback?.setWorldDepth(depth);
    this.scene.publicPerformerRun?.actionFeedback?.setWorldDepth(depth);
    this.scene.publicPerformerRun?.sakuraCombat?.setWorldDepth?.(depth);
    if(this.qRebaseView)return;
    if(this.venusView){this.venusView.setWorldDepth(depth);return;}
    if(this.genyaView){this.genyaView.setWorldDepth(depth);return;}
    if(this.kaiView){this.kaiView.setWorldDepth(depth);return;}
    if(this.enjoView){this.enjoView.setWorldDepth(depth);return;}
    if(this.sakuraView){this.sakuraView.setWorldDepth(depth);return;}
    this.playerImage?.setDepth(depth);
    this.playerShadow?.setDepth(depth-0.000010);
    this.playerLegs?.setDepth(depth-0.000008);
    this.footRig?.nodes.forEach((node,index)=>node.setDepth(depth-0.000007+index*0.000001));
    this.reactionImage?.setDepth(depth);
    this.basicShotImage?.setDepth(depth);
    this.turnImage?.setDepth(depth);
    this.secondarySurface?.setDepth(depth);
  }

  drawPlayer(now, moving, bulletColor) {
    if(this.disposed || !this.playerImage?.active || !this.scene.player?.active)return false;
    if(this.postUpdatePlayerFrame){
      this.pendingPlayerFrame={now,moving,bulletColor};
      return true;
    }
    return this.drawPlayerFrame(now,moving,bulletColor);
  }

  flushPlayerFrame() {
    const frame=this.pendingPlayerFrame;this.pendingPlayerFrame=null;
    const s=this.scene;
    if(!frame || this.disposed || !s.player?.active || !this.playerImage?.active
      || s._battlePaused || s._battleEnded || s._publicBattleDialog)return;
    // Constrain Arcade's final Sprite writeback before sampling locomotion/contact.
    s.oldStreet?.settlePlayer?.();
    s.playerGfx?.clear();
    this.drawPlayerFrame(frame.now,frame.moving,frame.bulletColor);
    s._updatePlayerReadabilityMarker?.(s.isMoving);
    s._updatePlayerDangerPressureRim?.();
    s._updatePublicStage1ObjectiveRouteCue?.();
    s.oldStreet?.sync();
    if(this.sakuraView?.state?.refined||(this.userCastView&&(!s.openingStreetCamera||s.openingStreetCamera.disposed)))s._updatePublicStage1AttackCues?.(true);
  }

  drawPlayerFrame(now, moving, bulletColor) {
    const {scene,playerImage}=this;const player=scene.player;
    if (this.disposed || !playerImage?.active || !player?.active) return false;
    if(this.userCastView){
      this.userCastView.update(now,Boolean(scene._battlePaused||scene._battleEnded||scene._publicBattleDialog));
      this.state=this.userCastView.state;
      scene.playerGfx?.lineStyle(1.5,0xffffff,.9).strokeCircle(player.x,player.y,4);
      scene.playerGfx?.lineStyle(.7,0x172326,1).strokeCircle(player.x,player.y,5);
      scene.publicPerformerRun?.actionFeedback?.update(now,this.userCastView);
      this.syncGroundContacts();
      return true;
    }
    this.qRebaseView?.restoreLegacy();
    const frozen=Boolean(scene._battlePaused || scene._battleEnded || scene._publicBattleDialog);
    const dx=player.x-this.lastX,dy=player.y-this.lastY;
    this.lastX=player.x;this.lastY=player.y;
    moving=Math.abs(dx)+Math.abs(dy)>0.05;
    if(this.freshSakura && !frozen && moving) this.direction=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
    const actions=scene.publicPerformerRun?.actions || 0;
    const attack=scene.publicPerformerRun?.sakuraCombat?.snapshot(now);
    if(!frozen){
      if(actions>this.actions){
        this.actionUntil=now+260;
        const presentation=scene.publicPerformerRun?.actionPresentation;
        this.actionFacing=presentation?.sequence===actions?presentation.direction:null;
      }
      const release=scene.publicPerformerRun?.actionFeedback?.lastRelease;
      if(this.genyaView && release && release.sequence===actions && release!==this.observedActionRelease){
        this.observedActionRelease=release;this.actionUntil=now+260;
        this.genyaView.beginActionRelease();
      }
      // An anchor heal can cancel the net HP delta between two rendered frames.
      const recordedHits=scene.battleRecord?.playerHitCount || 0;
      if(recordedHits>this.observedHits||player.hp<this.hp){this.hurtUntil=now+180;this.hitSequence++;}
      this.observedHits=recordedHits;
      this.actions=actions;this.hp=player.hp;
      this.state=now<this.hurtUntil?'hurt':now<this.actionUntil?'action':moving?'walk':'idle';
      if(attack){this.state=attack.kind==='basic'?'attack':attack.kind;this.direction=attack.direction;}
    }
    if(this.freshSakura){
      this.sakuraView.update(now,dx,dy,attack,frozen,now<this.hurtUntil,this.hitSequence);
      if(!frozen&&!this.qRebaseView)scene.publicPerformerRun?.sakuraCombat?.draw?.(now);
    }else if(this.venusView){
      this.venusView.update(now,dx,dy,{frozen,hurt:now<this.hurtUntil,action:now<this.actionUntil,actionFacing:this.actionFacing});
      this.state=this.venusView.pose?.state??this.state;this.direction=this.venusView.pose?.facing??this.direction;
    }else if(this.genyaView){
      this.genyaView.update(now,dx,dy,{frozen,hurt:now<this.hurtUntil,action:now<this.actionUntil,actionFacing:this.actionFacing});
      this.state=this.genyaView.pose?.state??this.state;this.direction=this.genyaView.pose?.facing??this.direction;
    }else if(this.kaiView){
      this.kaiView.update(now,dx,dy,{frozen,hurt:now<this.hurtUntil,action:now<this.actionUntil,actionFacing:this.actionFacing});
      this.state=this.kaiView.pose?.state??this.state;this.direction=this.kaiView.pose?.facing??this.direction;
    }else if(this.enjoView){
      this.enjoView.update(now,dx,dy,{frozen,hurt:now<this.hurtUntil,action:now<this.actionUntil,actionFacing:this.actionFacing});
      this.state=this.enjoView.pose?.state??this.state;this.direction=this.enjoView.pose?.facing??this.direction;
    }else{
      if(!frozen)this.playerShadow?.setPosition(player.x,player.y+26)
        .setAlpha(.16*(scene.playerGfx?.alpha??1));
      const visualY=performerVisualY(player.y,this.visualMetrics.scale);
      this.secondarySurface?.restore();
      const pose=this.celMotion.sample({now,dx,dy,state:this.state,actionUntil:this.actionUntil,actionFacing:this.actionFacing,frozen});
      this.direction=pose.facing;
      // Unlike foot integration, a bounded turn must finish across a long render frame.
      const dt=this.turnLastNow===null?0:Math.max(0,Math.min(160,now-this.turnLastNow));
      this.turnLastNow=now;
      const immediate=!!this.celMotion.aim||this.state==='hurt'||this.state==='action'||!this.turnImage?.active||!this.footRig;
      if(!frozen)this.turnPose=advanceSakuraTurn(this.turnState,pose.facing,dt,immediate);
      const turn=this.turnPose??{frame:null,direction:pose.facing};
      const visualRow=REACTION_DIRECTIONS.indexOf(turn.direction)*4;
      playerImage.setFrame(pose.frame)
        .setPosition(player.x,visualY)
        .setAngle(0)
        .setAlpha(scene.playerGfx?.alpha ?? 1)
        .setTint(this.state==='hurt'?0xFFB4C1:0xFFFFFF);
      if(this.footRig){
        this.footRig.update(now,dx,dy,turn.direction,frozen,playerImage.alpha,this.state==='hurt'?0xFFB4C1:0xFFFFFF);
        if(pose.frame<16)playerImage.setFrame(visualRow+Math.floor(this.footRig.state.phase*4));
        else if(pose.frame<32)playerImage.setFrame(16+visualRow+pose.frame%4);
        playerImage.setCrop(0,0,128,88).setPosition(player.x,visualY+this.footRig.upperOffset);
        this.playerLegs.setVisible(false);
      }else if(pose.lowerFrame!==null){
        playerImage.setCrop(0,0,128,pose.splitY);
        this.playerLegs.setFrame(pose.lowerFrame).setCrop(0,pose.splitY,128,128-pose.splitY)
          .setPosition(player.x,visualY).setAlpha(playerImage.alpha)
          .setTint(this.state==='hurt'?0xFFB4C1:0xFFFFFF).setVisible(true);
      }else{
        playerImage.setCrop();this.playerLegs.setVisible(false);
      }
      if(this.reactionImage && !frozen){
        const reacting=this.state==='hurt' && now<this.hurtUntil;
        this.reactionImage.setVisible(reacting);playerImage.setVisible(!reacting);
        if(reacting){
          const frame=Math.min(3,Math.floor(Math.max(0,now-(this.hurtUntil-180))/45));
          this.reactionImage.setFrame(REACTION_DIRECTIONS.indexOf(pose.facing)*4+frame)
            .setPosition(player.x,visualY+(this.footRig?.upperOffset || 0))
            .setAlpha(playerImage.alpha).setTint(0xFFB4C1);
          this.reactionImage.setCrop(0,0,128,88);
        }
      }
      if(!frozen){
        const shooting=pose.shotFrame!=null && this.basicShotImage?.active && !this.reactionImage?.visible;
        this.basicShotImage?.setVisible(Boolean(shooting));
        if(shooting)this.basicShotImage.setFrame(pose.shotFrame).setCrop(0,0,128,88)
          .setPosition(player.x,visualY+(this.footRig?.upperOffset||0))
          .setAlpha(playerImage.alpha).setTint(0xFFFFFF);
        const turning=!immediate&&turn.frame!==null;
        this.turnImage?.setVisible(turning);
        if(turning)this.turnImage.setFrame(turn.frame).setCrop(0,0,128,88)
          .setPosition(player.x,visualY+this.footRig.upperOffset)
          .setAlpha(playerImage.alpha).setTint(0xFFFFFF);
        // Complete cels replace each other; alpha blending would duplicate facial features.
        playerImage.setVisible(!turning&&!shooting&&!this.reactionImage?.visible);
      }
      // Optional upper layers never replace locomotion when the foot atlas is absent.
      if((this.reactionImage?.visible||this.basicShotImage?.visible) && !this.footRig){
        this.playerLegs.setFrame(pose.frame).setCrop(0,88,128,40)
          .setPosition(player.x,visualY).setAlpha(playerImage.alpha)
          .setTint(this.reactionImage?.visible?0xFFB4C1:0xFFFFFF).setVisible(true);
      }
      const upper=[this.reactionImage,this.basicShotImage,this.turnImage,playerImage].find(image=>image?.visible);
      const balance=this.bodyBalance.sample(now,dx,dy,this.footRig?.state.phase??0,frozen,
        this.state==='hurt'||this.state==='action'?0:pose.shotFrame!=null?.35:1);
      this.secondarySurface?.present(upper,now,dx,dy,frozen,balance);
    }
    this.qRebaseView?.update(now,attack,frozen);
    if(this.qRebaseView&&this.freshSakura&&!frozen)scene.publicPerformerRun?.sakuraCombat?.draw?.(now);
    this.shotFeedback?.update(now,this.qRebaseView||this.venusView||this.genyaView||this.kaiView||this.enjoView);
    scene.publicPerformerRun?.actionFeedback?.update(now,this.qRebaseView||this.venusView||this.genyaView||this.kaiView||this.enjoView);
    const gfx=scene.playerGfx;
    // Formal layered costumes share Sakura's open contact boundary.
    if(this.sakuraView?.state?.refined===true||this.venusView||this.genyaView||this.kaiView||this.enjoView){
      gfx.lineStyle(1.6,0x172326,1);gfx.strokeCircle(player.x,player.y,4);
      gfx.lineStyle(.65,0xFFFFFF,1);gfx.strokeCircle(player.x,player.y,4);
      gfx.fillStyle(bulletColor,1);gfx.fillCircle(player.x,player.y,.75);
    }else{
      gfx.fillStyle(0x172326,1);gfx.fillCircle(player.x,player.y,4.5);
      gfx.fillStyle(bulletColor,1);gfx.fillCircle(player.x,player.y,4);
    }
    if(player.hp<=2){gfx.lineStyle(2,0xF07078,0.65);gfx.strokeCircle(player.x,player.y,13);}
    this.syncGroundContacts();
    return true;
  }

  syncGroundContacts(){
    if(!this.groundContacts||this.disposed)return;
    const view=this.userCastView||this.sakuraView||this.venusView||this.genyaView||this.kaiView||this.enjoView;
    (view?.shadow||this.playerShadow)?.setVisible(false);
    this.groundContacts.update({player:this.scene.player,feet:performerGroundFeet(this),
      alpha:this.scene.playerGfx?.alpha??1,enemies:this.enemies.values()});
  }

  drawEnemy(gfx, role, state, paintRatio=0, reactionColor=null) {
    const art=getEnemyArt(role);
    if(this.disposed || !gfx || !art || !this.scene.textures?.exists(art.key))return false;
    let item=this.enemies.get(gfx);
    if(!item){
      const image=this.scene.add.image(gfx.x+art.offset,gfx.y+art.offset,art.key)
        .setDisplaySize(art.size,art.size).setDepth(gfx.depth-0.01);
      // Source-alpha backing separates the existing silhouette, without a target ring or new art.
      const contrastImages=this.scene.game?.renderer?.gl&&isPublicTargetFocusEnabled(this.scene)&&['finale-boss','finale-weak-point'].includes(role)
        ? [[0x172326,12],[0xFFFFFF,8]].map(([color,padding],index)=>this.scene.add.image(image.x,image.y,art.key)
          .setDisplaySize(art.size+padding,art.size+padding).setTintFill(color).setDepth(image.depth-0.000002+index*0.000001)) : [];
      const dispose=()=>{gfx.off('destroy',dispose);for(const n of contrastImages)n.destroy();image.destroy();this.enemies.delete(gfx);};
      const now=this.scene.publicPerformerRun?.now() ?? this.scene.time?.now ?? 0;
      gfx.once('destroy',dispose);item={image,contrastImages,art,dispose,role,state,
        motion:createEnemyMotion(role,{now,x:gfx.x,y:gfx.y,state})};this.enemies.set(gfx,item);
    }
    item.state=state;
    const exposed=canEnemyBePublicStage1PaintTarget({active:true,publicStage1EnemyRole:role,publicStage1EnemyState:state});
    item.baseTint=exposed?0xFFFFFF:0xA6B4BD;
    if(!this._syncEnemyPaintTint(item,this.scene.publicPerformerRun?.now()??this.scene.time?.now))item.image.setTint(item.baseTint);
    const {offset,radius}=art, color=COLORS[reactionColor] || 0x77D6C3;
    gfx.clear();
    gfx.lineStyle(2,color,0.95);
    gfx.lineBetween(offset-10,offset-radius-8,offset-3,offset-radius-8);
    gfx.lineBetween(offset+3,offset-radius-8,offset+10,offset-radius-8);
    drawEnemyStateCue(gfx,{role,state,radius,offset});
    const ratio=Math.max(0,Math.min(1,Number(paintRatio)||0));
    if(ratio>0){
      const y=offset+radius+11;
      gfx.lineStyle(5,0x302A38,0.95);
      gfx.lineBetween(offset-12,y,offset+12,y);
      gfx.lineStyle(3,0xE8F1F0,0.95);
      gfx.lineBetween(offset-12,y,offset+12,y);
      gfx.lineStyle(3,color,0.95);
      gfx.lineBetween(offset-12,y,offset-12+24*ratio,y);
    }
    return true;
  }

  notifyEnemyPaintHit(gfx,now) {
    const s=this.scene,item=this.enemies.get(gfx);
    if(this.disposed||!s._userCastPresentation||s._isPublicStage1Round?.()!==true||s.battleData?.defenseMode
      ||s._battlePaused||s._battleEnded||s._publicBattleDialog||!s.player?.active||!(s.player.hp>0)
      ||!gfx?.active||!item?.image?.active||!Number.isFinite(now)||now-(item.paintHitAt??-Infinity)<350)return false;
    item.paintHitAt=now;
    this._syncEnemyPaintTint(item,now);
    return true;
  }

  _syncEnemyPaintTint(item,now) {
    if(!this.scene._userCastPresentation||!Number.isFinite(item.paintHitAt))return false;
    const age=now-item.paintHitAt;
    if(age>=0&&age<70){item.paintHitTinted=true;item.image.setTint(0xA8E8F4);return true;}
    if(item.paintHitTinted){item.paintHitTinted=false;item.image.setTint(item.baseTint);return true;}
    return false;
  }

  notifyEnemyRelease(gfx,pulse,now,capture=null) {
    if(this.disposed)return false;
    const item=this.enemies.get(gfx);
    return notifyEnemyMotionRelease(item?.motion,{now,pulse,capture,state:item?.state ?? null});
  }

  syncEnemies() {
    if(this.disposed)return;
    const now=this.scene.publicPerformerRun?.now() ?? this.scene.time?.now ?? 0;
    const owners=this.scene.enemies?.getChildren?.() || [];
    for(const [gfx,item] of this.enemies){
      if(gfx.active===false){item.dispose();continue;}
      const owner=owners.find(enemy=>enemy.active!==false&&enemy.gfx===gfx);
      const pose=advanceEnemyMotion(item.motion,{now,x:gfx.x,y:gfx.y,
        state:owner?.publicStage1EnemyState ?? item.state,pulse:owner?.publicStage1CuePulse ?? null,
        chaserState:owner?.chapterChaserMotion?.state ?? null,
        capture:owner?.publicStage1CueCapture ?? null,
        paused:this.scene._battlePaused===true || this.scene._battleEnded===true});
      const position=enemyGroundPose(item.art,gfx,pose.rotation);
      item.ground=position.ground;
      item.image.setRotation?.(pose.rotation);
      item.image.setPosition(position.x,position.y)
        .setVisible(gfx.visible!==false).setAlpha(gfx.alpha ?? 1);
      item.contrastImages?.forEach((n,index)=>n.setRotation(pose.rotation).setPosition(position.x,position.y)
        .setVisible(gfx.visible!==false).setAlpha(gfx.alpha??1).setDepth(item.image.depth-0.000002+index*0.000001));
      this._syncEnemyPaintTint(item,now);
    }
    this.syncGroundContacts();
  }

  captureDefeatPose(resultType) {
    const {scene}=this,p=scene.player;
    if(this.userCastView&&resultType==='player-defeat'&&!this.disposed)return this.userCastView.captureDefeat();
    if(this.venusView&&resultType==='player-defeat'&&!this.disposed&&p?.active&&p.hp<=0
      &&Number.isFinite(p.x+p.y))return this.venusView.captureDefeat();
    if(this.genyaView&&resultType==='player-defeat'&&!this.disposed&&p?.active&&p.hp<=0
      &&Number.isFinite(p.x+p.y))return this.genyaView.captureDefeat();
    if(this.kaiView&&resultType==='player-defeat'&&!this.disposed&&p?.active&&p.hp<=0
      &&Number.isFinite(p.x+p.y))return this.kaiView.captureDefeat();
    if(this.enjoView&&resultType==='player-defeat'&&!this.disposed&&p?.active&&p.hp<=0
      &&Number.isFinite(p.x+p.y))return this.enjoView.captureDefeat();
    if(resultType!=='player-defeat' || this.disposed || this.freshSakura
      || scene.battleData?.practiceMode===true || Number(scene.battleData?.stageId || 1)!==1
      || !p?.active || !Number.isFinite(p.hp) || p.hp>0
      || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !this.reactionImage?.active)return null;
    return Object.freeze({x:p.x,y:performerVisualY(p.y,this.visualMetrics.scale),direction:this.direction,
      art:this.reactionArt,frameOffset:16,size:this.visualMetrics.displaySize,originY:.5});
  }

  destroy() {
    if(this.disposed)return;this.disposed=true;
    this.userCastView?.destroy();this.userCastView=null;
    this.qRebaseView?.destroy();this.qRebaseView=null;
    this.groundContacts?.destroy();this.groundContacts=null;
    this.shotFeedback?.destroy();this.shotFeedback=null;this.lastBasicShotAccepted=false;
    if(this.postUpdatePlayerFrame)this.scene.events.off('postupdate',this.postUpdatePlayerFrame);
    this.postUpdatePlayerFrame=null;this.pendingPlayerFrame=null;
    this.secondarySurface?.destroy();this.secondarySurface=null;
    if(this.venusView)this.venusView.destroy();
    else if(this.genyaView)this.genyaView.destroy();
    else if(this.kaiView)this.kaiView.destroy();
    else if(this.enjoView)this.enjoView.destroy();
    else if(this.sakuraView)this.sakuraView.destroy();else this.playerImage?.destroy();
    this.venusView=null;
    this.genyaView=null;
    this.kaiView=null;
    this.enjoView=null;
    this.sakuraView=null;this.playerImage=null;
    this.playerShadow?.destroy();this.playerShadow=null;
    this.playerLegs?.destroy();this.playerLegs=null;this.celMotion=null;
    this.footRig?.destroy();this.footRig=null;
    this.reactionImage?.destroy();this.reactionImage=null;
    this.basicShotImage?.destroy();this.basicShotImage=null;
    this.turnImage?.destroy();this.turnImage=null;this.turnState=null;this.turnPose=null;
    this.controlBand?.destroy();this.controlBand=null;
    for(const item of this.enemies.values())item.dispose();
    this.enemies.clear();
  }
}
