import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

const RECTS={logo:[0,0,435,151],backstage:[40,153,246,45],'nav-desk':[32,1542,136,110],'nav-roster':[224,1542,136,110],
 'nav-tour':[409,1542,136,110],'nav-inventory':[598,1542,136,110],'nav-records':[787,1542,136,110],
 'name-sakura':[0,990,410,240],start:[30,1408,650,115],resume:[684,1410,245,100],ticket:[652,85,67,66],settings:[838,76,76,74],
 preflight:[0,235,214,185],prepare:[0,420,214,160],'story-journal':[0,590,214,174]};
const NAV={desk:'主页',roster:'成员',tour:'巡演',inventory:'背包',records:'档案'};

function shell(Scene='TitleScene',currentCast=true){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(currentCast);
 const h=e.harness(e[Scene]);h.scene.create();return {e,h};
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

test('owner desk header keeps native logo and eyebrow fallbacks beneath concept crops',()=>{
 const {h}=shell();
 const heading=h.query('.shell-brand').querySelector('h1');
 assert(heading.querySelector('img.shell-brand-art'),'existing logo fallback retained');
 assert.equal(heading.querySelector('.shell-brand-copy').textContent,'ST☆RUSH');
 assert.equal(heading.children.at(-1),concept(heading,'logo'));
 const eyebrow=h.query('.shell-eyebrow');assert.equal(eyebrow.textContent,'巡演后台');
 assert.equal(eyebrow.children.at(-1),concept(eyebrow,'backstage'));
 assert.equal(h.all('.home-concept-art').filter(n=>['logo','backstage',...Object.keys(NAV).map(p=>'nav-'+p)].includes(n.dataset.conceptArt)).length,7);
 heading.querySelector('img.shell-brand-art').onerror();
 assert.equal(heading.querySelector('img.shell-brand-art'),null);assert(concept(heading,'logo'),'logo fallback error keeps concept crop');
 assert(heading.textContent.includes('ST☆RUSH'));
 h.shutdown();
});

test('all five owner nav buttons keep native icon, label, state and callback beside their crop',()=>{
 const {h}=shell();const nav=h.query('.shell-navigation');
 for(const [page,label]of Object.entries(NAV)){
  const button=nav.querySelector('[data-nav='+page+']');
  assert.equal(button.getAttribute('aria-label'),label);
  const frame=concept(button,'nav-'+page);assert(frame,page);assert.equal(button.children.at(-1),frame);
  assert(button.querySelector('svg')||button.querySelector('img.menu-art'),'native icon kept: '+page);
  assert.equal(button.querySelector('span').textContent,label);
 }
 const desk=nav.querySelector('[data-nav=desk]');assert.equal(desk.getAttribute('aria-current'),'page');assert.equal(desk.disabled,true);
 nav.querySelector('[data-nav=roster]').click();assert.equal(h.starts[0][0],'IdolRosterScene');
 h.shutdown();
});

test('rerender binds fresh parents and stale image events cannot mark them',()=>{
 const {h}=shell();
 const stale=concept(h.query('.shell-eyebrow'),'backstage').children[0];
 h.scene._publicShell.render();
 const eyebrow=h.query('.shell-eyebrow');const fresh=concept(eyebrow,'backstage').children[0];
 assert.notEqual(fresh,stale);
 stale.dispatchEvent({type:'load'});assert.equal(eyebrow.dataset.conceptState,undefined);
 stale.dispatchEvent({type:'error'});assert.equal(concept(eyebrow,'backstage').children[0],fresh);
 fresh.dispatchEvent({type:'load'});assert.equal(eyebrow.dataset.conceptState,'ready');
 h.shutdown();
 fresh.dispatchEvent({type:'error'});assert.equal(eyebrow.dataset.conceptState,'ready','no mutation after destroy');
});

test('legacy cast and redesigned nonhome roster have no concept crops; home retains its own composition',()=>{
 const legacy=shell('TitleScene',false);assert.equal(legacy.h.all('.home-concept-art').length,0);legacy.h.shutdown();
 const roster=shell('IdolRosterScene');assert(roster.h.query('.shell-navigation'));
 assert.equal(roster.h.all('.home-concept-art').length,0);
 assert.equal(roster.h.all('.roster-headshot').length,3);
 assert.equal(roster.h.query('.shell-performer-name').querySelector('h2').textContent,'步枪手');roster.h.shutdown();
});

test('helper has no imports, timers or global handlers',()=>{
 const source=fs.readFileSync(new URL('../src/systems/HomeConceptArt.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/^\s*import\b/m);
 assert.doesNotMatch(source,/setTimeout|setInterval|requestAnimationFrame|\bwindow\b|globalThis|\bdocument\b/);
});
