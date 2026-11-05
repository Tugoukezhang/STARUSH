import test from 'node:test';import assert from 'node:assert/strict';
import {getRetryCampaignBattleData,getNextCampaignBattleData} from '../src/utils/publicCampaignResult.mjs';
import {createFinaleTrialData,createRehearsalData,nextFinaleTrialData,retryFinaleTrialData,finishFinaleTrialRound,getFinaleTrialState} from '../src/utils/publicFinaleTrial.mjs';
import {resolvePublicBattleResume,withPublicBattleCheckpointData} from '../src/utils/publicBattleCheckpoint.mjs';
const api=await import('../src/utils/publicBattleEntry.mjs').catch(()=>({}));
const profile={version:1,clears:3,selectedId:'sakura',campaign:{version:1,selectedChapterId:'opening',chapterClears:{opening:1,neon:1,encore:1},completed:true}};
const base=()=>({stageId:1,practiceMode:false,defenseMode:false,performerId:'sakura',characterId:'sakura',team:[{characterId:'sakura'}],campaignChapterId:'opening',publicBattleResume:{runId:'previous-run'},stageName:'old',customIdentity:'preserved'});
const choices=['wide_brush','echo'];
const fresh=data=>{assert(data);assert.equal(Object.hasOwn(data,'publicBattleResume'),false,'fresh entry must not carry original checkpoint resume request');assert.equal(resolvePublicBattleResume(data).status,'fresh');return data;};
test('fresh entry helper removes only the one-shot continuation request and does not mutate input',()=>{
 assert.equal(typeof api.createFreshPublicBattleData,'function','fresh-entry boundary missing');
 for(const request of [{runId:'previous'},null,false,undefined,{},[]]){const d=base();d.publicBattleResume=request;Object.freeze(d);const copy=api.createFreshPublicBattleData(d);fresh(copy);assert.equal(d.publicBattleResume,request);assert.notEqual(copy,d);assert.equal(copy.team,d.team);assert.equal(copy.customIdentity,'preserved');}
 assert.equal(api.createFreshPublicBattleData(null),null);assert.equal(api.createFreshPublicBattleData([]),null);
});
for(const id of ['sakura','kai','enjo'])test(id+': actual campaign retry starts fresh rather than resolving the old saved run',()=>{
 const data={...base(),performerId:id,characterId:id,team:[{characterId:id}]},before=structuredClone(data);
 const retry=fresh(getRetryCampaignBattleData(data,profile));assert.equal(retry.performerId,id);assert.equal(retry.campaignChapterId,'opening');assert.deepEqual(data,before);
});
test('actual next chapter strips resume but preserves original next/unlock guard',()=>{
 const d=base(),run={victory:true,recorded:true,chapterId:'opening'},next=fresh(getNextCampaignBattleData(run,d,profile));assert.equal(next.campaignChapterId,'neon');assert.equal(next.customIdentity,'preserved');
 assert.equal(getNextCampaignBattleData({...run,victory:false},d,profile),null);assert.equal(getNextCampaignBattleData(run,d,{version:1,clears:0}),null);
});
test('trial and rehearsal creation are fresh attempts even when their base was a resumed campaign',()=>{
 const d=base(),trial=fresh(createFinaleTrialData(d,choices,profile));assert.equal(getFinaleTrialState(trial).startHp,5);assert.equal(trial.customIdentity,'preserved');
 const rehearsal=fresh(createRehearsalData(d,choices,profile,{chapterId:'opening',focus:'clear'}));assert(getFinaleTrialState(rehearsal).rehearsal);
 assert.equal(d.publicBattleResume.runId,'previous-run');
});
test('trial retry and advance preserve their HP/build policy without inheriting a continuation request',()=>{
 const trial=createFinaleTrialData({...base(),publicBattleResume:undefined},choices,profile);assert(trial);trial.publicBattleResume={runId:'stale'};
 const result=finishFinaleTrialRound(trial,{victory:true,hp:3,durationMs:1000,hitCount:2,actions:1});assert(result);
 const next=fresh(nextFinaleTrialData(trial,result));assert.equal(getFinaleTrialState(next).startHp,3);assert.equal(next.campaignChapterId,'neon');
 const retry=fresh(retryFinaleTrialData(next));assert.equal(getFinaleTrialState(retry).startHp,5);assert.deepEqual(getFinaleTrialState(retry).choices,choices);
 assert.equal(trial.publicBattleResume.runId,'stale');
});
test('rehearsal retry remains the selected chapter, not campaign or three-round fallback',()=>{
 const d=createRehearsalData(base(),choices,profile,{chapterId:'neon',focus:'clear'});assert(d);d.publicBattleResume={runId:'old'};
 const retry=fresh(retryFinaleTrialData(d));assert.equal(retry.campaignChapterId,'neon');assert.equal(getFinaleTrialState(retry).roundCount,1);
});
test('authentic resume factory retains its explicit original run binding',()=>{
 const cp={runId:'real-saved-run',battle:{performerId:'kai',chapterId:'opening',preparation:null,runGoal:null,routePlan:null,arrangementPlan:null}};
 const d=withPublicBattleCheckpointData(base(),cp,{});assert.equal(d.publicBattleResume.runId,cp.runId);assert.equal(d.performerId,'kai');
});
test('campaign retry leaves noncampaign and legacy diagnostic inputs with their existing owner',()=>{
 for(const d of [{...base(),practiceMode:true},{...base(),defenseMode:true},{...base(),publicFinaleTrial:{}},{...base(),stageId:2},null])assert.equal(getRetryCampaignBattleData(d,profile),d);
});
