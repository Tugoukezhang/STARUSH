import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
import {EventEmitter} from 'node:events';
import {resolveFinaleReturnPath} from '../src/utils/chapterFinaleContent.mjs';
const require=createRequire(import.meta.url),LineToCircle=require('phaser/src/geom/intersects/LineToCircle.js'),Circle=require('phaser/src/geom/circle/Circle.js');
const Phaser={Scene:class{},Geom:{Circle,Intersects:{LineToCircle}},Physics:{Arcade:{Events:{WORLD_STEP:'worldstep'}}}};
const BattleScene=loadBattleScene({Phaser}),source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
const start=source.indexOf('    this.enemyBullets.children.iterate(b => {',source.indexOf('const dt = delta / 1000;')),end=source.indexOf('    this._updateStage1WavePressureEvent();',start);assert(start>0&&end>start);
const step=Function('dt','STAGE_1_WAVE_PRESSURE_ACTION_ID','P15_234_HOSTILE_PROJECTILE_OWNER',source.slice(start,end));
function circle(x,y,r){return {enable:true,isCircle:true,halfWidth:r,halfHeight:r,center:{x,y},prev:{x:x-r,y:y-r},prevFrame:{x:x-r,y:y-r},reset(x,y){this.center={x:x-16+r,y:y-16+r};},updateFromGameObject(){this.center={x:this.owner.x,y:this.owner.y};}};}
function fixture({from={x:100,y:600},player={x:150,y:600},playerFrom=player,vx=500,vy=0,publicRound=true,current=true,wall=Infinity}={}){
 const events=[],bullet={...from,active:true,publicStage1StageCuePulse:true,moveVx:vx,moveVy:vy,body:circle(from.x,from.y,7),gfx:{setPosition(){events.push('gfx');}}};
 bullet.body.owner=bullet;
 const body=circle(player.x,player.y,6);body.prevFrame={x:playerFrom.x-6,y:playerFrom.y-6};body.prev={...body.prevFrame};
 const scene=Object.assign(Object.create(BattleScene.prototype),{_userCastPresentation:current,_isPublicStage1Round:()=>publicRound,player:{active:true,hp:5,body},enemyBullets:{children:{iterate:fn=>fn(bullet)}},oldStreet:{clearLine:(a,b)=>Math.max(a.x,b.x)<wall,absorbProjectile(b){events.push('cover');b.active=false;}},_onEnemyHitPlayer(b){events.push('hit');b.active=false;}});
 return {scene,bullet,events,run:dt=>step.call(scene,dt,'pressure','hostile')};
}
test('actual enemy loop recovers a200ms pulse through a stationary player without changing its endpoint',()=>{const f=fixture();f.run(.2);assert.deepEqual(f.events,['hit']);assert.equal(f.bullet.x,200);assert.equal(f.bullet.body.center.x,200);});
test('diagonal and reversed pulse crossings retain physical radius and frozen direction',()=>{
 for(const options of [{from:{x:100,y:550},player:{x:150,y:600},vx:400,vy:400},{from:{x:200,y:600},vx:-500}]){const f=fixture(options);f.run(.25);assert(f.events.includes('hit'));}
 const miss=fixture({player:{x:150,y:613.01}});miss.run(.2);assert(!miss.events.includes('hit'));const tangent=fixture({player:{x:150,y:613}});tangent.run(.2);assert(tangent.events.includes('hit'));
});
test('relative player displacement avoids false positives from sweeping only the final circle',()=>{
 const same=fixture({playerFrom:{x:50,y:600},player:{x:150,y:600}});same.run(.2);assert(!same.events.includes('hit'));
 const opposite=fixture({playerFrom:{x:200,y:600},player:{x:100,y:600}});opposite.run(.2);assert(opposite.events.includes('hit'));
 const stationary=fixture({vx:0,playerFrom:{x:50,y:600},player:{x:150,y:600}});stationary.run(.2);assert(stationary.events.includes('hit'));
});

test('fixed-step catchup uses frame start rather than the last physics substep',()=>{
 const same=fixture({playerFrom:{x:80,y:600},player:{x:150,y:600}});same.scene.player.body.prev.x=144-350/60;same.run(.2);assert(!same.events.includes('hit'));
 const crossed=fixture({playerFrom:{x:200,y:600},player:{x:100,y:600}});crossed.scene.player.body.prev.x=100-6+500/60;crossed.run(.2);assert(crossed.events.includes('hit'));
});
test('ordinary endpoint overlap remains Arcade owned and a non-crossing short step is unchanged',()=>{
 for(const dt of [.08,.1,.12,1/60]){const f=fixture();f.run(dt);assert(!f.events.includes('hit'));assert(f.events.includes('gfx'));}
 const noStep=fixture();noStep.run(0);assert(!noStep.events.includes('hit'));
});
test('same full-frame cover priority is preserved before recovery, including a wall beyond the player',()=>{
 for(const wall of [120,180]){const f=fixture({wall});f.run(.2);assert.deepEqual(f.events,['cover']);}
 const f=fixture(),street=new OldStreetState([{id:'wall',footprint:{x:120,y:550,width:10,height:100}}]);f.scene.oldStreet.clearLine=(a,b,r)=>street.clearLine(a,b,r);f.run(.2);assert.deepEqual(f.events,['cover']);assert.equal(street.opened.size,0);
});
test('noncurrent, nonpublic and other hostile families never enter this recovery',()=>{
 for(const options of [{current:false},{publicRound:false}]){const f=fixture(options);f.run(.2);assert(!f.events.includes('hit'));}
 const defense=fixture();defense.scene.battleData={defenseMode:true};defense.run(.2);assert(!defense.events.includes('hit'));
 const f=fixture();delete f.bullet.publicStage1StageCuePulse;f.run(.2);assert(!f.events.includes('hit'));
});
test('invalid, disabled, destroyed or terminal owners fail closed without a hit',()=>{
 for(const change of [f=>f.scene._battlePaused=true,f=>f.scene._battleEnded=true,f=>f.scene.player.active=false,f=>f.scene.player.hp=0,f=>f.scene.player.body.enable=false,f=>f.bullet.body.enable=false,f=>f.scene.player.body.isCircle=false,f=>f.scene.player.body.prevFrame.x=NaN,f=>f.bullet.body.halfWidth=0]){const f=fixture();change(f);f.run(.2);assert(!f.events.includes('hit'));}
});

function withDamageOwner(f){
 const effects=[];delete f.scene._onEnemyHitPlayer;
 Object.assign(f.scene,{battleRecord:{},time:{now:0},cameras:{main:{shake(){effects.push('shake');}}},
  support:{gainFromTakeDamage(){effects.push('support');}},tweens:{add(t){effects.push(t);}},
  _getPublicCombatFeedback:()=>null,_spawnPlayerHitBeatFlash(){effects.push('flash');},_onPlayerDeath(){effects.push('death');}});
 Object.assign(f.bullet,{destroy(){this.active=false;}});
 return effects;
}

test('real damage owner consumes during invulnerability without repeated or lethal extra damage',()=>{
 for(const invulnerable of [false,true]){
  const f=fixture(),effects=withDamageOwner(f);f.scene.player.invulnerable=invulnerable;f.run(.2);
  assert.equal(f.bullet.active,false);assert.equal(f.bullet.p16DisposeReason,'hit');
  assert.equal(f.scene.player.hp,invulnerable?5:4);assert.equal(f.scene.battleRecord.playerHitCount||0,invulnerable?0:1);
  assert.equal(effects.includes('flash'),!invulnerable);f.run(.2);assert.equal(f.scene.player.hp,invulnerable?5:4);
 }
 const f=fixture();withDamageOwner(f);f.scene.player.hp=0;f.run(.2);assert.equal(f.scene.player.hp,0);assert.equal(f.bullet.active,true);
});

test('swept terminal and stationary turn contacts resolve hit once and unbind the return worldstep',()=>{
 for(const leg of ['outbound','return','turn-contact']){
  const from=leg==='return'?{x:300,y:600}:leg==='turn-contact'?{x:300,y:600}:{x:100,y:600};
  const f=fixture({from,player:{x:leg==='turn-contact'?350:200,y:600},playerFrom:{x:leg==='turn-contact'?250:200,y:600}});
  withDamageOwner(f);const world=new EventEmitter(),outcomes=[];
  const path=resolveFinaleReturnPath({chapterId:'neon',attackIndex:2,origin:{x:100,y:600},capture:{capturedX:220,capturedY:600},speed:500,lifetimeMs:5000,width:1000,height:1778,clearLine:()=>true});
  Object.assign(f.scene,{physics:{world},_resolvePublicStage1FinaleAttack:(p,r)=>outcomes.push(r)});
  Object.assign(f.bullet,{publicStage1FinaleAttack:true,publicFinaleReturn:{path,leg,distance:0,worldStepHandler:null}});
  if(leg==='turn-contact'){const pending=()=>outcomes.push('stale-turn');f.bullet.publicFinaleReturn.worldStepHandler=pending;world.once('worldstep',pending);}
  f.run(1);assert.equal(f.bullet.active,false,leg);assert.equal(f.bullet.p16DisposeReason,'hit');assert.equal(world.listenerCount('worldstep'),0);
  world.emit('worldstep');f.run(1);assert.deepEqual(outcomes,['hit']);assert.equal(f.scene.player.hp,4);
 }
});
