import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {streetVisibleBounds} from '../src/systems/WorldGroundingPresentation.mjs';
import {oldStreetMaterialPath} from '../src/systems/StreetMaterialPresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const old={shop:['8b3a02eeae35cc9f10af8c54fa8bac270f7c88df4c571a17cabfeeb3b64fbda3','577d3353787a6647717a36e106a138f1e377ece4276d666a2cfd522864c8d7c2'],
 canopy:['78263c01be1a895a885565b0d4c56bf4a302b00e1d45addede32fe15d58e01d0','6d3be87dfb242441abe16d8fc44ef92e3b2ee44905d4b92068c7c9733dfc108b']};
for(const id of ['shop','canopy'])test(id+' installs both reviewed colour and gray exports without duplicate runtime paths',()=>{
 for(const [index,suffix] of ['','-muted'].entries()){
  const file=oldStreetMaterialPath(id+suffix),data=fs.readFileSync(new URL('../public/'+file,import.meta.url));
  assert.notEqual(crypto.createHash('sha256').update(data).digest('hex'),old[id][index],'RED: original '+id+suffix+' still ships');
  assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===file).length,1);
 }
});
test('shop registration follows uniform-fit source silhouette, not retired transparent padding',()=>{
 const b={x:0,y:0,width:560,height:520};
 assert.deepEqual(streetVisibleBounds('shop',b),{x:2,y:143,width:556,height:375});
 assert.deepEqual(b,{x:0,y:0,width:560,height:520});
});
test('theater registration keeps base and width, using measured shorter roof silhouette',()=>{
 assert.deepEqual(streetVisibleBounds('canopy',{x:0,y:0,width:704,height:332}),{x:23,y:33,width:658,height:297});
 assert.equal(streetVisibleBounds('canopy',{x:0,y:0,width:704,height:332}).y+297,330);
});
