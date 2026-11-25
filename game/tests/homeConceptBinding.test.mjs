import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

const RECTS={logo:[0,0,435,151],backstage:[40,153,246,45],'nav-desk':[32,1542,136,110],'nav-roster':[224,1542,136,110],
 'nav-tour':[409,1542,136,110],'nav-inventory':[598,1542,136,110],'nav-records':[787,1542,136,110],
 'name-sakura':[0,990,410,240],start:[30,1408,650,115],resume:[684,1410,245,100],ticket:[652,85,67,66],settings:[838,76,76,74],
 preflight:[0,235,214,185],prepare:[0,420,214,160],'story-journal':[0,590,214,174]};
const NAV={desk:'主页',roster:'成员',tour:'巡演',inventory:'背包'};

function shell(Scene='TitleScene',currentCast=true){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(currentCast);
 const h=e.harness(e[Scene],{suppressDebugAutoStart:true});h.scene.create();return {e,h};
}
const helper=e=>e.loadRuntime('systems/HomeConceptArt.mjs');
const concept=(node,key)=>node.children.find(child=>child.dataset?.conceptArt===key)??null;
function nativeButton(doc,label){
 const button=doc.createElement('button');button.setAttribute('aria-label',label);
 const text=doc.createElement('span');text.textContent=label;button.append(text);return {button,text};
}

test('helper exports the selected concept path and immutable per-component rects',()=>{
 const {e,h}=shell();const art=helper(e);
 assert.equal(art.HOME_CONCEPT_ART_PATH,'art/home-selected-reference-20261023/concept.png');
 assert.deepEqual(JSON.parse(JSON.stringify(art.HOME_CONCEPT_RECTS)),RECTS);
 assert(Object.isFrozen(art.HOME_CONCEPT_RECTS));
 for(const rect of Object.values(art.HOME_CONCEPT_RECTS))assert(Object.isFrozen(rect));
 assert.throws(()=>{art.HOME_CONCEPT_RECTS.logo[0]=5;});
 for(const [x,y,w,hh]of Object.values(RECTS))assert(w>0&&hh>0&&x+w<=941&&y+hh<=1672,'component crop, never the full poster');
 h.shutdown();
});

test('mount appends a decorative percentage crop after native content and waits for load',()=>{
 const {e,h}=shell();const art=helper(e);const view={doc:h.document,disposed:false};
 const {button,text}=nativeButton(h.document,'成员');
 const frame=art.mountHomeConceptArt(view,button,'nav-roster');
 assert.equal(frame.tagName,'SPAN');assert.equal(frame.className,'home-concept-art');
 assert.equal(frame.dataset.conceptArt,'nav-roster');assert.equal(frame.getAttribute('aria-hidden'),'true');
 assert.equal(button.children.length,2);assert.equal(button.children[0],text);assert.equal(button.children[1],frame);
 assert.equal(frame.children.length,2);const image=frame.children[0];assert.equal(frame.querySelector('svg').getAttribute('preserveAspectRatio'),'xMidYMid meet');
 assert.equal(image.tagName,'IMG');assert.equal(image.alt,'');assert.equal(image.getAttribute('aria-hidden'),'true');
 assert.equal(image.draggable,false);assert.equal(image.width,941);assert.equal(image.height,1672);
 assert.equal(image.src,art.HOME_CONCEPT_RENDER_PATH);
 const [x,y,w,hh]=RECTS['nav-roster'];
 for(const [prop,value]of Object.entries({left:-x/w*100,top:-y/hh*100,width:941/w*100,height:1672/hh*100})){
  assert.match(image.style[prop],/^-?[0-9.]+%$/,prop);assert(Math.abs(parseFloat(image.style[prop])-value)<0.01,prop);
 }
 assert.equal(button.dataset.conceptState,undefined,'native fallback until load');
 assert.equal(button.getAttribute('aria-label'),'成员');assert.equal(text.textContent,'成员');
 assert.equal(art.mountHomeConceptArt(view,button,'poster'),null);assert.equal(button.children.length,2);
 view.disposed=true;assert.equal(art.mountHomeConceptArt(view,button,'logo'),null);assert.equal(button.children.length,2);
 h.shutdown();
});

test('load readies only the owning parent; error removes only the decor and readiness',()=>{
 const {e,h}=shell();const art=helper(e);const view={doc:h.document,disposed:false};
 const a=nativeButton(h.document,'主页'),b=nativeButton(h.document,'巡演');
 const frameA=art.mountHomeConceptArt(view,a.button,'nav-desk');art.mountHomeConceptArt(view,b.button,'nav-tour');
 frameA.children[0].dispatchEvent({type:'load'});
 assert.equal(a.button.dataset.conceptState,'ready');assert.equal(b.button.dataset.conceptState,undefined);
 frameA.children[0].dispatchEvent({type:'error'});
 assert.equal(concept(a.button,'nav-desk'),null);assert.equal(a.button.dataset.conceptState,undefined);
 assert.equal(a.button.children.length,1);assert.equal(a.button.children[0],a.text);assert.equal(a.button.getAttribute('aria-label'),'主页');
 const moved=art.mountHomeConceptArt(view,b.button,'nav-records');const other=nativeButton(h.document,'档案');
 other.button.append(moved);moved.children[0].dispatchEvent({type:'load'});
 assert.equal(b.button.dataset.conceptState,undefined);assert.equal(other.button.dataset.conceptState,undefined);
 const late=art.mountHomeConceptArt(view,b.button,'nav-inventory');view.disposed=true;
 late.children[0].dispatchEvent({type:'load'});assert.equal(b.button.dataset.conceptState,undefined);
 late.children[0].dispatchEvent({type:'error'});assert.equal(concept(b.button,'nav-inventory'),late,'destroyed view is not mutated');
 h.shutdown();
});

test('home logo falls back to its original crop and finally its accessible name',()=>{
 const {e,h}=shell();
 const heading=h.query('.shell-brand').querySelector('h1');
 const native=heading.querySelector('.shell-brand-art');
 const standalone=concept(heading,'logo');
 assert.equal(heading.getAttribute('aria-label'),'ST☆RUSH');
 assert.equal(heading.querySelector('.shell-brand-copy').textContent,'ST☆RUSH');
 assert.equal(standalone.querySelector('image').getAttribute('href'),'art/setdesign/home-logo.webp');
 assert.equal(native.hidden,true);
 assert(!native.src);
 assert.equal(h.query('.shell-eyebrow').hidden,true);
 assert.equal(h.query('.shell-eyebrow').querySelector('.home-concept-art'),null);
 standalone.querySelector('img').dispatchEvent({type:'error'});
 const original=concept(heading,'logo');
 assert.notEqual(original,standalone);
 assert.equal(original.querySelector('svg').getAttribute('viewBox'),RECTS.logo.join(' '));
 assert.equal(original.querySelector('image').getAttribute('href'),helper(e).HOME_CONCEPT_RENDER_PATH);
 assert.equal(native.hidden,false);
 native.onerror();
 assert.equal(heading.querySelector('.shell-brand-art'),null);
 assert.equal(concept(heading,'logo'),original);
 original.querySelector('img').dispatchEvent({type:'error'});
 assert.equal(concept(heading,'logo'),null);
 assert.equal(heading.textContent,'ST☆RUSH');
 assert.equal(heading.getAttribute('aria-label'),'ST☆RUSH');
 h.shutdown();
});

test('one four-button root navigation opens its named destinations without writing the profile',()=>{
 const destinations={roster:'IdolRosterScene',tour:'TourRouteScene'};
 for(const page of Object.keys(NAV)){
  const {e,h}=shell();
  const saved=e.storage.getItem('starush.public-profile');
  const write=e.storage.setItem;
  e.storage.setItem=function(key,value){
   assert.notEqual(key,'starush.public-profile','browsing the roots must not save');
   return write.call(this,key,value);
  };
  assert.equal(h.all('.shell-navigation').length,1);
  const nav=h.query('.shell-navigation');
  assert.deepEqual(nav.children.map(button=>button.dataset.nav),Object.keys(NAV));
  for(const [id,label] of Object.entries(NAV)){
   const button=nav.querySelector('[data-nav='+id+']');
   assert.equal(button.tagName,'BUTTON');
   assert.equal(button.getAttribute('aria-label'),label);
   assert.equal(button.querySelector('.showbill-nav-label').textContent,label);
   const sticker=button.querySelector('img.nav-sticker');
   assert.equal(sticker.src,'art/infield/nav-'+id+'.webp');
   assert.equal(sticker.alt,'');
   assert.equal(button.disabled,id==='desk');
   assert.equal(button.getAttribute('aria-current'),id==='desk'?'page':null);
  }
  h.click('[data-nav='+page+']');
  if(destinations[page]){
   assert.equal(h.starts.length,1);
   assert.equal(h.starts[0][0],destinations[page]);
  }else{
   assert.equal(h.starts.length,0);
   assert.equal(h.root.dataset.page,page);
   assert.equal(h.query('[data-nav='+page+']').getAttribute('aria-current'),'page');
  }
  assert.equal(e.storage.getItem('starush.public-profile'),saved);
  h.shutdown();
 }
});

test('late logo events cannot request fallback art after a home rerender or shutdown',()=>{
 const {h}=shell();
 const getHeading=()=>h.query('.shell-brand').querySelector('h1');
 const oldHeading=getHeading();
 const oldImage=concept(oldHeading,'logo').querySelector('img');
 h.scene._publicShell.render();
 const heading=getHeading();
 const fresh=concept(heading,'logo').querySelector('img');
 assert.notEqual(heading,oldHeading);
 oldImage.dispatchEvent({type:'load'});
 assert.equal(oldHeading.dataset.conceptState,undefined);
 oldImage.dispatchEvent({type:'error'});
 assert(!oldHeading.querySelector('.shell-brand-art').src,'detached heading cannot start a new fallback request');
 assert.equal(heading.dataset.conceptState,undefined);
 assert.equal(concept(heading,'logo').querySelector('img'),fresh);
 fresh.dispatchEvent({type:'load'});
 assert.equal(heading.dataset.conceptState,'ready');
 h.shutdown();
 fresh.dispatchEvent({type:'error'});
 assert.equal(heading.dataset.conceptState,'ready');
 assert(!heading.querySelector('.shell-brand-art').src);
});

test('legacy home stays native and the owner roster retains the three current identities',()=>{
 const legacy=shell('TitleScene',false);
 assert.equal(legacy.h.all('.home-concept-art').length,0);
 assert.equal(legacy.h.query('.shell-brand').querySelector('h1').textContent,'ST☆RUSH');
 legacy.h.shutdown();
 const {h}=shell('IdolRosterScene');
 assert.equal(h.all('.shell-navigation').length,1);
 assert.equal(h.all('.home-concept-art').length,0);
 const portraits=h.all('.roster-headshot');
 assert.deepEqual(portraits.map(image=>image.parentNode.dataset.member),['sakura','kai','enjo']);
 assert.deepEqual(portraits.map(image=>image.parentNode.querySelector('span').textContent),
  ['战术女武神','翡翠风歌','蔚蓝魔法师']);
 assert.equal(h.query('.shell-performer-name').querySelector('h2').textContent,'战术女武神');
 h.shutdown();
});

test('helper has no imports, timers or global handlers',()=>{
 const source=fs.readFileSync(new URL('../src/systems/HomeConceptArt.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/^\s*import\b/m);
 assert.doesNotMatch(source,/setTimeout|setInterval|requestAnimationFrame|\bwindow\b|globalThis|\bdocument\b/);
});
