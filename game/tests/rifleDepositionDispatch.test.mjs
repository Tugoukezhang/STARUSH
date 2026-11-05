import test from 'node:test';
import assert from 'node:assert/strict';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
test('real projectile landing dispatches deposition once at consumed landing, regardless of confirmed target',()=>{
 const Scene=loadBattleScene({Phaser:{Scene:class{}}});
 for(const hit of [false,true]){
  const calls=[],s=Object.create(Scene.prototype),stamps=[];
  Object.assign(s,{_userCastPresentation:true,_isPublicSakuraEncoreWindowActive:()=>false,
   _disposePlayerProjectile:b=>{b.active=false;},_stampGroundSplat:(...r)=>stamps.push(r),
   paintZone:{applyPaintAt(x,y,n,r,color,observe){if(hit)observe({x,y,kind:'fixture'});return hit;}},_paintPublicStage1TargetsAt:()=>false,
   publicPerformerRun:{effects:()=>({paintRadiusBonus:0}),onImpact(){}},
   actorPresentation:{userCastView:{weaponFx:{impact:r=>calls.push(r)}}}});
  const b={active:true,x:150,y:100,color:'blue',moveVx:0,moveVy:-400};
  s._detonatePaintBullet(b);s._detonatePaintBullet(b);
  assert.equal(calls.length,1);assert.equal(stamps.length,1);
  assert.equal(calls[0].deposition,true);assert.equal(calls[0].hit,hit);
  assert.deepEqual([calls[0].x,calls[0].y,calls[0].color,calls[0].angle],[150,100,'blue',-Math.PI/2]);
  assert.equal(calls[0].contacts.length,hit?1:0);
  if(hit)assert.deepEqual({...calls[0].contacts[0]},{x:150,y:100,kind:'fixture',direct:false});
 }
});
