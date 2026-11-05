import {PublicFocusGesture,pickPublicFocusTarget,projectPublicFocusPoint,isPublicTargetFocusEnabled} from '../utils/publicTargetFocus.mjs';
import {canEnemyBePublicStage1PaintTarget} from './PublicStage1EnemyRoles.mjs';
import {PublicTargetFocusView} from './PublicTargetFocusView.mjs';
const roles={'unlit-chaser':'追击者','stage-cue-emitter':'声浪干扰','objective-disruptor':'设施干扰者','spotlight-captain':'领舞','finale-weak-point':'压轴弱点','finale-boss':'压轴目标'};
export class PublicTargetFocus{
 constructor(scene,{doc=globalThis.document,clock=()=>globalThis.performance?.now?.()??Date.now()}={}){
  this.scene=scene;this.clock=clock;this.target=null;this.disposed=false;this.gesture=new PublicFocusGesture();this.view=new PublicTargetFocusView({doc});
  this.handlers={pointerdown:p=>this.down(p),pointermove:p=>this.gesture.move(p),pointerup:p=>this.up(p),
   pointerupoutside:p=>{if(p?.button===undefined||p.button===0)this.gesture.cancel(p?.id);}};
  for(const [name,fn]of Object.entries(this.handlers))scene.input?.on?.(name,fn);
  this.doc=doc;this.win=doc?.defaultView||globalThis.window;this.interrupt=()=>this.suspend();this.visibility=()=>{if(doc.hidden)this.suspend();};
  this.win?.addEventListener?.('blur',this.interrupt);this.win?.addEventListener?.('pagehide',this.interrupt);doc?.addEventListener?.('touchcancel',this.interrupt);doc?.addEventListener?.('visibilitychange',this.visibility);
 }
 ready(){const s=this.scene;return !this.disposed&&isPublicTargetFocusEnabled(s)&&!!s.paintZone&&s.player?.active!==false&&s.player?.hp>0
  &&!s._battleEnded&&!s._battlePaused&&!s.publicPerformerRun?.choiceOpen&&!s._publicBattleDialog&&!s._sessionExperience?.isBlocking?.()&&s.input?.enabled!==false;}
 project(t){return projectPublicFocusPoint(this.scene.cameras?.main,t);}
 visible(t){const p=this.project(t),c=this.scene.cameras?.main;return !!p&&p.x>=0&&p.x<=c.width&&p.y>=112&&p.y<=c.height-40;}
 candidates(){const s=this.scene;return [...(s.paintZone?.finaleMode?[]:s.paintZone?.devices||[]),...(s.enemies?.getChildren?.()||[])];}
 eligible(t){
  const s=this.scene,zone=s.paintZone;if(!t||!this.candidates().includes(t)||!this.visible(t))return false;
  const device=zone?.devices?.includes(t);if(device?(zone.finaleMode||zone.canReceivePaint?.(t)!==true):!canEnemyBePublicStage1PaintTarget(t))return false;
  const run=s.publicPerformerRun,melee=run?.meleeCombat;
  // Selection is action intent, not permission for a remote basic melee hit.
  if(melee)return melee.available()&&melee.legal(t)&&s.oldStreet?.clearLine(s.player,t,2)!==false
   &&(device?run.isActionFixtureTarget(t,s.player.x,s.player.y):run.isActionEnemyTarget(t,s.player.x,s.player.y));
  if(s.publicPerformerRun?.sakuraCombat?.canAimAt?.(t)===false||s.oldStreet?.clearLine(s.player,t)===false)return false;
  const range=s._getPublicStage1PaintTargetRange?.(t),origin=s._getPublicStage1PaintShotOrigin?.(t);
  return Number.isFinite(range)&&range>0&&Math.hypot(t.x-s.player.x,t.y-s.player.y)<=range
   &&Number.isFinite(origin?.x)&&Number.isFinite(origin?.y);
 }
 field(p){
  const s=this.scene,c=s.cameras?.main,rest=s._joystickRest||{x:68,y:571};
  return Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&(p.button===undefined||p.button===0)&&!p.wasCanceled
   &&p.x>=0&&p.x<=c.width&&p.y>=112&&p.y<=c.height-40&&!s._isMobileControlPointer?.(p)
   &&Math.hypot(p.x-rest.x,p.y-rest.y)>64;
 }
 down(p){if(this.ready()&&this.field(p))this.gesture.begin(p,this.clock());}
 up(p){
  // Phaser shares one mouse Pointer id and records the last released button; right/middle releases must not end a left tap.
  if(p?.button!==undefined&&p.button!==0)return;
  const tap=this.gesture.end(p,this.clock());if(!tap||!this.ready()||!this.field(p))return;
  const target=pickPublicFocusTarget({point:tap,candidates:this.candidates(),project:t=>this.project(t),isEligible:t=>this.eligible(t)});
  const previous=this.target;this.target=target===this.target?null:target;this.update();
  if(previous===this.target)return;
  this.scene._showPublicBattleNotice?.(this.target?'集火 · '+this.label(this.target):'恢复自动选取',{kind:'action',duration:1000});
 }
 label(t){const name=typeof t.sourceLabel==='string'?t.sourceLabel:t.label;return typeof name==='string'&&name.trim()?name.replaceAll('\n',' '):roles[t.publicStage1EnemyRole]||'目标';}
 getTarget(){
  if(this.disposed)return null;
  if(this.target&&!this.eligible(this.target)){this.target=null;this.view.hide();}
  return this.ready()?this.target:null;
 }
 suspend(){this.gesture.clear();this.view.hide();}
 update(){
  if(!this.ready()){this.suspend();return;}
  const t=this.getTarget();if(!t){this.view.hide();return;}
  const p=this.project(t),c=this.scene.cameras.main,melee=this.scene.publicPerformerRun?.meleeCombat;
  this.view.show(p,this.label(t),c.width,c.height,melee?melee.canAimAt(t):true);
 }
 destroy(){
  if(this.disposed)return;this.disposed=true;this.target=null;this.gesture.clear();this.view.destroy();
  for(const [name,fn]of Object.entries(this.handlers))this.scene.input?.off?.(name,fn);
  this.win?.removeEventListener?.('blur',this.interrupt);this.win?.removeEventListener?.('pagehide',this.interrupt);this.doc?.removeEventListener?.('touchcancel',this.interrupt);this.doc?.removeEventListener?.('visibilitychange',this.visibility);
 }
}
