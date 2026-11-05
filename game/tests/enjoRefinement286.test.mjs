import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import {getPortraitBase} from '../src/systems/PortraitBaseRegistration.mjs';
const root=new URL('../',import.meta.url),dir=new URL('public/portraits/enjo-286/',root);
test('new generated source and runtime copy are byte-identical, with native dimensions',()=>{
 const source=readFileSync(new URL('source.png',dir));
 const hash=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(hash(source),'bb281f2f5d35818d86a1eb44d035ddee7bea490f18aeae34d6b1575643e58ab1');
 assert.equal(source.readUInt32BE(16),1024);assert.equal(source.readUInt32BE(20),1536);
 const b=getPortraitBase('enjo');assert.equal(b.src,'portraits/enjo-286/source.png');
 assert.deepEqual(b.bounds,{x:9,y:49,width:1011,height:1438});
});
test('new rig and alpha hit surface refer to the new artwork, not the old blink coordinates',()=>{
 const rig=JSON.parse(readFileSync(new URL('rig.json',dir),'utf8'));
 assert.deepEqual(rig.image,{width:1024,height:1536});assert.equal(rig.eyes.length,2);
 const renderer=readFileSync(new URL('renderer.js',dir),'utf8');
 assert.match(renderer,/source\.src=new URL\('\.\/source.png'/);assert.doesNotMatch(renderer,/enjo-277\/enjo.webp/);
 assert.match(renderer,/artRevision='enjo286'/);
});
test('new portrait runtime files are explicit, complete, and ship the upstream license',()=>{
 const rows=RUNTIME_PAYLOAD.filter(row=>row.group==='owner-enjo-refinement-286');assert.equal(rows.length,20);
 for(const row of rows)assert(statSync(new URL('public/'+row.file,root)).isFile());
 assert.match(readFileSync(new URL('LICENSE.mesh-avatar.txt',dir),'utf8'),/MIT License/);
});
