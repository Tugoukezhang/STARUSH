import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {SHARED_COMIC_MATERIAL,loadGraffitiMaterial} from '../src/systems/GraffitiPaintBrush.mjs';import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const path='art/world-comic-pigment-20261023/planes.png',size=1254;
test('exact reviewed world pigment asset is opaque grayscale and explicitly admitted without removing older clients',async()=>{
 const b=fs.readFileSync(new URL('../public/'+path,import.meta.url));assert.equal(createHash('sha256').update(b).digest('hex'),'ebe3b6e28b47db653c9e2b8defb79c511e17ceb73b8272659e509f3d57609483');assert.equal(b.length,1381138);
 const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp'),{data,info}=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,size);assert.equal(info.height,size);let gray=0,mid=0;for(let i=0;i<data.length;i+=4){assert.equal(data[i+3],255);const hi=Math.max(data[i],data[i+1],data[i+2]),lo=Math.min(data[i],data[i+1],data[i+2]);if(hi-lo<3)gray++;if(hi>=80&&hi<=200)mid++;}assert(gray/(size*size)>.99);assert(mid/(size*size)>.7);
 assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===path).length,1);for(const old of ['art/three-cast-comic-material-20261023/planes.png','art/comic-paint-directional-20261023/planes.png','art/comic-paint-material-20261023/planes.png'])assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===old).length,1,old);
});
test('only the new three-owner decoded material enables world-anchored mode through the real loader',()=>{
 assert.equal(SHARED_COMIC_MATERIAL.path,'art/comic-ink-planes-20261029/body.png');assert.equal(SHARED_COMIC_MATERIAL.size,size);
 for(const performerId of ['sakura','kai','enjo']){
  const data=new Uint8ClampedArray(size*size*4);for(let i=0;i<data.length;i+=4)data.set([128,128,128,255],i);
  const image={width:size,height:size,ownerDocument:{createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data,width:size,height:size})})})}};
  const s={_userCastPresentation:true,battleData:{performerId},textures:{exists:()=>true,get:()=>({getSourceImage:()=>image})}};
  const decoded=loadGraffitiMaterial(s);assert.equal(decoded.worldAnchored,true);assert.equal(decoded.width,size);assert.equal(decoded.data[0],128);
 }
 assert.equal(loadGraffitiMaterial({_userCastPresentation:false}),null);assert.equal(loadGraffitiMaterial({_userCastPresentation:true,battleData:{performerId:'venus'}}),null);
});
