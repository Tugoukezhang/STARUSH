import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {ENJO_ART} from '../src/systems/EnjoLayeredPresentation.mjs';
import {obliqueArt} from '../src/systems/LayeredObliquePresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const hash=b=>createHash('sha256').update(b).digest('hex'),root=new URL('../',import.meta.url);
const candidate=JSON.parse(fs.readFileSync(new URL('../../01-美术/enjo-unified-20261012/candidate-manifest.json',import.meta.url)));
const chroma=(r,g,b)=>r>g+25&&b>g+25;
test('Enjo selects all eight new views without changing texture keys or other identities',()=>{
 assert.equal(ENJO_ART.image,'art/enjo-unified-20261012/enjo-parts.webp');
 assert.equal(ENJO_ART.data,'art/enjo-unified-20261012/enjo-parts.json');
 assert.equal(ENJO_ART.key,'enjo-layered-20261007');
 assert.equal(obliqueArt('enjo').image,'art/enjo-unified-20261012/enjo-oblique.webp');
 assert.equal(obliqueArt('enjo').data,'art/enjo-unified-20261012/enjo-oblique.json');
 assert.equal(obliqueArt('enjo').key,'enjo-oblique-20261007');
 for(const id of ['venus','genya','kai'])assert.equal(obliqueArt(id).image,'art/'+id+'-unified-20261012/'+id+'-oblique.webp');
});
test('Enjo chroma processing preserves orange/red/brown, rejects bright and dark magenta',()=>{
 for(const rgb of [[255,0,255],[100,40,120]])assert.equal(chroma(...rgb),true);
 for(const rgb of [[240,135,25],[180,45,25],[135,75,40],[32,32,35]])assert.equal(chroma(...rgb),false);
 assert.equal(chroma(150,120,235),true,'Not suitable for legitimate violet-haired actors');
});
for(const r of candidate.rows)test(r.asset+': preserves 64 frame registrations and opaque silhouettes with clean warm palette',async()=>{
 const file=new URL(r.asset,root),atlas=new URL(r.atlas,root);
 assert.equal(hash(fs.readFileSync(file)),r.sha);assert.equal(hash(fs.readFileSync(atlas)),r.atlasSha);
 const {data,info}=await sharp(fs.readFileSync(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const old=await sharp(fs.readFileSync(new URL(r.oldAsset,root))).ensureAlpha().raw().toBuffer();
 const frames=JSON.parse(fs.readFileSync(atlas)).frames,covered=new Uint8Array(info.width*info.height),alpha=Buffer.alloc(covered.length),mask=Buffer.alloc(covered.length);
 assert.deepEqual([info.width,info.height],r.dimensions);assert.equal(Object.keys(frames).length,64);
 for(const [key,{frame:f}]of Object.entries(frames)){
  assert.deepEqual(f,r.parts.find(p=>p.key===key).frame);let warm=0,red=0;
  for(let y=f.y;y<f.y+f.h;y++)for(let x=f.x;x<f.x+f.w;x++){
   const k=(y*info.width+x)*4;covered[y*info.width+x]=1;
   if(data[k+3]>=128){if(data[k]>data[k+2]+30&&data[k+1]>data[k+2]+15)warm++;if(data[k]>data[k+1]*1.4&&data[k]>data[k+2]*1.5)red++;}
  }
  if(key.endsWith('/hairCap'))assert(warm>50,key+' lost warm brown hair');
  if(key.endsWith('/torso'))assert(red>50,key+' lost red jacket');
 }
 for(let i=0;i<covered.length;i++){
  const k=i*4,a=data[k+3];alpha[i]=a;mask[i]=a>=128?1:0;
  assert.equal(mask[i],old[k+3]>=128?1:0,'Opaque silhouette changed');
  if(a){assert(covered[i]&&a>=16,'Padding or low-alpha debris');assert(!chroma(data[k],data[k+1],data[k+2]),'Chroma contamination');}
  else assert.deepEqual([...data.subarray(k,k+4)],[0,0,0,0]);
 }
 assert.equal(hash(alpha),r.alphaSha);assert.equal(hash(mask),r.opaqueMaskSha);
});
test('release includes only four new Enjo assets, not old atlas or source inputs',()=>{
 const files=RUNTIME_PAYLOAD.map(r=>r.file);
 for(const r of candidate.rows){assert(files.includes(r.asset.slice(7)));assert(files.includes(r.atlas.slice(7)));assert(!files.includes(r.oldAsset.slice(7)));}
 assert(!files.some(f=>/enjo-unified-20261012\/(raw|input|candidate-manifest)/.test(f)));
 assert.equal(candidate.identity,'enjo');assert.equal(candidate.finalArt,false);assert.equal(candidate.humanPaintover,false);
});
