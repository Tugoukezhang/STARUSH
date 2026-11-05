import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {GRAFFITI_GROUND,createGraffitiBrush} from '../src/systems/GraffitiPaintBrush.mjs';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {attackPaintPolygon} from '../src/systems/StreetRestorationSurface.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const BEFORE='art/comic-ground-quiet-20261022/ground.png',NEXT='art/comic-ground-planes-20261022/ground.png';
const ACTIVE='art/comic-ground-ribbons-20261022/ground-v2.png';
const read=p=>fs.readFileSync(new URL('../public/'+p,import.meta.url));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const decode=async p=>{const {data,info}=await sharp(read(p)).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,width:info.width,height:info.height};};
const alphas=p=>p.filter((_,i)=>i%4===3);
test('directional comic planes ship as one exact replacement, not a second overdraw layer',()=>{
 assert.equal(GRAFFITI_GROUND.path,ACTIVE);assert.equal(GRAFFITI_GROUND.key,'graffiti-ground');
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>/comic-ground/.test(r.file)),[{file:ACTIVE,group:'owner-weapon-fx'}]);
 assert.equal(RUNTIME_PAYLOAD.length,419);assert.equal(new Set(RUNTIME_PAYLOAD.map(r=>r.file)).size,419);
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.group==='owner-character-walk'),[{file:'art/rifle-walk-volume-20261022/walk.png',group:'owner-character-walk'}]);
 assert.equal(hash(read(BEFORE)),'09a04f1d496ae43efbc61af9886d79bfe05f65a3842e732ee007517485a37928');
});
test('reviewed generated RGB atlas has pinned geometry and bytes; every old coverage byte survives',async()=>{
 const next=read(NEXT);assert.equal(next.length,330646);
 assert.equal(hash(next),'e4032b5a94c8232e4937a2d7a58eccc07c1d595ee34d8d0b1960a167cf4a5cc5');
 const a=await decode(BEFORE),b=await decode(NEXT);assert.equal(b.width,1024);assert.equal(b.height,256);
 assert.deepEqual(alphas(b.data),alphas(a.data));assert.notDeepEqual(b.data,a.data);
});
test('four generated cells contain broad but bounded intentional ink inside the existing footprints',async()=>{
 const a=await decode(BEFORE),b=await decode(NEXT);
 for(let f=0;f<4;f++){
  let area=0,dark=0,changed=0;
  for(let y=0;y<256;y++)for(let x=f*256;x<(f+1)*256;x++){
   const i=(y*1024+x)*4;if(b.data[i+3]<128)continue;area++;
   if(Math.max(b.data[i],b.data[i+1],b.data[i+2])<128)dark++;
   if(Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1])+Math.abs(a.data[i+2]-b.data[i+2])>96)changed++;
  }
  assert(dark/area>=.1&&dark/area<=.35,'ink floor/ceiling cell '+f);assert(changed/area>=.25,'meaningful generated replacement cell '+f);
 }
});
test('generated midgray planes reach the brush tone sampler instead of being discarded as zero ink',async()=>{
 const atlas=await decode(NEXT);
 for(const member of ['sakura','kai','enjo','venus']){
  const b=createGraffitiBrush(atlas,member);assert.equal(typeof b.tone,'function');
  let middle=0,white=0,dark=0;
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
   const u=(x+.5)/128,v=(y+.5)/128;if(b.sample(u,v)<.5)continue;
   const t=b.tone(u,v);assert(t>=0&&t<=1);
   if(t>.5&&t<.85){assert.equal(b.sample(u,v,true),0);middle++;}
   if(t>.95)white++;if(t<.3)dark++;
  }
  assert(middle>20&&white>100&&dark>20,member+' authored three-plane material');
 }
});
test('actual stamps and clipped overlapping fans preserve alpha, dirty bounds, ownership and replay for every member',async()=>{
 const images=[await decode(BEFORE),await decode(NEXT)],saved=images.map(i=>i.data.slice());
 const ground={width:120,height:80,data:new Uint8ClampedArray(120*80*4).fill(140)},groundBefore=ground.data.slice();
 const blocks=[{footprint:{x:140,y:50,width:20,height:60}}],fan={x:40,y:80,radius:170,angle:.1,halfAngle:.55};
 const points=attackPaintPolygon(fan,(_f,p)=>p.x<140);
 for(const member of ['sakura','kai','enjo','venus']){
  const [a,b]=images.map(img=>new StreetPigmentRaster(240,160,null,.9,createGraffitiBrush(img,member),ground));
  for(const r of [a,b]){r.stamp(60,60,45,0xff69b4,blocks,{performer:member,angle:.7});r.stamp(95,85,55,0xffd700,blocks,{performer:member,angle:-.5});r.fan(fan,points,0x00ced1,blocks);}
  assert.deepEqual(alphas(b.pixels),alphas(a.pixels),member);assert.deepEqual(b.dirty,a.dirty);
  assert.deepEqual(b.paintColors,a.paintColors,member+' pigment ownership');
  assert.notDeepEqual(b.pixels,a.pixels,member+' material changed');
  for(const r of [a,b]){r.consumeDirty();const before=r.pixels.slice();assert.equal(r.fan(fan,points,0x00ced1,blocks),false);assert.deepEqual(r.pixels,before);assert.equal(r.consumeDirty(),null);}
  for(let y=26;y<54;y++)for(let x=71;x<79;x++)assert.equal(b.pixels[(y*120+x)*4+3],0,member+' wall');
  a.destroy();b.destroy();assert.equal(b.pixels,null);assert.equal(b.paintColors,null);
 }
 images.forEach((i,n)=>assert.deepEqual(i.data,saved[n]));assert.deepEqual(ground.data,groundBefore);
});
