import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function shell(current=true){const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(current);const h=e.harness(e.TitleScene);h.scene.create();return {e,h,view:h.scene._publicShell};}
const helper=e=>e.loadRuntime('systems/ChapterVenueArt.mjs');
const fire=(img,type='load',width=768,height=512)=>{img.naturalWidth=width;img.naturalHeight=height;img.dispatchEvent({type});};
const paths=Object.fromEntries(['opening','neon','encore'].map(id=>[id,'art/chapter-venues-20261024/'+id+'.webp']));

test('venue registry is a bounded immutable four-chapter family',()=>{
 const {e,h}=shell(),art=helper(e);assert.deepEqual(JSON.parse(JSON.stringify(art.CHAPTER_VENUE_ART)),{...paths,raincheck:'art/rooftop-20261103/venue.webp'});assert(Object.isFrozen(art.CHAPTER_VENUE_ART));h.shutdown();
});
test('home receives one textless fixed-size decorative image above the actual map fallback',()=>{
 const {h}=shell(),map=h.query('.shell-main-map'),img=map.querySelector('img.chapter-venue-art');
 assert(img);assert.equal(img.src,paths.opening);assert.equal(img.width,768);assert.equal(img.height,512);assert.equal(img.alt,'');assert.equal(img.draggable,false);assert.equal(img.getAttribute('aria-hidden'),'true');assert.equal(img.hidden,true);
 assert(map.querySelector('.shell-map-world'));assert.equal(map.dataset.venueState,undefined);fire(img);assert.equal(map.dataset.venueState,'ready');assert.equal(img.hidden,false);h.shutdown();
});
test('wrong dimensions and network failure leave the actual map available',()=>{
 for(const [type,w,hh]of [['load',1,1],['error',768,512],['load',0,0]]){
  const {h}=shell(),map=h.query('.shell-main-map'),img=map.querySelector('.chapter-venue-art');fire(img,type,w,hh);
  assert.equal(map.dataset.venueState,undefined);assert.equal(map.querySelector('.chapter-venue-art'),null);assert(map.querySelector('.shell-map-world'));fire(img);assert.equal(map.dataset.venueState,undefined);h.shutdown();
 }
});
test('a late image cannot mutate a rerendered or destroyed shell',()=>{
 const {h,view}=shell(),old=h.query('.shell-main-map'),img=old.querySelector('.chapter-venue-art');view.render();
 const fresh=h.query('.shell-main-map');fire(img);assert.equal(old.dataset.venueState,undefined);assert.equal(fresh.dataset.venueState,undefined);
 const next=fresh.querySelector('.chapter-venue-art');h.shutdown();fire(next);assert.equal(fresh.dataset.venueState,undefined);assert.equal(next.hidden,true);
});
test('moved image events do not ready a different parent',()=>{
 const {h,view}=shell(),map=h.query('.shell-main-map'),img=map.querySelector('.chapter-venue-art'),other=view.element('figure','shell-route-preview',undefined,map.parentNode);
 other.append(img);fire(img);assert.equal(map.dataset.venueState,undefined);assert.equal(other.dataset.venueState,undefined);h.shutdown();
});
test('only the three intended presentation surfaces mount; tactical and unknown maps remain exact composites',()=>{
 const {e,h,view}=shell(),art=helper(e);
 for(const surface of ['shell-main-map','shell-route-preview','preflight-scene']){
  const f=view.element('figure',surface,undefined,view.root),img=art.mountChapterVenueArt(view,f,{id:'neon'});assert(img);assert.equal(img.src,paths.neon);
  assert.equal(art.mountChapterVenueArt(view,f,{id:'neon'}),img,'no duplicate node');assert.equal(f.children.length,1);
 }
 for(const id of ['opening','__proto__','missing']){const f=view.element('figure','preflight-map',undefined,view.root);assert.equal(art.mountChapterVenueArt(view,f,{id}),null);assert.equal(f.children.length,0);}
 const f=view.element('figure','shell-main-map',undefined,view.root);assert.equal(art.mountChapterVenueArt(view,f,{id:'missing'}),null);assert.equal(art.mountChapterVenueArt(view,f,{id:'__proto__'}),null);
 h.shutdown();
});
test('owner preflight uses venue hero but preserves real map in guide',()=>{
 const {h}=shell();h.click('[data-action=preflight]');assert(h.query('.preflight-scene').querySelector('.chapter-venue-art'));assert(h.query('.preflight-map').querySelector('.shell-map-world'));assert.equal(h.query('.preflight-map').querySelector('.chapter-venue-art'),null);h.shutdown();
});
test('tour previews reflect all chapter IDs without unlocking or changing native button state',()=>{
 const {h,view}=shell();view.showPage('tour');
 const rows=h.all('.shell-chapter-option');assert.equal(rows.length,3);
 for(const row of rows){const img=row.querySelector('.chapter-venue-art');assert(img);assert.equal(img.src,paths[row.dataset.chapter]);assert(row.getAttribute('aria-label'));assert(row.querySelector('.shell-chapter-state'));}
 assert.equal(rows[0].disabled,false);assert.equal(rows[1].disabled,true);assert.equal(rows[2].disabled,true);h.shutdown();
});
test('legacy cast receives no venue generation or admission',()=>{
 const {h,view}=shell(false);assert.equal(h.all('.chapter-venue-art').length,0);view.showPage('tour');assert.equal(h.all('.chapter-venue-art').length,0);h.shutdown();
});
test('CSS keeps fixed image framing, real fallback, stable button geometry and reduced motion',()=>{
 const css=fs.readFileSync(new URL('../src/styles/homeDemo.css',import.meta.url),'utf8');
 assert.match(css,/\.chapter-venue-art[^}]*object-fit:cover/);assert.match(css,/\[data-venue-state=ready\] > \.shell-map-world[^}]*visibility:hidden/);
 assert(css.includes('.chapter-venue-art[hidden] {display:none;}'),'generic shell img display cannot reveal an unready/failed image');
 assert.match(css,/\[data-venue-state=ready\] > \.chapter-venue-art[^}]*animation:chapter-venue-reveal 240ms/);assert.match(css,/@media \(prefers-reduced-motion:reduce\)[\s\S]*chapter-venue-art[^}]*animation:none/);
 assert.doesNotMatch(css,/font-size:[^;]*vw/);
});
test('runtime manifest admits exactly the three reviewed venue filenames, never PNG sources',()=>{
 const source=fs.readFileSync(new URL('../scripts/runtime-payload.mjs',import.meta.url),'utf8');assert(source.includes("'art/chapter-venues-20261024/', ['opening.webp','neon.webp','encore.webp']"));assert(!source.includes('venue-source'));
});
test('three admitted venue bytes are pinned and unique; no raw source slips into release',()=>{
 const rows=[['opening',109624,'eeb8532313f1a2db2ea3d506b338eccd07352d4b6e3c5d8856c73a94543ad5b1'],['neon',155260,'ce29a6096946419f51005412e1cf7f149fcc839f9b61d4ac51de10b300ef3f14'],['encore',93948,'4bc77cc68bc95e586d6875b9ecd67347a0d2239720d01e0a4a2acff8c08360c9']];
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file.startsWith('art/chapter-venues-20261024/')).map(r=>r.file).sort(),Object.values(paths).sort());
 for(const [id,size,hash]of rows){const b=fs.readFileSync(new URL('../public/'+paths[id],import.meta.url));assert.equal(b.length,size);assert.equal(createHash('sha256').update(b).digest('hex'),hash);assert.equal(b.subarray(0,4).toString(),'RIFF');assert.equal(b.subarray(8,12).toString(),'WEBP');}
});
