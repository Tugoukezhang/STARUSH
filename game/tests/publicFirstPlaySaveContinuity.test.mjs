import assert from 'node:assert/strict';
import test from 'node:test';
import {loadScenes,storageFixture} from './helpers/publicShellHarness.mjs';
const key='starush.public-profile';
const pages=['TitleScene','TourRouteScene','IdolRosterScene'];
const open=(e,type,data={})=>{const h=e.harness(e[type],{suppressDebugAutoStart:true,...data});h.scene.create();return h;};
function pending(clear=false){
 const storage=storageFixture(),write=storage.setItem,e=loadScenes({storage});
 if(clear)e.profile.selectPublicPerformer('sakura');
 storage.setItem=()=>{throw Error('quota');};
 if(clear)e.profile.recordPublicRun({runId:'save-continuity-fixture',performerId:'sakura',chapterId:'opening',victory:true});
 else e.profile.selectPublicPerformer('venus');
 return {e,storage,write};
}
test('pending first selection and failed clear stay visible and retryable on every public menu',()=>{
 for(const type of pages)for(const clear of [false,true]){
  const {e}=pending(clear),h=open(e,type);
  assert.match(h.query('.shell-save-status')?.textContent||'',/尚未保存/);
  assert.match(h.query('.shell-save-status').textContent,/刷新|关闭/);
  assert(h.query('[data-action=retry-save]'),'failure recovery must not be hidden in workshop');
  h.click('[data-action=retry-save]');assert.match(h.query('.shell-save-status').textContent,/仍未能保存/);
  assert.equal(e.profile.loadPublicProfile().hasPendingSave,true);assert.equal(h.starts.length,0);h.shutdown();
 }
});
test('explicit retry persists exactly once and removes the obsolete entry warning',()=>{
 for(const clear of [false,true]){
  const {e,storage,write}=pending(clear),h=open(e,'TitleScene',{selectionSaveFailed:true});
  storage.setItem=write;h.click('[data-action=retry-save]');
  assert.match(h.query('.shell-save-status').textContent,/已保存在本机/);
  assert.equal(h.query('[data-action=retry-save]'),null);assert.equal(h.query('.shell-save-notice'),null);
  const raw=storage.getItem(key),p=loadScenes({storage}).profile.loadPublicProfile();
  assert.equal(p.selectedId,clear?'sakura':'venus');assert.equal(p.clears,clear?1:0);assert.equal(p.attempts,clear?1:0);
  assert.equal(p.hasPendingSave,false);e.profile.retryPublicProfileSave();assert.equal(storage.getItem(key),raw);h.shutdown();
 }
});
test('retry from tour cannot resurrect an externally removed save',()=>{
 const {e,storage,write}=pending(true),h=open(e,'TourRouteScene');
 storage.removeItem(key);storage.setItem=write;h.click('[data-action=retry-save]');
 assert.equal(storage.getItem(key),null);assert.equal(e.profile.loadPublicProfile().clears,0);
 assert.equal(h.query('[data-action=retry-save]'),null);assert.match(h.query('.shell-save-status').textContent,/已被移除/);
 assert.equal(h.query('[data-chapter=neon]').disabled,true);h.shutdown();
});
test('corrupt and future-version data route to recovery instead of being overwritten by retry',()=>{
 for(const raw of ['{broken','{"version":99}']){
  const {e,storage,write}=pending(true),h=open(e,'TourRouteScene');storage.setItem=write;storage.setItem(key,raw);
  h.click('[data-action=retry-save]');assert.equal(storage.getItem(key),raw);
  assert.equal(h.query('[data-action=retry-save]'),null);assert(h.query('.shell-save-recovery'));
  assert.equal(Boolean(h.query('[data-action=recover-save]')),raw==='{broken');h.shutdown();
 }
});
test('clean first entry and a real saved profile do not show a false pending warning or no-op retry',()=>{
 for(const saved of [false,true])for(const type of pages){const e=loadScenes();if(saved)e.profile.selectPublicPerformer('sakura');
  const h=open(e,type,{selectionSaveFailed:saved});assert.equal(h.query('.shell-save-status'),null);
  assert.equal(h.query('[data-action=retry-save]'),null);assert.equal(h.query('.shell-save-notice'),null);h.shutdown();
 }
});
