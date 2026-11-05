import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {brotliDecompressSync} from 'node:zlib';
const root=fileURLToPath(new URL('..',import.meta.url));
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const sha=b=>createHash('sha256').update(b).digest('hex');
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/teamHairMaterial.json',import.meta.url)));
for(const r of fixture.rows){
 const reviewed=root+'/../'+fixture.source+'/export/'+r.id+'-'+r.asset.split('/').at(-1);
 test(r.asset+': reviewed rear-hair RGB and unchanged registration',()=>{
  assert.equal(sha(fs.readFileSync(reviewed)),r.sha,'Historical reviewed hair export is immutable');
  assert.equal(sha(fs.readFileSync(root+'/'+r.atlas)),r.geometrySha);
 });
 test(r.asset+': all alpha and owned rear-hair frames remain exact',async()=>{
  const {data,info}=await sharp(root+'/'+r.asset).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([info.width,info.height,info.channels],[...r.dimensions,4]);
  const approved=await sharp(reviewed).ensureAlpha().raw().toBuffer();
  const mask=brotliDecompressSync(Buffer.from(r.mask,'base64')),alpha=Buffer.alloc(mask.length);
  assert.equal(mask.length,info.width*info.height);
  const frames=JSON.parse(fs.readFileSync(root+'/'+r.atlas)).frames;
  for(const p of r.parts){
   assert(['backHair','hairCap','tailL','tailR'].includes(p.name));assert(p.changed>400);assert.deepEqual(frames[p.direction+'/'+p.name].frame,p.frame);
   for(let y=p.frame.y;y<p.frame.y+p.frame.h;y++){
    const start=(y*info.width+p.frame.x)*4,end=start+p.frame.w*4;
    assert(data.subarray(start,end).equals(approved.subarray(start,end)),'Approved hair frame changed: '+p.direction+'/'+p.name);
   }
  }
  for(let i=0;i<mask.length;i++){
   assert(mask[i]===0||mask[i]===1);alpha[i]=data[i*4+3];
   if(mask[i]){
    const x=i%info.width,y=Math.floor(i/info.width),p=r.parts.find(p=>x>=p.frame.x&&x<p.frame.x+p.frame.w&&y>=p.frame.y&&y<p.frame.y+p.frame.h);
    assert(p,'Mask must stay inside an existing rear-hair attachment');assert(data[i*4+3]>=240);
    if(r.id==='genya'&&p.name.startsWith('tail'))assert(y-p.frame.y>=p.frame.h*.25,'Original bow attachment band is protected');
   }
  }
  assert.equal(sha(alpha),r.alphaSha);
 });
}
test('four identities, eight atlases, 48 rear attachments; no final-art claim',()=>{
 assert.equal(fixture.rows.length,8);assert.equal(fixture.rows.reduce((n,r)=>n+r.parts.length,0),48);
 assert.deepEqual([...new Set(fixture.rows.map(r=>r.id))],['venus','genya','kai','enjo']);
 assert.equal(fixture.finalArt,false);assert.equal(fixture.humanPaintover,false);
});
