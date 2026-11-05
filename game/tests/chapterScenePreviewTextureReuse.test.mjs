import test from 'node:test';
import assert from 'node:assert/strict';
import * as chapter from '../src/systems/ChapterScenePresentation.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const base='http://127.0.0.1:5199/game/';
function fixture(id='opening'){
 const entries=[];const data={stageId:1,campaignChapterId:id};
 chapter.preloadChapterScenePresentation({load:{image:(key,path)=>entries.push({key,path})}},data);
 const images=entries.map(({path})=>({tagName:'IMG',src:new URL(path,base).href,currentSrc:'',complete:true,naturalWidth:256,naturalHeight:128}));
 const imported=new Map(),calls=[];
 const scene={textures:{exists:key=>imported.has(key),addImage(key,image){calls.push({key,image});imported.set(key,image);return {key};}}};
 const root={ownerDocument:{baseURI:base,defaultView:{URL}},querySelectorAll:selector=>{assert.equal(selector,'img');return images;}};
 return {scene,data,root,images,entries,imported,calls};
}
const reuse=(...args)=>{assert.equal(typeof chapter.reuseChapterScenePreview,'function','The shell must hand off its decoded images');return chapter.reuseChapterScenePreview(...args);};
test('reuse the same decoded image objects under exact existing texture keys for all three chapters',()=>{
 for(const id of ['opening','neon','encore']){
  const f=fixture(id),before=JSON.stringify(f.images);assert.equal(reuse(f.scene,f.data,f.root),f.entries.length);
  assert.deepEqual(f.calls.map(c=>c.key),f.entries.map(c=>c.key));
  for(let i=0;i<f.calls.length;i++)assert.equal(f.calls[i].image,f.images[i]);
  assert.equal(JSON.stringify(f.images),before,'Do not rewrite pixels, sources, display dimensions or loading handlers');
 }
});
test('an early start imports only complete valid images and leaves incomplete or failed images to the loader',()=>{
 const f=fixture();f.images[0].complete=false;f.images[1].naturalWidth=0;f.images[2].naturalHeight=0;
 assert.equal(reuse(f.scene,f.data,f.root),f.entries.length-3);
 assert(f.entries.slice(0,3).every(e=>!f.imported.has(e.key)));
 const queued=[];chapter.preloadChapterScenePresentation({load:{image:(key,path)=>{if(!f.imported.has(key))queued.push({key,path});}}},f.data);
 assert.deepEqual(queued,f.entries.slice(0,3));
});
test('only current chapter inventory and an exact resolved source may be imported',()=>{
 const f=fixture();f.images[0].currentSrc='https://other.example/'+f.entries[0].path;
 f.images[1].src+='?stale=1';f.images[2].src+='-wrong';
 f.images.push({src:new URL('art/unauthorised.png',base).href,complete:true,naturalWidth:64,naturalHeight:64});
 assert.equal(reuse(f.scene,f.data,f.root),f.entries.length-3);
 assert.equal(f.calls.length,f.entries.length-3);assert(f.calls.every(c=>f.entries.some(e=>e.key===c.key)));
 const hidden=fixture();assert.equal(reuse(hidden.scene,{...hidden.data,practiceMode:true},hidden.root),0);
 assert.equal(reuse(hidden.scene,{...hidden.data,stageId:2},hidden.root),0);assert.equal(hidden.calls.length,0);
});
test('existing textures remain the owner, duplicate starts and absent shell data do not create more sources',()=>{
 const f=fixture(),sentinel={original:true};f.imported.set(f.entries[0].key,sentinel);
 assert.equal(reuse(f.scene,f.data,f.root),f.entries.length-1);assert.equal(f.imported.get(f.entries[0].key),sentinel);
 assert.equal(reuse(f.scene,f.data,f.root),0);assert.equal(f.calls.length,f.entries.length-1);
 assert.equal(reuse(f.scene,f.data,null),0);assert.equal(reuse({textures:{}},f.data,f.root),0);
});
test('rejected uploads and an invalid document base preserve the original preload fallback',()=>{
 const f=fixture();f.scene.textures.addImage=()=>{throw Error('context unavailable');};
 assert.equal(reuse(f.scene,f.data,f.root),0);assert.equal(f.imported.size,0);
 f.root.ownerDocument.baseURI='not an absolute base';assert.equal(reuse(f.scene,f.data,f.root),0);
});
test('the actual TitleScene start handoff runs before shell shutdown without changing battle data',()=>{
 const l=loadScenes(),h=l.harness(l.TitleScene);l.document.baseURI=base;l.document.defaultView={URL};
 const imported=new Map();h.scene.textures={exists:key=>imported.has(key),addImage(key,image){imported.set(key,image);return {key};}};
 h.scene.create();h.root.ownerDocument=l.document;
 for(const image of h.all('img'))Object.assign(image,{complete:true,naturalWidth:256,naturalHeight:128});
 let countAtStart=0;const start=h.scene.scene.start;h.scene.scene.start=(...args)=>{countAtStart=imported.size;start(...args);};
 const before=JSON.stringify(h.scene._buildRecommendedBattleData(new URLSearchParams()));
 h.click('[data-action=start]');assert(countAtStart>0,'Decoded preview must be handed off before leaving the shell');
 assert.equal(h.starts[0][0],'BattleScene');assert.equal(JSON.stringify(h.starts[0][1]),before);
 h.shutdown();assert.equal(l.document.getElementById('public-shell'),null);assert(imported.size>0);
});
