import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {GENYA_ART} from '../src/systems/GenyaLayeredPresentation.mjs';
import {obliqueArt} from '../src/systems/LayeredObliquePresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const hash=b=>createHash('sha256').update(b).digest('hex'),root=new URL('../',import.meta.url);
const candidate=JSON.parse(fs.readFileSync(new URL('../../01-美术/genya-unified-20261012/candidate-manifest.json',import.meta.url)));
const chroma=(r,g,b)=>r>135&&b>135&&r>g+35&&b>g+35&&Math.abs(r-b)<45;
test('Genya loader selects coherent eight-view art without changing keys or other identities',()=>{
 assert.equal(GENYA_ART.image,'art/genya-unified-20261012/genya-parts.webp');
 assert.equal(GENYA_ART.data,'art/genya-unified-20261012/genya-parts.json');
 assert.equal(GENYA_ART.key,'genya-layered-20261006');
 assert.equal(obliqueArt('genya').image,'art/genya-unified-20261012/genya-oblique.webp');
 assert.equal(obliqueArt('genya').data,'art/genya-unified-20261012/genya-oblique.json');
 assert.equal(obliqueArt('genya').key,'genya-oblique-20261007');
 assert.equal(obliqueArt('venus').image,'art/venus-unified-20261012/venus-oblique.webp');
 assert.equal(obliqueArt('kai').image,'art/kai-unified-20261012/kai-oblique.webp');
});
test('chroma classification preserves legitimate cool violet instead of blanket purple removal',()=>{
 assert.equal(chroma(255,0,255),true);
 assert.equal(chroma(210,100,215),true);
 assert.equal(chroma(150,120,235),false);
 assert.equal(chroma(85,55,170),false);
});
for(const r of candidate.rows)test(r.asset+': 72 registered attachments retain opaque silhouettes and real violet hair',async()=>{
 const file=new URL(r.asset,root),atlas=new URL(r.atlas,root);
 assert.equal(hash(fs.readFileSync(file)),r.sha);assert.equal(hash(fs.readFileSync(atlas)),r.atlasSha);
 const {data,info}=await sharp(fs.readFileSync(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const old=await sharp(fs.readFileSync(new URL(r.oldAsset,root))).ensureAlpha().raw().toBuffer();
 const frames=JSON.parse(fs.readFileSync(atlas)).frames,covered=new Uint8Array(info.width*info.height),alpha=Buffer.alloc(covered.length),mask=Buffer.alloc(covered.length);
 assert.deepEqual([info.width,info.height],r.dimensions);assert.equal(Object.keys(frames).length,72);
 for(const [key,{frame:f}] of Object.entries(frames)){
  assert.deepEqual(f,r.parts.find(p=>p.key===key).frame);
  let violet=0;
  for(let y=f.y;y<f.y+f.h;y++)for(let x=f.x;x<f.x+f.w;x++){const k=(y*info.width+x)*4;covered[y*info.width+x]=1;if(data[k+3]>=128&&data[k+2]>data[k]+35&&data[k+2]>data[k+1]+15)violet++;}
  if(/\/(hairCap|tailL|tailR)$/.test(key))assert(violet>40,key+' lost legitimate violet');
 }
 for(let i=0;i<covered.length;i++){
  const k=i*4,a=data[k+3];alpha[i]=a;mask[i]=a>=128?1:0;
  assert.equal(mask[i],old[k+3]>=128?1:0,'Opaque silhouette changed');
  if(a)assert(covered[i]&&a>=16,'Padding and low-alpha debris must be empty');else assert.deepEqual([...data.subarray(k,k+4)],[0,0,0,0]);
  if(a>=128)assert(!chroma(data[k],data[k+1],data[k+2]),'Chroma contamination');
 }
 assert.equal(hash(alpha),r.alphaSha);assert.equal(hash(mask),r.opaqueMaskSha);
});
test('release contains exactly selected Genya atlases, not superseded art or source inputs',()=>{
 const files=RUNTIME_PAYLOAD.map(r=>r.file);
 for(const r of candidate.rows){assert(files.includes(r.asset.slice(7)));assert(files.includes(r.atlas.slice(7)));assert(!files.includes(r.oldAsset.slice(7)));}
 assert(!files.some(f=>/genya-unified-20261012\/(raw|input|candidate-manifest)/.test(f)));
 assert.equal(candidate.identity,'genya');assert.equal(candidate.finalArt,false);assert.equal(candidate.humanPaintover,false);
});
