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
