import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function setup(page='growth',earned=true) {
  const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  if(earned)e.seed(['opening','neon','encore']);
  const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:page});h.scene.create();
  return {e,h,v:h.scene._publicShell};
}
const raw=e=>e.storage.getItem('starush.public-profile');

test('returning from training rebases a stale same-member growth draft without a save',()=>{
  const {e,h,v}=setup();h.click('[data-growth-rank=3]');h.click('[data-action=growth-apply]');
  h.click('[data-action=growth-training]');h.click('[data-action=train]');
  const saved=raw(e);h.click('[data-action=back]');
  assert.equal(v.page,'growth');assert.equal(v.growthRank,2);
  assert.equal(h.query('[data-action=growth-confirm]'),null);
  assert.equal(h.query('[data-growth-rank="2"]').getAttribute('aria-pressed'),'true');
  assert.match(h.query('.workshop-status').textContent,/配置已更新/);
  assert.equal(raw(e),saved);h.shutdown();
});

test('returning from backpack shows the actual newly equipped gear, not a stale preview',()=>{
  const {e,h,v}=setup();h.click('[data-growth-equipment=wide_nozzle]');h.click('[data-action=growth-inventory]');
  h.click('[data-action=equip-selected]');const saved=raw(e);h.click('[data-action=back]');
  assert.equal(v.growthEquipmentId,'wide_nozzle');assert.equal(v.growthExpected.equipmentId,'wide_nozzle');
  assert.equal(h.query('[data-growth-equipment=wide_nozzle]').getAttribute('aria-pressed'),'true');
  assert.equal(h.query('[data-action=growth-apply]').disabled,true);assert.equal(raw(e),saved);h.shutdown();
});

test('another member training does not discard an unchanged-member draft or write on return',()=>{
  const {e,h,v}=setup();h.click('[data-growth-rank=3]');
  e.profile.trainPublicPerformer('kai',1);const saved=raw(e);v.render();
  assert.equal(v.growthRank,3);assert.equal(v.growthExpected.trainingLevel,1);
  assert.equal(raw(e),saved);h.shutdown();
});

for(const [action,page]of [['hub-training','workshop'],['hub-inventory','inventory'],['hub-growth','growth']]){
  test('hub current-member card and destination agree: '+page,()=>{
    const {e,h,v}=setup('playhub');e.profile.trainPublicPerformer('sakura',1);v.render();
    h.click('[data-action=hub-growth]');h.click('[data-growth-member=kai]');h.click('[data-action=back]');
    assert.equal(v.page,'playhub');assert.match(h.query('[data-action=hub-training]').textContent,/阶位 2/);
    const saved=raw(e);h.click('[data-action='+action+']');assert.equal(v.page,page);
    assert.equal(v.selection.memberId,'sakura');assert.equal(raw(e),saved);h.shutdown();
  });
}

test('fresh unsaved growth configuration is not labeled saved',()=>{
  const {h}=setup('growth',false);assert.doesNotMatch(h.query('.workshop-status').textContent,/已保存/);
  assert.match(h.query('.workshop-status').textContent,/尚未保存/);h.shutdown();
});

test('external same-member configuration change cancels the pending draft, not the save',()=>{
  const {e,h,v}=setup();h.click('[data-growth-rank=3]');h.click('[data-action=growth-apply]');
  e.profile.equipPublicPerformer('sakura','wide_nozzle');const saved=raw(e);
  e.window.dispatchEvent({type:'storage',key:'starush.public-profile'});
  assert.equal(v.growthConfirmation,null);assert.equal(v.growthEquipmentId,'wide_nozzle');
  assert.equal(v.growthExpected.equipmentId,'wide_nozzle');assert.equal(raw(e),saved);h.shutdown();
});

test('failed training deployment confirmation stays put and reports the save failure',()=>{
  const {e,h,v}=setup('workshop');h.click('[data-member=kai]');const saved=raw(e),set=e.storage.setItem;
  e.storage.setItem=()=>{throw Error('quota');};h.click('[data-action=confirm-preparation]');
  assert.equal(v.page,'workshop');assert.equal(h.starts.length,0);assert.equal(raw(e),saved);
  assert.match(h.query('.workshop-status').textContent,/未能保存/);
  e.storage.setItem=set;h.click('[data-action=retry-save]');h.click('[data-action=confirm-preparation]');
  assert.equal(JSON.parse(raw(e)).selectedId,'kai');
  assert.equal(e.profile.loadPublicProfile().selectedId,'kai');assert.equal(h.starts.length,1);h.shutdown();
});

test('clearing a save invalidates old growth confirmation without claiming it was saved',()=>{
  const {e,h,v}=setup();e.profile.trainPublicPerformer('sakura',1);v.render();
  h.click('[data-growth-rank=3]');h.click('[data-action=growth-apply]');
  e.storage.removeItem('starush.public-profile');e.window.dispatchEvent({type:'storage',key:null});
  assert.equal(v.growthConfirmation,null);assert.equal(v.growthRank,1);assert.equal(raw(e),null);
  assert.match(h.query('.workshop-status').textContent,/尚未保存/);
  assert.doesNotMatch(h.query('.workshop-status').textContent,/已保存/);h.shutdown();
});

for(const [kind,selector]of [['rank','[data-growth-rank=3]'],['equipment','[data-growth-equipment=wide_nozzle]'],['member','[data-growth-member=kai]']]){
 test('a new '+kind+' preview clears the previous synchronization notice',()=>{
  const {e,h,v}=setup();e.profile.trainPublicPerformer('sakura',1);v.render();
  assert.match(h.query('.workshop-status').textContent,/配置已更新/);const saved=raw(e);
  h.click(selector);assert.doesNotMatch(h.query('.workshop-status').textContent,/配置已更新/);
  if(kind!=='member')assert.match(h.query('.workshop-status').textContent,/尚未应用/);
  assert.equal(raw(e),saved);h.shutdown();
 });
}

test('cleared save cancels a draft even when default rank and gear match the former saved values',()=>{
 const {e,h,v}=setup();h.click('[data-growth-rank=3]');h.click('[data-action=growth-apply]');
 e.storage.removeItem('starush.public-profile');e.window.dispatchEvent({type:'storage',key:null});
 assert.equal(v.growthConfirmation,null);assert.equal(v.growthRank,1);assert.equal(raw(e),null);h.shutdown();
});

for(const reason of ['quota','authority'])test('failed deployment '+reason+' preserves the existing growth draft and confirmation',()=>{
 const {e,h,v}=setup();h.click('[data-growth-rank=3]');h.click('[data-action=growth-apply]');
 const saved=raw(e),confirmation=v.growthConfirmation;
 if(reason==='quota')e.storage.setItem=()=>{throw Error('quota');};else e.profile.configurePublicProfileWriteAuthority(()=>false);
 h.click('[data-action=prepared-preflight]');assert.equal(v.page,'growth');assert.equal(raw(e),saved);
 assert.equal(v.growthRank,3);assert.equal(v.growthConfirmation,confirmation);
 assert.match(h.query('.workshop-status').textContent,/未能保存/);h.shutdown();
});
