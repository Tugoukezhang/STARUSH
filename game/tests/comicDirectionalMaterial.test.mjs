import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';import{createRequire}from'node:module';
import{COMIC_POOL_MATERIAL}from'../src/systems/GraffitiPaintBrush.mjs';import{RUNTIME_PAYLOAD}from'../scripts/runtime-payload.mjs';
const path='art/comic-paint-directional-20261023/planes.png',old='art/comic-paint-material-20261023/planes.png';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const hash=b=>createHash('sha256').update(b).digest('hex');
test('runtime replaces only the material source; reviewed historic source remains unchanged',()=>{
 assert.equal(COMIC_POOL_MATERIAL.path,path);assert.equal(COMIC_POOL_MATERIAL.key,'comic-pool-material');
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>[path,old].includes(r.file)),[{file:path,group:'owner-weapon-fx'},{file:old,group:'owner-weapon-fx-compat'}]);
 assert.equal(RUNTIME_PAYLOAD.length,419);assert.equal(new Set(RUNTIME_PAYLOAD.map(r=>r.file)).size,419);
 assert.equal(hash(fs.readFileSync(new URL('../public/'+old,import.meta.url))),'48fe295f2ac95e4d00e1b5545ada5ea303f2a5e887fadb8756955b3d78f64865');
});
test('new source is exact512RGBA with three deliberate broad values and safe padding',async()=>{
 const bytes=fs.readFileSync(new URL('../public/'+path,import.meta.url));assert.equal(hash(bytes),'12e3cb839dc3a3303a8866e5bd5e1756cad5400c83d6050306ae397babb68f3f');assert.equal(bytes.length,34614);
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,512);assert.equal(info.height,512);
 let visible=0;const tones={24:0,128:0,236:0};
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4,v=data[i];assert.equal(v,data[i+1]);assert.equal(v,data[i+2]);assert([24,128,236].includes(v));if(x<64||x>=448||y<64||y>=448)assert.equal(data[i+3],0);if(data[i+3]>=240){visible++;tones[v]++;}}
 assert(visible>60000);assert(tones[24]/visible>.2&&tones[24]/visible<.28);assert(tones[128]/visible>.6&&tones[128]/visible<.72);assert(tones[236]/visible>.08&&tones[236]/visible<.14);
});
