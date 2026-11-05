import test from 'node:test';import assert from 'node:assert/strict';
import * as geometry from '../src/systems/WorldGroundingPresentation.mjs';
import {PropRestorationRaster} from '../src/systems/StreetMaterialPresentation.mjs';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';
const prop={id:'shop',art:'test',x:100,y:150,width:24,height:24,footprint:{x:90,y:140,width:20,height:10}},source={width:24,height:24};
function project(point,radius=8,p=prop,s=source){assert.equal(typeof geometry.projectStreetSurfaceContact,'function');return geometry.projectStreetSurfaceContact(p,s,point,radius);}
function raster(){const neutral={data:new Uint8ClampedArray(24*24*4)},color={data:new Uint8ClampedArray(24*24*4)};for(let i=0;i<neutral.data.length;i+=4){neutral.data.set([100,100,100,255],i);color.data.set([200,40,120,255],i);}neutral.data[3]=color.data[3]=0;return new PropRestorationRaster(24,24,neutral,color);}
test('front contact is local in both axes and never a full-height column',()=>{
 const p=project({x:100,y:154});assert.equal(p.x,12);assert.equal(p.y,24);assert(Math.abs(p.rx-Math.sqrt(48)/20*24)<1e-9);assert(Math.abs(p.ry-Math.sqrt(48))<1e-9);assert(p.ry<12);
 const r=raster();r.paint(p.x,p.y,p.rx,p.ry);assert.equal(r.coverage[8*24+12],0);assert(r.coverage[20*24+12]>0);
});
test('side/back contacts follow actual footprint position instead of the image midpoint',()=>{
 const left=project({x:86,y:145}),right=project({x:114,y:145}),back=project({x:100,y:136});assert.equal(left.x,0);assert.equal(right.x,24);assert.equal(left.y,12);assert.equal(right.y,12);assert.equal(back.y,0);assert.equal(back.x,12);
});
test('corner/grazing projection uses two-dimensional distance and rejects tangency or malformed geometry',()=>{
 const direct=project({x:100,y:150}),corner=project({x:86,y:154});assert(corner.rx<direct.rx&&corner.ry<direct.ry);assert.equal(project({x:100,y:158}),null);assert.equal(project({x:999,y:999}),null);assert.equal(project({x:NaN,y:150}),null);
 for(const p of [{...prop,width:0},{...prop,height:NaN},{...prop,footprint:{...prop.footprint,width:0}},{...prop,footprint:null}])assert.equal(project({x:100,y:150},8,p),null);
});
test('reviewed transparent padding and non-square world dimensions stay registered',()=>{
 const p=project({x:340,y:1406},32,{id:'record-shop',art:'shop',x:339,y:1420,width:280,height:260,footprint:{x:220,y:1290,width:240,height:116}},{width:560,height:520});assert.equal(p.x,280);assert.equal(p.y,518);assert.equal(p.ry,64);assert.equal(p.rx,32/240*556);
});
test('existing authored alpha holes survive local prop paint with exact source RGB and silhouette',()=>{
 const r=raster(),brush={sample:(u,v)=>u<.5&&v>.1&&v<.9?1:0},before=r.output.data.filter((_,i)=>i%4===3);assert(r.paint(12,12,10,10,false,brush));assert.equal(r.coverage[12*24+8],255);assert.equal(r.coverage[12*24+15],0);assert.deepEqual([...r.output.data.slice((12*24+8)*4,(12*24+8)*4+4)],[200,40,120,255]);assert.deepEqual(r.output.data.filter((_,i)=>i%4===3),before);r.takeDirty();const pixels=r.output.data.slice();assert.equal(r.paint(12,12,10,10,false,brush),false);assert.deepEqual(r.output.data,pixels);assert.equal(r.takeDirty(),null);
});
test('invalid authored samples fail closed rather than blackening or resetting existing coverage',()=>{
 const r=raster();assert.equal(r.paint(12,12,10,10,false,{sample:()=>NaN}),false);assert(r.coverage.every(v=>v===0));assert.equal(r.paint(12,12,10,10,false,{}),false);
});
test('real receiver reuses the ground brush and keeps legal/paused/end/disposal gates before sampling',()=>{
 const r=raster(),brush={sample:u=>u<.5?1:0},item={definition:prop,attackSurface:{raster:r,source,texture:{context:{}},dirty:false},image:{setVisible(){}},colorImage:{setVisible(){}}},scene={paintZone:{streetSurface:{raster:{brush}}}},owner={scene,state:{clearLine:()=>true},items:new Map([['shop',item]])};
 OldStreetScene.prototype.paintSurfaceAt.call(owner,{x:100,y:154},8,{x:100,y:160});assert.equal(r.coverage[20*24+15],0);assert(r.coverage[20*24+8]>0);assert.equal(r.coverage[8*24+8],0);r.takeDirty();
 for(const flag of ['_battlePaused','_battleEnded']){scene[flag]=true;OldStreetScene.prototype.paintSurfaceAt.call(owner,{x:110,y:145},8,{x:115,y:160});assert.equal(r.takeDirty(),null);scene[flag]=false;}
});
