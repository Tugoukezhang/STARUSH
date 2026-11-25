import {canEnemyBePublicStage1PaintTarget,isCloseContactThreat} from './PublicStage1EnemyRoles.mjs';
import {circleIntersectsFan} from './SakuraCombat.mjs';
import {STAGE1_PAINT_PER_HIT} from '../utils/stage1PaintRound.mjs';
import {PublicPaintContactReceipt} from './PublicPaintContactReceipt.mjs';

const KITS=Object.freeze({kai:{reach:84,halfAngle:Math.PI/3,cycle:300,windup:78,active:82},
 enjo:{reach:76,halfAngle:Math.PI*.43,cycle:420,windup:128,active:102}});
const PRIORITY={'finale-weak-point':4,'finale-boss':3,'spotlight-captain':2,'objective-disruptor':2,'stage-cue-emitter':1};

// Ordinary owner melee only. No projectile, wall-clock timer or saved pending attack.
export class PerformerMeleeCombat{
 constructor(scene,run){this.scene=scene;this.run=run;this.kit=KITS[run.member.id];this.attack=null;this.nextAt=-Infinity;this.sequence=0;this.destroyed=false;this.stats={started:0,swings:0,contacts:0,blocked:0,cancelled:0};}
 available(){const s=this.scene;return !!this.kit&&!this.destroyed&&s.publicPerformerRun===this.run&&this.run.alive()&&s._userCastPresentation===true
  &&s.player?.active!==false&&s.player?.hp>0&&!s._battleEnded&&!s._publicBattleDialog&&!this.run.choiceOpen
  &&s._battlePerformerContract?.publicActionOwnerId===this.run.member.id;}
 enemies(){return this.scene.enemies?.getChildren?.()||[];}
 fixture(t){const z=this.scene.paintZone;return !!t&&z?.devices?.includes(t)&&!z.finaleMode&&!t.complete
  &&t.zone<=(z.currentZone??0)&&t.publicStage1Suppressed!==true&&z.canReceivePaint?.(t)!==false;}
 legal(t){if(!t||![t.x,t.y].every(Number.isFinite))return false;
  if(this.fixture(t))return true;
  return this.enemies().includes(t)&&t.hp!==0&&!(Number.isFinite(t.hp)&&t.hp<0)
   &&(canEnemyBePublicStage1PaintTarget(t)||this.scene._getPublicStage1ProtectedBossTarget?.()===t);}
 radius(t){return this.scene.paintZone?.devices?.includes(t)?12:Math.min(48,Math.max(0,Number(t?.drawRadius)||28));}
 canAimAt(t){const p=this.scene.player;return this.available()&&this.legal(t)&&[p?.x,p?.y].every(Number.isFinite)
  &&Math.hypot(t.x-p.x,t.y-p.y)<=this.kit.reach+this.radius(t)&&this.scene.oldStreet?.clearLine(p,t,2)!==false;}
 selectTarget(){
  if(!this.available()||this.scene._battlePaused)return null;
  const s=this.scene,p=s.player,focus=s.publicTargetFocus?.getTarget?.();if(this.canAimAt(focus))return focus;
  let best=s.paintZone?.getNearestPaintable?.(p.x,p.y,t=>this.canAimAt(t))||null;
  if(best&&!this.canAimAt(best))best=null;
  const protectedBoss=s._getPublicStage1ProtectedBossTarget?.();
  let bestPriority=0,bestDistance=best?Math.hypot(best.x-p.x,best.y-p.y):Infinity;
  for(const t of this.enemies()){
   if(t===protectedBoss||!this.canAimAt(t))continue;
   const distance=Math.hypot(t.x-p.x,t.y-p.y);
   const priority=PRIORITY[t.publicStage1EnemyRole] || (isCloseContactThreat(t,distance) ? 0.5 : 0);
   if(priority>bestPriority || (priority===bestPriority && distance<bestDistance)){
    best=t;bestPriority=priority;bestDistance=distance;
   }
  }
  return best||(this.canAimAt(protectedBoss)?protectedBoss:null);
 }
 beginBasic(target,now=this.run.now(),interval=333){
  if(!this.available()||this.scene._battlePaused||this.attack||!Number.isFinite(now)||now<this.nextAt||!this.canAimAt(target))return false;
  const s=this.scene,p=s.player,angle=Math.atan2(target.y-p.y,target.x-p.x),cycle=Math.max(this.kit.cycle,Number.isFinite(interval)&&interval>0?interval:333);
  if(s.actorPresentation?.userCastView?.state==='hurt'||s.actorPresentation?.userCastView?.state==='action')return false;
  if(s.actorPresentation?.notifyBasicShot?.(now,Math.cos(angle),Math.sin(angle),cycle)===false)return false;
  this.attack={id:++this.sequence,target,startedAt:now,angle,cycle,windup:this.kit.windup,active:this.kit.active,
   actions:this.run.actions,hits:s.battleRecord?.playerHitCount||0,color:s.currentColor||this.run.member.color,released:false};
  this.nextAt=now+cycle;this.stats.started++;return true;
 }
 snapshot(now=this.run.now()){
  const a=this.attack;if(!a)return null;const age=Math.max(0,now-a.startedAt),phase=age<a.windup?'windup':age<a.windup+a.active?'release':'recovery';
  const progress=phase==='windup'?age/a.windup:phase==='release'?(age-a.windup)/a.active:(age-a.windup-a.active)/Math.max(1,a.cycle-a.windup-a.active);
  const {target,...pose}=a;
  return {...pose,x:this.scene.player.x,y:this.scene.player.y,reach:this.kit.reach,phase,progress:Math.max(0,Math.min(1,progress))};
 }
 update(now=this.run.now()){
  if(!this.available()){this.clear();return;}
  const a=this.attack;if(!a)return;
  if(a.actions!==this.run.actions||a.hits!==(this.scene.battleRecord?.playerHitCount||0)){this.clear();return;}
  if(this.scene._battlePaused)return;
  if(!a.released&&now-a.startedAt>=a.windup){
   a.released=true;
   this.resolve(a,now);
   if(!this.available()){this.clear();return;}
  }
  if(this.attack!==a)return;
  if(a.strokeOrigin){
   const step=Math.min(4,1+Math.floor(Math.max(0,now-a.startedAt-a.windup)/a.active*4));
   if(step>(a.strokeStep||0)){
    a.strokeStep=step;
    this.scene.paintZone?.paintAttackFan?.({...a.strokeOrigin,angle:a.angle,radius:this.kit.reach,
     halfAngle:this.kit.halfAngle,innerRadius:this.kit.reach*.42,sweep:step/4,color:a.color});
   }
  }
  if(now-a.startedAt>=a.cycle)this.attack=null;
 }
 resolve(a,now){
  const s=this.scene,p=s.player,fan={x:p.x,y:p.y,angle:a.angle,radius:this.kit.reach,halfAngle:this.kit.halfAngle};
  if(s.oldStreet?.clearLine(p,p,2)===false)return;
  const clear=t=>s.oldStreet?.clearLine(p,t,2)!==false;
  const accept=t=>this.legal(t)&&circleIntersectsFan(fan,t,this.radius(t))&&clear(t);
  // A vanished primary must not silence another valid contact in the already locked fan.
  if(!this.legal(a.target)&&![...(s.paintZone?.devices||[]),...this.enemies()].some(accept)){this.clear();return;}
  let primary=null,blocked=false;
  const release={x:p.x+Math.cos(a.angle)*this.kit.reach*.48,y:p.y+Math.sin(a.angle)*this.kit.reach*.48};
  const receipt=new PublicPaintContactReceipt({source:'melee',...release,color:a.color});
  this.stats.swings++;
  const fx=s.actorPresentation?.userCastView?.weaponFx;
  if(clear(release)){
   fx?.meleeSwing?.({...release,angle:a.angle,reach:this.kit.reach,color:a.color,start:now});
  }
  s.p17Audio?.playShotTick?.({time:s.time?.now});
  for(const t of [...(s.paintZone?.devices||[])]){
   if(!this.available())return;
   if(!this.fixture(t)||!accept(t))continue;
   if(s.paintZone.applyPaint(t,STAGE1_PAINT_PER_HIT,a.color)===true){receipt.record({x:t.x,y:t.y,kind:'fixture'},t);this.stats.contacts++;}
  }
  for(const t of [...this.enemies()]){
   if(!this.available())return;
   if(!accept(t))continue;
   if(s._getPublicStage1ProtectedBossTarget?.()===t){
    t.publicBlockedHitAt=now;this.stats.blocked++;blocked=true;
    fx?.blocked?.({x:t.x-Math.cos(a.angle)*this.radius(t),y:t.y-Math.sin(a.angle)*this.radius(t),angle:a.angle,start:now});continue;
   }
   if(!canEnemyBePublicStage1PaintTarget(t))continue;
   s._paintPublicStage1TargetsAt(t.x,t.y,STAGE1_PAINT_PER_HIT,1,a.color,t,(contact,target)=>{
    receipt.record({...contact,direct:target===a.target},target);this.stats.contacts++;primary||=target;
   },{performer:this.run.member.id,angle:a.angle});
  }
  if(!this.available())return;
  this.run.lastPaintReceipt=receipt.snapshot();
  const contacts=this.run.lastPaintReceipt?.contacts||[],hitTargets=receipt.targets();
  const deposition=!blocked||contacts.length>0;
  // Sword ink follows its locked local release, never the later player/target position.
  if(this.run.member.id==='kai'&&deposition&&clear(release))a.strokeOrigin={x:p.x,y:p.y};
  // The heavy ground stroke belongs to its accepted primary contact, not the middle of the swing.
  const landing=this.run.member.id==='enjo'&&contacts.length?(receipt.contactFor(a.target)||contacts[0]):release;
  if(deposition&&clear(landing))s._stampGroundSplat?.(landing.x,landing.y,a.color,32,true,{performer:this.run.member.id,angle:a.angle});
  if(!this.available())return;
  const feedback=receipt.feedback({position:landing,radius:32,angle:a.angle,start:now,deposition,
   successfulPaint:contacts.length>0,sequence:a.id});
  this.run.lastPaintFeedback=feedback;
  if(feedback)this.run.lastPaintReceipt=feedback.receipt;
  if(deposition&&feedback)fx?.impact?.(feedback);
  if(contacts.length&&this.available())this.run.onImpact(release.x,release.y,a.color,primary,hitTargets,{x:fan.x,y:fan.y,angle:fan.angle});
 }
 clear(){if(this.attack&&!this.attack.released)this.stats.cancelled++;this.attack=null;}
 destroy(){if(this.destroyed)return;this.clear();this.destroyed=true;}
}
