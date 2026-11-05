import test from 'node:test';
import assert from 'node:assert/strict';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {attackPaintPolygon} from '../src/systems/StreetRestorationSurface.mjs';
const brush={sample:(_u,_v,ink=false)=>ink?0:1};
const substrate=rgb=>({width:40,height:20,data:Uint8ClampedArray.from({length:40*20*4},(_,i)=>i%4===3?255:rgb[i%4])});
const pixel=(r,x=20,y=10)=>Array.from(r.pixels.slice((y*r.pixelWidth+x)*4,(y*r.pixelWidth+x)*4+3));
const paint=(Class,color,rgb,b=brush)=>{const r=new Class(80,40,null,.9,b,rgb&&substrate(rgb));r.stamp(40,20,35,color);return r;};
const previousRGB=(color,rgb)=>[16,8,0].map((shift,i)=>{const tint=Math.round(((color>>>shift)&255)*.9+255*(1-.9));return rgb?Math.round(tint*(.45+.55*rgb[i]/255)):tint;});
const hue=rgb=>{const [r,g,b]=rgb,m=Math.max(...rgb),n=Math.min(...rgb),d=m-n;return !d?0:((m===r?(g-b)/d:m===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360;};
test('authored yellow does not turn lime on teal nor orange on magenta road',()=>{
 for(const rgb of [[60,170,160],[200,50,170],[60,70,180],[40,190,50]]){
  const p=pixel(paint(StreetPigmentRaster,0xffd700,rgb));assert(hue(p)>=45&&hue(p)<=56,JSON.stringify({rgb,p,hue:hue(p)}));
 }
});
test('pink and cyan retain their pigment hue across six differently colored substrates',()=>{
 for(const color of [0xff69b4,0x00ced1])for(const rgb of [[60,170,160],[200,50,170],[60,70,180],[40,190,50],[230,200,120],[30,30,30]]){
  const p=pixel(paint(StreetPigmentRaster,color,rgb)),reference=pixel(paint(StreetPigmentRaster,color,[255,255,255]));
  assert(Math.abs(hue(p)-hue(reference))<1.5,JSON.stringify({color,rgb,p}));
  const a=p.map(c=>c/Math.max(...p)),b=reference.map(c=>c/Math.max(...reference));a.forEach((c,i)=>assert(Math.abs(c-b[i])<.012));
 }
});
test('equal luminance different-hue substrates produce equal bounded comic pigment',()=>{
 // Rec.709 luminance of these two substrates is 100 and 100.0248.
 for(const color of [0xff69b4,0xffd700,0x00ced1]){
  const a=pixel(paint(StreetPigmentRaster,color,[100,100,100])),b=pixel(paint(StreetPigmentRaster,color,[200,80,4]));
  a.forEach((c,i)=>assert(Math.abs(c-b[i])<=1));
 }
});
test('comic yellow keeps a bright graphic floor on dark roads instead of returning mustard paint',()=>{
 for(const rgb of [[0,0,0],[40,40,40],[80,80,80],[60,70,100]]){
  const p=pixel(paint(StreetPigmentRaster,0xffd700,rgb,{...brush,tone:()=>1}));assert(p[0]>=180&&p[1]>=155&&p[2]<=30,JSON.stringify({rgb,p}));
 }
});
test('authored white, gray and ink planes survive actual stamping and ignore substrate hue and value',()=>{
 const colors=[0xff69b4,0xffd700,0x00ced1];
 for(const color of colors)for(const [tone,ink] of [[1,0],[.5,0],[0,1]]){
  const b={sample:(_u,_v,isInk=false)=>isInk?ink:1,tone:()=>tone};
  const a=pixel(paint(StreetPigmentRaster,color,[0,0,0],b)),c=pixel(paint(StreetPigmentRaster,color,[240,120,40],b));
  assert.deepEqual(a,c,'authored planes must not pick up road value or hue');
  const tint=previousRGB(color,null),expected=tint.map(v=>Math.round(Math.round(v*(.4+.6*tone))*(1-ink*.45)));
  assert.deepEqual(a,expected);
 }
});
test('gray structure and strength stay byte-identical while ink remains a local shade, not a new hue',()=>{
 for(const rgb of [[0,0,0],[40,40,40],[130,130,130],[200,200,200],[255,255,255]])for(const color of [0xff69b4,0xffd700,0x00ced1]){
  assert.deepEqual(pixel(paint(StreetPigmentRaster,color,rgb)),previousRGB(color,rgb));
  const ink={sample:()=>1},a=pixel(paint(StreetPigmentRaster,color,rgb)),b=pixel(paint(StreetPigmentRaster,color,rgb,ink));
  b.forEach((c,i)=>assert(Math.abs(c-Math.round(a[i]*.55))<=1));assert(Math.abs(hue(a)-hue(b))<2);
 }
 const dark=pixel(paint(StreetPigmentRaster,0xffd700,[40,40,40])),light=pixel(paint(StreetPigmentRaster,0xffd700,[200,200,200]));
 assert(light[0]-dark[0]>=85,'retain existing substrate contrast, not washed-flat paint');
});
test('legacy unbrushed and substrate-free material RGB stays exactly unchanged',()=>{
 for(const color of [0xff69b4,0xffd700,0x00ced1])for(const rgb of [[60,170,160],[200,50,170],[0,0,0],[255,255,255],null]){
  assert.deepEqual(pixel(paint(StreetPigmentRaster,color,rgb,null)),previousRGB(color,rgb));
 }
 assert.deepEqual(pixel(paint(StreetPigmentRaster,0x00ced1,null)),previousRGB(0x00ced1,null));
});
test('real overlap, clipped fan, blocker holes, ownership and dirty extents do not change',()=>{
 const fan={x:12,y:20,radius:65,angle:0,halfAngle:.55},points=attackPaintPolygon(fan,(_a,p)=>p.x<62),blocks=[{footprint:{x:56,y:8,width:8,height:24}}];
 const mask={sample:(u,v,ink=false)=>ink?(u>.4&&u<.6?.8:0):Math.hypot(u-.5,v-.5)<.48?(u<.4?.65:1):0};
 const rasters=[null,substrate([60,170,160])].map(s=>new StreetPigmentRaster(80,40,null,.9,mask,s));
 for(const r of rasters){r.stamp(28,20,22,0xff69b4,blocks);r.stamp(40,20,24,0xffd700,blocks);r.fan(fan,points,0x00ced1,blocks);}
 const [a,b]=rasters;assert.deepEqual(b.pixels.filter((_,i)=>i%4===3),a.pixels.filter((_,i)=>i%4===3));assert.deepEqual(b.paintColors,a.paintColors);assert.deepEqual(b.dirty,a.dirty);assert.notDeepEqual(b.pixels,a.pixels);
 for(let y=5;y<15;y++)for(let x=29;x<31;x++)assert.equal(b.pixels[(y*40+x)*4+3],0);
 b.consumeDirty();const before=b.pixels.slice();assert.equal(b.fan(fan,points,0x00ced1,blocks),false);assert.deepEqual(b.pixels,before);assert.equal(b.consumeDirty(),null);
 b.destroy();assert.equal(b.pixels,null);assert.equal(b.substrate,null);assert.equal(b.paintColors,null);
});
