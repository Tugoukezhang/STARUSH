import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const setup=(page,owner=true)=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(owner);
 const h=e.harness(e.TitleScene);h.scene.create();const v=h.scene._publicShell;if(page!=='desk')v.showPage(page);
 return{e,h,v};
};
test('owner inner pages use five native navigation controls without home raster overlays',()=>{
 for(const page of ['roster','tour','inventory','records','workshop']){
  const{h}=setup(page);const nav=h.query('.shell-navigation');
  for(const key of ['desk','roster','tour','inventory','records']){
   const b=nav.querySelector('[data-nav='+key+']'),art=b.querySelector('.home-concept-art');
   assert.equal(art,null,page+': '+key);assert(b.getAttribute('aria-label'));
   assert(b.querySelector('svg'));assert(b.querySelector('span'));
  }h.shutdown();
 }
 const{h}=setup('roster',false);assert.equal(h.all('.home-concept-art').length,0);h.shutdown();
});
test('inventory initially exposes six items and keeps an explicit collapse or expand choice',()=>{
 const{e,h,v}=setup('inventory'),raw=e.storage.getItem('starush.public-profile');
 assert.equal(h.query('.inventory-chooser').open,true);
 const chooser=h.query('.inventory-chooser');chooser.open=false;chooser.dispatchEvent({type:'toggle'});
 h.click('[data-member=kai]');assert.equal(h.query('.inventory-chooser').open,false);
 const next=h.query('.inventory-chooser');next.open=true;next.dispatchEvent({type:'toggle'});
 h.click('[data-inventory-item=return_edge]');assert.equal(h.query('.inventory-chooser').open,true);
 assert.equal(e.document.activeElement,h.query('[data-inventory-item=return_edge]'));
 assert.equal(h.query('.inventory-grid').querySelectorAll('button').length,6);
 assert.equal(h.query('[data-action=equip-selected]').disabled,true);
 assert.equal(e.storage.getItem('starush.public-profile'),raw,'browsing cannot write selection or equipment');
 v.showPage('tour');v.backPage();assert.equal(h.query('.inventory-chooser').open,true);h.shutdown();
});
test('all inventory cells use their real item art and mark actual equipment compatibility',()=>{
 const{h}=setup('inventory');
 for(const[id,art,compatible]of [['wide_nozzle','nozzle',true],['rhythm_sync','tempo',true],['return_edge','lens',false]]){
  const cell=h.query('[data-inventory-item='+id+']');assert(cell.querySelector('img').src.endsWith('/'+art+'.webp'));
  assert.equal(cell.dataset.compatible,String(compatible));
 }
 h.click('[data-member=kai]');assert.equal(h.query('[data-inventory-item=return_edge]').dataset.compatible,'true');h.shutdown();
});
test('inventory title is native accessible text without a load-dependent bitmap overlay',()=>{
 const{h}=setup('inventory'),title=h.query('.shell-brand').querySelector('h1'),image=title.querySelector('img');
 assert.equal(image,null);assert.equal(title.textContent,'装备背包');
 assert.equal(title.getAttribute('aria-label'),'装备背包');assert.equal(title.dataset.lettered,undefined);
 assert.equal(title.dataset.titleArt,undefined);
 assert(title.textContent.includes('装备背包'));h.shutdown();
});
test('inventory item art failure keeps the established native icon fallback',()=>{
 const{h}=setup('inventory'),cell=h.query('[data-inventory-item=wide_nozzle]'),image=cell.querySelector('img');
 image.dispatchEvent({type:'error'});cell.querySelector('.equipment-art').dispatchEvent({type:'error'});assert(!cell.querySelector('img'));assert(cell.querySelector('svg'));assert.equal(cell.getAttribute('aria-label'),'扩幅导流器');h.shutdown();
});
test('inner family sheet is loaded last and scopes its layout without new runtime logic',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert(html.indexOf('innerScreenFamily.css')>html.indexOf('homeDemo.css'));
 const css=fs.readFileSync(new URL('../src/styles/innerScreenFamily.css',import.meta.url),'utf8');
 for(const key of ['roster','tour','inventory'])assert(css.includes('[data-page='+key+']'));
 assert(css.includes('prefers-reduced-motion:reduce'));assert(css.includes('object-fit:contain'));
 assert(css.includes('[data-concept-state=ready]'));assert(css.includes('pointer-events:none'));
});
