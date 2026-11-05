import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {OldStreetState,OLD_STREET_DEVICES} from '../src/utils/oldStreetMap.mjs';

const Phaser={Scene:class{},Math:{Clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}};
const {BattleScene,PaintZoneSystem}=loadBattleScene({Phaser,includeOwners:true});
const recorded={x:337.0747670331632,y:440.1465819130113};
function sceneAt(point=recorded){
 const scene=Object.assign(Object.create(BattleScene.prototype),{
  _userCastPresentation:true,_isPublicStage1Round:()=>true,
  player:{...point,active:true},oldStreet:new OldStreetState(),
  enemies:{children:{iterate(){}}},actorPresentation:{userCastView:{handWorld:()=>({x:point.x+16,y:point.y-12})}},
 });
 const garden={...OLD_STREET_DEVICES.find(d=>d.id==='oldstreet-garden'),paint:14,complete:false};
 scene.paintZone=Object.assign(new PaintZoneSystem(scene),{currentZone:1,devices:[garden],complete:false});
 return {scene,garden};
}

test('recorded garden corner cannot select a shot that its real cover corridor rejects',()=>{
 const {scene,garden}=sceneAt();
 assert(scene.oldStreet.clearLine(scene.player,garden));
 assert.equal(scene.oldStreet.clearLine(scene.player,garden,2),false);
 assert.equal(scene._selectAutoAimTarget(),null,'auto aim kept firing into the grazing wall corner');
 assert.equal(scene._getPublicStage1ObjectiveRouteTarget(),garden,'nearby but blocked objective lost its route cue');
});

test('moving around the same corner restores the exact fixture as a legal target',()=>{
 const {scene,garden}=sceneAt({x:337,y:460});
 assert.equal(scene._selectAutoAimTarget(),garden);
 const origin=scene._getPublicStage1PaintShotOrigin(garden);
 assert(origin);assert(scene.oldStreet.clearLine(scene.player,origin,2));assert(scene.oldStreet.clearLine(origin,garden,2));
 assert.equal(scene._getPublicStage1ObjectiveRouteTarget(),null);
});

test('unsafe muzzle falls back to the player, but both blocked paths fail closed',()=>{
 const {scene,garden}=sceneAt({x:337,y:460});
 scene.actorPresentation.userCastView.handWorld=()=>({x:184,y:450});
 const origin=scene._getPublicStage1PaintShotOrigin(garden);assert.equal(origin.x,337);assert.equal(origin.y,460);
 scene.oldStreet.clearLine=()=>false;assert.equal(scene._getPublicStage1PaintShotOrigin(garden),null);
 scene.oldStreet.clearLine=()=>true;assert.equal(scene._getPublicStage1PaintShotOrigin({x:NaN,y:5}),null);
});

test('clamped world-edge origin is checked before emission, not after corridor validation',()=>{
 const {scene}=sceneAt({x:4,y:4}),calls=[];
 scene.actorPresentation.userCastView.handWorld=()=>({x:-12,y:-10});
 scene.oldStreet.clearLine=(a,b,pad)=>{calls.push({a,b,pad});return b.x>=8&&b.y>=8;};
 const origin=scene._getPublicStage1PaintShotOrigin({x:150,y:150});
 assert.equal(origin.x,8);assert.equal(origin.y,8);assert(calls.slice(1).every(c=>c.pad===2));
});

test('a late rejected shot creates no bullet and does not consume its cooldown',()=>{
 const {scene,garden}=sceneAt();let bullets=0;
 Object.assign(scene,{_selectAutoAimTarget:()=>garden,lastShotTime:0,currentColor:'pink',
  support:{getCenterStageFireRateMultiplier:()=>1},
  physics:{add:{sprite(){bullets++;throw Error('blocked emission');}}}});
 assert.doesNotThrow(()=>scene._tryShoot(1000));assert.equal(bullets,0);assert.equal(scene.lastShotTime,0);
});

test('hidden and legacy selection retain the old contract rather than opting into current cast geometry',()=>{
 const {scene,garden}=sceneAt();scene._userCastPresentation=false;
 assert.equal(scene._selectAutoAimTarget(),garden);
 assert.equal(scene._getPublicStage1ObjectiveRouteTarget(),null);
});

test('a muzzle that peeks around cover cannot hide the route when direct targeting is blocked',()=>{
 const {scene,garden}=sceneAt({x:100,y:100});garden.x=140;garden.y=200;
 scene.oldStreet=new OldStreetState([{id:'corner',footprint:{x:110,y:143,width:12,height:13}}]);
 assert.equal(scene.oldStreet.clearLine(scene.player,garden),false);
 assert.equal(scene._selectAutoAimTarget(),null);
 assert.equal(scene._getPublicStage1ObjectiveRouteTarget(),garden,'a rejected target needs guidance, not silence');
 const source=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const original=source.slice(source.indexOf('  _getPublicStage1PaintShotOrigin(target) {'),source.indexOf('  _selectAutoAimTarget() {'));
 const body=original.replace('if(this.oldStreet?.clearLine(this.player,target)===false)return null;','');assert.notEqual(body,original);
 scene._getPublicStage1PaintShotOrigin=Function('Phaser','STAGE1_PAINT_WORLD_WIDTH','STAGE1_PAINT_WORLD_HEIGHT',
  `return ({${body}})._getPublicStage1PaintShotOrigin;`)(Phaser,1000,1778);
 assert.equal(scene._getPublicStage1ObjectiveRouteTarget(),null,'removing the direct-target guard must reproduce the lost cue');
});
