import assert from 'node:assert/strict';
import test from 'node:test';
import { getPublicCampaignResult, getNextCampaignBattleData } from '../src/utils/publicCampaignResult.mjs';
import { loadPublicProfile, recordPublicRun } from '../src/utils/publicRunProgression.mjs';
import { PublicStage1PerformerRun } from '../src/systems/PublicStage1PerformerRun.mjs';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};
const base={title:'legacy',titleColor:'#fff',type:'victory',buttons:[],descriptionLines:[],supplementLines:[]};
const run={runId:'win',performerId:'sakura',chapterId:'opening',victory:true,choices:[],durationMs:1000};

test('results distinguish next stop, a full tour ending, and failure without legacy Stage 1 copy',()=>{
  const next=getPublicCampaignResult(base,{...run,persisted:true});
  assert.equal(next.title,'星光初演 · 通关');
  assert.equal(next.buttons[0].action,'campaign-next');
  assert.match(next.descriptionLines.join(' '),/霓虹街口/);
  // The third chapter is no longer terminal, even if a stale caller still claims completion.
  for(const campaignCompleted of [false,true]){
    const third=getPublicCampaignResult(base,{...run,chapterId:'encore',campaignCompleted});
    assert.equal(third.title,'终场合奏 · 通关');
    assert.equal(third.buttons[0].action,'campaign-next');
    assert.equal(third.continuation.chapterId,'raincheck');
    assert.match(third.descriptionLines.join(' '),/雨后返场/);
  }
  const fourth=getPublicCampaignResult(base,{...run,chapterId:'raincheck',campaignCompleted:true});
  assert.equal(fourth.title,'雨后返场 · 通关');
  assert.equal(fourth.continuation.chapterId,'homecoming');
  const final=getPublicCampaignResult(base,{...run,chapterId:'homecoming',campaignCompleted:true});
  assert.equal(final.title,'巡演完成');
  assert.deepEqual(final.descriptionLines,['所有站点已点亮，本轮巡演完成。']);
  assert.doesNotMatch(`${final.title} ${final.descriptionLines.join(' ')}`,/三站|三章/);
  assert.equal(final.continuation,null);
  assert.equal(final.buttons.some(b=>b.action==='campaign-next'),false);
  // The last chapter alone does not earn the ending without the recorded completion flag.
  const unfinished=getPublicCampaignResult(base,{...run,chapterId:'homecoming',campaignCompleted:false});
  assert.equal(unfinished.title,'回港加演 · 通关');
  assert.doesNotMatch(unfinished.descriptionLines.join(' '),/巡演完成/);
  assert.equal(unfinished.buttons.some(b=>b.action==='campaign-next'),false);
  const lostFinal=getPublicCampaignResult(base,{...run,chapterId:'homecoming',victory:false,campaignCompleted:true});
  assert.equal(lostFinal.title,'回港加演 · 未完成');
  assert.equal(lostFinal.buttons[0].action,'retry');
  const failed=getPublicCampaignResult(base,{...run,victory:false});
  assert.equal(failed.buttons[0].action,'retry');
  assert.equal(failed.buttons.some(b=>b.action==='campaign-next'),false);
  assert.equal(failed.objectiveLine,null);
  const rejected=getPublicCampaignResult(base,{...run,recorded:false,persisted:false});
  assert.equal(rejected.buttons.some(b=>b.action==='campaign-next'),false);
  assert.match(rejected.descriptionLines.join(' '),/未能记入/);
});

test('unpersisted finish retries the same settlement after storage recovers',()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'), data=new Map();let blocked=false;
  const storage={getItem:key=>{if(blocked)throw Error('temporary read denial');return data.get(key)??null;},setItem:(key,value)=>{if(blocked)throw Error('temporary write denial');data.set(key,value);}};
  Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
  try{
    recordPublicRun(run);
    const owner=new PublicStage1PerformerRun({battleData:{stageId:1,performerId:'sakura',campaignChapterId:'neon'},time:{now:100}});
    blocked=true;const result=owner.finish(true);assert.equal(result.persisted,false);assert.equal(result.recorded,true);
    blocked=false;const recovered=owner.finish(true);
    assert.equal(recovered,result);
    assert.equal(recovered.recorded,true);assert.equal(recovered.persisted,true);
    assert.equal(loadPublicProfile().campaign.chapterClears.neon,1);
    owner.finish(true);assert.equal(loadPublicProfile().attempts,2);
  }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;}
});

test('next requires accepted victory and unlocked progress, retains performer but switches chapter',()=>{
  const storage=memory(), data={stageId:1,performerId:'kai',campaignChapterId:'opening'};
  assert.equal(getNextCampaignBattleData(run,data,loadPublicProfile(storage)),null);
  const profile=recordPublicRun(run,storage);
  const next=getNextCampaignBattleData(run,data,profile);
  assert.equal(next.campaignChapterId,'neon');
  assert.equal(next.performerId,'kai');
  assert.equal(getNextCampaignBattleData({...run,victory:false},data,profile),null);
  assert.equal(getNextCampaignBattleData({...run,chapterId:'encore'},data,profile),null);
  assert.equal(getNextCampaignBattleData(run,{...data,practiceMode:true},profile),null);
});

test('third and fourth victories unlock the next chapter; only the fifth completes the tour',()=>{
  const storage=memory(), data={stageId:1,performerId:'kai'};
  const third={...run,runId:'win-encore',chapterId:'encore'}, fourth={...run,runId:'win-raincheck',chapterId:'raincheck'};
  const thirdData={...data,campaignChapterId:'encore'}, fourthData={...data,campaignChapterId:'raincheck'};
  const early=recordPublicRun(run,storage);
  assert.equal(getNextCampaignBattleData(third,thirdData,early),null,'an uncleared third chapter cannot open the fourth');
  recordPublicRun({...run,runId:'win-neon',chapterId:'neon'},storage);
  const unlocked=recordPublicRun(third,storage);
  assert.equal(unlocked.campaign.completed,false);
  const next=getNextCampaignBattleData(third,thirdData,unlocked);
  assert.equal(next.campaignChapterId,'raincheck');
  assert.equal(next.performerId,'kai');
  const fourthProfile=recordPublicRun(fourth,storage);
  assert.equal(fourthProfile.campaign.completed,false);
  assert.equal(getNextCampaignBattleData(fourth,fourthData,fourthProfile).campaignChapterId,'homecoming');
  const fifth={...run,runId:'win-homecoming',chapterId:'homecoming'};
  const done=recordPublicRun(fifth,storage);
  assert.equal(done.campaign.completed,true);
  assert.equal(getNextCampaignBattleData(fifth,{...data,campaignChapterId:'homecoming'},done),null);
});

test('owner finish records actual chapter and does not count repeated settlement twice',()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'), storage=memory();
  Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
  try {
    recordPublicRun(run);
    const scene={battleData:{stageId:1,performerId:'venus',campaignChapterId:'neon'},time:{now:100}};
    const owner=new PublicStage1PerformerRun(scene);
    scene.time.now=1100;
    const result=owner.finish(true);
    assert.equal(result.chapterId,'neon');
    assert.equal(result.campaignCompleted,false);
    assert.equal(loadPublicProfile().campaign.chapterClears.neon,1);
    assert.equal(owner.finish(true),result);
    assert.equal(loadPublicProfile().campaign.chapterClears.neon,1);
  } finally {
    if(original) Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;
  }
});

for(const [cleared,chapterId,completed,title] of [
  [['opening','neon'],'encore',false,'终场合奏 · 通关'],
  [['opening','neon','encore'],'raincheck',false,'雨后返场 · 通关'],
  [['opening','neon','encore','raincheck'],'homecoming',true,'巡演完成'],
]){
  test(`owner finish of ${chapterId} after ${cleared.length} recorded victories reports completed=${completed}`,()=>{
    const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'), storage=memory();
    Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
    try {
      for(const id of cleared) recordPublicRun({...run,runId:`seed-${id}`,chapterId:id});
      const scene={battleData:{stageId:1,performerId:'venus',campaignChapterId:chapterId},time:{now:100}};
      const owner=new PublicStage1PerformerRun(scene);
      scene.time.now=1100;
      const result=owner.finish(true);
      assert.equal(result.chapterId,chapterId);
      assert.equal(result.campaignCompleted,completed);
      assert.equal(loadPublicProfile().campaign.completed,completed);
      assert.equal(getPublicCampaignResult(base,result).title,title);
      assert.equal(owner.finish(true),result);
      assert.equal(loadPublicProfile().campaign.chapterClears[chapterId],1);
      assert.equal(loadPublicProfile().clears,cleared.length+1);
    } finally {
      if(original) Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;
    }
  });
}
