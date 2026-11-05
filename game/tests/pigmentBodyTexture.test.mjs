import test from 'node:test';
import assert from 'node:assert/strict';
import {createComicPigmentMaterial,stampComicPigmentMaterial,finishComicPigment} from '../src/systems/ComicPigmentFinish.mjs';
import {SHARED_COMIC_MATERIAL} from '../src/systems/GraffitiPaintBrush.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import fs from 'node:fs';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';

const bodyPath='art/pigment-cel-tile-20261028/body.png';
function fixture(body=true){
  const w=180,h=92,r={width:w*2,height:h*2,pixelWidth:w,pixelHeight:h,pixels:new Uint8ClampedArray(w*h*4),paintColors:new Uint32Array(w*h)};
  for(let p=0;p<w*h;p++){r.pixels.set([255,140,0,255],p*4);r.paintColors[p]=0xff8c00;}
  const n=8,image={width:n,height:n,data:new Uint8ClampedArray(n*n*4),worldAnchored:true,printFloor:true,screenPrint:true,paintBodyTexture:body};
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const v=x<3?32:y<4?224:128;image.data.set([v,v,v,255],(y*n+x)*4);}
  const m=createComicPigmentMaterial(r,image),render=(rect={x:0,y:0,width:w,height:h},out=new Uint8ClampedArray(r.pixels.length))=>{finishComicPigment(r,out,rect,m);return out;};
  return{r,m,render};
}
test('new continuous body replaces exactly one active payload image without changing shared decode size',()=>{
  assert.equal(SHARED_COMIC_MATERIAL.path,'art/comic-ink-planes-20261029/body.png');assert.equal(SHARED_COMIC_MATERIAL.size,1254);
  assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===SHARED_COMIC_MATERIAL.path).length,1);
  assert.equal(RUNTIME_PAYLOAD.some(r=>r.file==='art/comic-screenprint-floor-20261024/planes.png'),false);
});
test('world body lookup is bounded, mirror-continuous and fixed regardless of stamp angle',()=>{
  const {r,m}=fixture();assert(m.bodyPattern instanceof Uint8Array);assert.equal(m.bodyPattern.byteLength,6400);
  stampComicPigmentMaterial(m,r,{x:170,y:90,radius:500,color:0xff8c00,angle:2});
  assert.notEqual(m.tones[0],m.tones[40]);assert.equal(m.tones[0],m.tones[159]);assert.equal(m.tones[79],m.tones[80]);
  assert.equal(m.tones[0],m.tones[160]);assert.equal(m.tones[79*r.pixelWidth],m.tones[80*r.pixelWidth]);
  const saved=m.tones.slice();stampComicPigmentMaterial(m,r,{x:100,y:70,radius:500,color:0xff8c00,angle:-1});assert.deepEqual(m.tones,saved);
});
test('current body renders over restored legacy cache without changing save bytes, coverage or hue owners',()=>{
  const f=fixture(),{r,m}=f;r.pixels[3]=0;r.pixels[7]=91;r.paintColors[24]=0xff69b4;
  m.tones.fill(128);m.colors.fill(0xff8c00);
  const saved=[r.pixels.slice(),r.paintColors.slice(),m.tones.slice(),m.colors.slice()],a=f.render();
  assert.notDeepEqual(a.slice(16*4,16*4+3),a.slice(40*4,40*4+3),'legacy neutral cache must not flatten current source');
  assert.deepEqual(a.slice(0,4),r.pixels.slice(0,4));for(let i=3;i<a.length;i+=4)assert.equal(a[i],r.pixels[i]);
  assert.deepEqual([r.pixels,r.paintColors,m.tones,m.colors],saved);
  m.tones.fill(0);m.colors.fill(0);assert.deepEqual(f.render(),a,'old tone cache cannot select current visual material');
});
test('body full and independently dirty-tiled renders are byte-exact and repeatable',()=>{
  const f=fixture(),a=f.render(),b=new Uint8ClampedArray(a.length);for(let x=0;x<180;x+=30)f.render({x,y:0,width:30,height:92},b);
  assert.deepEqual(a,b);assert.deepEqual(f.render(),a);
});
test('body feature requires all world/printed flags and cannot change historical material',()=>{
  const a=fixture(false);assert.equal(a.m.bodyPattern,undefined);
  for(const flag of['worldAnchored','printFloor','screenPrint']){const f=fixture();f.m.image[flag]=false;const m=createComicPigmentMaterial(f.r,f.m.image);assert.equal(m.bodyPattern,undefined);}
});
test('body lookup cannot be overwritten through an aliased upload target',()=>{
  const f=fixture();f.m.bodyPattern=new Uint8Array(new ArrayBuffer(f.r.pixels.byteLength));
  assert.throws(()=>f.render(undefined,new Uint8ClampedArray(f.m.bodyPattern.buffer)),/alias/);
});
test('candidate material is exact neutral opaque source with bounded unchanged decoded allocation',async()=>{
  const bytes=fs.readFileSync(new URL('../public/'+bodyPath,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'8dcbb9362b2f18f37ec1b0ea9cf9d44fb8d994e55376a2f8dcd6d4e277fd9e32');
  const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp'),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,1254);assert.equal(info.height,1254);assert.equal(data.length,6290064);
  for(let i=0;i<data.length;i+=4){assert.equal(data[i],data[i+1]);assert.equal(data[i],data[i+2]);assert.equal(data[i+3],255);}
  const old=fs.readFileSync(new URL('../public/art/comic-screenprint-floor-20261024/planes.png',import.meta.url));
  assert.equal(createHash('sha256').update(old).digest('hex'),'56ed582618fcc61d32ac3df29cac357fb0143faceb675aa2c891947b0cfa97db');
});
