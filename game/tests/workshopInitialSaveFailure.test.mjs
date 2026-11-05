import assert from 'node:assert/strict';
import {test} from 'node:test';
import {loadScenes,storageFixture} from './helpers/publicShellHarness.mjs';
const key='starush.public-profile';
const workshop=env=>{const p=env.harness(env.TitleScene,{suppressDebugAutoStart:true,openPreparation:true});p.scene.create();return p;};
test('empty first-visit workshop must not claim nonexistent records are saved',()=>{
 const env=loadScenes(),page=workshop(env);
 assert.doesNotMatch(page.query('.workshop-status').textContent,/保存在本机/);assert.match(page.query('.workshop-status').textContent,/尚无/);
 assert.equal(page.query('[data-action=retry-save]'),null,'no pending operation means no misleading no-op retry');
 assert.equal(env.storage.getItem(key),null,'view must remain read-only');page.shutdown();
});
test('first-session failed selection is pending even when attempts is zero',()=>{
 const storage=storageFixture(),set=storage.setItem,env=loadScenes({storage});storage.setItem=()=>{throw Error('quota');};
 const result=env.profile.selectPublicPerformer('venus');assert.equal(result.attempts,0);assert.equal(result.hasPendingSave,true);
 assert(!Object.keys(result).includes('hasPendingSave'));assert(!JSON.stringify(result).includes('hasPendingSave'));
 const page=workshop(env);assert.match(page.query('.workshop-status').textContent,/尚未保存/);assert.doesNotMatch(page.query('.workshop-status').textContent,/保存在本机/);
 assert.equal(page.query('[data-action=train]').disabled,true);assert(page.query('[data-action=retry-save]'));
 page.click('[data-action=retry-save]');assert.match(page.query('.workshop-status').textContent,/仍未能保存/);assert.doesNotMatch(page.query('.workshop-status').textContent,/已被移除/);assert.equal(storage.getItem(key),null);
 storage.setItem=set;page.click('[data-action=retry-save]');assert.match(page.query('.workshop-status').textContent,/已保存在本机/);assert.equal(page.query('[data-action=retry-save]'),null);
 const saved=JSON.parse(storage.getItem(key));assert.equal(saved.selectedId,'venus');assert.equal(saved.attempts,0);assert.equal(saved.clears,0);assert(!Object.hasOwn(saved,'hasPendingSave'));
 assert.equal(env.profile.loadPublicProfile().hasPendingSave,false);assert.equal(loadScenes({storage}).profile.loadPublicProfile().selectedId,'venus');page.shutdown();
});
test('existing pending run reward stays locked until real save succeeds exactly once',()=>{
 const storage=storageFixture(),set=storage.setItem,env=loadScenes({storage});env.profile.selectPublicPerformer('sakura');storage.setItem=()=>{throw Error('quota');};
 env.profile.recordPublicRun({runId:'real-contract-fixture',chapterId:'opening',performerId:'sakura',victory:true});const page=workshop(env);
 assert.equal(page.query('[data-action=train]').disabled,true);storage.setItem=set;page.click('[data-action=retry-save]');assert.equal(page.query('[data-action=train]').disabled,false);
 const raw=storage.getItem(key);env.profile.retryPublicProfileSave();assert.equal(storage.getItem(key),raw);assert.equal(env.profile.loadPublicProfile().clears,1);page.shutdown();
});
test('corrupt or incompatible raw uses the explicit recovery lane, not a generic retry',()=>{
 for(const raw of ['{broken','{"version":99}']){const storage=storageFixture();storage.setItem(key,raw);const env=loadScenes({storage}),page=workshop(env);
  assert.doesNotMatch(page.query('.workshop-status').textContent,/保存在本机/);assert.equal(page.query('[data-action=retry-save]'),null);assert.equal(storage.getItem(key),raw);page.shutdown();
 }
});
test('external removal cannot use the new zero-attempt retry to resurrect an old selection',()=>{
 const storage=storageFixture(),set=storage.setItem,env=loadScenes({storage});env.profile.selectPublicPerformer('sakura');storage.setItem=()=>{throw Error('quota');};env.profile.selectPublicPerformer('venus');
 const page=workshop(env);assert(page.query('[data-action=retry-save]'));storage.removeItem(key);storage.setItem=set;page.click('[data-action=retry-save]');
 assert.equal(storage.getItem(key),null);assert.equal(env.profile.loadPublicProfile().selectedId,'sakura');assert.equal(page.query('[data-action=retry-save]'),null);assert.match(page.query('.workshop-status').textContent,/已被移除/);page.shutdown();
});
