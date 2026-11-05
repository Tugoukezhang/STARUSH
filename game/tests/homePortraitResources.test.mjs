import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import {getHomePortraitArt} from '../src/systems/HomePortraitPresentation.mjs';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const BASE='art/home-portrait-demo-20261022/',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=[
 ['sakura-body.webp',800,1259,'4038d51399f5ce98846ac76182408715174e363e1010778024e7b120130a6001'],
 ['sakura-hair.webp',208,434,'1400a8a684ab263990716da45de58adaaef8421b9126889df39ccfc287dbfa52'],
 ['sakura-tail.webp',146,69,'134882b95a02193a75862185b82fc48c485b864864721c359535a164a14a05d0'],
 ['sakura-blink.webp',230,200,'5aab0347b5e5b924062e2e7a40a2d2539eb4b5908258e3b3f628daa9f23933c3'],
 ['backstage.webp',768,1365,'91241928225e1f33efca3226e3d5e6653a7299614f63ad75dbd640538f4f58c6'],
];
test('home demo admits exactly five reviewed exports, no raw concept or guide',()=>{
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file.startsWith(BASE)),files.map(([name])=>({file:BASE+name,group:'owner-ui'})));
 assert.deepEqual(fs.readdirSync(new URL('../public/'+BASE,import.meta.url)).sort(),files.map(r=>r[0]).sort());
 // B252 adds four exact portrait-base files; the five home exports remain byte-exact.
 assert.equal(RUNTIME_PAYLOAD.length,419);assert.equal(new Set(RUNTIME_PAYLOAD.map(r=>r.file)).size,419);
});
test('all home candidate files match reviewed bytes, geometry and bounded texture budget',async()=>{
 let decoded=0;
 for(const [name,width,height,expected]of files){const b=fs.readFileSync(new URL('../public/'+BASE+name,import.meta.url));assert.equal(sha(b),expected,name);const m=await sharp(b).metadata();assert.deepEqual([m.width,m.height],[width,height]);assert.equal(!!m.hasAlpha,name!=='backstage.webp');decoded+=width*height*4;}
 assert.equal(decoded,8807464);assert(decoded<9*1024*1024);
});
test('stationary original-RGB body hair and tail reconstruct the reviewed original matte exactly',async()=>{
 const art=getHomePortraitArt('sakura'),out=Buffer.alloc(art.width*art.height*4);
 for(const layer of art.layers.filter(r=>r.id!=='blink')){const {data,info}=await sharp(fs.readFileSync(new URL('../public/'+layer.src,import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*4;if(!data[i+3])continue;const j=((y+layer.y)*art.width+x+layer.x)*4;assert.equal(out[j+3],0,'layers overlap');data.copy(out,j,i,i+4);}
 }
 assert.equal(sha(out),'5834edc6e98e1bf20c474c185e2f6f96ac61af72c9e10e15bf59198c977c4b81');
});
