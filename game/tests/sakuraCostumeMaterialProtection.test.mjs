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
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/sakuraCostumeMaterial.json',import.meta.url)));
for(const r of fixture.rows){
 test(r.group+': only reviewed costume export and unchanged geometry may ship',()=>{
  const b=fs.readFileSync(root+'/'+r.file);
  assert.equal(sha(b),r.sha,'Only reviewed costume material may ship');
  assert.equal(b.length,r.bytes);
  assert.equal(sha(fs.readFileSync(root+'/'+r.data)),r.geometrySha);
 });
 test(r.group+': alpha, collars, head, arms, hands, legs, fan and all non-cloth pixels stay exact',async()=>{
  const {data,info}=await sharp(root+'/'+r.file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([info.width,info.height,info.channels],[2048,1024,4]);
  const mask=brotliDecompressSync(Buffer.from(r.mask,'base64')),alpha=Buffer.alloc(mask.length),h=createHash('sha256');
  assert.equal(mask.length,2048*1024);assert.equal(sha(mask),r.maskSha);
  const views=JSON.parse(fs.readFileSync(root+'/'+r.data)).views;
  assert.equal(r.parts.length,8);
  for(const p of r.parts){assert(['torso','pelvis'].includes(p.name));assert.deepEqual(views[p.direction].meshes.find(m=>m.name===p.name).region,p.region);}
  for(let i=0;i<mask.length;i++){
   assert(mask[i]===0||mask[i]===1);alpha[i]=data[i*4+3];
   if(!mask[i])h.update(data.subarray(i*4,i*4+4));
   else{
    const x=i%2048,y=Math.floor(i/2048),p=r.parts.find(p=>x>=p.region[0]&&x<p.region[0]+p.region[2]&&y>=p.region[1]&&y<p.region[1]+p.region[3]);
    assert(p,'Mask must be inside an existing cloth attachment');
    if(p.name==='torso')assert(y-p.region[1]>=p.region[3]*.20,'Original collar band is not repaintable');
    assert(data[i*4+3]>=240,'Do not repaint alpha fringes');
   }
  }
  assert.equal(sha(alpha),r.alphaSha);assert.equal(h.digest('hex'),r.protectedSha);
 });
}
test('same eight views and 93 meshes; no source/raw/prompt paths in loader contract',()=>{
 const rigs=fixture.rows.flatMap(r=>Object.values(JSON.parse(fs.readFileSync(root+'/'+r.data)).views));
 assert.equal(rigs.length,8);assert.equal(rigs.reduce((n,v)=>n+v.meshes.length,0),93);
 for(const r of fixture.rows)assert.doesNotMatch(fs.readFileSync(root+'/'+r.data,'utf8'),/sakura-costume-material|generated\.png|costume-edit-sheet|PROMPT_AND_SCOPE|data:image/);
});
