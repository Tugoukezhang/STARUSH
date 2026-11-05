import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import crypto from 'node:crypto';import {createRequire} from 'node:module';import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
test('roster stage admits only its exact reviewed textless environment export',async()=>{
 const file='art/roster-studio-20261031/stage.webp';assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file.startsWith('art/roster-studio-20261031/')),[{file,group:'owner-roster-stage'}]);
 const bytes=await fs.readFile(new URL('../public/'+file,import.meta.url));assert.equal(bytes.length,94964);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'fb5359140e5991c8ff34875b10cbc3bbd4dfda9d097a7ae3884c64b7e12bbaee');
 const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp'),m=await sharp(bytes).metadata();assert.deepEqual([m.width,m.height],[960,720]);assert.equal(m.hasAlpha,false);
 assert.deepEqual((await fs.readdir(new URL('../public/art/roster-studio-20261031/',import.meta.url))).sort(),['stage.webp']);
});
