import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs/promises';import crypto from'node:crypto';import{createRequire}from'node:module';
import{HEAVY_COMIC_CHAIN}from'../src/systems/UserWeaponFx.mjs';import{RUNTIME_PAYLOAD}from'../scripts/runtime-payload.mjs';
const path='art/heavy-ink-chain-20261028/chain.webp';
test('the admitted heavy chain is the reviewed twelve-cel source, not the rejected thin follow-through bank',async()=>{
 assert.equal(HEAVY_COMIC_CHAIN.path,'art/heavy-pigment-swing-20261029/chain.png');assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===HEAVY_COMIC_CHAIN.path).length,1);assert(!RUNTIME_PAYLOAD.some(r=>r.file==='art/heavy-comic-chain-20261028/chain.webp'));
 const bytes=await fs.readFile(new URL('../public/'+path,import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'0d5ebc7c7307aa8387484ab9a85c9a3b353230a89e737ff44b735ff6f8351157');
});
test('all cels retain transparent gutters and real radius budgets; settled pigment stays neutral',async()=>{
 const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
 // Historical original remains byte-exact; new active cells have their own source contract.
 const{data,info}=await sharp(await fs.readFile(new URL('../public/'+path,import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height],[1024,768]);
 for(let frame=0;frame<12;frame++){let pixels=0,minX=256,minY=256,maxX=-1,maxY=-1;for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=((Math.floor(frame/4)*256+y)*1024+frame%4*256+x)*4;if(!data[i+3])continue;pixels++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);assert(Math.min(x,y,255-x,255-y)>=8);assert(Math.hypot(x-128,y-(frame>=4&&frame<8?160:128))<=256*(frame<4?.46:frame<8?.469:.43));if(frame>=8){assert.equal(data[i],data[i+1]);assert.equal(data[i],data[i+2]);}}assert(pixels>100);if(frame===2)assert(maxY-minY>maxX-minX,'downstroke must remain a descending curved body, not a horizontal scratch');}
});
