import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import {getMenuPortraitExpressionArt} from '../src/systems/MenuPortraitExpression.mjs';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const hashes={
 'enjo-blink.webp':'484ab74b5135fae5415b753944e1144bc66368c17875c93c27f2dbfe768e1d89',
 'enjo-smile.webp':'a053aacaaa8a20a137bb09d4fe571e8f1c68ce49a061d026277c808e458d1eb7',
 'kai-blink.webp':'c674623fbf89a681a79eb431cfc1a27079948428f2413b8945bb421bb0eb3661',
 'kai-smile.webp':'aa02deb9294bd0164ad9645b90c21aa9ce23256349739c6eec1469ae53ef4669',
};
// Measured from the admitted B245 lossless patches; retain the existing >90% transparent guard.
const alpha={
 'enjo-blink.webp':{size:330,nonzero:4870,opaque:2982},
 'enjo-smile.webp':{size:330,nonzero:1925,opaque:1173},
 'kai-blink.webp':{size:310,nonzero:5026,opaque:3074},
 'kai-smile.webp':{size:310,nonzero:1037,opaque:637},
};
test('only four reviewed current-face patches are explicitly admitted',()=>{
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file.startsWith('art/menu-expression-20261031/')).map(r=>r.file.split('/').at(-1)).sort(),Object.keys(hashes).sort());
 assert.equal(new Set(RUNTIME_PAYLOAD.map(r=>r.file)).size,RUNTIME_PAYLOAD.length);
});
for(const id of ['enjo','kai'])test(id+' patches match reviewed bytes, crop size and sparse alpha',async()=>{
 const art=getMenuPortraitExpressionArt(id);
 for(const key of ['blink','smile']){
  const bytes=await fs.readFile(new URL('../public/'+art[key],import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hashes[id+'-'+key+'.webp']);
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([info.width,info.height],[art.width,art.height]);
  const expected=alpha[id+'-'+key+'.webp'];assert.deepEqual([info.width,info.height],[expected.size,expected.size]);
  let transparent=0,opaque=0;for(let n=3;n<data.length;n+=4){transparent+=data[n]===0;opaque+=data[n]===255;}
  assert(transparent>info.width*info.height*.9);assert(opaque>300);
  assert.equal(info.width*info.height-transparent,expected.nonzero);assert.equal(opaque,expected.opaque);
 }
});
