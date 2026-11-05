import { canEnemyBePublicStage1PaintTarget } from './PublicStage1EnemyRoles.mjs';
import { STAGE1_PAINT_PER_HIT, STAGE1_PAINT_SHOT_RANGE } from '../utils/stage1PaintRound.mjs';
import { resolvePublicStage1SakuraEncorePaintAmount } from './PublicStage1SakuraActionContract.mjs';

const PALETTE = {pink:0xFF69B4,blue:0x00CED1,yellow:0xFFD700,purple:0x9370DB,orange:0xFF8C00};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const SAKURA_ATTACK_ART = Object.freeze({key:'sakura-fan-attack-20260913',
  path:'art/sakura-combat-20260913/fan-attack.png',frameWidth:160,frameHeight:160});
export const SAKURA_MOVING_ATTACK_ART = Object.freeze({key:'sakura-fan-moving-attack-20260913',
  path:'art/sakura-combat-20260913/fan-moving-attack.png',frameWidth:160,frameHeight:160});
// Historical source measurements are retained for diagnostics, not runtime hit geometry.
export const SAKURA_FAN_ROOTS = Object.freeze([[58,80],[48,85],[95,85],[62,85],
  [112,76],[47,78],[92,83],[59,87],[42,81],[115,84],[100,85],[92,87],
  [111,79],[114,80],[97,86],[107,86]].map(Object.freeze));
// Frozen combat-space contract. New visual registrations must not move legal hit geometry.
const COMMITTED_SOCKETS=Object.freeze([[92.34,146.69],[85.3,140.1],[62.97,140.1],[110.31,179.66],
  [92.94,144.93],[65.97,127.4],[54.39,129.59],[103.71,175.61],
  [162.46,161.27],[174.52,136.17],[181.47,131.79],[171.64,159.08],
  [157.87,162.89],[174.75,151.9],[165.75,149.7],[146.87,173.88]].map(Object.freeze));
export function sakuraFanRoot(player,frame) {
  const [x,y]=COMMITTED_SOCKETS[frame]??COMMITTED_SOCKETS[0];
  return {x:player.x+(x-128)*88/256,y:player.y+(y-245)*88/256+26};
}

export function sakuraFacing(angle) {
  const x=Math.cos(angle),y=Math.sin(angle);
  return Math.abs(x)>Math.abs(y) ? (x<0?'left':'right') : (y<0?'up':'down');
}

// Exact circle-to-closed-sector distance, including the two finite radial edges.
export function circleIntersectsFan(fan, target, targetRadius=0) {
  const dx=target.x-fan.x,dy=target.y-fan.y,d=Math.hypot(dx,dy),r=Math.max(0,targetRadius);
  if(d<=r)return true;
  const relative=Math.atan2(Math.sin(Math.atan2(dy,dx)-fan.angle),Math.cos(Math.atan2(dy,dx)-fan.angle));
  if(Math.abs(relative)<=fan.halfAngle)return d<=fan.radius+r;
  const edge=fan.angle+Math.sign(relative)*fan.halfAngle;
  const t=clamp(dx*Math.cos(edge)+dy*Math.sin(edge),0,fan.radius);
  return Math.hypot(dx-t*Math.cos(edge),dy-t*Math.sin(edge))<=r;
}

export class SakuraCombat {
  constructor(scene, run) {
    this.scene=scene;this.run=run;this.attack=null;this.gfx=null;this.destroyed=false;
    this.sequence=0;this.lastAttack=null;this.lastAngle=-Math.PI/2;this.launch=null;
    this.worldDepth=8.8;
  }
  available() {
    return !this.destroyed && this.run.alive() && !this.scene._battlePaused
      && this.scene.player?.active!==false && this.run.member.id==='sakura'
      && this.scene._battlePerformerContract?.publicActionOwnerId==='sakura';
  }
  get specialBusy() { return !!this.attack && this.attack.kind!=='basic'; }
  resolveLaunchOrigin(direction) {
    const p=this.scene.player,row={down:0,left:1,right:2,up:3}[direction];
    if(row===undefined || ![p?.x,p?.y].every(Number.isFinite))return null;
    const socket=sakuraFanRoot(p,row*4+1);
    const clear=(from,to)=>this.scene.oldStreet?.clearLine(from,to)!==false;
    if(!clear(p,p))return null;
    if(clear(p,socket))return socket;
    // Retract to the last clear prefix; an endpoint beyond a thin wall is not safe.
    let lo=0,hi=1;
    for(let i=0;i<24;i++){
      const t=(lo+hi)/2,point={x:p.x+(socket.x-p.x)*t,y:p.y+(socket.y-p.y)*t};
      if(clear(p,point))lo=t;else hi=t;
    }
    return {x:p.x+(socket.x-p.x)*lo,y:p.y+(socket.y-p.y)*lo};
  }
  canAimAt(target) {
    if(!target || target.active===false || target.complete || this.destroyed)return false;
    const p=this.scene.player;
    const origin=this.resolveLaunchOrigin(sakuraFacing(Math.atan2(target.y-p.y,target.x-p.x)));
    return !!origin && this.scene.oldStreet?.clearLine(p,target)!==false
      && this.scene.oldStreet?.clearLine(origin,target)!==false;
  }
  begin(kind,target,now,durations,onRelease=null) {
    if(!this.available() || (this.attack && (kind==='basic'||this.specialBusy)))return false;
    const p=this.scene.player;
    const bearing=target ? Math.atan2(target.y-p.y,target.x-p.x) : this.lastAngle;
    const direction=sakuraFacing(bearing),socket=this.resolveLaunchOrigin(direction);
    if(!socket || (target && !this.canAimAt(target)))return false;
    // Capture weapon-space aim once. Feet-space aim misses targets beside the hand.
    const angle=target ? Math.atan2(target.y-socket.y,target.x-socket.x) : bearing;
    const radius=(this.scene._getPublicStage1PaintTargetRange?.(target) || STAGE1_PAINT_SHOT_RANGE)
      +this.run.effects().paintRadiusBonus+(kind==='special'?40:0);
    this.lastAngle=bearing;
    this.attack={id:++this.sequence,kind,startedAt:now,windup:durations[0],release:durations[1],recovery:durations[2],
      x:p.x,y:p.y,angle,direction,radius,halfAngle:kind==='special'?Math.PI/3:Math.PI/6,
      color:this.scene.currentColor || 'pink',targets:new Set(),released:false,onRelease,
      power:this.run.effects().actionPower || 1,impactRecorded:false};
    return true;
  }
  beginBasic(target, now=this.run.now(), interval=333) {
    if(!target || target.active===false || target.complete)return false;
    const cycle=clamp(interval,180,600);
    return this.begin('basic',target,now,[cycle*.25,cycle*.45,cycle*.30]);
  }
  beginSpecial(target) {
    if(Number(this.scene._specialCharge)<100)return false;
    if(!this.begin('special',target,this.run.now(),[160,220,180]))return false;
    this.scene._specialCharge=0;this.scene._updateHUD?.();return true;
  }
  beginEncore(onRelease) { return this.begin('encore',null,this.run.now(),[220,260,180],onRelease); }
  snapshot(now=this.run.now()) {
    const a=this.attack;if(!a)return null;
    const age=Math.max(0,now-a.startedAt),phase=age<a.windup?'windup':age<a.windup+a.release?'release':'recovery';
    const progress=phase==='windup'?age/a.windup:phase==='release'?(age-a.windup)/a.release:(age-a.windup-a.release)/a.recovery;
    const direction=a.direction,row={down:0,left:1,right:2,up:3}[direction];
    const pose=phase==='windup'?0:phase==='release'?(progress<.5?1:2):3;
    return {id:a.id,kind:a.kind,phase,progress:clamp(progress,0,1),direction,frame:row*4+pose,
      angle:a.angle,x:a.x,y:a.y,radius:a.radius,color:a.color,hitCount:a.targets.size};
  }
  update(now=this.run.now()) {
    if(this.destroyed)return;
    if(!this.run.alive() || this.scene.player?.active===false){this.clear();return;}
    if(this.scene._battlePaused)return;
    const a=this.attack;if(!a)return;
    const age=now-a.startedAt;
    if(age<a.windup){a.x=this.scene.player.x;a.y=this.scene.player.y;}
    else {
      if(!a.released){
        const socket=this.resolveLaunchOrigin(a.direction);
        if(!socket){this.clear();return;}
        a.x=socket.x;a.y=socket.y;a.released=true;
        this.scene.p17Audio?.playShotTick?.({time:this.scene.time?.now});
        a.onRelease?.();
        if(this.destroyed || !this.run.alive())return;
      }
      // Sweep all missed radii after a slow frame; each target still resolves once.
      const front=a.radius*clamp((age-a.windup)/a.release,0,1);
      if(a.kind!=='encore' && !a.sweepComplete){
        // Surface pigment follows the issued attack, never a successful target/reward.
        if(front-(a.paintedFront || 0)>=12 || front>=a.radius){
          this.scene.paintZone?.paintAttackFan?.({...a,radius:front});
          a.paintedFront=front;
        }
        this.resolve(a,front);a.previousFront=front;a.sweepComplete=front>=a.radius;
      }
    }
    // The layered actor redraws attached FX after movement and this frame's pose.
    if(!this.scene.actorPresentation?.sakuraView)this.draw(now);
    if(age>=a.windup+a.release+a.recovery){
      this.lastAttack={id:a.id,kind:a.kind,color:a.color,angle:a.angle,hitCount:a.targets.size,released:a.released};
      this.clear();
    }
  }
  resolve(a,front) {
    const s=this.scene,fan={...a,radius:front},base=resolvePublicStage1SakuraEncorePaintAmount(STAGE1_PAINT_PER_HIT,s._isPublicSakuraEncoreWindowActive?.()===true);
    const visible=t=>s.oldStreet?.clearLine(a,t)!==false;
    const accept=(t,r)=>!a.targets.has(t) && Math.hypot(t.x-a.x,t.y-a.y)+r>=(a.previousFront || 0)
      && circleIntersectsFan(fan,t,r) && visible(t);
    const mark=(t,enemy)=>{
      a.targets.add(t);
      s.paintZone?.stampPaint?.(t.x,t.y,enemy?28:38,a.color,180,!a.impactRecorded);
      if(enemy && !a.primaryEnemyImpact)a.primaryEnemyImpact={x:t.x,y:t.y};
      if(!a.impactRecorded){this.run.onImpact(t.x,t.y,a.color,enemy?t:null);a.impactRecorded=true;}
    };
    if(!s.paintZone?.finaleMode)for(const t of s.paintZone?.devices || []){
      if(t.complete || t.zone>(s.paintZone.currentZone ?? 0) || !accept(t,12))continue;
      if(s.paintZone.applyPaint(t,a.kind==='special'?18*a.power:base,a.color)!==false)mark(t,false);
    }
    // Damage can synchronously remove a child from Phaser's live group array.
    for(const t of [...(s.enemies?.getChildren?.() || [])]){
      if(!canEnemyBePublicStage1PaintTarget(t) || !accept(t,t.drawRadius || 12))continue;
      if(s._paintPublicStage1TargetsAt(t.x,t.y,a.kind==='special'?STAGE1_PAINT_PER_HIT*2*a.power:base,
        (t.drawRadius || 12)+1,a.color,t)!==false)mark(t,true);
    }
    if(front>=a.radius && a.color==='yellow' && a.primaryEnemyImpact){
      const origin=a.primaryEnemyImpact;
      const secondary=(s.enemies?.getChildren?.() || []).filter(t=>canEnemyBePublicStage1PaintTarget(t)
        && !a.targets.has(t) && Math.hypot(t.x-origin.x,t.y-origin.y)<=120
        && s.oldStreet?.clearLine(origin,t)!==false)
        .sort((p,q)=>Math.hypot(p.x-origin.x,p.y-origin.y)-Math.hypot(q.x-origin.x,q.y-origin.y))[0];
      if(secondary)s._paintPublicStage1TargetsAt(secondary.x,secondary.y,7,(secondary.drawRadius || 12)+1,a.color,secondary);
    }
  }
  draw(now) {
    const a=this.attack,s=this.scene;if(!s.add?.graphics || !a || s._battlePaused)return;
    if(!this.gfx)this.gfx=s.add.graphics().setDepth(this.worldDepth);
    const g=this.gfx;g.clear();
    const pose=this.snapshot(now);if(!pose)return;
    const view=s.actorPresentation?.qRebaseView ?? s.actorPresentation?.sakuraView;
    // Owner creation can follow the actor draw. Do not attach to last frame's native hand.
    if(view?.state?.native && (view.state.attackId!==pose.id || view.state.attackPhase!==pose.phase))return;
    const color=PALETTE[a.color] || PALETTE.pink;
    const hand=view?.handWorld(pose) ?? sakuraFanRoot(s.player,pose.frame);
    if(pose.phase==='windup'){
      const {x,y}=hand;
      g.lineStyle(2,color,.7);g.lineBetween(x-3,y-3,x+3,y+3);return;
    }
    if(a.kind==='encore')return;
    const r=pose.phase==='release'?a.radius*pose.progress:a.radius;
    const alpha=pose.phase==='release'?.82:(1-pose.progress)*.32;
    if(alpha<=0)return;
    // Freeze cosmetic release registration separately from legal hit and pigment geometry.
    if(this.launch?.id!==a.id)this.launch={id:a.id,point:pose.phase==='release'&&pose.progress<.45?{...hand}:null};
    if(pose.phase==='release' && pose.progress<.45 && this.launch.point){
      const from=this.launch.point,tip={x:a.x+Math.cos(a.angle)*r,y:a.y+Math.sin(a.angle)*r};
      const length=Math.hypot(from.x-a.x,from.y-a.y)+r;
      if(length<=64 && s.oldStreet?.clearLine(from,a)!==false && s.oldStreet?.clearLine(a,tip)!==false){
        const trail=Array.from({length:7},(_,i)=>{const t=i/6,u=1-t;return {
          x:u*u*from.x+2*u*t*a.x+t*t*tip.x,y:u*u*from.y+2*u*t*a.y+t*t*tip.y};});
        if(trail.slice(1).every((p,i)=>s.oldStreet?.clearLine(trail[i],p)!==false)){
          g.lineStyle(1.5,color,.7*(1-pose.progress/.45));
          for(let i=1;i<trail.length;i++)g.lineBetween(trail[i-1].x,trail[i-1].y,trail[i].x,trail[i].y);
        }
      }
    }
    if(r<=0)return;
    // Clip the same committed fan against cover; never paint a wave through buildings.
    const points=[];
    for(let i=0;i<=20;i++){
      const angle=a.angle-a.halfAngle+2*a.halfAngle*i/20;
      let reach=r;
      if(s.oldStreet?.clearLine(a,{x:a.x+Math.cos(angle)*r,y:a.y+Math.sin(angle)*r})===false){
        let lo=0,hi=r;for(let n=0;n<7;n++){const mid=(lo+hi)/2;
          if(s.oldStreet.clearLine(a,{x:a.x+Math.cos(angle)*mid,y:a.y+Math.sin(angle)*mid}))lo=mid;else hi=mid;}
        reach=lo;
      }
      points.push({x:a.x+Math.cos(angle)*reach,y:a.y+Math.sin(angle)*reach});
    }
    if(g.fillStyle&&g.fillPoints){
      const width=Math.min(r*.24,a.kind==='special'?28:18);
      const blockers=s.oldStreet?.state?.blockers?.()??[];
      const clear=(from,to)=>s.oldStreet?.clearLine(from,to)!==false;
      const inner=p=>{const d=Math.hypot(p.x-a.x,p.y-a.y),ratio=d>0?Math.max(0,d-width)/d:0;
        return {x:a.x+(p.x-a.x)*ratio,y:a.y+(p.y-a.y)*ratio};};
      g.fillStyle(color,alpha*.24);
      for(let i=1;i<points.length;i++){
        const p=points[i-1],q=points[i],cell=[p,q,inner(q),inner(p)];
        const xs=cell.map(v=>v.x),ys=cell.map(v=>v.y);
        const bounds={left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
        // Reject an overlapping cell conservatively, including a wall enclosed between rays.
        if(blockers.some(b=>{const f=b.footprint;return f&&bounds.right>=f.x&&bounds.left<=f.x+f.width
          &&bounds.bottom>=f.y&&bounds.top<=f.y+f.height;}))continue;
        if(!cell.every((v,j)=>clear(a,v)&&clear(v,cell[(j+1)%4])))continue;
        const center={x:xs.reduce((sum,v)=>sum+v,0)/4,y:ys.reduce((sum,v)=>sum+v,0)/4};
        if(clear(a,center))g.fillPoints(cell,true,true);
      }
    }
    for(const [width,tint,strength,inset] of [[a.kind==='special'?11:7,color,.23,0],[2.5,0xFFF5FA,1,0],[1.5,color,.8,-6]]){
      g.lineStyle(width,tint,alpha*strength);
      for(let i=1;i<points.length;i++){
        const p=points[i-1],q=points[i],ratio=Math.max(0,(r+inset)/r);
        g.lineBetween(a.x+(p.x-a.x)*ratio,a.y+(p.y-a.y)*ratio,a.x+(q.x-a.x)*ratio,a.y+(q.y-a.y)*ratio);
      }
    }
  }
  setWorldDepth(depth) {
    if(this.destroyed||!Number.isFinite(depth))return;
    // Match the other performer cues without changing committed hit geometry.
    this.worldDepth=depth+.00002;this.gfx?.setDepth(this.worldDepth);
  }
  clear() { this.attack=null;this.launch=null;this.gfx?.clear(); }
  destroy() { if(this.destroyed)return;this.destroyed=true;this.clear();this.gfx?.destroy();this.gfx=null; }
}
