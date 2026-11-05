import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {VENUS_ART} from '../src/systems/VenusLayeredPresentation.mjs';
import {obliqueArt} from '../src/systems/LayeredObliquePresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const hash=b=>createHash('sha256').update(b).digest('hex');
const root=new URL('../',import.meta.url);
const candidate=JSON.parse(fs.readFileSync(new URL('../../01-美术/venus-unified-20261012/candidate-manifest.json',import.meta.url)));
test('Venus loaders select the coherent eight-view candidate, without changing texture keys',()=>{
 assert.equal(VENUS_ART.image,'art/venus-unified-20261012/venus-parts.webp');
 assert.equal(VENUS_ART.data,'art/venus-unified-20261012/venus-parts.json');
 assert.equal(VENUS_ART.key,'venus-layered-20261006');
 assert.equal(obliqueArt('venus').image,'art/venus-unified-20261012/venus-oblique.webp');
 assert.equal(obliqueArt('venus').data,'art/venus-unified-20261012/venus-oblique.json');
 assert.equal(obliqueArt('venus').key,'venus-oblique-20261007');
 assert.equal(obliqueArt('genya').image,'art/genya-unified-20261012/genya-oblique.webp');
});
for(const r of candidate.rows)test(r.asset+': approved registration, opaque outline and clean transparent padding',async()=>{
 const file=new URL(r.asset,root),atlas=new URL(r.atlas,root);
 assert.equal(hash(fs.readFileSync(file)),r.sha);assert.equal(hash(fs.readFileSync(atlas)),r.atlasSha);
 const {data,info}=await sharp(fs.readFileSync(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const old=await sharp(fs.readFileSync(new URL(r.oldAsset,root))).ensureAlpha().raw().toBuffer();
 const frames=JSON.parse(fs.readFileSync(atlas)).frames,covered=new Uint8Array(info.width*info.height),alpha=Buffer.alloc(covered.length),mask=Buffer.alloc(covered.length);
 assert.deepEqual([info.width,info.height],r.dimensions);assert.equal(Object.keys(frames).length,64);
 for(const [key,{frame:f}] of Object.entries(frames)){
  assert.deepEqual(f,r.parts.find(p=>p.key===key).frame);
  for(let y=f.y;y<f.y+f.h;y++)for(let x=f.x;x<f.x+f.w;x++)covered[y*info.width+x]=1;
 }
 for(let i=0;i<covered.length;i++){
  const k=i*4,a=data[k+3];alpha[i]=a;mask[i]=a>=128?1:0;
  assert.equal(mask[i],old[k+3]>=128?1:0,'Measured opaque silhouette changed');
  if(a)assert(covered[i]&&a>=16,'Atlas gaps and low-alpha debris must be empty');
  else assert.deepEqual([...data.subarray(k,k+4)],[0,0,0,0]);
  if(a>=128)assert(!(data[k]>data[k+1]+25&&data[k+2]>data[k+1]+25),'Magenta-key contamination');
 }
 assert.equal(hash(alpha),r.alphaSha);assert.equal(hash(mask),r.opaqueMaskSha);
});
test('release uses only the selected Venus atlases, not raw source or the superseded runtime',()=>{
 const files=RUNTIME_PAYLOAD.map(r=>r.file);
 for(const r of candidate.rows){assert(files.includes(r.asset.slice(7)));assert(files.includes(r.atlas.slice(7)));assert(!files.includes(r.oldAsset.slice(7)));}
 assert(!files.some(f=>/venus-unified-20261012\/(raw|input|candidate-manifest)/.test(f)));
 assert.equal(candidate.finalArt,false);assert.equal(candidate.humanPaintover,false);
});
