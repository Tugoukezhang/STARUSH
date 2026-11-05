import test from 'node:test';import assert from 'node:assert/strict';import{EventEmitter}from'node:events';
import * as brushes from '../src/systems/GraffitiPaintBrush.mjs';import{StreetPaintSurface}from'../src/systems/StreetRestorationSurface.mjs';
import{RUNTIME_PAYLOAD}from'../scripts/runtime-payload.mjs';
import fs from'node:fs';import{createHash}from'node:crypto';import{createRequire}from'node:module';
const path='art/three-cast-comic-material-20261023/planes.png',size=1254;
test('the exact new bitmap is a bounded opaque grayscale material, not a mockup or unreviewed source directory',async()=>{
 const b=fs.readFileSync(new URL('../public/'+path,import.meta.url));assert.equal(createHash('sha256').update(b).digest('hex'),'0502fdb72527daee9047070cea57c5d403628f23c73fbc2fa3057f4ff16e618f');assert.equal(b.length,1501325);const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');const{data,info}=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,size);assert.equal(info.height,size);let gray=0,dark=0,light=0;for(let i=0;i<data.length;i+=4){assert.equal(data[i+3],255);const hi=Math.max(data[i],data[i+1],data[i+2]),lo=Math.min(data[i],data[i+1],data[i+2]);if(hi-lo<3)gray++;if(hi<70)dark++;if(hi>210)light++;}const n=size*size;assert(gray/n>.99);assert(dark/n>.08&&dark/n<.2);assert(light/n>.03&&light/n<.12);
});
function fixture(id){
 const data=new Uint8ClampedArray(size*size*4);for(let i=0;i<data.length;i+=4){const x=(i/4)%size,v=x<size/3?24:x>size*2/3?236:128;data.set([v,v,v,255],i);}
 const small=new Uint8ClampedArray(512*512*4).fill(255),atlas=new Uint8ClampedArray(1024*256*4).fill(255);let source;
 const doc={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(s){source=s},getImageData:()=>({width:source.width,height:source.height,data:source.data.slice()})})})};
 const image={setOrigin(){return this},setDisplaySize(){return this},setDepth(){return this},setAlpha(){return this},setBlendMode(){return this},destroy(){this.destroyed=true}};
 const texture={context:{createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData(){}},setFilter(){this.filtered=true},refresh(){this.refreshes=(this.refreshes||0)+1}};
 const scene={_userCastPresentation:true,battleData:{performerId:id,practiceMode:true},_isPublicStage1Round:()=>true,events:new EventEmitter(),
  textures:{exists:()=>true,get:key=>({getSourceImage:()=>key===brushes.SHARED_COMIC_MATERIAL?.key?{width:size,height:size,data,ownerDocument:doc}:key===brushes.GRAFFITI_GROUND.key?{width:1024,height:256,data:atlas,ownerDocument:doc}:{width:512,height:512,data:small,ownerDocument:doc}}),createCanvas:()=>texture,remove(){}},add:{image:()=>image}};
 return{scene,texture,image};
}
test('one explicit new three-cast material is admitted while both prior source paths remain compatible',()=>{
 assert.equal(brushes.SHARED_COMIC_MATERIAL?.path,'art/comic-ink-planes-20261029/body.png');assert.equal(brushes.SHARED_COMIC_MATERIAL?.size,size);
 assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===path).length,1);for(const old of ['art/comic-paint-directional-20261023/planes.png','art/comic-paint-material-20261023/planes.png'])assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===old).length,1);
});
test('all three actual owners preload the shared material and reject wrong decoded dimensions with cleanup',()=>{
 assert(brushes.SHARED_COMIC_MATERIAL);
 for(const id of ['sakura','kai','enjo']){const load=new EventEmitter(),events=new EventEmitter(),queued=[],errors=[];load.image=(...a)=>queued.push(a);load.on('loaderror',e=>errors.push(e));const scene={load,events,initialBattleData:{performerId:id},textures:{exists:()=>false,get:()=>({getSourceImage:()=>({width:2,height:2})}),remove(){}}};brushes.preloadGraffitiGround(scene);const key=brushes.SHARED_COMIC_MATERIAL.key;assert.equal(queued.filter(q=>q[0]===key).length,1,id);load.emit('filecomplete-image-'+key);assert.equal(errors.length,1);events.emit('shutdown');assert.equal(load.listenerCount('filecomplete-image-'+key),0);}
});
test('all three read a neutral three-value field without broadening non-user or unknown-owner paths',()=>{
 for(const id of ['sakura','kai','enjo']){const{scene}=fixture(id),image=brushes.loadGraffitiMaterial(scene);assert.equal(image?.width,size,id);const values=new Set();for(let i=0;i<image.data.length;i+=4){values.add(image.data[i]);assert.equal(image.data[i],image.data[i+1]);}assert.deepEqual([...values].sort((a,b)=>a-b),[24,128,236]);}
 assert.equal(brushes.loadGraffitiMaterial({_userCastPresentation:false}),null);assert.equal(brushes.loadGraffitiMaterial({_userCastPresentation:true,battleData:{performerId:'venus'}}),null);
});
test('persistent ground for all three is a mergeable broad pool rather than the old release-shaped splinter mask',()=>{
 for(const id of ['sakura','kai','enjo']){const{scene}=fixture(id),brush=brushes.loadGraffitiBrush(scene);assert.equal(brush?.mergeOpaque,true,id);assert.equal(brush?.preserveSubstrate,true,id);}
});
test('real three-owner surfaces keep immutable pigment separate from rendered ink and preserve coverage on repeat flush',()=>{
 for(const id of ['sakura','kai','enjo']){const{scene,texture}=fixture(id),p=new StreetPaintSurface(scene,()=>[],100,100);assert(p.material,id);assert.notEqual(p.raster.pixels,p.imageData.data,id+' never feeds finish back into base');assert(texture.filtered,id+' smooths only paint surface');p.stamp(50,50,80,0xff69b4);const base=p.raster.pixels.slice();p.flush();assert.deepEqual(p.raster.pixels,base);assert.notDeepEqual(p.imageData.data,base);for(let i=3;i<base.length;i+=4)assert.equal(p.imageData.data[i],base[i]);const rendered=p.imageData.data.slice();p.flush();assert.deepEqual(p.imageData.data,rendered);p.destroy();p.destroy();assert.equal(p.material,null);assert.equal(p.raster.pixels,null);}
});
