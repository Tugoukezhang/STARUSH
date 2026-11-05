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
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/teamCostumeMaterial.json',import.meta.url)));
for(const r of fixture.rows){
 const reviewed=root+'/../'+fixture.source+'/export/'+r.id+'-'+r.asset.split('/').at(-1);
 test(r.asset+': immutable reviewed garment export and unchanged atlas',()=>{
  assert.equal(sha(fs.readFileSync(reviewed)),r.sha,'Historical reviewed garment export is immutable');
  assert.equal(sha(fs.readFileSync(root+'/'+r.atlas)),r.geometrySha);
 });
 test(r.asset+': all alpha and every reviewed garment frame remain exact',async()=>{
  const {data,info}=await sharp(root+'/'+r.asset).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const approved=await sharp(reviewed).ensureAlpha().raw().toBuffer();
  assert.deepEqual([info.width,info.height,info.channels],[...r.dimensions,4]);
  const mask=brotliDecompressSync(Buffer.from(r.mask,'base64')),alpha=Buffer.alloc(mask.length);
  assert.equal(mask.length,info.width*info.height);assert.equal(r.parts.length,8);
  const frames=JSON.parse(fs.readFileSync(root+'/'+r.atlas)).frames;
  for(const p of r.parts){
   assert(['torso','skirt','pelvis'].includes(p.name));assert(p.changed>400);assert.deepEqual(frames[p.direction+'/'+p.name].frame,p.frame);
   for(let y=p.frame.y;y<p.frame.y+p.frame.h;y++){
    const start=(y*info.width+p.frame.x)*4,end=start+p.frame.w*4;
    assert(data.subarray(start,end).equals(approved.subarray(start,end)),'Approved garment/collar frame changed: '+p.direction+'/'+p.name);
   }
  }
  for(let i=0;i<mask.length;i++){
   assert(mask[i]===0||mask[i]===1);alpha[i]=data[i*4+3];
   if(mask[i]){
    const x=i%info.width,y=Math.floor(i/info.width),p=r.parts.find(p=>x>=p.frame.x&&x<p.frame.x+p.frame.w&&y>=p.frame.y&&y<p.frame.y+p.frame.h);
    assert(p,'Mask must stay inside existing garment frame');
    if(p.name==='torso')assert(y-p.frame.y>=p.frame.h*.20,'Original collar band is protected');
    assert(data[i*4+3]>=240,'Do not repaint translucent outline pixels');
   }
  }
  assert.equal(sha(alpha),r.alphaSha);
 });
}
test('four identities, eight atlases, 64 garment panels; no final-art claim',()=>{
 assert.equal(fixture.rows.length,8);assert.equal(fixture.rows.reduce((n,r)=>n+r.parts.length,0),64);
 assert.deepEqual([...new Set(fixture.rows.map(r=>r.id))],['venus','genya','kai','enjo']);
 assert.equal(fixture.finalArt,false);assert.equal(fixture.humanPaintover,false);
});
