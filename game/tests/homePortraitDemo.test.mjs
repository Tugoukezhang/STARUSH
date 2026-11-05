import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createDocument,loadScenes} from './helpers/publicShellHarness.mjs';
const api=()=>import('../src/systems/HomePortraitPresentation.mjs');
function fixture(){
 const doc=createDocument(),parent=doc.createElement('button'),fallback=doc.createElement('img');parent.append(fallback);
 const view={doc,element(tag,cls,text,host){const n=doc.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;host.append(n);return n;}};
 return {doc,parent,fallback,view};
}
test('home-only rifle layer geometry is explicit and never swaps other actor identities',async()=>{
 const {getHomePortraitArt}=await api(),art=getHomePortraitArt('sakura');
 assert.deepEqual([art.width,art.height],[853,1280]);assert.equal(art.kind,'layered-demo');
 assert.deepEqual(art.layers.map(r=>r.id),['body','hair','tail','blink']);
 for(const row of art.layers){assert.match(row.src,/^art\/home-portrait-demo-20261022\/sakura-/);assert(row.width>0&&row.height>0);assert(row.x>=0&&row.y>=0&&row.x+row.width<=art.width&&row.y+row.height<=art.height);}
 for(const id of ['kai','enjo','venus','unknown',undefined])assert.equal(getHomePortraitArt(id),null);
});
test('Q proxy is suppressed immediately while HD waits for all layers',async()=>{
 const {mountHomePortrait}=await api(),f=fixture(),dispose=mountHomePortrait(f.view,f.parent,'sakura',f.fallback);
 const rig=f.parent.querySelector('.home-portrait-rig'),images=rig.querySelectorAll('img');assert.equal(images.length,4);assert.equal(rig.hidden,true);assert.equal(f.fallback.hidden,true);
 for(const img of images.slice(0,3))img.dispatchEvent({type:'load'});
 assert.equal(f.fallback.hidden,true);images[3].dispatchEvent({type:'load'});
 assert.equal(rig.hidden,false);assert.equal(f.fallback.hidden,true);assert.equal(f.parent.dataset.portraitState,'ready');
 for(const img of images){assert.equal(img.draggable,false);assert.equal(img.alt,'');assert.equal(img.getAttribute('aria-hidden'),'true');}
 dispose();assert.equal(f.parent.querySelector('.home-portrait-rig'),null);assert(!f.fallback.hidden);
});
test('one failed layer rejects the whole composite and late loads cannot revive it',async()=>{
 const {mountHomePortrait}=await api(),f=fixture(),dispose=mountHomePortrait(f.view,f.parent,'sakura',f.fallback);
 const images=f.parent.querySelectorAll('.home-portrait-layer');images[0].dispatchEvent({type:'error'});images.forEach(i=>i.dispatchEvent({type:'load'}));
 assert.equal(f.parent.dataset.portraitState,'unavailable');assert(!f.fallback.hidden);assert.equal(f.parent.querySelector('.home-portrait-rig'),null);dispose();dispose();
});
test('hidden document pauses motion and disposal detaches its listener',async()=>{
 const {mountHomePortrait}=await api(),f=fixture(),dispose=mountHomePortrait(f.view,f.parent,'sakura',f.fallback);
 const rig=f.parent.querySelector('.home-portrait-rig');assert.equal(rig.dataset.motion,'running');
 f.doc.hidden=true;f.doc.dispatchEvent({type:'visibilitychange'});assert.equal(rig.dataset.motion,'paused');
 f.doc.hidden=false;f.doc.dispatchEvent({type:'visibilitychange'});assert.equal(rig.dataset.motion,'running');
 dispose();f.doc.hidden=true;f.doc.dispatchEvent({type:'visibilitychange'});assert.equal(rig.dataset.motion,'running');
});
test('unsupported actor keeps original art, DOM and button untouched',async()=>{
 const {mountHomePortrait}=await api(),f=fixture();f.fallback.src='original-kai.webp';
 const dispose=mountHomePortrait(f.view,f.parent,'kai',f.fallback);assert.equal(f.parent.children.length,1);assert.equal(f.fallback.src,'original-kai.webp');assert(!f.fallback.hidden);dispose();
});
test('pointer local follow is clamped and reset without moving the hit target',async()=>{
 const {mountHomePortrait}=await api(),f=fixture();f.parent.getBoundingClientRect=()=>({left:0,top:0,width:200,height:300});
 const dispose=mountHomePortrait(f.view,f.parent,'sakura',f.fallback),rig=f.parent.querySelector('.home-portrait-rig');
 f.parent.dispatchEvent({type:'pointermove',clientX:2000,clientY:-2000});assert.equal(rig.style['--portrait-look-x'],'1');assert.equal(rig.style['--portrait-look-y'],'-1');
 f.parent.dispatchEvent({type:'pointerleave'});assert.equal(rig.style['--portrait-look-x'],'0');assert.equal(rig.style['--portrait-look-y'],'0');assert.equal(f.parent.style.transform,undefined);
 dispose();f.parent.dispatchEvent({type:'pointermove',clientX:0,clientY:0});assert.equal(rig.style['--portrait-look-x'],'0');
});
test('actual home mounts the rig and disposes it before navigation without changing the fallback asset',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.TitleScene);h.scene.create();
 const rig=h.query('.home-portrait-rig');assert(rig,'actual home must mount the layered portrait');
 assert.equal(h.query('.lobby-character').src,'art/user-cast-20261015/cat-rifle.webp');
 for(const img of rig.querySelectorAll('img'))img.dispatchEvent({type:'load'});
 assert.equal(h.query('.lobby-character').hidden,true);
 h.click('[data-action=preflight]');assert(!h.root.contains(rig),'Home rig must be disposed, not carried into preparation');
 const prepared=h.query('.preflight-portrait-stage').querySelector('.home-portrait-rig');
 assert(prepared&&prepared!==rig);assert.equal(prepared.dataset.static,undefined);assert.equal(h.query('.shell-content').dataset.preflightPresentation,'stage-v3');h.shutdown();
});
test('home motion has a dedicated late stylesheet with hidden/reduced motion and no moving hit targets',()=>{
 const css=fs.readFileSync(new URL('../src/styles/homeDemo.css',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert(html.indexOf('/src/styles/homeDemo.css')>html.indexOf('/src/styles/formalGameLayout.css'));
 for(const name of ['home-portrait-breathe','home-portrait-blink','home-portrait-hair','home-portrait-tail'])assert(css.includes('@keyframes '+name));
 assert(css.includes('@media (prefers-reduced-motion:reduce)'));assert(css.includes('[data-motion=paused]'));assert(css.includes('animation-play-state:paused'));
 assert(!/font-size:[^;]*vw/.test(css));assert(css.includes('.home-portrait-rig[hidden]'));assert(css.includes('pointer-events:none'));
});
