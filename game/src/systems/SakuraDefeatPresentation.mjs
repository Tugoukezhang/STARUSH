import {SakuraNativeDefeatPresentation} from './SakuraNativeDefeatPresentation.mjs';
import {SakuraRefinedDefeatPresentation} from './SakuraRefinedDefeatPresentation.mjs';
import {VenusDefeatPresentation} from './VenusDefeatPresentation.mjs';
import {GenyaDefeatPresentation} from './GenyaDefeatPresentation.mjs';
import {KaiDefeatPresentation} from './KaiDefeatPresentation.mjs';
import {EnjoDefeatPresentation} from './EnjoDefeatPresentation.mjs';
import {QRebaseDefeatView} from './QRebaseTrialPresentation.mjs';

export const SAKURA_DEFEAT_ART = Object.freeze({
  key: 'sakura-defeat-20260922',
  path: 'art/sakura-defeat-20260922/defeat.png',
  frameWidth: 256,
  frameHeight: 256,
});

const DIRECTIONS = Object.freeze(['down', 'left', 'right', 'up']);
const FRAME_TIMES = Object.freeze([80, 220, 380]);
export const SAKURA_DEFEAT_DURATION = 560;

export function captureSakuraDefeat(actor, resultType) {
  if(actor?.qRebaseView&&resultType==='player-defeat')return actor.qRebaseView.captureDefeat();
  if(actor?.nativeSakura){
    const scene=actor.scene,player=scene?.player,view=actor.sakuraView;
    if(resultType!=='player-defeat'||!actor.freshSakura||actor.disposed||scene?.battleData?.practiceMode===true
      ||!player?.active||!Number.isFinite(player.hp)||player.hp>0||!Number.isFinite(player.x)||!Number.isFinite(player.y)
      ||view?.disposed||!view?.activeRig||!view.pose||!view.textureKey)return null;
    if(view.captureDefeatSnapshot)return Object.freeze({native:true,x:player.x,y:player.y,...view.captureDefeatSnapshot()});
    return Object.freeze({native:true,x:player.x,y:player.y,direction:view.state.direction,textureKey:view.textureKey,worldDepth:view.worldDepth,
      presentation:view.presentation?{...view.presentation}:{scale:1,groundOffset:26},
      rig:structuredClone(view.activeRig),pose:structuredClone(view.pose),rootShift:view.rootShift.slice(),
      layers:view.layers?.map(l=>({rig:structuredClone(l.rig),pose:structuredClone(l.pose),rootShift:l.rootShift.slice(),textureKey:l.textureKey,
        parts:l.nodes.map(n=>n.part.name),order:l.nodes.map(n=>view.nodes.indexOf(n))}))});
  }
  // Keep the existing battle-end owner while other reviewed performers supply their own art.
  if(actor && !actor.freshSakura)return actor.captureDefeatPose?.(resultType) ?? null;
  const scene = actor?.scene;
  const player = scene?.player;
  if (resultType !== 'player-defeat' || !actor?.freshSakura || actor.disposed
      || scene?.battleData?.practiceMode === true || !player?.active
      || !Number.isFinite(player.hp) || player.hp > 0
      || !Number.isFinite(player.x) || !Number.isFinite(player.y)
      || !actor.sakuraView?.upper?.active) return null;
  const direction = actor.sakuraView.state?.upperDirection;
  return Object.freeze({ x: player.x, y: player.y,
    direction: DIRECTIONS.includes(direction) ? direction : 'down' });
}

// Combat has already ended. This owns only the short, cancelable result transition.
export class SakuraDefeatPresentation {
  constructor(scene, pose, onComplete) {
    this.started = false;
    this.disposed = false;
    this.timers = [];
    this.image = null;
    if(pose?.qRebaseTrial){
      this.qRebase=new QRebaseDefeatView(scene,pose,SAKURA_DEFEAT_DURATION,()=>{this.disposed=true;onComplete?.();});
      this.started=this.qRebase.started;return;
    }
    if(pose?.venus){
      this.venus=new VenusDefeatPresentation(scene,pose,SAKURA_DEFEAT_DURATION,()=>{this.disposed=true;onComplete?.();});
      this.started=this.venus.started;return;
    }
    if(pose?.genya){
      this.genya=new GenyaDefeatPresentation(scene,pose,SAKURA_DEFEAT_DURATION,()=>{this.disposed=true;onComplete?.();});
      this.started=this.genya.started;return;
    }
    if(pose?.kai){
      this.kai=new KaiDefeatPresentation(scene,pose,SAKURA_DEFEAT_DURATION,()=>{this.disposed=true;onComplete?.();});
      this.started=this.kai.started;return;
    }
    if(pose?.enjo){
      this.enjo=new EnjoDefeatPresentation(scene,pose,SAKURA_DEFEAT_DURATION,()=>{this.disposed=true;onComplete?.();});
      this.started=this.enjo.started;return;
    }
    if(pose?.native){
      const Presentation=pose.variant==='refined'?SakuraRefinedDefeatPresentation:SakuraNativeDefeatPresentation;
      this.native=new Presentation(scene,pose,SAKURA_DEFEAT_DURATION,()=>{this.disposed=true;onComplete?.();});
      this.started=this.native.started;return;
    }
    const art=pose?.art || SAKURA_DEFEAT_ART;
    if (!pose || !scene.textures?.exists(art.key) || !scene.time?.delayedCall) return;
    this.onComplete = onComplete;
    this.started = true;
    const row = Math.max(0, DIRECTIONS.indexOf(pose.direction));
    const startFrame=(pose.frameOffset || 0)+row*4,size=pose.size || 88;
    const frames=pose.frames||[startFrame,startFrame+1,startFrame+2,startFrame+3];
    this.image = scene.add.image(pose.x, pose.y, art.key, frames[0])
      .setDisplaySize(size, size).setOrigin(pose.originX??0.5, pose.originY ?? (245 / 256 - 26 / 88)).setDepth(9.81);
    this.image.setFlipX?.(pose.flipX===true);
    FRAME_TIMES.forEach((time, index) => {
      this.timers.push(scene.time.delayedCall(time, () => {
        if (!this.disposed) this.image.setFrame(frames[index+1]);
      }));
    });
    this.timers.push(scene.time.delayedCall(SAKURA_DEFEAT_DURATION, () => {
      if (this.disposed) return;
      const complete = this.onComplete;
      this.destroy();
      complete?.();
    }));
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.qRebase?.destroy();
    this.native?.destroy();
    this.venus?.destroy();
    this.genya?.destroy();
    this.kai?.destroy();
    this.enjo?.destroy();
    for (const timer of this.timers) timer.remove(false);
    this.timers.length = 0;
    this.image?.destroy();
    this.image = null;
    this.onComplete = null;
  }
}
