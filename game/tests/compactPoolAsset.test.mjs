import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import {COMPACT_POOL_GROUND,createCompactPoolBrush} from '../src/systems/GraffitiPaintBrush.mjs';import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
test('retained legacy compact pool keeps the exact512square export, margins and dense core',async()=>{
 const legacyPath='art/compact-pool-ground-20261023/pool.png';
 const bytes=fs.readFileSync(new URL('../public/'+legacyPath,import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'43b45b4a3cbf5427b2ae2a9a05189ef9d67afaa600f3abd3766e3aac3d5a33aa');
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file===legacyPath),[{file:legacyPath,group:'owner-weapon-fx'}]);
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height,info.channels],[512,512,4]);
 let opaque=0,white=0,dark=0;for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4;if(x<64||x>=448||y<64||y>=448)assert.equal(data[i+3],0,'transparent padding');if(data[i+3]<240)continue;opaque++;const v=Math.max(data[i],data[i+1],data[i+2]);if(v>=242)white++;if(v<128)dark++;}
 assert(opaque>70000);assert(white/opaque>.8);assert(dark/opaque<.04);
 const brush=createCompactPoolBrush({data,width:512,height:512}),r=new StreetPigmentRaster(300,180,null,.9,brush);
 for(let x=45;x<=255;x+=6)for(const y of [70,90,110])r.stamp(x,y,42,0xff69b4,[],{angle:0});
 const snapshot=r.pixels.slice();r.consumeDirty();for(let x=45;x<=255;x+=6)for(const y of [70,90,110])r.stamp(x,y,42,0xff69b4,[],{angle:0});
 assert.deepEqual(r.pixels,snapshot);assert.equal(r.consumeDirty(),null);assert.equal(brush.preserveSubstrate,true);r.destroy();
});
