import test from 'node:test';import assert from 'node:assert/strict';import {loadBattleScene} from './helpers/loadBattleScene.mjs';
const Battle=loadBattleScene({Phaser:{Scene:class{},Math:{Clamp:(n,a,b)=>Math.max(a,Math.min(b,n))}}});
function fixture({selected=true,owner=true,id='sakura',blocked=false}={}){
 const bullets=[],timers=[],stamps=[],paints=[],notifications=[],audio=[],fx=[],disposed=[],crits=[],target={x:700,y:1400,active:true,hp:100,publicStage1EnemyRole:'unlit-chaser'},s=Object.create(Battle.prototype);
 Object.assign(s,{_userCastPresentation:owner,player:{x:500,y:1500},currentColor:'pink',lastShotTime:0,support:{getCenterStageFireRateMultiplier:()=>1},_isPublicStage1Round:()=>true,_selectAutoAimTarget:()=>target,_getPublicStage1PaintShotOrigin:()=>blocked?null:{x:520,y:1480},_configureCenteredArcadeCircle(){},
  publicPerformerRun:{member:{id},growth:{choices:selected?['fanfire']:[]},now:()=>1000,effects:()=>({paintRadiusBonus:0}),alive:()=>true,onImpact(...a){fx.push(['accepted',...a]);}},
  physics:{add:{sprite(x,y){const b={x,y,active:true,body:{setCircle(){}},setAlpha(){return this;},setDepth(){return this;}};return b;}}},
  playerBullets:{add:b=>bullets.push(b)},dmgCalc:{rollCrit:()=>{crits.push(true);return false;}},_createPlayerBulletVisual(){return{node:{setRotation(a){this.rotation=a;},active:true},offsetX:0,offsetY:0};},_trackCombatObject:()=>true,
  actorPresentation:{userCastView:{art:{id},handWorld:()=>({x:520,y:1480}),weaponFx:{impact:r=>fx.push(['impact',r])}},notifyBasicShot:(...a)=>notifications.push(a),queueBasicShotFx:(...a)=>{fx.push(['muzzle',...a]);return true;}},
  p17Audio:{playShotTick:row=>audio.push(row)},time:{now:1000,delayedCall:(ms,fn)=>{timers.push({ms,fn});return{remove(){}};}},oldStreet:{clearLine:()=>true},paintZone:{getHeat:()=>0,applyPaintAt:(x,y,amount)=>{paints.push(amount);return false;}},
  _tryBlockPublicBossProjectile:()=>false,_isPublicSakuraEncoreWindowActive:()=>false,_disposePlayerProjectile(b,reason){b.active=false;disposed.push(reason);},_stampGroundSplat:(...a)=>stamps.push(a),_paintPublicStage1TargetsAt:()=>false});
 return{s,bullets,timers,stamps,paints,notifications,audio,fx,disposed,crits,target};
}
test('actual ordinary rifle casts three tracked lanes at one accepted muzzle with one cadence/audio/motion event',()=>{
 const f=fixture();f.s._tryShoot(1000);assert.equal(f.bullets.length,3);assert.equal(f.timers.length,3);assert.equal(f.notifications.length,1);assert.equal(f.audio.length,1);assert.equal(f.fx.filter(r=>r[0]==='muzzle').length,1);assert.equal(f.crits.length,1,'one cast must not roll critical three times');
 const angles=f.bullets.map(b=>Math.atan2(b.moveVy,b.moveVx));assert(Math.abs(angles[1]-angles[0]+.24)<1e-10);assert(Math.abs(angles[2]-angles[0]-.24)<1e-10);
 for(const b of f.bullets){assert.equal(b.x,520);assert.equal(b.y,1480);assert.equal(b.paintShot,true);assert.equal(b.fanfire,true);}
 assert.equal(f.bullets[0].paintTargetX,700);assert.equal(f.bullets[0].paintTargetY,1400);assert.notEqual(f.bullets[1].paintTargetY,f.bullets[2].paintTargetY);
 assert.deepEqual(f.bullets.map(b=>b.fanfirePaintScale),[.6,.2,.2]);assert.deepEqual(f.bullets.map(b=>b.fanfireLane),[0,1,2]);f.s._tryShoot(1001);assert.equal(f.bullets.length,3,'not extra fire-rate events');
});
test('unselected/legacy casts stay single; melee action owners never become ranged three-lane weapons',()=>{
 for(const options of [{selected:false},{owner:false}]){const f=fixture(options);f.s._tryShoot(1000);assert.equal(f.bullets.length,1);assert.equal(f.bullets[0].fanfire,undefined);}
 const f=fixture({id:'kai'});let actions=0;f.s.publicPerformerRun.meleeCombat={beginBasic(){actions++;return true;}};f.s._tryShoot(1000);assert.equal(actions,1);assert.equal(f.bullets.length,0);
 const block=fixture({blocked:true});block.s._tryShoot(1000);assert.equal(block.bullets.length,0);assert.equal(block.s.lastShotTime,0);
});
test('real detonation divides original coating budget and only primary lane charges stamp heat',()=>{
 const base=fixture({selected:false});base.s._tryShoot(1000);base.s._detonatePaintBullet(base.bullets[0]);
 const f=fixture();f.s._tryShoot(1000);for(const b of f.bullets)f.s._detonatePaintBullet(b);
 assert.equal(f.paints.length,3);assert(Math.abs(f.paints.reduce((a,b)=>a+b,0)-base.paints[0])<1e-10);assert(Math.abs(f.paints[0]/base.paints[0]-.6)<1e-10);assert(Math.abs(f.paints[1]/base.paints[0]-.2)<1e-10);
 assert.deepEqual(f.stamps.map(a=>a[4]),[true,false,false]);assert.deepEqual(f.disposed,['paint-detonated','paint-detonated','paint-detonated']);assert.equal(f.fx.filter(r=>r[0]==='accepted').length,0,'empty landings do not count as real impacts');
});
test('each real lane uses existing timed detonation lifecycle without new recurrence or cast replay',()=>{
 const f=fixture();f.s._tryShoot(1000);for(const timer of f.timers){assert.equal(timer.ms,2000);timer.fn();timer.fn();}assert.equal(f.disposed.length,3);assert.equal(f.notifications.length,1);assert.equal(f.audio.length,1);
});
