import test from 'node:test';import assert from 'node:assert/strict';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {attackPaintPolygon} from '../src/systems/StreetRestorationSurface.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
const brush={sample:(_u,_v,ink)=>ink?0:1},base={x:100,y:100,radius:84,angle:0,halfAngle:Math.PI/3,innerRadius:84*.42,sweep:.25};
const raster=()=>new StreetPigmentRaster(256,256,null,.9,brush);
const alpha=(r,x,y)=>r.pixels[(Math.floor(y/2)*r.pixelWidth+Math.floor(x/2))*4+3];
const at=(r,angle,distance=65)=>alpha(r,100+Math.cos(angle)*distance,100+Math.sin(angle)*distance);
test('sword stroke reveals only reached bearings, excludes the body and preserves ordinary full fan',()=>{
 const r=raster();r.fan(base,attackPaintPolygon(base),0x00ced1);assert(at(r,-Math.PI/4)>0);assert.equal(at(r,Math.PI/4),0);assert.equal(at(r,0,16),0);
 const legacy=raster(),{innerRadius,sweep,...fan}=base;legacy.fan(fan,attackPaintPolygon(fan),0x00ced1);assert(at(legacy,Math.PI/4)>0);assert(at(legacy,0,16)>0);
});
test('four nested sweeps equal a single full stroke without darkening, extra coverage or repeated material sampling',()=>{
 const stepped=raster(),full=raster();let count=0;
 for(const sweep of [.25,.5,.75,1]){const fan={...base,sweep};stepped.fan(fan,attackPaintPolygon(fan),0x00ced1);const next=stepped.pixels.filter((v,i)=>i%4===3&&v>0).length;assert(next>count);count=next;}
 const fan={...base,sweep:1};full.fan(fan,attackPaintPolygon(fan),0x00ced1);assert.deepEqual(stepped.pixels,full.pixels);stepped.consumeDirty();assert.equal(stepped.fan(fan,attackPaintPolygon(fan),0x00ced1),false);
});
test('swept annulus clips against actual cover and rejects malformed optional geometry',()=>{
 const fan={...base,sweep:1},r=raster(),blockers=[{footprint:{x:140,y:40,width:8,height:120}}];
 r.fan(fan,attackPaintPolygon(fan,(_from,to)=>to.x<140),0x00ced1,blockers);assert.equal(alpha(r,160,100),0);assert.equal(alpha(r,143,100),0);assert(at(r,-Math.PI/4,48)>0);
 for(const patch of [{sweep:NaN},{sweep:-1},{sweep:2},{innerRadius:Infinity},{innerRadius:-1},{innerRadius:85}]){const bad={...base,...patch};assert.deepEqual(attackPaintPolygon(bad),[]);assert.equal(raster().fan(bad,attackPaintPolygon(base),0x00ced1),false);}
});
test('building receiver receives only swept polygon samples, with no heat or device progress',()=>{
 const {PaintZoneSystem}=loadBattleScene({Phaser:{Scene:class{}},includeOwners:true}),calls=[];
 const owner=Object.create(PaintZoneSystem.prototype);Object.assign(owner,{scene:{oldStreet:{clearLine:()=>true,paintSurfaceAt:(...a)=>calls.push(a)}},heat:23,devices:[],streetSurface:{fan:fan=>attackPaintPolygon(fan)}});
 assert(owner.paintAttackFan(base));assert.equal(calls.length,6);for(const [p,radius,origin] of calls){assert(Math.atan2(p.y-100,p.x-100)<=-Math.PI/6+.001);assert.equal(radius,24);assert.equal(origin,base);}
 assert.equal(owner.heat,23);assert.deepEqual(owner.devices,[]);
 calls.length=0;owner.paintAttackFan({...base,sweep:0});assert.equal(calls.length,0);
 owner.streetSurface.fan=fan=>attackPaintPolygon(fan,(_from,to)=>to.x<115);
 owner.paintAttackFan({...base,sweep:1});assert.equal(calls.length,0,'a clipped point inside the body gap cannot color a remote facade');
});
