import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {getChapterGroundArt,getChapterGroundColorArt} from '../src/systems/ChapterGroundArt.mjs';
import {loadChapterGroundSubstrate,preloadChapterGroundColor} from '../src/systems/ChapterGroundSubstrate.mjs';
import {getChapterScenePresentation,preloadChapterScenePresentation} from '../src/systems/ChapterScenePresentation.mjs';
const brush={sample:(u,v,ink=false)=>ink?0:u>.2&&u<.8&&v>.2&&v<.8?1:0};
test('legacy defense does not queue a current-map material or request its CPU substrate',()=>{
 const data={stageId:1,defenseMode:true},calls=[];assert.equal(getChapterScenePresentation(data).groundColorPath,null);
 preloadChapterScenePresentation({load:{image:(key,url)=>calls.push({key,url})}},data);assert(!calls.some(r=>r.key.startsWith('chapter-ground-color-')));
 assert.equal(loadChapterGroundSubstrate({_userCastPresentation:true,battleData:data}),null);
});
test('all chapter neutral/color pairs share geometry and exact authored paths',()=>{
 for(const id of ['opening','neon','encore']){assert.equal(getChapterGroundArt(id),'art/map-presentation-20261018/'+id+'-neutral.webp');assert.equal(getChapterGroundColorArt(id),'art/map-presentation-20261018/'+id+'-color.webp');}assert.equal(getChapterGroundColorArt('unknown'),null);
});
test('substrate changes covered RGB only, not coverage, blockers or dirty max-coverage',()=>{
 const pixels=new Uint8ClampedArray(100*60*4);for(let i=0;i<pixels.length;i+=4){pixels.set([i%8?210:90,180,140,255],i);}
 const substrate={width:100,height:60,data:pixels},a=new StreetPigmentRaster(200,120,null,.9,brush),b=new StreetPigmentRaster(200,120,null,.9,brush,substrate),blockers=[{footprint:{x:0,y:0,width:20,height:120}}];
 for(const r of [a,b])r.stamp(70,60,70,0xff69b4,blockers);
 assert.deepEqual([...a.pixels].filter((_,i)=>i%4===3),[...b.pixels].filter((_,i)=>i%4===3));assert.notDeepEqual(a.pixels,b.pixels,'material RGB must visibly enter covered pixels');
 assert(b.pixels.some((v,i)=>i%4!==3&&v!==a.pixels[i]));const before=b.pixels.slice();b.consumeDirty();assert.equal(b.stamp(70,60,70,0xff69b4,blockers),false);assert.equal(b.consumeDirty(),null);assert.deepEqual(b.pixels,before);b.destroy();assert.equal(b.substrate,null);
});
test('missing or invalid substrate must not silently show a legacy circle',()=>{
 assert.equal(loadChapterGroundSubstrate({_userCastPresentation:false}),null);
 assert.throws(()=>loadChapterGroundSubstrate({_userCastPresentation:true,battleData:{stageId:1},textures:{exists:()=>false}}),/ground/i);
});
test('wrong decoded ground size triggers existing loader recovery, unregisters on shutdown',()=>{
 const load=new EventEmitter(),events=new EventEmitter(),removed=[],queued=[],errors=[];load.image=(...a)=>queued.push(a);load.on('loaderror',e=>errors.push(e));
 const scene={load,events,textures:{exists:()=>false,get:()=>({getSourceImage:()=>({width:1,height:1})}),remove:k=>removed.push(k)}};
 preloadChapterGroundColor(scene,'opening');assert.deepEqual(queued,[['chapter-ground-color-opening','art/map-presentation-20261018/opening-color.webp']]);load.emit('filecomplete-image-chapter-ground-color-opening');assert.equal(errors.length,1);assert.equal(removed.length,1);events.emit('shutdown');assert.equal(load.listenerCount('filecomplete-image-chapter-ground-color-opening'),0);
});
test('a rejected decoded image must retry a fresh URL, not reuse its browser image request',()=>{
 const load=new EventEmitter(),events=new EventEmitter(),queued=[];let exists=false;
 load.image=(...args)=>queued.push(args);
 const scene={load,events,textures:{exists:()=>exists,get:()=>({getSourceImage:()=>({width:1,height:1})}),remove:()=>{exists=false;}}};
 preloadChapterGroundColor(scene,'opening');exists=true;load.emit('filecomplete-image-chapter-ground-color-opening');events.emit('shutdown');
 preloadChapterGroundColor(scene,'opening');assert.notEqual(queued[0][1],queued[1][1]);assert.match(queued[1][1],/opening-color\.webp\?groundRetry=1$/);
});
