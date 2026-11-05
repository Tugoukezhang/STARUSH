import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {preloadChapterScenePresentation} from '../src/systems/ChapterScenePresentation.mjs';
const ImageFile=createRequire(import.meta.url)('phaser/src/loader/filetypes/ImageFile.js');
function fixture(original){
 if(arguments.length===0)original='XHR';
 const files=[],load={path:'',prefix:'',baseURL:'',textureManager:{},image(key,url){files.push(new ImageFile(this,key,url));}};
 if(original!==undefined)load.imageLoadType=original;
 return {files,load,scene:{load}};
}
test('all current chapter image files use the supported image path, not duplicate blob XHR',()=>{
 for(const campaignChapterId of ['opening','neon','encore']){
  const f=fixture();preloadChapterScenePresentation(f.scene,{stageId:1,campaignChapterId});assert(f.files.length>5);
  for(const file of f.files){assert.equal(file.useImageElementLoad,true,file.url);assert.equal(file.load,file.loadImage);assert.equal(file.onProcess,file.onProcessImage);}
  assert.equal(new Set(f.files.map(r=>r.key)).size,f.files.length);assert.equal(f.load.imageLoadType,'XHR');
 }
});
test('queue mode is narrow and restores both explicit and absent properties',()=>{
 for(const original of ['XHR','HTMLImageElement',undefined]){
  const f=fixture(original),before=Object.getOwnPropertyDescriptor(f.load,'imageLoadType');
  preloadChapterScenePresentation(f.scene,{stageId:1});assert.deepEqual(Object.getOwnPropertyDescriptor(f.load,'imageLoadType'),before);
  f.load.image('unrelated','unrelated.webp');assert.equal(f.files.at(-1).useImageElementLoad,original==='HTMLImageElement');
 }
});
test('an interrupted image queue restores loader mode while preserving the error',()=>{
 for(const original of ['XHR',undefined]){
  const f=fixture(original),failure=Error('queue interrupted'),seen=[];
  f.load.image=function(key,url){seen.push(new ImageFile(this,key,url));throw failure;};
  assert.throws(()=>preloadChapterScenePresentation(f.scene,{stageId:1}),e=>e===failure);
  assert.equal(f.load.imageLoadType,original);assert.equal(Object.hasOwn(f.load,'imageLoadType'),original!==undefined);assert.equal(seen[0].useImageElementLoad,true);
 }
});
test('an inherited loader mode is restored without adding an own override',()=>{
 const f=fixture(undefined);Object.setPrototypeOf(f.load,{imageLoadType:'XHR'});
 preloadChapterScenePresentation(f.scene,{stageId:1});assert.equal(f.load.imageLoadType,'XHR');assert.equal(Object.hasOwn(f.load,'imageLoadType'),false);
 assert(f.files.every(file=>file.useImageElementLoad));
});
test('hidden or non-public stages do not mutate loader mode or queue images',()=>{
 for(const data of [{stageId:1,practiceMode:true},{stageId:2}]){const f=fixture();preloadChapterScenePresentation(f.scene,data);assert.deepEqual(f.files,[]);assert.equal(f.load.imageLoadType,'XHR');}
});
test('existing texture identities and queued paths remain unchanged',()=>{
 const f=fixture(),textures={owner:true};f.scene.textures=textures;preloadChapterScenePresentation(f.scene,{stageId:1});assert.equal(f.scene.textures,textures);
 assert.equal(f.files[0].key,'chapter-ground-opening');assert.equal(f.files[0].url,'art/map-presentation-20261018/opening-neutral.webp');
 assert(f.files.every(file=>file.url.startsWith('art/')&&file.url.endsWith('.webp')));assert(!f.files.some(file=>file.url.includes('sakura')));
});
test('real Phaser image completion and failure still notify its existing loader',()=>{
 const prior=Object.getOwnPropertyDescriptor(globalThis,'Image'),result=[];
 try{globalThis.Image=class {};const f=fixture();f.load.nextFile=(file,ok)=>result.push({file,ok});
  preloadChapterScenePresentation(f.scene,{stageId:1});const file=f.files[0];assert.equal(file.useImageElementLoad,true);file.crossOrigin='anonymous';
  for(const ok of [true,false]){file.load();assert.equal(file.data.src,file.url);assert.equal(file.data.crossOrigin,'anonymous');file.data[ok?'onload':'onerror']();assert.deepEqual(result.at(-1),{file,ok});}
 }finally{if(prior)Object.defineProperty(globalThis,'Image',prior);else delete globalThis.Image;}
});
