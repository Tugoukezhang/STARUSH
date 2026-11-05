import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {StreetPaintSurface,attackPaintPolygon} from '../src/systems/StreetRestorationSurface.mjs';
const rasterUrl=new URL('../src/systems/StreetPigmentRaster.mjs',import.meta.url);
const {StreetPigmentRaster}=fs.existsSync(rasterUrl)?await import(rasterUrl):{};

function fixture(){
  const calls={created:0,refresh:0,upload:[],removed:0};
  const context={setTransform(){},createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),
    putImageData:(...a)=>calls.upload.push(a)};
  const image={setOrigin(){return this;},setDisplaySize(){return this;},setDepth(d){this.depth=d;return this;},
    setAlpha(a){this.alpha=a;return this;},setBlendMode(m){this.mode=m;return this;},destroy(){this.active=false;},active:true};
  const scene={textures:{createCanvas(){calls.created++;return {context,refresh(){calls.refresh++;}};},exists:()=>true,remove(){calls.removed++;}},add:{image:()=>image}};
  return {calls,image,scene,surface:new StreetPaintSurface(scene,()=>[],256,128)};
}
const alpha=(r,x,y)=>r.pixels[(Math.floor(y/2)*r.pixelWidth+Math.floor(x/2))*4+3];

test('ground uses multiplicative pigment, not a flat normal-blended range decal',()=>{
  const f=fixture();assert.equal(f.image.mode,'MULTIPLY');assert.equal(f.image.alpha,.5);assert.equal(f.image.depth,.4);
  f.surface.destroy();
});
test('fan has bounded feathered coverage; replaying identical color cannot darken or grow it',()=>{
  assert.equal(typeof StreetPigmentRaster,'function');
  const r=new StreetPigmentRaster(256,128),fan={x:40,y:64,angle:0,halfAngle:Math.PI/6,radius:128};
  const points=attackPaintPolygon(fan);
  assert.equal(r.fan(fan,points,0xFF69B4,[]),true);
  assert.equal(alpha(r,100,64),255);assert.equal(alpha(r,100,115),0);
  assert.ok(alpha(r,164,64)>0&&alpha(r,164,64)<150,'outer boundary must feather');
  assert.ok(alpha(r,110,92)>0&&alpha(r,110,92)<180,'side edge must feather');
  const before=r.pixels.slice();r.consumeDirty();
  for(let i=0;i<50;i++)assert.equal(r.fan(fan,points,0xFF69B4,[]),false);
  assert.deepEqual(r.pixels,before);assert.equal(r.consumeDirty(),null);
  const rgb=Array.from(r.pixels.slice((32*r.pixelWidth+50)*4,(32*r.pixelWidth+50)*4+3));
  assert.ok(rgb.every(c=>1-.5*(1-c/255)>.8),'road contrast retained at least 80 percent by authored tint');
});
test('cover clips pigment and stamps never paint buildings or invalid positions',()=>{
  assert.equal(typeof StreetPigmentRaster,'function');
  const r=new StreetPigmentRaster(256,128),fan={x:40,y:64,angle:0,halfAngle:Math.PI/6,radius:128};
  const points=attackPaintPolygon(fan,(_p,to)=>to.x<=100);
  r.fan(fan,points,0xFF69B4,[]);assert.equal(alpha(r,110,64),0);assert.ok(alpha(r,80,64)>0);
  const blocks=[{footprint:{x:110,y:20,width:40,height:90}}];
  assert.equal(r.stamp(120,64,30,0xFF69B4,blocks),false);
  assert.equal(r.stamp(90,64,60,0xFF69B4,blocks),true);
  assert.equal(alpha(r,120,64),0);
  for(const x of [NaN,Infinity,-5,300])assert.equal(r.stamp(x,64,20,0xFF69B4,[]),false);
});
test('fan bounds avoid probing blockers across its empty surrounding rectangle',()=>{
  const r=new StreetPigmentRaster(1000,1778),fan={x:500,y:800,angle:0,halfAngle:Math.PI/6,radius:160};
  let probes=0;const blockers=[{get footprint(){probes++;return {x:0,y:0,width:1,height:1};}}];
  r.fan(fan,attackPaintPolygon(fan),0xFF69B4,blockers);
  assert.ok(probes<7500,`only actually covered pixels should query blockers; got ${probes}`);
});
test('surface owns one bounded texture; dirty uploads batch and destruction releases the pixel store',()=>{
  const f=fixture();assert.equal(f.calls.created,1);
  f.surface.stamp(80,64,22,0xFF69B4);f.surface.stamp(90,64,22,0xFF69B4);f.surface.flush();f.surface.flush();
  assert.equal(f.calls.refresh,1);assert.equal(f.calls.upload.length,1);
  const r=f.surface.raster;assert.equal(r.pixels.byteLength,128*64*4);
  const frame=f.calls.upload[0];assert.equal(frame[1],0);assert.equal(frame[2],0);assert.ok(frame[5]<128&&frame[6]<64);
  f.surface.destroy();f.surface.destroy();assert.equal(f.calls.removed,1);assert.equal(r.pixels,null);assert.equal(f.surface.texture,null);
});
test('new rendering keeps existing fan return geometry and does not own damage or facility completion',()=>{
  const f=fixture(),fan={x:40,y:64,angle:0,halfAngle:Math.PI/6,radius:128};
  f.surface.stamp(12,12,8,0xFF69B4);
  assert.deepEqual(f.surface.fan(fan,0xFF69B4,()=>true),attackPaintPolygon(fan));
  assert.equal(alpha(f.surface.raster,100,64),255,'an already dirty texture must still rasterize subsequent attacks');
  f.surface.destroy();assert.deepEqual(f.surface.fan(fan,0xFF69B4,()=>true),[]);
});
