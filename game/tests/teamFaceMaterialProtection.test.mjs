import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('..',import.meta.url));
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const sha=b=>createHash('sha256').update(b).digest('hex');
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/teamFaceMaterial.json',import.meta.url)));
for(const r of fixture.rows){
 const reviewed=root+'/../'+r.source+'/export/'+r.asset.split('/').at(-1);
 test(r.asset+': immutable reviewed head export and original UV',()=>{
  assert.equal(sha(fs.readFileSync(reviewed)),r.sha);
  assert.equal(sha(fs.readFileSync(root+'/'+r.atlas)),r.geometrySha);
 });
 test(r.asset+': current complete expressions match review and retain original alpha',async()=>{
  const {data,info}=await sharp(root+'/'+r.asset).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const approved=await sharp(reviewed).ensureAlpha().raw().toBuffer();
  const frames=JSON.parse(fs.readFileSync(root+'/'+r.atlas)).frames;
  assert.deepEqual([info.width,info.height,info.channels],[1024,1024,4]);
  for(const p of r.parts){
   assert(['face','closedFace','hurtFace'].includes(p.name));assert(p.changed>500);
   assert.deepEqual(frames[p.direction+'/'+p.name].frame,p.frame);
   for(let y=p.frame.y;y<p.frame.y+p.frame.h;y++){
    const start=(y*info.width+p.frame.x)*4,end=start+p.frame.w*4;
    assert(data.subarray(start,end).equals(approved.subarray(start,end)),'Approved face changed: '+p.direction+'/'+p.name);
   }
  }
  assert.equal(sha(Buffer.from(Array.from({length:info.width*info.height},(_,i)=>data[i*4+3]))),r.alphaSha);
 });
}
test('three characters retain five visible views with three distinct expressions each',()=>{
 assert.equal(fixture.rows.length,6);
 for(const id of ['venus','kai','enjo']){
  const parts=fixture.rows.filter(r=>r.id===id).flatMap(r=>r.parts);
  assert.equal(parts.length,15);
  assert.deepEqual([...new Set(parts.map(p=>p.direction))],['down','left','right','down-left','down-right']);
  for(const d of new Set(parts.map(p=>p.direction)))assert.deepEqual(parts.filter(p=>p.direction===d).map(p=>p.name),['face','closedFace','hurtFace']);
 }
});
