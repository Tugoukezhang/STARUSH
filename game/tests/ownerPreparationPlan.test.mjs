import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';

function fixture(chapters=['opening','neon','encore']) {
  const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.seed(chapters);
  return {...e,prep:e.loadRuntime('utils/publicPreparation.mjs')};
}
const raw=e=>e.storage.getItem('starush.public-profile');
const snapshot=(e,id='kai')=>e.prep.getPreparationSnapshot(e.profile.loadPublicProfile(),id);

test('whole plan commits rank and gear once, preserving deployment and other members',()=>{
  const e=fixture();assert.equal(typeof e.profile.applyPublicPreparationPlan,'function');
  const expected=snapshot(e),before=e.profile.loadPublicProfile();let writes=0;
  const set=e.storage.setItem;e.storage.setItem=(...args)=>{writes++;return set(...args);};
  const r=e.profile.applyPublicPreparationPlan(expected,{trainingLevel:3,equipmentId:'rhythm_sync'});
  assert.equal(r.preparationStatus,'planned');assert.equal(writes,1);
  assert.deepEqual(plain(snapshot(e)),{...plain(expected),trainingLevel:3,equipmentId:'rhythm_sync'});
  assert.equal(r.selectedId,before.selectedId);assert.deepEqual(plain(snapshot(e,'sakura')),plain(e.prep.getPreparationSnapshot(before,'sakura')));
  assert.equal(e.prep.getPreparationResources(r).spent,9);
  assert.equal(e.profile.applyPublicPreparationPlan(expected,{trainingLevel:3,equipmentId:'rhythm_sync'}).preparationStatus,'stale');
  assert.equal(writes,1);
});

test('whole plan rejects locked gear, downgrade, invalid and unaffordable targets without partial training',()=>{
  const e=fixture(['opening']);assert.equal(typeof e.profile.applyPublicPreparationPlan,'function');
  const expected=snapshot(e),before=raw(e);
  for(const [target,status]of [[{trainingLevel:2,equipmentId:'focus_lens'},'locked'],
    [{trainingLevel:3,equipmentId:'wide_nozzle'},'insufficient'],[{trainingLevel:4,equipmentId:null},'invalid'],
    [{trainingLevel:1,equipmentId:null},'unchanged'],[{trainingLevel:NaN,equipmentId:null},'invalid']]){
    assert.equal(e.profile.applyPublicPreparationPlan(expected,target).preparationStatus,status);assert.equal(raw(e),before);
  }
  e.profile.trainPublicPerformer('kai',1);
  const trained=raw(e);assert.equal(e.profile.applyPublicPreparationPlan(snapshot(e),{trainingLevel:1,equipmentId:'wide_nozzle'}).preparationStatus,'downgrade');
  assert.equal(raw(e),trained);
  assert.equal(e.profile.applyPublicPreparationPlan({...snapshot(e),equipmentId:'wide_nozzle'},{trainingLevel:2,equipmentId:null}).preparationStatus,'stale');
  assert.equal(e.profile.applyPublicPreparationPlan(null,{}).preparationStatus,'invalid');
});

test('failed and denied writes never grant or queue a whole plan',()=>{
  const e=fixture();assert.equal(typeof e.profile.applyPublicPreparationPlan,'function');
  const expected=snapshot(e),before=raw(e),set=e.storage.setItem;
  e.storage.setItem=()=>{throw Error('quota');};
  assert.equal(e.profile.applyPublicPreparationPlan(expected,{trainingLevel:3,equipmentId:'focus_lens'}).preparationStatus,'storage-error');
  assert.equal(raw(e),before);assert.equal(snapshot(e).trainingLevel,1);
  e.storage.setItem=set;e.profile.retryPublicProfileSave();assert.equal(raw(e),before);
  e.profile.configurePublicProfileWriteAuthority(()=>false);
  assert.equal(e.profile.applyPublicPreparationPlan(expected,{trainingLevel:3,equipmentId:'focus_lens'}).preparationStatus,'save-required');
  assert.equal(raw(e),before);
});

test('legacy spend is readable, never refunded on load, and explicit recovery preserves history and equipment',()=>{
  const e=fixture();assert.equal(typeof e.prep.getRetiredTrainingRecovery,'function');
  e.profile.trainPublicPerformer('venus',1);e.profile.trainPublicPerformer('venus',2);e.profile.trainPublicPerformer('genya',1);
  e.profile.equipPublicPerformer('venus','wide_nozzle');
  const before=raw(e),p=e.profile.loadPublicProfile(),offer=e.prep.getRetiredTrainingRecovery(p);
  assert.equal(offer.notes,12);assert.equal(raw(e),before);
  const r=e.profile.recoverRetiredPublicTraining(offer.trainingLevels);
  assert.equal(r.preparationStatus,'recovered');assert.equal(e.prep.getPreparationResources(r).balance-e.prep.getPreparationResources(p).balance,12);
  assert.equal(r.preparation.trainingLevels.venus,1);assert.equal(r.preparation.trainingLevels.genya,1);
  assert.equal(r.preparation.equipmentByPerformer.venus,'wide_nozzle');
  for(const key of ['campaign','clears','attempts','performance','clearsByPerformer','selectedId'])assert.deepEqual(r[key]===undefined?undefined:plain(r[key]),p[key]===undefined?undefined:plain(p[key]));
  const saved=raw(e);assert.equal(e.profile.recoverRetiredPublicTraining(offer.trainingLevels).preparationStatus,'stale');
  assert.equal(e.profile.recoverRetiredPublicTraining({venus:1,genya:1}).preparationStatus,'unchanged');assert.equal(raw(e),saved);
});

test('recovery failures, corrupt save and external deletion never resurrect or charge a profile',()=>{
  const e=fixture();assert.equal(typeof e.profile.recoverRetiredPublicTraining,'function');
  e.profile.trainPublicPerformer('venus',1);const expected={venus:2,genya:1},before=raw(e),set=e.storage.setItem;
  e.storage.setItem=()=>{throw Error('quota');};assert.equal(e.profile.recoverRetiredPublicTraining(expected).preparationStatus,'storage-error');
  assert.equal(raw(e),before);assert.equal(e.profile.loadPublicProfile().preparation.trainingLevels.venus,2);
  e.storage.setItem=set;e.profile.retryPublicProfileSave();assert.equal(raw(e),before);
  assert.equal(e.profile.recoverRetiredPublicTraining({venus:2,genya:1,sakura:3}).preparationStatus,'invalid');
  e.storage.setItem('starush.public-profile','{broken');
  assert.equal(e.profile.recoverRetiredPublicTraining(expected).preparationStatus,'save-required');assert.equal(raw(e),'{broken');
  e.storage.removeItem('starush.public-profile');
  assert.equal(e.profile.applyPublicPreparationPlan(snapshot(e),{trainingLevel:2,equipmentId:null}).preparationStatus,'save-required');assert.equal(raw(e),null);
});

test('growth previews, confirmation, atomic apply and explicit deployment handoff are distinct',()=>{
  const e=fixture(),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'growth'});h.scene.create();
  h.click('[data-growth-member="kai"]');const before=raw(e);
  h.click('[data-growth-rank="3"]');h.click('[data-growth-equipment="rhythm_sync"]');assert.equal(raw(e),before);
  assert.ok(h.query('[data-action="growth-apply"]'),'Growth needs an executable plan command');
  h.click('[data-action="growth-apply"]');assert.equal(raw(e),before);assert.match(h.text,/9 练习笔记/);
  h.click('[data-action="growth-confirm"]');assert.equal(snapshot(e).trainingLevel,3);assert.equal(snapshot(e).equipmentId,'rhythm_sync');
  assert.equal(e.profile.loadPublicProfile().selectedId,'sakura');
  h.click('[data-action="prepared-preflight"]');assert.equal(e.profile.loadPublicProfile().selectedId,'kai');
  assert.equal(h.scene._publicShell.page,'preflight');assert.match(h.text,/节拍同步器/);h.shutdown();
});

test('growth stale confirmation and quota failure stay truthful and retryable',()=>{
  const e=fixture(),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'growth'});h.scene.create();
  h.click('[data-growth-rank="3"]');assert.ok(h.query('[data-action="growth-apply"]'));
  h.click('[data-action="growth-apply"]');e.profile.equipPublicPerformer('sakura','wide_nozzle');
  h.click('[data-action="growth-confirm"]');assert.equal(snapshot(e,'sakura').trainingLevel,1);assert.match(h.text,/已更新/);
  h.click('[data-growth-rank="3"]');h.click('[data-action="growth-apply"]');const before=raw(e),set=e.storage.setItem;
  e.storage.setItem=()=>{throw Error('quota');};h.click('[data-action="growth-confirm"]');assert.equal(raw(e),before);assert.match(h.text,/保存失败/);
  e.storage.setItem=set;h.click('[data-action="growth-confirm"]');assert.equal(snapshot(e,'sakura').trainingLevel,3);h.shutdown();
});

test('legacy recovery is a two-step opt-in and does not appear for modern zero-spend saves',()=>{
  const e=fixture(),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'workshop'});h.scene.create();
  assert.equal(h.query('[data-action="recover-retired-training"]'),null);e.profile.trainPublicPerformer('venus',1);h.scene._publicShell.render();
  const before=raw(e);assert.ok(h.query('[data-action="recover-retired-training"]'));
  h.click('[data-action="recover-retired-training"]');assert.equal(raw(e),before);
  h.click('[data-action="confirm-retired-recovery"]');assert.equal(e.prep.getRetiredTrainingRecovery(e.profile.loadPublicProfile()).notes,0);
  assert.equal(h.query('[data-action="recover-retired-training"]'),null);h.shutdown();
});

test('inventory-origin plan captures expected state and denied member handoff cannot advance',()=>{
  const e=fixture(),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'inventory',earnedEquipment:{memberId:'kai',equipmentId:'wide_nozzle'}});h.scene.create();
  // Growth/compare is a per-item detail command, not a top-level inventory control.
  assert.equal(h.query('[data-action="inventory-catalog"]'),null);h.click('[data-inventory-item="wide_nozzle"]');
  const sheet=h.query('dialog.ui-sheet');assert(sheet?.open);assert.equal(sheet.querySelector('.ui-item-detail').dataset.item,'wide_nozzle');
  const catalog=sheet.querySelector('[data-action="inventory-catalog"]');assert.equal(catalog.disabled,false);
  catalog.click();assert.equal(h.scene._publicShell.page,'growth');h.click('[data-growth-rank="2"]');
  h.click('[data-action="growth-apply"]');h.click('[data-action="growth-confirm"]');
  assert.equal(snapshot(e).trainingLevel,2);assert.equal(snapshot(e).equipmentId,'wide_nozzle');
  assert.equal(e.profile.loadPublicProfile().selectedId,'sakura');
  e.profile.configurePublicProfileWriteAuthority(()=>false);
  h.click('[data-action="prepared-preflight"]');assert.equal(h.scene._publicShell.page,'growth');
  assert.match(h.text,/未能保存/);h.shutdown();
});

test('growth fixed footer keeps explicit apply and one deployment command; auxiliary navigation stays in content',()=>{
  const e=fixture(),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'growth'});h.scene.create();
  const footer=h.query('.shell-selection-footer');
  assert.equal(footer.querySelectorAll('[data-action="prepared-preflight"]').length,1);
  assert.equal(footer.querySelectorAll('[data-action="growth-apply"]').length,1);
  assert(footer.querySelector('[data-action="growth-apply"]').disabled);
  assert(h.query('.shell-content').contains(h.query('[data-action="growth-training"]')));
  assert(h.query('.shell-content').contains(h.query('[data-action="growth-inventory"]')));h.shutdown();
});

test('new preparation commands reuse existing image-backed command surfaces',()=>{
  const e=fixture(),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'growth'});h.scene.create();
  assert.equal(h.query('[data-action="growth-apply"]').closest('.preflight-links')?.style.gridTemplateColumns,'minmax(0,1fr)');
  e.profile.trainPublicPerformer('venus',1);h.scene._publicShell.render();
  assert.equal(h.query('[data-action="recover-retired-training"]').closest('.preflight-links')?.style.gridTemplateColumns,'minmax(0,1fr)');h.shutdown();
});
