import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import {FACILITY_RESTORATION_POP} from '../src/systems/FacilityCompletionFx.mjs';
const require=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json'),sharp=require('sharp');
const path='art/restoration-comic-pop-20261022/pop.png',file=new URL('../public/'+path,import.meta.url);
test('only the current restoration export ships; historic six-cell bytes remain exact with no raw/preview references',()=>{
 const current='art/facility-ink-seal-20261029/pop.png';assert.equal(FACILITY_RESTORATION_POP.path,current);
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file===current),[{file:current,group:'owner-facility-fx'}]);
 assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===path).length,0);
 assert.equal(RUNTIME_PAYLOAD.length,419);assert.equal(new Set(RUNTIME_PAYLOAD.map(r=>r.file)).size,419);
 assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),'90dfb105bad1e5d72187bd39da42008849674d803e975c8276af2b2d3d7ba08b');
 assert(!RUNTIME_PAYLOAD.some(r=>/restoration-(source|white|dark|export)/.test(r.file)));
});
test('six alpha cels have safe transparent margins, no opaque backdrop and bounded decode',async()=>{
 const image=sharp(fs.readFileSync(file)),meta=await image.metadata();assert.deepEqual([meta.width,meta.height,meta.channels],[1536,256,4]);
 assert.equal(meta.width*meta.height*4,1572864);assert(fs.statSync(file).size<100000);
 const {data,info}=await image.raw().toBuffer({resolveWithObject:true});
 for(let frame=0;frame<6;frame++){
  let visible=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++){
   const alpha=data[(y*info.width+frame*256+x)*4+3];
   if(x<24||x>231||y<24||y>231)assert.equal(alpha,0);
   if(alpha>128)visible++;
  }
  assert(visible>100&&visible<20000,'designed sparse foreground, not a filled tile');
 }
});
