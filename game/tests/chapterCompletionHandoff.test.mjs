import test from 'node:test';import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
function accepted(member='sakura',chapter='opening'){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.profile.selectPublicPerformer(member);
 const {PublicStage1PerformerRun}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
 if(chapter!=='opening')e.profile.recordPublicRun({runId:'previous',performerId:member,chapterId:'opening',victory:true,choices:[],durationMs:1000});
 const scene={_userCastPresentation:true,battleData:{stageId:1,performerId:member,campaignChapterId:chapter},time:{now:0},battleRecord:{playerHitCount:1}};
 const owner=new PublicStage1PerformerRun(scene);scene.time.now=10000;return{e,owner,run:owner.finish(true)};
}
function resultScene(e,run){const {BattleScene}=e.loadRuntime('scenes/BattleScene.js'),starts=[],restarts=[],releases=[];
 const s={_userCastPresentation:true,_publicRunResult:run,battleData:{stageId:1,performerId:run.performerId,campaignChapterId:run.chapterId},
 _publicBattleDialog:{rejectNextChapter(o){s.rejected=o;}},_releaseBattleRuntimeObjects:x=>releases.push(x),scene:{start:(...x)=>starts.push(x),restart:x=>restarts.push(x)}};
 return{s,starts,restarts,releases,act:()=>BattleScene.prototype._handleBattleResultAction.call(s,'campaign-next')};
}
test('canonical next-station identity and saved availability are present only for a recorded victory with a next chapter',()=>{
 const {e,owner,run}=accepted(),{getPublicCampaignResult:get}=e.loadRuntime('utils/publicCampaignResult.mjs');
 const m=get({},run);assert(m.continuation,'canonical next-station model is missing');assert.deepEqual(plain(m.continuation),{chapterId:'neon',name:'霓虹街口',available:true,persisted:true});assert.equal(m.buttons[0].label,'下一站准备');
 const pending=get({},{...run,persisted:false});assert.deepEqual(plain(pending.continuation),{chapterId:'neon',name:'霓虹街口',available:false,persisted:false});
 for(const patch of [{victory:false},{recorded:false},{chapterId:'homecoming',campaignCompleted:true}])assert.equal(get({},{...run,...patch}).continuation,null);assert.equal(get({},{...run,chapterId:'encore'}).continuation.chapterId,'raincheck');assert.equal(get({},{...run,chapterId:'raincheck'}).continuation.chapterId,'homecoming');owner.destroy();
});
test('all three current members go from one durably saved result to the actual next-station preparation, not immediate combat',()=>{
 for(const member of ['sakura','kai','enjo']){const{e,owner,run}=accepted(member),h=resultScene(e,run),before=e.profile.loadPublicProfile();
  h.act();assert.deepEqual(plain(h.starts),[['TitleScene',{suppressDebugAutoStart:true,openPage:'preflight'}]]);assert.equal(h.restarts.length,0);assert.deepEqual(h.releases,['campaign-next']);
  const p=e.profile.loadPublicProfile(),{getPreparationSnapshot}=e.loadRuntime('utils/publicPreparation.mjs');assert.equal(p.campaign.selectedChapterId,'neon');assert.equal(p.selectedId,member);assert.equal(p.attempts,before.attempts);assert.equal(p.clears,before.clears);assert.deepEqual(plain(getPreparationSnapshot(p,member)),plain(getPreparationSnapshot(before,member)));
  h.act();assert.equal(h.starts.length,1);owner.destroy();
 }
});
test('next-station selection save failure remains on this result and retry changes no rewards or run count',()=>{
 const{e,owner,run}=accepted(),h=resultScene(e,run),raw=e.storage.getItem('starush.public-profile'),set=e.storage.setItem;
 e.storage.setItem=()=>{throw new DOMException('Synthetic storage denial','QuotaExceededError');};assert.equal(h.act(),false);assert.equal(h.starts.length,0);assert.equal(h.restarts.length,0);assert.equal(h.releases.length,0);assert.equal(e.storage.getItem('starush.public-profile'),raw);assert.equal(h.s.rejected.retryable,true);
 e.storage.setItem=set;h.act();assert.equal(h.starts[0][0],'TitleScene');assert.equal(e.profile.loadPublicProfile().attempts,1);assert.equal(e.profile.loadPublicProfile().clears,1);owner.destroy();
});
test('rejected, stale and foreign-member result cannot change selected chapter or open preparation',()=>{
 for(const patch of [{persisted:false},{recorded:false},{runId:'unowned'},{performerId:'kai'}]){const{e,owner,run}=accepted(),h=resultScene(e,{...run,...patch}),raw=e.storage.getItem('starush.public-profile');assert.equal(h.act(),false);assert.equal(h.starts.length,0);assert.equal(h.restarts.length,0);assert.equal(e.storage.getItem('starush.public-profile'),raw);owner.destroy();}
});
