import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {PUBLIC_EQUIPMENT,createPublicPreparation,getOwnedEquipment,getPreparationResources,getPreparationSnapshot,isEquipmentCompatible} from '../src/utils/publicPreparation.mjs';
import {getPreparationCatalog} from '../src/utils/publicPreparationCatalog.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const api=await import('../src/utils/publicEquipmentInventory.mjs').catch(()=>({}));
function read(profile,id){assert.equal(typeof api.getPublicEquipmentInventory,'function','shared equipment read model missing');return api.getPublicEquipmentInventory(profile,id);}
const profile=()=>({version:1,clears:6,selectedId:'sakura',clearsByPerformer:{sakura:2,kai:2,enjo:2,venus:0,genya:0},campaign:{version:1,selectedChapterId:'opening',chapterClears:{opening:1,neon:1,encore:1},completed:true},preparation:createPublicPreparation()});
test('all six actual item definitions and original ordering have one derived ownership/compatibility/state model',()=>{
 const p=profile();for(const id of ['sakura','kai','enjo','venus','genya']){
  const m=read(p,id);assert.equal(m.performerId,id);assert.deepEqual(m.items.map(i=>i.id),PUBLIC_EQUIPMENT.map(i=>i.id));
  assert.deepEqual(m.preparation,getPreparationSnapshot(p,id));assert.deepEqual(m.resources,getPreparationResources(p));
  for(const row of m.items){assert.equal(row.owned,getOwnedEquipment(p).some(i=>i.id===row.id));assert.equal(row.compatible,isEquipmentCompatible(row.id,id));assert.equal(row.canEquip,row.owned&&row.compatible);assert.equal(row.state,row.owned?'owned':'locked');assert.equal(row.equipped,false);assert.equal(row.description,PUBLIC_EQUIPMENT.find(i=>i.id===row.id).description);assert(!Object.hasOwn(row,'quantity'),'do not invent equipment copy counts');}
  assert.deepEqual(m.compatibleItems.map(i=>i.id),m.items.filter(i=>i.compatible).map(i=>i.id));assert.equal(m.equippedItem,null);
 }
});
test('chapter and performer sources remain distinct; locked is not the same as incompatible',()=>{
 const p=profile();p.campaign.chapterClears={opening:1,neon:0,encore:0};p.clearsByPerformer.kai=0;
 const m=read(p,'sakura'),wide=m.items.find(i=>i.id==='wide_nozzle'),edge=m.items.find(i=>i.id==='return_edge'),lens=m.items.find(i=>i.id==='focus_lens');
 assert.deepEqual(wide.source,{kind:'chapter-first-clear',id:'opening'});assert.deepEqual(edge.source,{kind:'performer-first-clear',id:'kai'});
 assert(wide.owned&&wide.compatible&&wide.canEquip);assert(!edge.owned&&!edge.compatible&&!edge.canEquip);assert(!lens.owned&&lens.compatible&&!lens.canEquip);
});
test('actual per-member equipped identity remains separate from other owned previews and shared equipment ownership',()=>{
 const p=profile();p.preparation.equipmentByPerformer.sakura='wide_nozzle';p.preparation.equipmentByPerformer.kai='wide_nozzle';
 for(const id of ['sakura','kai']){const m=read(p,id);assert.equal(m.equippedItem.id,'wide_nozzle');assert.equal(m.items.filter(i=>i.equipped).length,1);assert.equal(m.equippedItem.state,'equipped');assert.equal(m.items.find(i=>i.id==='rhythm_sync').state,'owned');}
 assert.equal(read(p,'enjo').equippedItem,null);
});
test('results are immutable copied state; later profile mutation cannot rewrite an old projection',()=>{
 const p=profile(),raw=JSON.stringify(p),m=read(p,'sakura');assert.equal(JSON.stringify(p),raw);
 for(const v of [m,m.items,m.compatibleItems,m.resources,m.preparation,...m.items,...m.items.map(i=>i.source)])assert(Object.isFrozen(v));
 assert.throws(()=>m.items[0].state='equipped');assert.throws(()=>m.items[0].source.id='foreign');
 p.campaign.chapterClears.opening=0;assert.equal(m.items[0].owned,true);assert.equal(read(p,'sakura').items[0].owned,false);
});
test('invalid member/profile returns null and malformed preparation retains existing normalized fallback',()=>{
 assert.equal(read(null,'sakura'),null);assert.equal(read(profile(),'missing'),null);assert.equal(read(profile(),'toString'),null);
 const p=profile();p.preparation.equipmentByPerformer.sakura='return_edge';const m=read(p,'sakura');assert.deepEqual(m.preparation,getPreparationSnapshot(p,'sakura'));assert.equal(m.equippedItem,null);
});
test('preparation catalog retains its exact original effects and preview semantics through common item states',()=>{
 const p=profile();p.preparation.equipmentByPerformer.kai='return_edge';
 for(const id of ['sakura','kai','enjo','venus','genya']){const m=read(p,id),c=getPreparationCatalog(p,id);assert.deepEqual(c.equipment.map(i=>i.id),m.compatibleItems.map(i=>i.id));for(const item of c.equipment){const row=m.items.find(i=>i.id===item.id);assert.equal(item.owned,row.owned);assert.equal(item.equipped,row.equipped);}assert.deepEqual(c.resources,m.resources);assert.deepEqual(c.current.equipmentId,m.preparation.equipmentId);}
});
test('preparation catalog fails closed for invalid profile containers instead of dereferencing a missing inventory',()=>{
 for(const p of [[],false,'bad',null])assert.equal(getPreparationCatalog(p,'sakura'),null);
});
test('all three actual consumers import and call the same projection, not parallel ownership sets',()=>{
 for(const file of ['src/utils/publicPreparationCatalog.mjs','src/systems/MobileGameScreens.mjs','src/systems/PublicShellView.mjs']){
  const s=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');assert.match(s,/getPublicEquipmentInventory\(/,file+' must consume shared projection');
 }
});
test('real inventory and workshop views reflect shared states; preview does not change deployment or profile',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.seed(['opening','neon','encore']);
 const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'inventory'});h.scene.create();
 try{const model=e.loadRuntime('utils/publicEquipmentInventory.mjs');assert.equal(typeof model.getPublicEquipmentInventory,'function');
  const before=e.storage.getItem('starush.public-profile');
  const view=h.scene._publicShell;
  for(const id of ['sakura','kai','enjo']){
    view.showPage('roster');
    h.click('[data-action=actor-switch]');
    h.click('[data-member='+id+']');
    h.click('[data-nav=inventory]');
    const m=model.getPublicEquipmentInventory(e.profile.loadPublicProfile(),id);
    const context=h.query('.inv-context');
    assert.equal(context.dataset.performer,id);
    assert.equal(context.dataset.deployed,String(id==='sakura'));
    assert.match(h.query('.inv-context-slot').textContent,new RegExp(m.equippedItem?.name||'空'));
    for(const row of m.items){
      const button=h.query('[data-inventory-item='+row.id+']');
      assert.equal(button.dataset.state,!row.owned?'locked':!row.compatible?'incompatible':row.equipped?'equipped':'owned');
      assert.equal(button.dataset.owned,String(row.owned));
      assert.equal(button.dataset.equipped,String(row.equipped));
    }
    h.click('[data-inventory-item=travelling_nozzle]');
    assert.match(h.query('.inv-detail-role').textContent,/战术女武神专用/);
    assert.match(h.query('.inv-source-unlock').textContent,/战术女武神首次通关/);
    assert.equal(h.query('[data-action=equip-selected]').disabled,id!=='sakura');
    h.click('[data-action=sheet-close]');
    view.showPage('workshop');h.click('[data-action=workshop-sheet-equipment]');
    for(const row of m.compatibleItems){
      const option=h.query('.ui-sheet').querySelector('[data-equipment='+row.id+']');
      assert.equal(option.dataset.state,!row.owned?'locked':row.equipped?'equipped':'available');
    }
    h.click('[data-action=sheet-close]');
  }
  assert.equal(e.storage.getItem('starush.public-profile'),before);
 }finally{h.shutdown();}
});
