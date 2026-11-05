import test from 'node:test';
import assert from 'node:assert/strict';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
const {PaintZoneSystem,BattleScene}=loadBattleScene({Phaser:{Scene:class{},Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}},includeOwners:true});
function setup(){
 const floor=[],props=[];
 const scene={_userCastPresentation:true,player:{x:20,y:80},oldStreet:{clearLine:()=>true,paintSurfaceAt:(...a)=>props.push(a)}};
 const owner=Object.create(PaintZoneSystem.prototype);
 Object.assign(owner,{scene,tileGrid:{cols:10,rows:10,tileSize:24,tiles:[]},heat:31,devices:[],streetSurface:{stamp:(...a)=>{floor.push(a);return true;}},_addHeat(){this.heat++;}});
 return {owner,scene,floor,props};
}
test('radial ground paint reaches buildings with the same footprint even with no enemies or devices',()=>{
 const f=setup();
 f.owner.stampPaint(80,90,60,'blue',180,false);
 assert.equal(f.floor.length,1);assert.equal(f.props.length,1);
 assert.equal(f.props[0][0].x,80);assert.equal(f.props[0][0].y,90);assert.equal(f.props[0][1],60);
 assert.equal(f.props[0][2].x,80);assert.equal(f.props[0][2].y,90);
 assert.equal(f.owner.heat,31);assert.equal(f.owner.devices.length,0);
});
test('repeat pigment still contacts a previously untouched facade when the ground raster is unchanged',()=>{
 const f=setup();f.owner.streetSurface.stamp=()=>false;
 f.owner.stampPaint(80,90,60,'blue',180,false);
 assert.equal(f.props.length,1);
});
test('derived splats retain the actual attack origin and reject centers across cover',()=>{
 const f=setup(),origin={x:20,y:80};
 f.owner.stampPaint(80,90,60,'blue',180,false,null,origin);
 assert.equal(f.props.length,1);assert.equal(f.props[0][2],origin);
 f.scene.oldStreet.clearLine=()=>false;
 assert.equal(f.owner.stampPaint(120,90,60,'blue',180,true,null,origin),false);
 assert.equal(f.floor.length,1);assert.equal(f.props.length,1);assert.equal(f.owner.heat,31);
});
test('paused, ended and invalid radial requests do not mutate ground, facade or heat',()=>{
 for(const flag of ['_battlePaused','_battleEnded']){const f=setup();f.scene[flag]=true;assert.equal(f.owner.stampPaint(80,90,60,'blue',180,true),false);assert.equal(f.floor.length+f.props.length,0);assert.equal(f.owner.heat,31);}
 for(const radius of [0,-1,NaN,Infinity]){const f=setup();assert.equal(f.owner.stampPaint(80,90,radius,'blue',180,true),false);assert.equal(f.floor.length+f.props.length,0);}
});
test('legacy and missing real street surface never start a new building presentation path',()=>{
 const f=setup();f.scene._userCastPresentation=false;f.owner.stampPaint(80,90,60,'blue',180,false);assert.equal(f.floor.length,1);assert.equal(f.props.length,0);
 const g=setup();g.owner.streetSurface=null;g.owner.stampPaint(80,90,60,'blue',180,false);assert.equal(g.props.length,0);
});
test('all three ground-splat components carry one original origin instead of teleporting across cover',()=>{
 const calls=[];const scene={paintZone:{stampPaint:(...a)=>calls.push(a)},actorPresentation:{userCastView:{weaponFx:{}}}};
 BattleScene.prototype._stampGroundSplat.call(scene,80,90,'blue',60,false);
 assert.equal(calls.length,3);for(const a of calls){assert.equal(a[7]?.x,80);assert.equal(a[7]?.y,90);}
});
test('Encore satellite patches retain the release origin without changing accepted device amounts',()=>{
 const f=setup();f.owner.stampPaint=(...a)=>{f.floor.push(a);return true;};f.owner.burstRelight(80,90);
 assert.equal(f.floor.length,11);for(const a of f.floor.slice(1)){assert.equal(a[7]?.x,80);assert.equal(a[7]?.y,90);}
});
