import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,createDocument} from './helpers/publicShellHarness.mjs';
import * as icons from '../src/systems/EquipmentIconArt.mjs';
const IDS=['wide_nozzle','rhythm_sync','focus_lens','rain_relay','travelling_nozzle','return_edge','delayed_hammer'];
const settle=()=>new Promise(r=>setImmediate(r));
function openScene(e,Scene,options={}) {
  const h=e.harness(Scene,{suppressDebugAutoStart:true,...options});
  h.scene.create();return h;
}
function ownerSession(cleared=[]) {
  const e=loadScenes();
  e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  e.seed(cleared);return e;
}
function watchProfile(e) {
  const key='starush.public-profile',saved=e.storage.getItem(key),set=e.storage.setItem;
  let writes=0;
  e.storage.setItem=function(k,v) {
    if(k===key)writes++;
    return set.call(this,k,v);
  };
  return ()=>{
    assert.equal(writes,0,'browsing must not write the profile');
    assert.equal(e.storage.getItem(key),saved);
  };
}
const imageFixture=()=>{
  const doc=createDocument(),parent=doc.createElement('span'),fallback=doc.createElement('img');parent.append(fallback);
  const view={doc,root:parent,element(tag,cls,text,host){const n=doc.createElement(tag);n.className=cls;host.append(n);return n;}};
  const image=icons.mountEquipmentIcon(view,parent,'wide_nozzle',fallback);
  image.naturalWidth=image.naturalHeight=256;
  return{view,parent,fallback,image};
};
test('seven actual equipment items have distinct immutable art; unknown and prototype keys stay native',()=>{
  assert.equal(new Set(IDS.map(id=>icons.getEquipmentIconArt(id)?.src)).size,IDS.length);
  for(const id of IDS){assert(Object.isFrozen(icons.getEquipmentIconArt(id)));assert.match(icons.getEquipmentIconArt(id).src,/\.(png|webp)$/);}
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
test('inventory filters and item details show all seven equipment images without writing a profile',()=>{
  const e=ownerSession(['opening']),h=openScene(e,e.TitleScene),checkSave=watchProfile(e);
  h.click('[data-nav=inventory]');
  const slots=h.all('.ui-item-slot');
  assert.deepEqual(slots.map(slot=>slot.dataset.inventoryItem),IDS);
  const visibleIds=()=>slots.filter(slot=>!slot.hidden).map(slot=>slot.dataset.inventoryItem);
  h.click('[data-action=bag-filter-owned]');
  assert.equal(h.query('[data-action=bag-filter-owned]').getAttribute('aria-pressed'),'true');
  assert.deepEqual(visibleIds(),['wide_nozzle','travelling_nozzle']);
  h.click('[data-action=bag-filter-compatible]');
  assert.deepEqual(visibleIds(),IDS.filter(id=>id!=='return_edge'&&id!=='delayed_hammer'));
  h.click('[data-action=bag-filter-all]');
  assert.deepEqual(visibleIds(),IDS);
  const thumbnails={return_edge:'art/printroom/chime-icon.png',delayed_hammer:'art/printroom/book-icon.png'};
  for(const slot of slots) {
    const id=slot.dataset.inventoryItem,original=icons.getEquipmentIconArt(id);
    const thumb=slot.querySelector('.equipment-art');
    assert.equal(thumb.src,thumbnails[id]??original.src);
    assert.equal(thumb.width,256);
    slot.click();
    const dialog=h.query('dialog'),detail=dialog.querySelector('.inv-detail');
    assert(dialog.open);
    assert.equal(detail.dataset.item,id);
    assert.equal(dialog.getAttribute('aria-label'),slot.querySelector('.ui-item-name').textContent);
    const full=detail.querySelectorAll('.equipment-art');
    assert.equal(full.length,1);
    assert.equal(full[0].src,original.src);
    assert.equal(full[0].width,original.width);
    h.click('[data-action=sheet-close]');
    assert.equal(h.query('dialog'),null);
    assert.equal(e.document.activeElement,slot);
  }
  checkSave();h.shutdown();
});

test('locked chapter and member gear explain their real unlock conditions and refuse an equip',()=>{
  const e=ownerSession(),h=openScene(e,e.TitleScene),checkSave=watchProfile(e);
  h.click('[data-nav=inventory]');
  for(const [id,reason] of [['wide_nozzle','首通星光初演'],['return_edge','翡翠风歌首次通关任意章节']]) {
    const slot=h.click('[data-inventory-item='+id+']');
    assert.equal(slot.dataset.owned,'false');
    const detail=h.query('dialog').querySelector('.inv-detail');
    assert.equal(detail.dataset.state,'locked');
    assert.equal(detail.querySelector('.inv-detail-reason').textContent,'解锁条件：'+reason);
    const equip=detail.querySelector('[data-action=equip-selected]');
    assert.equal(equip.disabled,true);
    equip.click();
    assert.equal(e.profile.loadPublicProfile().preparation.equipmentByPerformer.sakura,null);
    h.click('[data-action=sheet-close]');
  }
  checkSave();h.shutdown();
});

test('member and tour previews show the three confirmed identities and five named stops; legacy gear remains usable',()=>{
  const e=ownerSession(['opening']),checkSave=watchProfile(e);
  const desk=openScene(e,e.TitleScene);
  desk.click('[data-nav=roster]');
  assert.equal(desk.starts.at(-1)[0],'IdolRosterScene');
  desk.shutdown();
  const roster=openScene(e,e.IdolRosterScene);
  const members=[['sakura','战术女武神'],['kai','翡翠风歌'],['enjo','蔚蓝魔法师']];
  for(const [id,name] of members) {
    roster.click('[data-action=actor-switch]');
    const choices=roster.query('dialog').querySelectorAll('[data-member]');
    assert.deepEqual(choices.map(button=>[button.dataset.member,button.getAttribute('aria-label')]),members);
    choices.find(button=>button.dataset.member===id).click();
    assert.equal(roster.query('.roster-stage-identity').querySelector('h2').textContent,name);
    assert.equal(roster.query('.roster-portrait-stage').querySelector('.member-mark-full').dataset.performer,id);
    assert.equal(e.profile.loadPublicProfile().selectedId,'sakura');
  }
  roster.click('[data-nav=tour]');
  assert.equal(roster.starts.at(-1)[0],'TourRouteScene');
  roster.shutdown();
  const tour=openScene(e,e.TourRouteScene),stops=tour.all('button.journey-chapter');
  assert.deepEqual(stops.map(row=>row.dataset.chapter),['opening','neon','encore','raincheck','homecoming']);
  for(const row of stops) {
    const id=row.dataset.chapter,chapter=e.model().chapters.find(candidate=>candidate.id===id);
    const title=row.querySelector('.shell-chapter-copy').querySelector('strong');
    assert.equal(title.textContent,chapter.name);
    assert(row.getAttribute('aria-label').startsWith(chapter.name));
    assert.equal(row.querySelector('.journey-landmark').src,'art/showbill/stop-'+id+'.webp');
    assert.equal(row.disabled,!chapter.unlocked);
    tour.click('button[data-chapter='+id+']');
    if(chapter.unlocked) {
      assert.equal(tour.query('dialog').getAttribute('aria-label'),chapter.name);
      tour.click('[data-action=sheet-close]');
    } else assert.equal(tour.query('dialog'),null);
  }
  checkSave();tour.shutdown();
  const legacy=loadScenes();
  legacy.loadRuntime('utils/userCast.mjs').configureUserCast(false);
  const bag=openScene(legacy,legacy.TitleScene,{openPage:'inventory'});
  assert.equal(bag.root.dataset.page,'inventory');
  bag.click('[data-inventory-item=focus_lens]');
  assert.equal(bag.query('[data-inventory-item=focus_lens]').getAttribute('aria-pressed'),'true');
  assert.equal(bag.all('.equipment-art').length,0);
  assert.match(bag.text,/聚光镜/);
  assert.equal(bag.query('[data-action=equip-selected]').disabled,true);
  bag.shutdown();
});
