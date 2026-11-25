import test from 'node:test';import assert from 'node:assert/strict';import {loadBattleScene} from './helpers/loadBattleScene.mjs';
const Battle=loadBattleScene({Phaser:{Scene:class{},Math:{Clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}}});
test('ordinary melee dispatch uses its local selector, not distant focus or generic projectile aim',()=>{
 const s=new Battle(),near={x:60,y:0},far={x:300,y:0};Object.assign(s,{_isPublicStage1Round:()=>true,publicTargetFocus:{getTarget:()=>far},publicPerformerRun:{meleeCombat:{selectTarget:()=>near}},player:{x:0,y:0}});
 assert.equal(s._selectAutoAimTarget(),near);
});
test('ordinary melee starts its owner and never reaches generic physics sprite creation',()=>{
 const s=new Battle(),t={x:60,y:0},calls=[];Object.assign(s,{player:{x:0,y:0},dmgCalc:{rollCrit:()=>false},_selectAutoAimTarget:()=>t,lastShotTime:-Infinity,support:{getCenterStageFireRateMultiplier:()=>1},_isPublicStage1Round:()=>true,paintZone:{getHeat:()=>0},_isPublicSakuraEncoreWindowActive:()=>false,publicPerformerRun:{now:()=>1000,meleeCombat:{beginBasic:(...a)=>{calls.push(a);return true;}}},physics:{add:{sprite(){throw Error('melee must not create a bullet');}}}});
 s._tryShoot(1000);assert.equal(calls.length,1);assert.equal(calls[0][0],t);assert.equal(s.lastShotTime,1000);
});

test('ranged automatic fire protects against a visible nearby chaser and honours explicit focus',()=>{
 const {BattleScene}=loadBattleScene({Phaser:{Scene:class{},Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}},includeOwners:true});
 const s=new BattleScene(), lamp={x:5,y:0}, chaser={active:true,hp:20,x:48,y:0,publicStage1EnemyRole:'unlit-chaser'};
 Object.assign(s,{_userCastPresentation:true,_isPublicStage1Round:()=>true,player:{x:0,y:0},
  paintZone:{getNearestPaintable:()=>lamp},enemies:{children:{iterate:f=>f(chaser)}},
  oldStreet:{clearLine:()=>true},_getPublicStage1PaintShotOrigin:()=>({x:0,y:0})});
 assert.equal(s._selectAutoAimTarget(),chaser);
 chaser.x=49;assert.equal(s._selectAutoAimTarget(),lamp);
 chaser.x=40;s.oldStreet.clearLine=()=>false;assert.equal(s._selectAutoAimTarget(),lamp);
 s.oldStreet.clearLine=()=>true;s.publicTargetFocus={getTarget:()=>lamp};assert.equal(s._selectAutoAimTarget(),lamp);
});

test('a far required lamp cannot silence a reachable optional lamp',()=>{
 const Phaser={Scene:class{},Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}};
 const {BattleScene,PaintZoneSystem}=loadBattleScene({Phaser,includeOwners:true});
 const s=new BattleScene(), far={x:300,y:100,required:true,zone:0}, near={x:35,y:100,zone:0};
 Object.assign(s,{_userCastPresentation:true,_isPublicStage1Round:()=>true,player:{x:10,y:100},
  _getPublicStage1PaintShotOrigin:()=>({x:10,y:100})});
 s.paintZone=Object.assign(Object.create(PaintZoneSystem.prototype),{scene:s,devices:[far,near],currentZone:0});
 assert.equal(s._selectAutoAimTarget(),near);
 far.x=279;assert.equal(s._selectAutoAimTarget(),far,'in-range required objective still wins');
});

test('auto rifle keeps a shootable chaser through slight crossings but yields to a real threat or obstruction',()=>{
 const Phaser={Scene:class{},Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}};
 const {BattleScene}=loadBattleScene({Phaser,includeOwners:true}),s=new BattleScene();
 const chaser=x=>({x,y:0,active:true,hp:20,publicStage1EnemyRole:'unlit-chaser'});
 const previous=chaser(-70),crossing=chaser(66),targets=[crossing,previous];
 Object.assign(s,{_isPublicStage1Round:()=>true,_userCastPresentation:true,player:{x:0,y:0},
  publicPerformerRun:{lastBasicTarget:previous},enemies:{children:{iterate:f=>targets.forEach(f)}},
  oldStreet:{clearLine:()=>true},_getPublicStage1PaintShotOrigin:()=>({x:0,y:0})});
 assert.equal(s._selectAutoAimTarget(),previous);
 crossing.x=56;assert.equal(s._selectAutoAimTarget(),crossing);
 previous.x=-50;crossing.x=48;assert.equal(s._selectAutoAimTarget(),crossing,'48-unit priority uses real distance');
 previous.x=-46;s.oldStreet.clearLine=(from,to)=>to!==previous;assert.equal(s._selectAutoAimTarget(),crossing);
 previous.x=-284;crossing.x=278;s.oldStreet.clearLine=()=>true;assert.equal(s._selectAutoAimTarget(),crossing);
});

test('automatic attacks skip the target scan while cooling down',()=>{
 const s=new Battle();let scans=0;
 Object.assign(s,{player:{x:0,y:0},lastShotTime:1000,support:{getCenterStageFireRateMultiplier:()=>1},
  _isPublicStage1Round:()=>true,_selectAutoAimTarget:()=>{scans++;return null;}});
 for(let i=0;i<10;i++)s._tryShoot(1000+i*8);
 assert.equal(scans,0);s._tryShoot(2000);assert.equal(scans,1);
});

test('out-of-range ordinary enemies never need a shot corridor check',()=>{
 const Phaser={Scene:class{},Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}};
 const {BattleScene}=loadBattleScene({Phaser,includeOwners:true}),s=new BattleScene();
 const enemies=Array.from({length:30},(_,i)=>({x:400+i,y:0,hp:20,active:true,publicStage1EnemyRole:'unlit-chaser'}));
 let checks=0;
 Object.assign(s,{_isPublicStage1Round:()=>true,_userCastPresentation:true,player:{x:0,y:0},
  enemies:{children:{iterate:f=>enemies.forEach(f)}},oldStreet:{clearLine:()=>{checks++;return true;}},
  _getPublicStage1PaintShotOrigin:()=>({x:0,y:0})});
 assert.equal(s._selectAutoAimTarget(),null);assert.equal(checks,0);
});
