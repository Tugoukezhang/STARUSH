import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {brotliDecompressSync} from 'node:zlib';
import assert from 'node:assert/strict';
import test from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sharp=createRequire(import.meta.url)('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const {rows}=JSON.parse(fs.readFileSync(new URL('./fixtures/sakuraHeadMaterial.json',import.meta.url)));

test('seven head-hair regions, no costume/ponytail/rig or closed-eye edits',()=>{
 assert.equal(rows.flatMap(r=>r.parts).length,7);
 assert.deepEqual(rows.flatMap(r=>r.parts).map(p=>p.direction).sort(),['front','left','right','front-right','front-left','back-right','back-left'].sort());
 assert(rows.every(r=>r.parts.every(p=>p.name==='head-open')));
});
for(const c of rows){
 test(c.group+': Only reviewed main-head material may ship',()=>{
  const bytes=fs.readFileSync(path.join(root,c.file));assert.equal(sha(bytes),c.sha,'Only reviewed main-head material may ship');assert.equal(bytes.length,c.bytes);
  assert.equal(sha(fs.readFileSync(path.join(root,c.data))),c.geometrySha);
 });
 test(c.group+': exact protected face/closed-eye/other RGBA and reviewed head alpha',async()=>{
  const {data,info}=await sharp(path.join(root,c.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height,info.channels],[2048,1024,4]);
  const mask=brotliDecompressSync(Buffer.from(c.mask,'base64')),alpha=Buffer.alloc(mask.length),h=createHash('sha256'),rig=JSON.parse(fs.readFileSync(path.join(root,c.data)));
  assert.equal(mask.length,2048*1024);assert.equal(sha(mask),c.maskSha);
  for(let i=0;i<mask.length;i++){alpha[i]=data[i*4+3];const x=i%2048,y=Math.floor(i/2048);if(mask[i])assert(c.parts.some(p=>x>=p.region[0]&&x<p.region[0]+p.region[2]&&y>=p.region[1]&&y<p.region[1]+p.region[3]));else h.update(data.subarray(i*4,i*4+4));}
  assert.equal(sha(alpha),c.alphaSha);assert.equal(h.digest('hex'),c.protectedSha);
  for(const p of c.parts){assert.deepEqual(rig.views[p.direction].meshes.find(m=>m.name===p.name).region,p.region);if(!p.eyes)continue;
   const [x,y,w,hh]=p.region,[ex,ey,ew,eh]=p.eyes;assert.deepEqual([ew,eh],[w,hh]);
   for(let yy=0;yy<hh;yy++)for(let xx=0;xx<w;xx++){const eye=(ey+yy)*2048+ex+xx;assert.equal(mask[eye],0,'Closed-eye overlay must stay exact');if(data[eye*4+3]>0)assert.equal(mask[(y+yy)*2048+x+xx],0,'Blink-covered base pixels must also remain exact');}
  }
 });
}
