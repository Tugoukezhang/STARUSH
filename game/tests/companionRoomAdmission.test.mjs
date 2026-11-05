import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const file='art/companion-room-20261031/lounge.webp',sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
test('dedicated lounge admits exactly one original export, never the raw source or reference media',()=>{
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file.startsWith('art/companion-room-20261031/')),[{file,group:'owner-companion-room'}]);
 assert.deepEqual(fs.readdirSync(new URL('../public/art/companion-room-20261031/',import.meta.url)),['lounge.webp']);
});
test('admitted room matches the reviewed source-only export and fixed memory budget',async()=>{
 const bytes=fs.readFileSync(new URL('../public/'+file,import.meta.url)),m=await sharp(bytes).metadata();assert.deepEqual([m.width,m.height,m.format],[1024,1536,'webp']);assert(m.width*m.height*4<7*1024*1024);assert(bytes.length<1024*1024);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'2655099de86b40216350ceef197cec9c9fc04e81a86e38f334c2fcc2f998ad35');
});
