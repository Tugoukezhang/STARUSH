import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function setup(earnedEquipment){
  const s=loadScenes();s.loadRuntime('utils/userCast.mjs').configureUserCast(true);s.seed(['opening']);
  const h=s.harness(s.TitleScene,{suppressDebugAutoStart:true,openPage:'inventory',earnedEquipment});
  h.scene.create();return {s,h,view:h.scene._publicShell};
}
test('reward opens exact item once without deploying or writing',()=>{
  const {s,h,view}=setup({memberId:'kai',equipmentId:'wide_nozzle'});
  const before=JSON.stringify([...s.storage.values]);
  assert.equal(h.query('dialog')?.querySelector('.ui-item-detail')?.dataset.item,'wide_nozzle');
  assert.equal(s.profile.loadPublicProfile().selectedId,'sakura');
  assert.match(h.query('.inv-detail-target').textContent,/翡翠风歌/);
  h.click('[data-action=sheet-close]');view.render();
  assert.equal(h.all('dialog').length,0);
  view.showPage('preflight');view.showPage('inventory');
  assert.equal(h.all('dialog').length,0);
  assert.equal(JSON.stringify([...s.storage.values]),before);h.shutdown();
});
test('equip and unequip retain detail and target, with a current persisted state',()=>{
  const {s,h}=setup({memberId:'kai',equipmentId:'wide_nozzle'});
  h.click('[data-action=equip-selected]');
  assert.equal(h.query('dialog')?.open,true);
  assert.equal(h.query('.ui-item-detail').dataset.state,'equipped');
  assert.match(h.query('.inv-detail-feedback').textContent,/已保存/);
  assert.equal(s.profile.loadPublicProfile().preparation.equipmentByPerformer.kai,'wide_nozzle');
  assert.equal(s.profile.loadPublicProfile().selectedId,'sakura');
  h.click('[data-action=equip-selected]');
  assert.equal(h.query('.ui-item-detail').dataset.state,'owned');
  assert.equal(s.profile.loadPublicProfile().preparation.equipmentByPerformer.kai,null);
  h.click('[data-action=sheet-close]');
  assert.equal(s.document.activeElement,h.query('[data-inventory-item=wide_nozzle]'));h.shutdown();
});
test('save refusal keeps detail truthful, then explicit retry succeeds',()=>{
  const {s,h}=setup({memberId:'sakura',equipmentId:'wide_nozzle'});
  const setItem=s.storage.setItem;
  s.storage.setItem=function(k,v){if(k==='starush.public-profile')throw new Error('simulated storage full');return setItem.call(this,k,v);};
  h.click('[data-action=equip-selected]');
  assert.equal(h.query('dialog')?.open,true);
  assert.notEqual(h.query('.ui-item-detail').dataset.state,'equipped');
  assert.doesNotMatch(h.query('.inv-detail-feedback').textContent,/已保存/);
  assert.equal(s.profile.loadPublicProfile().preparation.equipmentByPerformer.sakura,null);
  s.storage.setItem=setItem;
  h.click('[data-action=equip-selected]');
  assert.equal(h.query('.ui-item-detail').dataset.state,'equipped');h.shutdown();
});
