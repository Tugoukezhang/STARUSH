import assert from 'node:assert/strict';
import test from 'node:test';
import { loadScenes, storageFixture } from './helpers/publicShellHarness.mjs';
import { getChapterStory } from '../src/utils/publicStory.mjs';
import { getPublicChapter, resolveChapterPaintHit } from '../src/utils/publicCampaign.mjs';

const key='starush.public-profile';
function failedRun() {
  const storage=storageFixture(), env=loadScenes({storage});
  env.profile.selectPublicPerformer('sakura');
  const set=storage.setItem;
  storage.setItem=()=>{throw Error('temporary quota failure');};
  env.profile.recordPublicRun({runId:'pending-clear',chapterId:'opening',performerId:'sakura',victory:true});
  return {env,storage,restore:()=>{storage.setItem=set;}};
}

test('workshop retries the same unsaved reward without unrelated selection or duplicate grants',()=>{
  const {env,storage,restore}=failedRun();
  const page=env.harness(env.TitleScene,{suppressDebugAutoStart:true,openPreparation:true});page.scene.create();
  assert.equal(page.query('[data-action=train]').disabled,true);
  const retry=page.query('[data-action=retry-save]');assert.ok(retry,'a failed save needs a reachable retry');
  retry.click();assert.equal(page.query('[data-action=train]').disabled,true);
  assert.match(page.query('.workshop-status').textContent,/未能保存/);
  restore();page.query('[data-action=retry-save]').click();
  assert.equal(page.query('[data-action=train]').disabled,false);
  assert.equal(page.query('[data-action=retry-save]'),null);
  assert.equal(JSON.parse(storage.getItem(key)).clears,1);
  const snapshot=storage.getItem(key);env.profile.retryPublicProfileSave();
  assert.equal(storage.getItem(key),snapshot);
  assert.equal(loadScenes({storage}).profile.loadPublicProfile().clears,1);
  page.shutdown();
});

test('explicit retry merges a newer save, rejects incompatible data, and respects external reset',()=>{
  for(const variant of ['merge','version','reset']){
    const {env,storage,restore}=failedRun();restore();
    if(variant==='merge'){
      const other=loadScenes({storage});other.profile.recordPublicRun({runId:'other-clear',chapterId:'opening',performerId:'kai',victory:true});
      const p=env.profile.retryPublicProfileSave();assert.equal(p.persisted,true);assert.equal(p.clears,2);
      assert.equal(new Set(p.recordedRunIds).size,2);
    }else if(variant==='version'){
      storage.setItem(key,'{"version":99}');const p=env.profile.retryPublicProfileSave();
      assert.equal(p.persisted,false);assert.equal(storage.getItem(key),'{"version":99}');
    }else{
      storage.removeItem(key);const p=env.profile.retryPublicProfileSave();
      assert.equal(p.clears,0);assert.equal(storage.getItem(key),null,'retry cannot resurrect a deleted save');
    }
  }
});

test('rejected next-chapter navigation leaves result controls usable and explains the stale gate',()=>{
  for(const fallback of ['retry','campaign-tour']){
    const env=loadScenes();env.profile.recordPublicRun({runId:'earned',chapterId:'opening',performerId:'sakura',victory:true});
    const {BattleScene}=env.loadRuntime('scenes/BattleScene.js');
    const {BattleSurfaceView,getPublicResultSurfaceModel}=env.loadRuntime('systems/BattleSurfaceView.mjs');
    const {getPublicCampaignResult}=env.loadRuntime('utils/publicCampaignResult.mjs');
    const run={runId:'earned',chapterId:'opening',performerId:'sakura',victory:true,persisted:true,recorded:true,choices:[]};
    const starts=[],scene={battleData:{stageId:1,campaignChapterId:'opening',performerId:'sakura'},_publicRunResult:run,
      input:{enabled:true,keyboard:{enabled:true}},events:{once(){},off(){}},_releaseBattleRuntimeObjects(){},
      scene:{start:(...a)=>starts.push(a),restart:(...a)=>starts.push(a)}};
    const view=new BattleSurfaceView(scene,{mode:'result',model:getPublicResultSurfaceModel(getPublicCampaignResult({},run),run),
      onAction:action=>BattleScene.prototype._handleBattleResultAction.call(scene,action)},env.document);
    env.storage.removeItem(key);view.root.querySelector('[data-result-action=campaign-next]').click();
    assert.equal(starts.length,0);assert.equal(view.busy,false,'rejected navigation must release the button lock');
    assert.match(view.root.querySelector('[role=status]').textContent,/存档.*变化/);
    assert.equal(view.root.querySelector('[data-result-action=campaign-next]').disabled,true);
    view.root.querySelector(`[data-result-action=${fallback}]`).click();assert.equal(starts.length,1);
    view.destroy();
  }
});

test('all first-entry character stories agree with performer-pigment restoration',()=>{
  for(const chapter of ['opening','neon','encore'])for(const member of ['sakura','kai','venus','genya','enjo']){
    const text=getChapterStory(chapter,'intro',member).lines.map(l=>l.text).join('\n');
    assert.doesNotMatch(text,/单一的颜色无法|每一盏灯要的颜色|两个声部依次接力|颜色换了/);
    for(const def of getPublicChapter(chapter).devices.filter(d=>d.required)){
      let d={...def,paint:0,sequenceIndex:0,complete:false};
      for(let n=0;n<3&&!d.complete;n++)d={...d,...resolveChapterPaintHit(d,d.paintMax,'pink')};
      assert.equal(d.complete,true);
    }
  }
});
