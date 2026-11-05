import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createDocument,loadScenes} from './helpers/publicShellHarness.mjs';
import * as portraits from '../src/systems/MenuPortraitPresentation.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
function fixture({cached=false,noDecode=false}={}){
 const doc=createDocument(),parent=doc.createElement('button'),fallback=doc.createElement('img');parent.append(fallback);
 let resolve,reject,calls=0;const pending=new Promise((a,b)=>{resolve=a;reject=b;});
 const view={doc,element(tag,cls,text,host){const n=doc.createElement(tag);n.className=cls;host.append(n);if(!noDecode)n.decode=()=>{calls++;return pending;};if(cached){n.complete=true;n.naturalWidth=1152;n.naturalHeight=1664;}return n;}};
 const dispose=portraits.mountMenuPortrait(view,parent,'kai',fallback),image=parent.querySelector('.menu-portrait-image');
 return{doc,parent,fallback,view,dispose,image,resolve,reject,get calls(){return calls;},load(w=1152,h=1664){image.naturalWidth=w;image.naturalHeight=h;image.dispatchEvent({type:'load'});}};
}
test('two immutable full-height menu illustrations have explicit high resolution and unsupported ids stay untouched',()=>{
 assert.deepEqual(['sakura','bogus',null].map(portraits.getMenuPortraitArt),[null,null,null]);
 for(const[id,w,h]of [['kai',1152,1664],['enjo',1152,1664]]){const a=portraits.getMenuPortraitArt(id);assert(Object.isFrozen(a));assert.equal(a.width,w);assert.equal(a.height,h);assert.equal(a.src,`art/portrait-base-20261101/${id}.webp`);}
});
test('load waits for successful decoding before an atomic reveal; duplicate loads decode only once',async()=>{
 const f=fixture();assert.equal(f.image.hidden,true);f.load();f.load();assert.equal(f.calls,1);assert.equal(f.fallback.hidden,true);f.resolve();await tick();assert.equal(f.image.hidden,false);assert.equal(f.fallback.hidden,true);assert.equal(f.parent.dataset.menuPortraitState,'ready');f.dispose();assert.equal(f.parent.dataset.menuPortrait,undefined);assert.equal(f.fallback.hidden,false);
});
test('cached images still decode; rejection and incorrect dimensions explicitly fail without Q',async()=>{
 const f=fixture({cached:true});assert.equal(f.calls,1);f.reject(Error('corrupt'));await tick();assert.equal(f.parent.dataset.menuPortraitState,'unavailable');assert.equal(f.parent.querySelector('.menu-portrait-image'),null);assert.equal(f.fallback.hidden,true);assert(f.parent.querySelector('.menu-portrait-error'));f.dispose();
 const g=fixture();g.load(100,100);assert.equal(g.calls,0);assert.equal(g.parent.dataset.menuPortraitState,'unavailable');g.dispose();
});
test('errors and late decode after disposal, movement or shell shutdown cannot revive a portrait',async()=>{
 for(const mode of ['error','dispose','move','shutdown']){const f=fixture();f.load();if(mode==='error')f.image.dispatchEvent({type:'error'});if(mode==='dispose')f.dispose();if(mode==='move')f.doc.createElement('div').append(f.image);if(mode==='shutdown')f.view.disposed=true;f.resolve();await tick();assert.notEqual(f.parent.dataset.menuPortraitState,'ready');assert.equal(f.fallback.hidden,mode!=='dispose');f.dispose();assert.equal(f.fallback.hidden,false);}
});
test('without decode, only the exact fully loaded image can replace the original',()=>{const f=fixture({noDecode:true});f.load();assert.equal(f.image.hidden,false);assert.equal(f.fallback.hidden,true);f.dispose();});
test('native lobby and only the large roster slot use new art; battle and small avatars keep originals',()=>{
 for(const id of ['kai','enjo']){const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.loadRuntime('utils/publicRunProgression.mjs').selectPublicPerformer(id);const h=e.harness(e.TitleScene);h.scene.create();const v=h.scene._publicShell;
  const image=h.query('.menu-portrait-image');assert(image);assert(image.src.endsWith('/'+id+'.webp'));const original=h.query('.lobby-character').src;assert(!original.includes('menu-portraits'));v.showPage('roster');assert.equal(image.parentNode,null);assert.equal(h.all('.menu-portrait-image').length,1);assert(h.query('.member-mark-full').querySelector('.menu-portrait-image'));for(const m of h.query('.shell-member-strip').querySelectorAll('img'))assert(!m.src.includes('menu-portraits'));v.showPage('inventory');assert.equal(h.all('.menu-portrait-image').length,0);h.shutdown();
 }
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.TitleScene);h.scene.create();assert(h.query('.home-portrait-rig'));assert.equal(h.all('.menu-portrait-image').length,0);h.shutdown();
 for(const file of ['UiPerformerArt','BattleSurfaceView','HomePortraitPresentation'])assert(!fs.readFileSync(new URL('../src/systems/'+file+'.mjs',import.meta.url),'utf8').includes('menu-key-art-20261025'));
});
