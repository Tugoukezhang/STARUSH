import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {streetVisibleBounds} from '../src/systems/WorldGroundingPresentation.mjs';
import {oldStreetMaterialPath} from '../src/systems/StreetMaterialPresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const approved={
 repair:{size:[480,402],box:[19,117,461,400],hashes:['b3fe339076fb2fc2296b746f62cbfbec1851033c68ee150593ced7eea416aade','df92ac6cd3802f8cab08a1a17cd595b0de3a31e6ca82b14fc0643efbaa7987c7']},
 kiosk:{size:[344,368],box:[21,56,323,366],hashes:['e2b17179026ae6ae1267437d42f827f9ea7f221b82be22fa212f00fca8b33660','a4ed846dcaed5c28b4e6d594c8024b726620e46325e0dc44c8c352d89364c171']},
 garden:{size:[340,328],box:[2,121,338,326],hashes:['be20f80d9597389bddd09c4023b22ab55e6a7d62c941208976919595aecf5398','5f752bb3124f5af8fce3a005cc6aaabb6a2ee52cf6b87eaa5ded87ab1a29b7a6']},
 tree:{size:[180,240],box:[11,2,168,238],hashes:['069fb48a1368db7b8521fef7f3439cac36e4f3a369f54b4195be659c08a3d2cb','8ce5b43aef682a9a9e03b80b5f85ecf617a575ff757ac19e23feab621e203bef']}
};
for(const [id,row] of Object.entries(approved)) {
 test(id+' ships exact reviewed gray and color exports on existing unique paths',()=>{
  for(const [index,suffix] of ['','-muted'].entries()){
   const file=oldStreetMaterialPath(id+suffix),data=fs.readFileSync(new URL('../public/'+file,import.meta.url));
   assert.equal(crypto.createHash('sha256').update(data).digest('hex'),row.hashes[index],'Reviewed '+id+suffix+' export missing');
   assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===file).length,1);
  }
 });
 test(id+' measured silhouette keeps center-bottom registration at display scale',()=>{
  const [w,h]=row.size,[l,t,r,b]=row.box,outer={x:100,y:200,width:w/2,height:h/2};
  assert.deepEqual(streetVisibleBounds(id,outer),{x:100+l/2,y:200+t/2,width:(r-l)/2,height:(b-t)/2});
  assert.deepEqual(outer,{x:100,y:200,width:w/2,height:h/2});
 });
}
test('new first-chapter tree registration does not leak into independent neon art',()=>{
 const outer={x:100,y:200,width:90,height:120};
 assert.deepEqual(streetVisibleBounds('tree',outer,'neon'),{x:103,y:201,width:84,height:118});
 assert.deepEqual(streetVisibleBounds('tree',outer),{x:105.5,y:201,width:78.5,height:118});
 assert(!RUNTIME_PAYLOAD.some(r=>/street-set-20261011|repair-raw|kiosk-raw|garden-raw|tree-raw/.test(r.file)));
});
