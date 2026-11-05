import test from 'node:test';import assert from 'node:assert/strict';
import {createComicPigmentMaterial,stampComicPigmentMaterial,finishComicPigment} from '../src/systems/ComicPigmentFinish.mjs';
import {loadGraffitiMaterial} from '../src/systems/GraffitiPaintBrush.mjs';
import {StreetPaintSurface} from '../src/systems/StreetRestorationSurface.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
const colors=[0xff69b4,0x00ced1,0xff8c00];
const hue=rgb=>{const [r,g,b]=rgb,m=Math.max(...rgb),n=Math.min(...rgb),d=m-n;return !d?0:((m===r?(g-b)/d:m===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360;};
function fixture(color=colors[2],tone=128,ground=200){
 const r={width:16,height:12,pixelWidth:8,pixelHeight:6,pigmentStrength:.9,pixels:new Uint8ClampedArray(8*6*4),paintColors:new Uint32Array(8*6),dirty:null,substrate:{width:8,height:6,data:new Uint8ClampedArray(8*6*4)}};
 for(let p=0;p<48;p++){r.pixels.set([60,28,4,255],p*4);r.paintColors[p]=color;r.substrate.data.set([ground,ground,ground,255],p*4);}
 const image={width:4,height:4,data:new Uint8ClampedArray(4*4*4),worldAnchored:true,printFloor:true};for(let p=0;p<16;p++)image.data.set([tone,tone,tone,255],p*4);
 const m=createComicPigmentMaterial(r,image);stampComicPigmentMaterial(m,r,{x:8,y:6,radius:40,color});
 const render=(rect={x:0,y:0,width:8,height:6},target=new Uint8ClampedArray(r.pixels.length))=>{finishComicPigment(r,target,rect,m);return target;};return {r,m,render};
}
const rgb=out=>[...out.slice(0,3)];

test('continuous authored grays survive the actual decoded loader instead of becoming a three-value poster',()=>{
 const values=[96,112,128,144,160,180],size=1254,data=new Uint8ClampedArray(size*size*4);for(let p=0;p<size*size;p++){const v=values[p%values.length];data.set([v,v,v,255],p*4);}
 const source={width:size,height:size,ownerDocument:{createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({width:size,height:size,data:data.slice()})})})}};
 for(const performerId of ['sakura','kai','enjo']){const image=loadGraffitiMaterial({_userCastPresentation:true,battleData:{performerId},textures:{exists:()=>true,get:()=>({getSourceImage:()=>source})}});assert.equal(image.printFloor,true);assert.equal(image.worldAnchored,true);assert.deepEqual(Array.from({length:6},(_,p)=>image.data[p*4]),values);}
});

test('new profile reconstructs a bright owner pigment over stale dark raw RGB without rewriting history',()=>{
 const f=fixture(),before=f.r.pixels.slice(),owners=f.r.paintColors.slice(),out=f.render();
 assert(Math.max(...rgb(out))>=225,'neutral owner body must not inherit old brown scratches');assert(Math.abs(hue(rgb(out))-hue([255,140,0]))<2);
 assert.deepEqual(f.r.pixels,before);assert.deepEqual(f.r.paintColors,owners);
});

test('shade remains bright and hue-preserving across all three owner colors, including old extreme cached tones',()=>{
 for(const color of colors)for(const tone of[0,24,76,96,112,128,160,205,236,255]){
  const f=fixture(color,tone,0),out=rgb(f.render()),reference=[16,8,0].map(s=>(color>>>s)&255);
  const peak=Math.max(...reference)*.9+255*.1;
  assert(Math.max(...out)>=Math.floor(peak*.73),JSON.stringify({color,tone,out,peak}));assert(Math.abs(hue(out)-hue(reference))<2.5,JSON.stringify({color,tone,out}));
 }
});

test('actual substrate joints survive under identical paint tone without inheriting a foreign floor hue',()=>{
 const a=fixture(colors[2],128,30),b=fixture(colors[2],128,230),dark=rgb(a.render()),light=rgb(b.render());
 assert(light[0]-dark[0]>=12&&light[0]-dark[0]<=30);assert(Math.abs(hue(dark)-hue(light))<2);
 const c=fixture(colors[2],128);for(let p=0;p<48;p++)c.r.substrate.data.set([200,80,4,255],p*4);
 const d=fixture(colors[2],128,100);rgb(c.render()).forEach((v,i)=>assert(Math.abs(v-rgb(d.render())[i])<=1,'equal luminance, different hue floor stays neutral'));
});

test('material variation is continuous and monotonic; unflagged historical shading remains different',()=>{
 const samples=[76,96,112,128,144,160,180].map(t=>rgb(fixture(colors[2],t).render()));
 assert(new Set(samples.map(v=>v.join(','))).size>=6);for(let i=1;i<samples.length;i++)assert(samples[i][1]>=samples[i-1][1]);
 const f=fixture(colors[2],24),printed=f.render();f.m.image.printFloor=false;assert.notDeepEqual(f.render(),printed);
});

test('same-owner unions, holes and neighboring colors preserve exact alpha and all semantic/cache bytes',()=>{
 const f=fixture();for(let y=0;y<6;y++){const p=y*8+4;f.r.paintColors[p]=colors[0];f.m.colors[p]=colors[0];}
 f.r.pixels[3]=0;f.r.pixels[7]=90;f.r.pixels[11]=170;
 const before=[f.r.pixels.slice(),f.r.paintColors.slice(),f.m.tones.slice(),f.m.colors.slice()],out=f.render();
 for(let i=3;i<out.length;i+=4)assert.equal(out[i],f.r.pixels[i]);assert.deepEqual([f.r.pixels,f.r.paintColors,f.m.tones,f.m.colors],before);
 assert.deepEqual(out.slice(0,4),f.r.pixels.slice(0,4));
});

test('stale tone owner cannot resurrect another color plane; repeat and partial-tile finish equal a full oracle',()=>{
 const f=fixture(),full=f.render(),again=f.render();assert.deepEqual(again,full);
 const partial=new Uint8ClampedArray(full.length);for(const rect of[{x:0,y:0,width:4,height:6},{x:4,y:0,width:4,height:6}])f.render(rect,partial);assert.deepEqual(partial,full);
 f.m.colors.fill(colors[0]);f.m.tones.fill(0);const stale=f.render(),neutral=fixture(colors[2],128).render();assert.deepEqual(stale,neutral);
});

test('no substrate, nonworld or unflagged image stays safe; caller output may never alias immutable state',()=>{
 const f=fixture();delete f.r.substrate;const out=f.render();assert(rgb(out)[0]>=225);
 f.m.image.worldAnchored=false;const nonworld=f.render();f.m.image.printFloor=false;assert.deepEqual(f.render(),nonworld);
 assert.throws(()=>f.render(undefined,f.r.pixels),/alias/);
});

test('reviewed actual print bitmap is opaque continuous grayscale, exact SHA and explicitly admitted once',async()=>{
 const path='art/printed-floor-pigment-20261024/planes.png',bytes=readFileSync(new URL('../public/'+path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),'3887268013aa71a9f7f3b1c5bd5e5d78ec603bb70efe8ecb88b186309646a5e3');
 const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp'),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,1254);assert.equal(info.height,1254);const bins=new Set();let gray=0;for(let i=0;i<data.length;i+=4){assert.equal(data[i+3],255);const hi=Math.max(data[i],data[i+1],data[i+2]),lo=Math.min(data[i],data[i+1],data[i+2]);bins.add(hi);if(hi-lo<=2)gray++;assert(hi>=80&&hi<=210);}assert(bins.size>=64);assert(gray/(1254*1254)>.99);assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file===path),[{file:path,group:'owner-weapon-fx'}]);assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file==='art/ink-pocket-pigment-20261023/planes.png').length,1);
});

test('real print Surface flush uses the continuous profile, body owner and bounded dirty tiles; full oracle agrees',()=>{
 const pool=new Uint8ClampedArray(512*512*4).fill(255),planes=new Uint8ClampedArray(1254*1254*4);for(let p=0;p<1254*1254;p++){const v=96+(p%80);planes.set([v,v,v,255],p*4);}
 let source;const canvas={getContext:()=>({drawImage(s){source=s;},getImageData:()=>({width:source.width,height:source.height,data:source.data.slice()})})},uploads=[];
 const node={setOrigin(){return this;},setDisplaySize(){return this;},setDepth(){return this;},setAlpha(){return this;},setBlendMode(){return this;},destroy(){}};
 const texture={context:{createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData:(...a)=>uploads.push(a)},setFilter(){},refresh(){}};
 const scene={_userCastPresentation:true,battleData:{performerId:'enjo',practiceMode:true},_isPublicStage1Round:()=>true,textures:{exists:()=>true,get:key=>({getSourceImage:()=>({width:key==='three-cast-comic-material'?1254:512,height:key==='three-cast-comic-material'?1254:512,data:key==='three-cast-comic-material'?planes:pool,ownerDocument:{createElement:()=>canvas}})}),createCanvas:()=>texture,remove(){}},add:{image:()=>node}};
 const s=new StreetPaintSurface(scene,()=>[],240,120);assert.equal(s.material.image.printFloor,true);assert(new Set(s.material.image.data.filter((_,i)=>i%4===0)).size>64);
 s.stamp(45,60,34,colors[2]);s.flush();s.stamp(110,60,34,colors[2]);s.stamp(185,60,30,colors[0]);const raw=s.raster.pixels.slice(),owners=s.raster.paintColors.slice();s.flush();
 const full=new Uint8ClampedArray(raw.length);finishComicPigment(s.raster,full,{x:0,y:0,width:120,height:60},s.material);assert.deepEqual(s.imageData.data,full);assert.deepEqual(s.raster.pixels,raw);assert.deepEqual(s.raster.paintColors,owners);assert(uploads.length>0);assert.equal(s.materialDirty.size,0);s.destroy();assert.equal(s.material,null);
});

test('a restored old tone cache is re-finished deterministically without changing stored RGB, alpha or owners',()=>{
 const f=fixture(colors[2],24),saved=[f.r.pixels.slice(),f.r.paintColors.slice(),f.m.tones.slice(),f.m.colors.slice()];f.m.image.printFloor=false;const old=f.render();f.m.image.printFloor=true;const upgraded=f.render();assert.notDeepEqual(upgraded,old);
 for(let i=3;i<old.length;i+=4)assert.equal(upgraded[i],old[i]);assert.deepEqual([f.r.pixels,f.r.paintColors,f.m.tones,f.m.colors],saved);assert.deepEqual(f.render(),upgraded);
});
