import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const require=createRequire(import.meta.url),postcss=require('postcss');
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
// B61 source remains immutable; B64 supersedes its single-caption CSS with an approved five-state family.
const READY='art/ready-lettering-20261022/ready.png',SHA='0f6f32478445f9650bb5f25b51be73fb5074a7ca816a722ce755c2b4ee5acd23';
const H='#game-container[data-battle-mode=public]',SELECTOR=H+' #skill-special[data-art=weapon][data-charge-state=ready] #special-state::after';
const text=fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8'),css=postcss.parse(text);
const top=()=>{const rows=[];css.walkRules(r=>{if(!r.parent.name)rows.push(r);});return rows;};
const decls=r=>r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]);

test('ready plate is the exact admitted opaque 168x56 PNG with white padding and strong ink',async()=>{
  assert.deepEqual(fs.readdirSync(new URL('../public/art/ready-lettering-20261022/',import.meta.url)),['ready.png']);
  const png=fs.readFileSync(new URL('../public/'+READY,import.meta.url));assert.equal(png.length,10954);assert.equal(crypto.createHash('sha256').update(png).digest('hex'),SHA);
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(png.readUInt32BE(16),168);assert.equal(png.readUInt32BE(20),56);
  const{data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height,info.channels],[168,56,4]);
  let ink=0;for(let y=0;y<56;y++)for(let x=0;x<168;x++){const i=(y*168+x)*4;assert.equal(data[i+3],255,'opaque '+x+','+y);
    if(x<2||x>165||y<2||y>53)assert(Math.min(data[i],data[i+1],data[i+2])>=235,'white outer padding '+x+','+y);
    if(Math.max(data[i],data[i+1],data[i+2])<80)ink++;}
  assert(ink>=300,'strong dark ink '+ink);
});

test('release contains exactly one owner-ui ready plate and unique runtime files',()=>{
  assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file.includes('ready-lettering')).map(r=>({...r})),[{file:READY,group:'owner-ui'}]);
  assert.equal(RUNTIME_PAYLOAD.length,419);assert.equal(new Set(RUNTIME_PAYLOAD.map(r=>r.file)).size,419);
});

test('B64 retires the old single-caption overlay while retaining native text, geometry and original source',()=>{
  assert.equal(text.split('/'+READY).length-1,0,'historical source no longer draws over new family');
  const rows=top().filter(r=>r.toString().includes('command-state-family'));assert.equal(rows.length,5);
  assert.equal(top().filter(r=>r.selector===SELECTOR).length,0,'no competing old overlay');
  for(const r of top().filter(r=>/#special-state/.test(r.selector)))for(const[p,v]of decls(r))
    assert(!/^(clip|clip-path|text-indent|visibility|opacity|font-size|color)$/.test(p)||!/transparent|^0(px)?$|hidden|rect|-\d/.test(v),r.selector+' hides text via '+p+':'+v);
  for(const r of rows)assert.deepEqual(Object.keys(Object.fromEntries(decls(r))),['--command-caption-art']);
  assert.equal(top().filter(r=>r.selector===H+' #skill-special[data-art=weapon] #special-state').map(r=>r.toString().replace(/\s+/g,'')).join(),
    '#game-container[data-battle-mode=public]#skill-special[data-art=weapon]#special-state{position:absolute;top:46px;left:14px;right:14px;height:28px;padding:4px;box-sizing:border-box;font-size:14px;line-height:20px;font-weight:800;font-variant-numeric:tabular-nums;color:#202b30;border:0;}');
  const src=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?src(new URL(e.name+'/',dir)):/\.(m?js|html)$/.test(e.name)?[fs.readFileSync(new URL(e.name,dir),'utf8')]:[]);
  assert(!src(new URL('../src/',import.meta.url)).some(t=>t.includes('ready-lettering')),'CSS-only plate, no script owner');
});
