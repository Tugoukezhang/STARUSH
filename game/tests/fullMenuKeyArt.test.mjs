import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import {getMenuPortraitArt} from '../src/systems/MenuPortraitPresentation.mjs';
import {getHomePortraitArt} from '../src/systems/HomePortraitPresentation.mjs';
import {getUserCastArt} from '../src/utils/userCast.mjs';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const base='art/menu-key-art-20261025/';
const runtimeBase='art/portrait-base-20261101/';
const hashes={kai:'d9426d2a43815f8f76c6b7d31ed78d19811a6bb3acc554c31041f62749448f9d',enjo:'a6caa50b7b7103fcc1bda822708123eef0f6ddf61d7b71a697ba6b7288a8b6c3'};
test('two full-height menu illustrations have exact versioned geometry, not previous chibi proportions',()=>{
 for(const id of ['kai','enjo'])assert.deepEqual(getMenuPortraitArt(id),{src:runtimeBase+id+'.webp',width:1152,height:1664});
 assert.equal(getMenuPortraitArt('sakura'),null);assert.equal(getMenuPortraitArt('bogus'),null);
});
test('exact two full-height files are explicitly admitted while previous menu images retain compatibility',()=>{
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file.startsWith(runtimeBase)).map(r=>r.file).sort(),['kai.webp','enjo.webp','kai-avatar.webp','enjo-avatar.webp'].map(f=>runtimeBase+f).sort());
 assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file.startsWith('art/menu-series-cast-20261031/')).length,4);
 assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file.startsWith(base)).length,0,'superseded source candidate stays out of runtime');
 assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file.startsWith('art/menu-portraits-20261024/')).length,2);
 assert.deepEqual(fs.readdirSync(new URL('../public/'+base,import.meta.url)).sort(),['enjo.webp','kai.webp']);
});
test('reviewed full illustration bytes decode sharply within the shared texture budget',async()=>{
 let bytes=0,decoded=0;
 for(const [id,hash]of Object.entries(hashes)){
  const file=fs.readFileSync(new URL('../public/'+base+id+'.webp',import.meta.url));assert.equal(crypto.createHash('sha256').update(file).digest('hex'),hash);
  const m=await sharp(file).metadata();assert.deepEqual([m.width,m.height,m.hasAlpha],[1152,1664,true]);bytes+=file.length;decoded+=m.width*m.height*4;
 }
 assert(bytes<3*1024*1024);assert(decoded<16*1024*1024);
});
test('full-figure assets keep real alpha and64px layout safety without an opaque poster backdrop',async()=>{
 for(const id of ['kai','enjo']){
  const {data,info}=await sharp(fs.readFileSync(new URL('../public/'+base+id+'.webp',import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let visible=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
   const a=data[(y*info.width+x)*4+3];if(x<64||x>=info.width-64||y<64||y>=info.height-64)assert.equal(a,0);
   if(a>8)visible++;
  }
  assert(visible>info.width*info.height*.25&&visible<info.width*info.height*.75);
 }
});
test('battle chibi, avatars and the existing rifle layered demo retain their original independent identity paths',()=>{
 for(const [id,design]of [['sakura','cat-rifle'],['kai','mecha-sword'],['enjo','hammer-cat']]){
  const art=getUserCastArt(id);assert.equal(art.portrait,'art/user-cast-20261015/'+design+'.webp');assert.equal(art.battle,'art/user-cast-20261015/'+design+'-battle.webp');
  assert.equal(art.avatar,'art/user-cast-20261015/'+design+'-avatar.webp');
 }
 assert.equal(getHomePortraitArt('kai'),null);assert.equal(getHomePortraitArt('enjo'),null);assert.equal(getHomePortraitArt('sakura').kind,'layered-demo');
});
test('menu illustration loader remains static and cannot import source sheets or claim rigged characters',()=>{
 const source=fs.readFileSync(new URL('../src/systems/MenuPortraitPresentation.mjs',import.meta.url),'utf8');
 for(const forbidden of ['requestAnimationFrame','setInterval','moc3','psd2live','batch-122','sources/'])assert(!source.includes(forbidden),forbidden);
 for(const file of ['UiPerformerArt','BattleSurfaceView','HomePortraitPresentation'])assert(!fs.readFileSync(new URL('../src/systems/'+file+'.mjs',import.meta.url),'utf8').includes(base),file);
});
