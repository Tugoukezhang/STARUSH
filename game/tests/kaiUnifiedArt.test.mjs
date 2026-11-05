import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {KAI_ART} from '../src/systems/KaiLayeredPresentation.mjs';
import {obliqueArt} from '../src/systems/LayeredObliquePresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const hash=b=>createHash('sha256').update(b).digest('hex'),root=new URL('../',import.meta.url);
const candidate=JSON.parse(fs.readFileSync(new URL('../../01-美术/kai-unified-20261012/candidate-manifest.json',import.meta.url)));
const chroma=(r,g,b)=>r>g+25&&b>g+25;
test('Kai loaders choose the new eight-view art, without changing keys or other identities',()=>{
 assert.equal(KAI_ART.image,'art/kai-unified-20261012/kai-parts.webp');
 assert.equal(KAI_ART.data,'art/kai-unified-20261012/kai-parts.json');
 assert.equal(KAI_ART.key,'kai-layered-20261006');
 assert.equal(obliqueArt('kai').image,'art/kai-unified-20261012/kai-oblique.webp');
 assert.equal(obliqueArt('kai').data,'art/kai-unified-20261012/kai-oblique.json');
 assert.equal(obliqueArt('kai').key,'kai-oblique-20261007');
 assert.equal(obliqueArt('genya').image,'art/genya-unified-20261012/genya-oblique.webp');
 assert.equal(obliqueArt('venus').image,'art/venus-unified-20261012/venus-oblique.webp');
 assert.equal(obliqueArt('enjo').image,'art/enjo-unified-20261012/enjo-oblique.webp');
});
test('Kai key rule detects dark magenta and preserves cyan/navy; it is not a universal purple-hair rule',()=>{
 assert.equal(chroma(255,0,255),true);assert.equal(chroma(100,40,120),true);
 assert.equal(chroma(45,175,220),false);assert.equal(chroma(50,65,120),false);
 assert.equal(chroma(150,120,235),true);
});
for(const r of candidate.rows)test(r.asset+': 64 registered attachments keep opaque outline, blue hair and clean edges',async()=>{
 const file=new URL(r.asset,root),atlas=new URL(r.atlas,root);
 assert.equal(hash(fs.readFileSync(file)),r.sha);assert.equal(hash(fs.readFileSync(atlas)),r.atlasSha);
 const {data,info}=await sharp(fs.readFileSync(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const old=await sharp(fs.readFileSync(new URL(r.oldAsset,root))).ensureAlpha().raw().toBuffer();
 const frames=JSON.parse(fs.readFileSync(atlas)).frames,covered=new Uint8Array(info.width*info.height),alpha=Buffer.alloc(covered.length),mask=Buffer.alloc(covered.length);
 assert.deepEqual([info.width,info.height],r.dimensions);assert.equal(Object.keys(frames).length,64);
 for(const [key,{frame:f}]of Object.entries(frames)){
  assert.deepEqual(f,r.parts.find(p=>p.key===key).frame);let blue=0,cyan=0;
  for(let y=f.y;y<f.y+f.h;y++)for(let x=f.x;x<f.x+f.w;x++){
   const k=(y*info.width+x)*4;covered[y*info.width+x]=1;
   if(data[k+3]>=128){if(data[k+2]>data[k]+20&&data[k+2]>data[k+1]+10)blue++;if(data[k+1]>data[k]+40&&data[k+2]>data[k]+45)cyan++;}
  }
  if(key.endsWith('/hairCap'))assert(blue>40,key+' lost navy hair');
  if(/^(down|left|right|down-left|down-right)\/face$/.test(key))assert(cyan>20,key+' lost cyan forelock/eyes');
 }
 for(let i=0;i<covered.length;i++){
  const k=i*4,a=data[k+3];alpha[i]=a;mask[i]=a>=128?1:0;
  assert.equal(mask[i],old[k+3]>=128?1:0,'Opaque silhouette changed');
  if(a){assert(covered[i]&&a>=16,'Padding or low-alpha debris');assert(!chroma(data[k],data[k+1],data[k+2]),'Dark or bright chroma contamination');}
  else assert.deepEqual([...data.subarray(k,k+4)],[0,0,0,0]);
 }
 assert.equal(hash(alpha),r.alphaSha);assert.equal(hash(mask),r.opaqueMaskSha);
});
test('release ships exactly the new Kai exports, not old textures or source inputs',()=>{
 const files=RUNTIME_PAYLOAD.map(r=>r.file);
 for(const r of candidate.rows){assert(files.includes(r.asset.slice(7)));assert(files.includes(r.atlas.slice(7)));assert(!files.includes(r.oldAsset.slice(7)));}
 assert(!files.some(f=>/kai-unified-20261012\/(raw|input|candidate-manifest)/.test(f)));
 assert.equal(candidate.identity,'kai');assert.equal(candidate.finalArt,false);assert.equal(candidate.humanPaintover,false);
});
