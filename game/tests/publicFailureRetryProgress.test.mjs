import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicStage1PerformerRun } from '../src/systems/PublicStage1PerformerRun.mjs';
import { getPublicCampaignResult, getRetryCampaignBattleData } from '../src/utils/publicCampaignResult.mjs';
import { loadPublicProfile, recordPublicRun } from '../src/utils/publicRunProgression.mjs';
import { getPreparationResources } from '../src/utils/publicPreparation.mjs';
import { BattleSurfaceView, getPublicResultSurfaceModel } from '../src/systems/BattleSurfaceView.mjs';
import {configureUserCast,isUserCastEnabled} from '../src/utils/userCast.mjs';
import { createDocument } from './helpers/publicShellHarness.mjs';

function fixture(t, chapterId='opening') {
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map();
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
 t.after(()=>{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;});
 if(chapterId!=='opening')recordPublicRun({runId:'prior-clear',performerId:'venus',chapterId:'opening',victory:true,choices:[],durationMs:1000});
 const progress={completed:4,total:10};
 const scene={battleData:{stageId:1,performerId:'venus',campaignChapterId:chapterId},time:{now:100},
  paintZone:{getObjectiveProgress:()=>({...progress}),finaleMode:false}};
 const run=new PublicStage1PerformerRun(scene);t.after(()=>run.destroy());
 return {scene,run,progress,storage};
}
const base={descriptionLines:[],buttons:[]};
test('failure captures actual required progress before cleanup and does not unlock or grant rewards',t=>{
 const {run,scene}=fixture(t);scene.time.now=4100;
 const result=run.finish(false);
 assert.deepEqual(result.objectiveProgress,{completed:4,total:10,finaleReached:false});
 assert.equal(result.durationMs,4000);assert.equal(result.victory,false);
 assert.equal(result.reward.notes,0);assert.deepEqual(result.reward.equipmentIds,[]);
 const profile=loadPublicProfile();assert.equal(profile.attempts,1);assert.equal(profile.clears,0);
 assert.equal(profile.campaign.chapterClears.neon,0);assert.equal(getPreparationResources(profile).balance,0);
 const model=getPublicCampaignResult(base,result);
 assert(model.descriptionLines.some(s=>s.includes('4 / 10')));
 assert(model.descriptionLines.some(s=>s.includes('本站重新开始')));
 assert.equal(model.buttons[0].action,'retry');assert(!model.buttons.some(b=>b.action==='campaign-next'));
});
test('an uncompleted finale is not described as uncompleted facilities',t=>{
 const {run,scene,progress}=fixture(t);progress.completed=10;scene.paintZone.finaleMode=true;
 const result=run.finish(false),text=getPublicCampaignResult(base,result).descriptionLines.join(' ');
 assert.deepEqual(result.objectiveProgress,{completed:10,total:10,finaleReached:true});
 assert.match(text,/10 \/ 10/);assert.match(text,/压轴尚未完成/);
});
test('completed facilities do not claim a specific blocker without a recorded cause',t=>{
 const {run,progress}=fixture(t);progress.completed=10;
 const text=getPublicCampaignResult(base,run.finish(false)).descriptionLines.join(' ');
 assert.match(text,/10 \/ 10/);assert.match(text,/尚未进入压轴/);assert.doesNotMatch(text,/舞台压力尚未解除/);
});
test('failure result snapshot survives scene destruction and settlement retries exactly once',t=>{
 const {run,scene,progress}=fixture(t);const result=run.finish(false);
 progress.completed=0;scene.paintZone=null;scene.time.now=90000;
 assert.equal(run.finish(true),result);assert.deepEqual(result.objectiveProgress,{completed:4,total:10,finaleReached:false});
 assert.equal(loadPublicProfile().attempts,1);assert.equal(loadPublicProfile().clears,0);
});
test('neon failure preserves prior clear/preparation while a new retry owner has no build or counters',t=>{
 const {run,scene}=fixture(t,'neon');const before=loadPublicProfile();run.growth.choose('relay');run.actions=2;run.impacts=7;run.finish(false);
 const profile=loadPublicProfile();assert.deepEqual(profile.campaign,before.campaign);assert.equal(profile.clears,1);
 assert.equal(getPreparationResources(profile).balance,getPreparationResources(before).balance);
 const data=getRetryCampaignBattleData(scene.battleData,profile),retry=new PublicStage1PerformerRun({...scene,battleData:data});t.after(()=>retry.destroy());
 assert.equal(data.campaignChapterId,'neon');assert.equal(retry.member.id,'venus');assert.notEqual(retry.runId,run.runId);
 assert.deepEqual(retry.growth.choices,[]);assert.equal(retry.actions,0);assert.equal(retry.impacts,0);assert.equal(retry.result,undefined);
});
test('victory and legacy failure models retain previous output without invented progress',t=>{
 const {run,scene}=fixture(t);scene.paintZone=null;
 const failed=run.finish(false);assert.equal(failed.objectiveProgress,undefined);
 assert.equal(getPublicCampaignResult(base,failed).descriptionLines.length,1);
 assert.equal(getPublicCampaignResult(base,{...failed,victory:true,objectiveProgress:{completed:10,total:10,finaleReached:true}}).descriptionLines.length,1);
});
test('zero-reward failures render no collection surface while retaining real failure progress',t=>{
 const {run,scene}=fixture(t);const failed=run.finish(false);
 const model=getPublicResultSurfaceModel(getPublicCampaignResult(base,failed),failed);
 assert.equal(model.reward,null);
 const doc=createDocument(),view=new BattleSurfaceView(scene,{mode:'result',model,onAction(){}},doc);t.after(()=>view.destroy());
 assert.equal(view.root.querySelector('[data-result-action=preparation]'),null);
 assert(!view.root.textContent.includes('练习笔记 +0'));assert(view.root.textContent.includes('4 / 10'));
 assert(view.root.querySelector('[data-result-action=retry]'));
});
test('positive note or known equipment rewards still render; unknown IDs are not a grant',()=>{
 const run={performerId:'venus',chapterId:'opening',victory:true,recorded:true,persisted:true};
 assert.equal(getPublicResultSurfaceModel(base,{...run,reward:{notes:3,equipmentIds:[]}}).reward.notes,3);
 assert.equal(getPublicResultSurfaceModel(base,{...run,reward:{notes:0,equipmentIds:['focus_lens']}}).reward.equipment.length,1);
 assert.equal(getPublicResultSurfaceModel(base,{...run,reward:{notes:0,equipmentIds:['unknown']}}).reward,null);
 assert.equal(getPublicResultSurfaceModel(base,{...run,recorded:false,reward:{notes:3,equipmentIds:[]}}).reward,null);
});

test('pause and failure agree on a rooftop hold and the result survives world cleanup',t=>{
 const enabled=isUserCastEnabled();configureUserCast(true);t.after(()=>configureUserCast(enabled));
 const {scene,run}=fixture(t);
 scene._userCastPresentation=true;scene.battleData.campaignChapterId='raincheck';
 Object.assign(scene.paintZone,{currentZone:1,devices:[{zone:1,required:true,chapterAwaitingCalibration:true,chapterCalibrationBuffered:false}]});
 assert.match(run.getAttemptProgress().next,/连续校音 1.5 秒/);
 scene.paintZone.devices[0].chapterCalibrationBuffered=true;
 const before=run.getAttemptProgress();
 assert.match(before.next,/已有供电/);
 const result=run.finish(false);scene.paintZone=null;
 const model=getPublicResultSurfaceModel(getPublicCampaignResult(base,result),result);
 assert.deepEqual(model.attemptReview,before);
 assert(!before.rows.some(row=>row.includes('压轴声浪')));
});
