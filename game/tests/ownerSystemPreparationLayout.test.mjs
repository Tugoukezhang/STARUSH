import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';

function setup(page='inventory',earned=true,current=true){
 const e=loadScenes();if(current)e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 if(earned)e.seed(['opening','neon','encore']);
 const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:page});h.scene.create();
 return {e,h,v:h.scene._publicShell};
}
const raw=e=>e.storage.getItem('starush.public-profile');

test('compact preparation scope is limited to the current three owners and three pages',()=>{
 const {h,v}=setup();for(const page of ['inventory','workshop','growth']){v.showPage(page);assert.equal(h.root.dataset.systemPreparation,'true');}
 for(const page of ['desk','roster','tour','preflight','records','playhub','library']){v.showPage(page);assert.equal(h.root.dataset.systemPreparation,'false');}
 h.shutdown();const legacy=setup('inventory',false,false);assert.equal(legacy.h.root.dataset.systemPreparation,'false');legacy.h.shutdown();
});

test('inventory presents a collapsible item chooser and synchronized full-width live detail in one workbench',()=>{
 const {e,h}=setup(),before=raw(e),workbench=h.query('.inventory-workbench');assert(workbench);
 assert.equal(h.query('.inventory-grid').parentNode,h.query('.inventory-chooser'));assert.equal(h.query('.inventory-chooser').parentNode,h.query('.inventory-detail'));assert.equal(h.query('.inventory-detail').parentNode,workbench);
 assert.equal(h.query('.inventory-detail').getAttribute('aria-live'),'polite');
 assert.equal(h.query('.inventory-grid').querySelectorAll('button').length,6);
 for(const item of e.loadRuntime('utils/publicPreparation.mjs').PUBLIC_EQUIPMENT){
  h.click('[data-inventory-item='+item.id+']');assert.equal(h.query('.inventory-detail').dataset.item,item.id);
  assert.match(h.query('.inventory-detail').textContent,new RegExp(item.name));
  const owned=e.loadRuntime('utils/publicPreparation.mjs').getOwnedEquipment(e.profile.loadPublicProfile()).some(row=>row.id===item.id);
  assert.match(h.query('.inventory-status').textContent,new RegExp(owned?item.name:item.unlock));assert.equal(raw(e),before);
 }
 h.shutdown();
});

test('inventory exposes structured projected effects, not an applied build, and keeps incompatible gear blocked',()=>{
 const {e,h}=setup();h.click('[data-inventory-item=focus_lens]');
 assert(h.query('.inventory-effects'));const rows=h.query('.inventory-effects').querySelectorAll('div');assert.equal(rows.length,3);
 assert.match(h.query('.inventory-effects').textContent,/1.15 倍/);
 h.click('[data-inventory-item=return_edge]');assert.equal(h.query('[data-action=equip-selected]').disabled,true);
 assert.match(h.query('.inventory-detail').textContent,/机甲剑士/);h.shutdown();
});

test('training action precedes the secondary notes explanation and catalog route',()=>{
 const {e,h}=setup('workshop'),main=h.query('.shell-content');
 const training=h.query('[data-training-primary]');assert(training);
 assert(main.children.indexOf(training)<main.children.indexOf(h.query('.workshop-wallet')));
 assert(main.children.indexOf(training)<main.children.indexOf(h.query('[data-action=training-catalog]')));
 assert.match(training.textContent,/3 练习笔记/);const saved=raw(e);h.click('[data-member=kai]');assert.equal(raw(e),saved);h.shutdown();
});

test('growth compares the current and planned effects before the gear choices and applies only after confirmation',()=>{
 const {e,h,v}=setup('growth'),main=h.query('.shell-content'),preview=h.query('.growth-preview'),gear=h.query('.growth-equipment-pool');
 assert(gear);assert(main.children.indexOf(preview)<main.children.indexOf(gear));
 assert(h.query('.growth-application'));const before=raw(e);
 h.click('[data-growth-rank=2]');h.click('[data-growth-equipment=focus_lens]');
 assert.match(h.query('.growth-effects').textContent,/26.5%/);assert.equal(raw(e),before);
 h.click('[data-action=growth-apply]');h.click('[data-action=growth-cancel]');assert.equal(raw(e),before);
 h.click('[data-action=growth-apply]');h.click('[data-action=growth-confirm]');
 const saved=e.profile.loadPublicProfile();assert.equal(saved.preparation.trainingLevels.sakura,2);assert.equal(saved.preparation.equipmentByPerformer.sakura,'focus_lens');
 assert.equal(v.page,'growth');h.shutdown();
});

for(const id of ['sakura','kai','enjo'])test('reordered preparation pages retain real training and one-slot equipment for '+id,()=>{
 const {e,h,v}=setup('workshop');h.click('[data-member='+id+']');h.click('[data-action=train]');
 assert.equal(e.profile.loadPublicProfile().preparation.trainingLevels[id],2);
 v.showPage('inventory');h.click('[data-inventory-item=wide_nozzle]');h.click('[data-action=equip-selected]');
 assert.equal(e.profile.loadPublicProfile().preparation.equipmentByPerformer[id],'wide_nozzle');
 v.showPage('growth');assert.equal(h.query('[data-growth-rank="2"]').getAttribute('aria-pressed'),'true');
 const saved=plain(e.profile.loadPublicProfile());h.click('[data-growth-equipment=none]');
 assert.deepEqual(plain(e.profile.loadPublicProfile()),saved);h.shutdown();
});

test('new inventory detail cannot bypass the original unsaved or quota gates',()=>{
 const fresh=setup('inventory',false);assert(fresh.h.query('[data-action=equip-selected]').disabled);fresh.h.shutdown();
 const {e,h}=setup(),before=raw(e);e.storage.setItem=()=>{throw Error('controlled quota');};
 h.click('[data-action=equip-selected]');assert.equal(raw(e),before);assert.match(h.query('.inventory-status').textContent,/保存失败/);h.shutdown();
});
