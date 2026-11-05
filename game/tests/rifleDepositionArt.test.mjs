import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const file='art/rifle-pigment-deposition-20261023/deposition.png';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
test('only reviewed deposition strip is admitted, never raw or review sheet',()=>{
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file===file),[{file,group:'owner-weapon-fx'}]);
 assert(!RUNTIME_PAYLOAD.some(r=>/deposition-raw|deposition-review/.test(r.file)));
});
test('six actual alpha cels remain centered, bounded, distinct and grounded at small scale',async()=>{
 const png=fs.readFileSync(new URL('../public/'+file,import.meta.url));
 assert.equal(crypto.createHash('sha256').update(png).digest('hex'),'bc5f47ba2ab4d610dad9478856b19ac2eb91de9923e4b3b267ee7264bc5b65a2');
 const{data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height],[1536,2048]);
 const frames=[];
 for(let f=0;f<48;f++){let left=256,right=-1,top=256,bottom=-1,mass=0,radius=0;const pixels=[];
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=((Math.floor(f/6)*256+y)*1536+(f%6)*256+x)*4,[r,g,b,a]=data.subarray(i,i+4);pixels.push(r,g,b,a);mass+=a;
   if(x<20||x>=236||y<64||y>=192)assert.equal(a,0,'transparent margin');
   if(a>0){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);radius=Math.max(radius,Math.hypot(x+.5-128,y+.5-128));assert.equal(r,g);assert.equal(g,b);}
  }
  assert(mass>0);assert(radius<=.43*256);assert(Math.abs((left+right+1)/2-128)<=16);assert(Math.abs((top+bottom+1)/2-128)<=10);assert(bottom-top<=126,'world-Y projection keeps all headings grounded');
  frames.push({mass,hash:crypto.createHash('sha256').update(Buffer.from(pixels)).digest('hex')});
 }
 assert.equal(new Set(frames.map(r=>r.hash)).size,48);for(let b=0;b<8;b++){const f=frames.slice(b*6,b*6+6);assert(f[2].mass>f[0].mass*5);assert(f[3].mass<f[2].mass);assert(f[5].mass<f[2].mass/5);}
});
