import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,createDocument} from './helpers/publicShellHarness.mjs';
import * as icons from '../src/systems/EquipmentIconArt.mjs';
const IDS=['wide_nozzle','rhythm_sync','focus_lens','travelling_nozzle','return_edge','delayed_hammer'];
const settle=()=>new Promise(r=>setImmediate(r));
const setup=(page,owner=true)=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(owner);const h=e.harness(e.TitleScene);h.scene.create();const v=h.scene._publicShell;if(page!=='desk')v.showPage(page);return{e,h,v};};
const imageFixture=()=>{
  const doc=createDocument(),parent=doc.createElement('span'),fallback=doc.createElement('img');parent.append(fallback);
  const view={doc,root:parent,element(tag,cls,text,host){const n=doc.createElement(tag);n.className=cls;host.append(n);return n;}};
  const image=icons.mountEquipmentIcon(view,parent,'wide_nozzle',fallback);
  image.naturalWidth=image.naturalHeight=256;
  return{view,parent,fallback,image};
};
test('six actual equipment items have distinct immutable art; unknown and prototype keys stay native',()=>{
  assert.equal(new Set(IDS.map(id=>icons.getEquipmentIconArt(id)?.src)).size,6);
  for(const id of IDS){assert(Object.isFrozen(icons.getEquipmentIconArt(id)));assert(icons.getEquipmentIconArt(id).src.endsWith('.png'));}
  for(const id of ['unknown','toString','__proto__'])assert.equal(icons.getEquipmentIconArt(id),null);
});
test('native fallback stays visible until decode succeeds and recovers on image failure',async()=>{
  const {parent,fallback,image}=imageFixture();let resolve;image.decode=()=>new Promise(r=>resolve=r);
  image.dispatchEvent({type:'load'});assert.notEqual(fallback.hidden,true);resolve();await settle();
  assert(fallback.hidden);assert.equal(parent.dataset.equipmentArtState,'ready');
  image.dispatchEvent({type:'error'});assert.equal(fallback.hidden,false);assert.equal(parent.dataset.equipmentArtState,undefined);
});
test('wrong dimensions, rejected decode and late disposed or detached page never replace native icons',async()=>{
  for(const mode of ['size','decode','disposed','detached']){
    const {view,parent,fallback,image}=imageFixture();let resolve;
    image.decode=()=>mode==='decode'?Promise.reject(Error('decode')):new Promise(r=>resolve=r);
    if(mode==='size')image.naturalWidth=255;
    image.dispatchEvent({type:'load'});
    if(mode==='disposed')view.disposed=true;
    if(mode==='detached')view.root=createDocument().createElement('div');
    resolve?.();await settle();assert.notEqual(fallback.hidden,true);assert.notEqual(parent.dataset.equipmentArtState,'ready');
  }
});
test('inventory uses every actual item art in grid and detail while directory summary remains native without persisting browsing',()=>{
  const{e,h}=setup('inventory'),raw=e.storage.getItem('starush.public-profile');
  for(const cell of h.query('.inventory-grid').querySelectorAll('button'))assert.equal(cell.querySelector('.equipment-art')?.src,icons.getEquipmentIconArt(cell.dataset.inventoryItem).src);
  assert.equal(h.query('.inventory-detail-heading').querySelectorAll('.equipment-art').length,1);
  for(const id of IDS){
    h.click('[data-inventory-item='+id+']');
    assert.equal(h.query('.inventory-detail-heading').querySelector('.equipment-art').src,icons.getEquipmentIconArt(id).src);
    const summary=h.query('.inventory-chooser').querySelector('summary');
    assert.equal(summary.querySelector('img'),null);
    assert.equal(summary.querySelector('.inventory-chooser-title').textContent,'配件目录');
    assert.equal(h.query('[data-inventory-item='+id+']').querySelector('.equipment-art').src,icons.getEquipmentIconArt(id).src);
    assert.equal(h.query('[data-inventory-item='+id+']').getAttribute('aria-pressed'),'true');
  }
  assert.equal(e.storage.getItem('starush.public-profile'),raw);h.shutdown();
});
test('locked footer shows real unlock requirement and refuses an unavailable equipment action',()=>{
  const{h}=setup('inventory');assert(h.query('.inventory-status').textContent.includes('首通星光初演'));
  assert(h.query('[data-action=equip-selected]').disabled);h.click('[data-inventory-item=return_edge]');
  assert(h.query('.inventory-status').textContent.includes('机甲剑士'));assert(h.query('[data-action=equip-selected]').disabled);h.shutdown();
});
test('roster and tour use native identity while chapter previews and legacy equipment stay unchanged',()=>{
  const{e,h,v}=setup('roster');assert(h.query('.roster-portrait-stage'));
  assert.equal(h.query('.shell-performer-name').querySelector('h2').textContent,'步枪手');
  assert.equal(h.query('.shell-performer-name').querySelector('.home-concept-art'),null);
  assert(h.query('[data-action=confirm-member]'));v.showPage('tour');
  assert.equal(h.all('.shell-chapter-option').length,3);
  for(const row of h.all('.shell-chapter-option')){
    const title=row.querySelector('.shell-chapter-copy').querySelector('strong'),chapter=e.model().chapters.find(c=>c.id===row.dataset.chapter);
    assert.equal(title.textContent,chapter.name);assert.equal(title.querySelector('.home-concept-art'),null);
    assert.ok(row.querySelector('.shell-route-preview'));assert.ok(row.getAttribute('aria-label').startsWith(chapter.name));
  }
  h.shutdown();const legacy=setup('inventory',false);assert.equal(legacy.h.all('.equipment-art').length,0);legacy.h.shutdown();
});
