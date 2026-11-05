import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';

test('Enjo rest admits only the reviewed four-cel export, never its raw AI source',()=>{
 const file='art/enjo-rest-20261023/idle.png';
 assert.deepEqual(RUNTIME_PAYLOAD.filter(row=>row.file.startsWith('art/enjo-rest-20261023/')),[{file,group:'owner-character-idle'}]);
 const bytes=readFileSync(new URL('../public/'+file,import.meta.url));
 assert.equal(bytes.length,171165);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'91e18e61b0dea39a4d125b9ebfec51dd8b5ad0c9d2d77faa9a297abc99ff538a');
 assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[1536,320]);
 assert.ok(!RUNTIME_PAYLOAD.some(row=>/idle-source-raw|protected-grid|ready12-inspection/.test(row.file)));
});
