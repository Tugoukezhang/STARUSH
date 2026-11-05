import test from 'node:test';
import assert from 'node:assert/strict';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';

test('ground stroke array-map work stays constant rather than allocating color arrays per pixel',()=>{
 const brush={mergeOpaque:true,preserveSubstrate:true,sample:(u,v,ink)=>ink?0:1,tone:()=>.7};
 const substrate={width:32,height:32,data:new Uint8ClampedArray(32*32*4).fill(160)};
 const r=new StreetPigmentRaster(64,64,null,.9,brush,substrate);
 const original=Array.prototype.map;let maps=0;
 try{
  Array.prototype.map=function(...args){maps++;return original.apply(this,args);};
  assert(r.stamp(32,32,28,0xff69b4));
 }finally{Array.prototype.map=original;}
 assert(maps<=2,'Stroke allocated '+maps+' array maps; color work must not allocate per pixel');
 r.destroy();
});

test('scalar color path retains exact tone rounding, opaque union and color ownership',()=>{
 const brush={mergeOpaque:true,sample:(u,v,ink)=>ink?0:1,tone:()=>.5};
 const r=new StreetPigmentRaster(4,4,null,1,brush);
 assert(r.stamp(1,1,8,0x80a0c0));assert.deepEqual([...r.pixels.slice(0,4)],[90,112,134,255]);
 assert.equal(r.paintColors[0],0x80a0c0);assert.deepEqual(r.consumeDirty(),{x:0,y:0,width:2,height:2});
 const before=r.pixels.slice();assert.equal(r.stamp(1,1,8,0x80a0c0),false);assert.deepEqual(r.pixels,before);assert.equal(r.consumeDirty(),null);
 assert(r.stamp(1,1,8,0x204060));assert.deepEqual([...r.pixels.slice(0,4)],[22,45,67,255]);assert.equal(r.paintColors[0],0x204060);
 r.destroy();
});

test('legacy no-substrate opaque path retains its existing channel carry',()=>{
 const r=new StreetPigmentRaster(4,2,null,1,{mergeOpaque:true,sample:(u,v,ink)=>ink?0:1});
 r.pixels.set([200,100,50,255]);r.paintColors[0]=0x102030;
 assert(r.stamp(1,1,8,0x102030));
 assert.deepEqual([...r.pixels.slice(4,8)],[200,100,50,255]);
 r.destroy();
});
