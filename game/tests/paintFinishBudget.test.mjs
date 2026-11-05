import test from 'node:test';
import assert from 'node:assert/strict';
import {StreetPaintSurface} from '../src/systems/StreetRestorationSurface.mjs';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {createComicPigmentMaterial} from '../src/systems/ComicPigmentFinish.mjs';

function surface(material=true) {
  const s=Object.create(StreetPaintSurface.prototype),w=258,h=194;
  Object.assign(s,{width:w,height:h,disposed:false,dirty:false,blockers:()=>[]});
  s.raster=new StreetPigmentRaster(w,h,new Uint8ClampedArray(Math.ceil(w/2)*Math.ceil(h/2)*4),.9,
    material?{sample:(u,v,ink)=>ink?0:1}:null);
  const image={width:8,height:8,data:new Uint8ClampedArray(256).fill(255),worldAnchored:true,inwardContour:true,printFloor:true,screenPrint:true};
  s.material=material?createComicPigmentMaterial(s.raster,image):null;
  s.materialDirty=material?new Set():null;
  s.imageData={data:material?new Uint8ClampedArray(s.raster.pixels.length):s.raster.pixels};
  s.uploaded=new Uint8ClampedArray(s.raster.pixels.length);s.calls=[];s.time=0;s.refreshes=0;
  s.texture={context:{putImageData(data,dx,dy,x,y,width,height){
    s.calls.push({x,y,width,height});s.time++;
    for(let row=y;row<y+height;row++){const start=(row*s.raster.pixelWidth+x)*4;s.uploaded.set(data.data.subarray(start,start+width*4),start);}
  }},refresh(){s.refreshes++;}};
  return s;
}
const paint=(s,color=0x39bcdc)=>s.stamp(129,97,128,color);
const budget=s=>({budgetMs:2,clock:()=>s.time});

test('normal budget counts the whole-footprint preview and keeps remaining tile work without raster dirty',()=>{
  const s=surface();paint(s);const n=s.materialDirty.size;assert(n>2);
  s.flush(budget(s));
  assert.equal(s.calls.length,2,'one base preview and one detail tile fit this fake budget');
  assert.equal(s.materialDirty.size,n-1);assert.equal(s.dirty,true);
  assert.equal(s.raster.dirty,null);assert.equal(s.refreshes,1);
  s.flush(budget(s));assert.equal(s.calls.length,4,'continue even after consumeDirty returned null');
});
test('bounded overlapping replacement and halo re-invalidation end at identical pixels to synchronous flush',()=>{
  const s=surface(),sync=surface();
  for(let i=0;i<12;i++){
    const x=70+i*8,y=50+i*5,color=i%2?0xff74ae:0x39bcdc;
    for(const p of [s,sync])p.stamp(x,y,70,color);
    s.flush(budget(s));sync.flush();
  }
  let steps=0;while(s.dirty&&steps++<100)s.flush(budget(s));
  assert(steps<100);assert.equal(s.materialDirty.size,0);
  assert.deepEqual(s.uploaded,sync.uploaded);
  assert.deepEqual(s.raster.pixels,sync.raster.pixels);
  assert.deepEqual(s.material.tones,sync.material.tones);
  assert.deepEqual(s.material.colors,sync.material.colors);
});
test('default flush drains remaining display tiles synchronously even when no new pigment arrived',()=>{
  const s=surface(),sync=surface();paint(s);paint(sync);s.flush(budget(s));s.flush();sync.flush();
  assert.equal(s.dirty,false);assert.equal(s.materialDirty.size,0);
  assert.deepEqual(s.uploaded,sync.uploaded);const n=s.refreshes;s.flush();assert.equal(s.refreshes,n);
});
test('nonmaterial copies keep old synchronous behavior, with one upload',()=>{
  const s=surface(false);paint(s);s.flush(budget(s));
  assert.equal(s.dirty,false);assert.equal(s.calls.length,1);assert.equal(s.refreshes,1);
  assert.deepEqual(s.uploaded,s.raster.pixels);
});
test('disposed surface does not finish or upload pending display work',()=>{
  const s=surface();paint(s);s.disposed=true;s.flush(budget(s));assert.equal(s.calls.length,0);assert.equal(s.refreshes,0);
});
test('a fresh impact previews centre and outer footprint before budgeted material tiles',()=>{
 const s=surface();paint(s);const n=s.materialDirty.size;s.flush({budgetMs:1,clock:()=>s.time});assert.equal(s.calls.length,1);const first=s.calls[0],x=Math.floor(129/2),y=Math.floor(97/2);assert(x>=first.x&&x<first.x+first.width&&y>=first.y&&y<first.y+first.height);assert(s.uploaded[(y*s.raster.pixelWidth+x)*4+3]>0);const far=(30*s.raster.pixelWidth+30)*4;assert(s.raster.pixels[far+3]>0);assert(s.uploaded[far+3]>0,'outer footprint must not remain gray while expensive detail is pending');assert.equal(s.materialDirty.size,n);
});
test('centre-first insertion never moves older pending tiles behind a newer impact',()=>{
 const s=surface();s.materialDirty.add(0);paint(s);const order=[...s.materialDirty],columns=Math.ceil(s.raster.pixelWidth/32),home=Math.floor(97/64)*columns+Math.floor(129/64);assert.equal(order[0],0);assert.equal(order[1],home);assert.equal(new Set(order).size,order.length);
});
test('centre-first partial presentation ends byte-identical to legacy row-order full presentation',()=>{
 const s=surface(),legacy=surface();for(const p of[s,legacy]){paint(p);p.stamp(150,110,70,0xff74ae);}legacy.materialDirty=new Set([...legacy.materialDirty].sort((a,b)=>a-b));legacy.flush();let n=0;while(s.dirty&&n++<100)s.flush(budget(s));assert(n<100);assert.deepEqual(s.uploaded,legacy.uploaded);assert.deepEqual(s.raster.pixels,legacy.raster.pixels);assert.deepEqual(s.raster.paintColors,legacy.raster.paintColors);assert.deepEqual(s.material.tones,legacy.material.tones);assert.deepEqual(s.material.colors,legacy.material.colors);
});
