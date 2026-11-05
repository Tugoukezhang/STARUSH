import test from 'node:test';import assert from 'node:assert/strict';import {createDocument} from './helpers/publicShellHarness.mjs';import {mountHomePortrait,getHomePortraitArt} from '../src/systems/HomePortraitPresentation.mjs';
const flush=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});promise.catch(()=>{});return{promise,resolve,reject};}
function fixture({cached=false,throws=false,noDecode=false}={}){
 const doc=createDocument(),parent=doc.createElement('button'),fallback=doc.createElement('img'),pending=[],calls=[];parent.append(fallback);
 const view={doc,element(tag,cls,text,host){const n=doc.createElement(tag);n.className=cls;host.append(n);if(tag==='img'){const i=pending.length,d=deferred();pending.push(d);calls.push(0);if(!noDecode)n.decode=()=>{calls[i]++;if(throws)throw Error('decode-failed');return d.promise;};if(cached){const row=getHomePortraitArt('sakura').layers[i];n.complete=true;n.naturalWidth=row.width;n.naturalHeight=row.height;}}return n;}};
 const dispose=mountHomePortrait(view,parent,'sakura',fallback),rig=parent.querySelector('.home-portrait-rig'),images=rig.querySelectorAll('img');return{doc,parent,fallback,view,pending,calls,dispose,rig,images,load(){images.forEach(i=>i.dispatchEvent({type:'load'}));}};
}
test('Q proxy stays hidden while HD waits for every decode',async()=>{
 const f=fixture();f.load();assert.equal(f.fallback.hidden,true);assert.equal(f.rig.hidden,true);assert.equal(f.parent.dataset.portraitState,'loading');assert.deepEqual(f.calls,[1,1,1,1]);
 f.pending.slice(1).forEach(d=>d.resolve());await flush();assert.equal(f.rig.hidden,true,'small hair/tail/blink cannot reveal a partial character');
 f.pending[0].resolve();await flush();assert.equal(f.rig.hidden,false);assert.equal(f.fallback.hidden,true);assert.equal(f.parent.dataset.portraitState,'ready');f.dispose();
});
test('one rejected decode rejects the composite and late successes cannot revive it',async()=>{
 const f=fixture();f.load();f.pending[0].reject(Error('corrupt-image'));await flush();assert.equal(f.parent.dataset.portraitState,'unavailable');assert.equal(f.parent.querySelector('.home-portrait-rig'),null);assert.equal(f.fallback.hidden,false);
 f.pending.slice(1).forEach(d=>d.resolve());await flush();assert.equal(f.parent.dataset.portraitState,'unavailable');assert.equal(f.fallback.hidden,false);f.dispose();
});
test('a synchronous decoder error is a safe original-portrait fallback',()=>{
 const f=fixture({throws:true});assert.doesNotThrow(()=>f.load());assert.equal(f.parent.dataset.portraitState,'unavailable');assert.equal(f.fallback.hidden,false);assert.equal(f.parent.querySelector('.home-portrait-rig'),null);f.dispose();
});
test('pending decode after disposal cannot mutate the next screen',async()=>{
 const f=fixture();f.load();f.dispose();f.pending.forEach(d=>d.resolve());await flush();assert.equal(f.parent.querySelector('.home-portrait-rig'),null);assert.equal(f.fallback.hidden,false);assert.equal(f.parent.dataset.portraitState,undefined);
});
test('moving the pending rig away makes asynchronous completion inert',async()=>{
 const f=fixture();f.load();const other=f.doc.createElement('div');other.append(f.rig);f.pending.forEach(d=>d.resolve());await flush();assert.notEqual(f.parent.dataset.portraitState,'ready');assert.equal(f.fallback.hidden,true);f.dispose();assert.equal(f.fallback.hidden,false);
});
test('a disposed shell cannot become portrait-ready from a late promise',async()=>{
 const f=fixture();f.load();f.view.disposed=true;f.pending.forEach(d=>d.resolve());await flush();assert.notEqual(f.parent.dataset.portraitState,'ready');assert.equal(f.fallback.hidden,true);f.dispose();assert.equal(f.fallback.hidden,false);
});
test('cached-load and duplicate-load paths decode each layer only once',async()=>{
 const f=fixture({cached:true});f.load();f.load();assert.deepEqual(f.calls,[1,1,1,1]);assert.equal(f.rig.hidden,true);f.pending.forEach(d=>d.resolve());await flush();assert.equal(f.rig.hidden,false);f.load();assert.deepEqual(f.calls,[1,1,1,1]);f.dispose();
});
test('an older browser without decode preserves the existing all-loads fallback',()=>{
 const f=fixture({noDecode:true});f.images.slice(0,3).forEach(i=>i.dispatchEvent({type:'load'}));assert.equal(f.rig.hidden,true);f.images[3].dispatchEvent({type:'load'});assert.equal(f.rig.hidden,false);assert.equal(f.fallback.hidden,true);f.dispose();
});
