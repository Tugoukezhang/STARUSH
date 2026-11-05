import test from 'node:test';
import assert from 'node:assert/strict';
import {getChapterContent,validateChapterContent} from '../src/utils/publicChapterContent.mjs';
import {HOMECOMING_CHAPTER} from '../src/utils/homecomingChapter.mjs';
import {getPublicChapter} from '../src/utils/publicCampaign.mjs';
import {ChapterObjectiveContract} from '../src/utils/chapterObjectives.mjs';
import {ChapterSideSet} from '../src/utils/chapterSideSets.mjs';
import {HARBOR_STAGE_CONFIG,HARBOR_STAGE_DEVICES,HOMECOMING_STAGE_CONFIG} from '../src/utils/harborStageMap.mjs';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
import {PUBLIC_EQUIPMENT,getChapterRewardPreview,getPreparationResources} from '../src/utils/publicPreparation.mjs';
import {
 PUBLIC_PROFILE_STORAGE_KEY,confirmPublicProfileRestore,isPublicChapterUnlocked,loadPublicProfile,previewPublicProfileRestore,
 recordPublicRun,resolvePublicChapterId,selectPublicChapter,selectPublicReplaySession,
} from '../src/utils/publicRunProgression.mjs';
import {PublicStoryPlayback} from '../src/utils/publicStoryPlayback.mjs';
import {getChapterStory} from '../src/utils/publicStory.mjs';
import {getPublicJourneyResult} from '../src/utils/publicJourneyContent.mjs';
import {configureUserCast} from '../src/utils/userCast.mjs';

const ROUTE=['opening','neon','encore','raincheck'];
const ACTORS=['步枪手','重锤手','机甲剑士'];
const BEATS=['intro','midpoint','outro'];

function memoryStorage(raw=null){
 const items=new Map(raw===null?[]:[[PUBLIC_PROFILE_STORAGE_KEY,raw]]),writes=[];
 return {writes,getItem:key=>items.has(key)?items.get(key):null,
  setItem:(key,value)=>{writes.push(key);items.set(key,String(value));},removeItem:key=>{items.delete(key);}};
}
// A literal on-disk save: never derived from the code under test.
function savedProfile(chapterClears,{selected='opening',completed=false,trainingLevels={},equipment={}}={}){
 const total=Object.values(chapterClears).reduce((sum,count)=>sum+count,0);
 return {version:1,selectedId:'sakura',clears:total,attempts:total,
  clearsByPerformer:{sakura:total,kai:0,venus:0,genya:0,enjo:0},lastRun:null,recordedRunIds:[],
  campaign:{version:1,selectedChapterId:selected,clearedChapterIds:Object.keys(chapterClears).filter(id=>chapterClears[id]>0),chapterClears,completed},
  preparation:{version:1,trainingLevels:{sakura:1,kai:1,venus:1,genya:1,enjo:1,...trainingLevels},
   equipmentByPerformer:{sakura:null,kai:null,venus:null,genya:null,enjo:null,...equipment}}};
}
const finish=(storage,runId,chapterId,victory=true,performerId='sakura')=>
 recordPublicRun({runId,performerId,chapterId,victory,choices:[],durationMs:60000},storage);
const unlocked=storage=>isPublicChapterUnlocked('homecoming',loadPublicProfile(storage));

test('homecoming stays locked through every earlier chapter, including a lost raincheck',()=>{
 const storage=memoryStorage();
 assert.equal(unlocked(storage),false);
 const early=finish(storage,'early-empty','homecoming');
 assert.equal(early.clears,0);assert.equal(early.attempts,0);assert.deepEqual(storage.writes,[]);
 for(const chapterId of ROUTE.slice(0,3)){
  assert.equal(finish(storage,'clear-'+chapterId,chapterId).campaign.chapterClears[chapterId],1);
  assert.equal(unlocked(storage),false,'still locked after '+chapterId);
 }
 const writes=storage.writes.length;
 const blocked=finish(storage,'early-after-encore','homecoming');
 assert.equal(blocked.campaign.chapterClears.homecoming,0);assert.equal(blocked.clears,3);
 assert.equal(storage.writes.length,writes,'a rejected run writes nothing');
 assert.equal(finish(storage,'lost-raincheck','raincheck',false).campaign.chapterClears.raincheck,0);
 assert.equal(unlocked(storage),false,'a lost raincheck is an attempt, not a clear');
 const cleared=finish(storage,'clear-raincheck','raincheck');
 assert.equal(cleared.campaign.selectedChapterId,'homecoming');assert.equal(cleared.campaign.completed,false);
 assert.equal(unlocked(storage),true);
 assert.equal(resolvePublicChapterId('homecoming',loadPublicProfile(storage)),'homecoming');
});
test('selection and replay requests cannot enter homecoming before raincheck',()=>{
 const raw=JSON.stringify(savedProfile({opening:1,neon:1,encore:1},{selected:'encore'})),storage=memoryStorage(raw);
 const profile=selectPublicChapter('homecoming',storage);
 assert.equal(profile.campaign.selectedChapterId,'encore');
 assert.equal(resolvePublicChapterId('homecoming',profile),'encore');
 assert.equal(selectPublicReplaySession({performerId:'sakura',chapterId:'homecoming'},
  {performerId:'sakura',chapterId:'encore'},storage).sessionStatus,'locked');
 assert.deepEqual(storage.writes,[]);assert.equal(storage.getItem(PUBLIC_PROFILE_STORAGE_KEY),raw);
});
test('three-chapter save loads read-only and must still clear raincheck first',()=>{
 const raw=JSON.stringify(savedProfile({opening:1,neon:1,encore:1},{selected:'encore',completed:true})),storage=memoryStorage(raw);
 const profile=loadPublicProfile(storage);
 assert.equal(profile.recovery,undefined);assert.equal(profile.campaign.selectedChapterId,'encore');
 assert.equal(profile.campaign.completed,false);
 assert.equal(profile.campaign.chapterClears.raincheck,0);assert.equal(profile.campaign.chapterClears.homecoming,0);
 assert.equal(isPublicChapterUnlocked('raincheck',profile),true);assert.equal(isPublicChapterUnlocked('homecoming',profile),false);
 assert.deepEqual(storage.writes,[]);assert.equal(storage.getItem(PUBLIC_PROFILE_STORAGE_KEY),raw);
 finish(storage,'migrated-raincheck','raincheck');
 assert.equal(unlocked(storage),true);
 assert.deepEqual(Object.keys(JSON.parse(storage.getItem(PUBLIC_PROFILE_STORAGE_KEY)).campaign.chapterClears).sort(),
  ['encore','homecoming','neon','opening','raincheck']);
});
test('four-chapter migration keeps counts, training and equipment, and reopens the campaign',()=>{
 const raw=JSON.stringify(savedProfile({opening:2,neon:1,encore:3,raincheck:1},
  {selected:'raincheck',completed:true,trainingLevels:{sakura:3},equipment:{sakura:'rain_relay'}})),storage=memoryStorage(raw);
 const profile=loadPublicProfile(storage);
 assert.equal(profile.recovery,undefined);assert.equal(profile.campaign.completed,false);
 assert.equal(profile.campaign.selectedChapterId,'raincheck');
 assert.equal(profile.campaign.chapterClears.opening,2);assert.equal(profile.campaign.chapterClears.encore,3);
 assert.equal(profile.campaign.chapterClears.homecoming,0);
 assert.equal(profile.preparation.trainingLevels.sakura,3);assert.equal(profile.preparation.equipmentByPerformer.sakura,'rain_relay');
 assert.equal(isPublicChapterUnlocked('homecoming',profile),true);assert.deepEqual(storage.writes,[]);
});
test('homecoming and later replays never discard earlier progress',()=>{
 const storage=memoryStorage(JSON.stringify(savedProfile({opening:2,neon:1,encore:3,raincheck:1},
  {selected:'raincheck',trainingLevels:{sakura:3},equipment:{sakura:'rain_relay'}})));
 const before=loadPublicProfile(storage);
 const first=finish(storage,'home-1','homecoming');
 assert.deepEqual({...first.campaign.chapterClears},{opening:2,neon:1,encore:3,raincheck:1,homecoming:1});
 assert.deepEqual([...first.campaign.clearedChapterIds],[...ROUTE,'homecoming']);
 assert.equal(first.campaign.completed,true);assert.equal(first.campaign.selectedChapterId,'homecoming');
 assert.equal(first.clears,before.clears+1);assert.deepEqual(first.preparation,before.preparation);
 // Same run retried at settlement: no double credit, no write.
 const writes=storage.writes.length;
 assert.equal(finish(storage,'home-1','homecoming').clears,first.clears);assert.equal(storage.writes.length,writes);
 const lost=finish(storage,'home-lost','homecoming',false);
 assert.equal(lost.campaign.chapterClears.homecoming,1);assert.equal(lost.campaign.completed,true);assert.equal(lost.attempts,first.attempts+1);
 const replay=finish(storage,'opening-replay','opening');
 assert.equal(replay.campaign.chapterClears.opening,3);assert.equal(replay.campaign.chapterClears.homecoming,1);
 assert.equal(replay.campaign.completed,true);assert.equal(replay.campaign.selectedChapterId,'opening');
 assert.equal(isPublicChapterUnlocked('homecoming',replay),true);
 assert.deepEqual(replay.preparation,before.preparation);
 const reloaded=loadPublicProfile(memoryStorage(storage.getItem(PUBLIC_PROFILE_STORAGE_KEY)));
 assert.equal(reloaded.recovery,undefined);assert.deepEqual(reloaded.campaign,replay.campaign);
});
test('a replay between raincheck and homecoming keeps the unlock',()=>{
 const storage=memoryStorage(JSON.stringify(savedProfile({opening:1,neon:1,encore:1,raincheck:1},{selected:'homecoming'})));
 const replay=finish(storage,'neon-replay','neon');
 assert.equal(replay.campaign.chapterClears.neon,2);assert.equal(replay.campaign.chapterClears.raincheck,1);
 assert.equal(isPublicChapterUnlocked('homecoming',replay),true);
});
for(const [name,counts] of [
 ['homecoming clear over a zero raincheck',{opening:1,neon:1,encore:1,raincheck:0,homecoming:1}],
 ['homecoming clear with no raincheck key',{opening:1,neon:1,encore:1,homecoming:1}],
 ['a gap earlier in the chain',{opening:1,neon:0,encore:1,raincheck:1}],
])test('forged save is protected, not unlocked or rewritten: '+name,()=>{
 const raw=JSON.stringify(savedProfile(counts)),storage=memoryStorage(raw),profile=loadPublicProfile(storage);
 assert.equal(profile.recovery?.kind,'corrupt');assert.equal(isPublicChapterUnlocked('homecoming',profile),false);
 assert.equal(profile.campaign.chapterClears.homecoming,0);
 finish(storage,'forged-run','homecoming');
 assert.deepEqual(storage.writes,[]);assert.equal(storage.getItem(PUBLIC_PROFILE_STORAGE_KEY),raw);
});
test('a forged selection cannot resume into homecoming',()=>{
 const profile=loadPublicProfile(memoryStorage(JSON.stringify(savedProfile({opening:1,neon:1,encore:1,raincheck:0},{selected:'homecoming'}))));
 assert.notEqual(profile.campaign.selectedChapterId,'homecoming');
 assert.equal(isPublicChapterUnlocked('homecoming',profile),false);
});
test('a legacy save without a campaign credits only the opening',()=>{
 const legacy=savedProfile({opening:5});delete legacy.campaign;
 const profile=loadPublicProfile(memoryStorage(JSON.stringify(legacy)));
 assert.equal(profile.recovery,undefined);assert.equal(profile.campaign.chapterClears.opening,5);
 assert.equal(isPublicChapterUnlocked('homecoming',profile),false);
});
test('backup import accepts an old four-chapter file and rejects a forged homecoming clear',()=>{
 const storage=memoryStorage();
 const proposal=previewPublicProfileRestore(savedProfile({opening:1,neon:1,encore:1,raincheck:1},{selected:'raincheck'}),storage);
 assert.equal(proposal.status,'ready');assert.equal(proposal.profile.campaign.chapterClears.homecoming,0);
 assert.equal(confirmPublicProfileRestore(proposal,storage).status,'restored');
 assert.equal(unlocked(storage),true);
 assert.equal(previewPublicProfileRestore(savedProfile({opening:1,neon:1,encore:1,raincheck:0,homecoming:1}),memoryStorage()).status,'invalid-profile');
});
test('homecoming pays the standard notes and adds no exclusive item',()=>{
 assert.equal(PUBLIC_EQUIPMENT.some(item=>item.chapterId==='homecoming'||/回港/.test(item.unlock)),false);
 const storage=memoryStorage(JSON.stringify(savedProfile({opening:1,neon:1,encore:1,raincheck:1},{selected:'homecoming'})));
 const before=loadPublicProfile(storage),preview=getChapterRewardPreview(before,'homecoming','sakura');
 assert.equal(preview.notes,3);assert.deepEqual(preview.equipment,[]);
 // A performer's own first clear item is the generic rule, and still is not chapter loot.
 const kai=getChapterRewardPreview(before,'homecoming','kai');
 assert.equal(kai.notes,3);assert.deepEqual(kai.equipment.map(item=>item.id),['return_edge']);
 const after=finish(storage,'home-reward','homecoming');
 assert.equal(getPreparationResources(after).earned-getPreparationResources(before).earned,3);
});
test('non-story contract fields stay pinned and validate',()=>{
 assert.deepEqual(validateChapterContent(),[]);
 const {story,pacingSteps,briefing,...contract}=HOMECOMING_CHAPTER;
 assert.deepEqual(JSON.parse(JSON.stringify(contract)),{
  id:'homecoming',ordinal:5,name:'回港加演',subtitle:'重访港湾 · 留给收工的人',accent:0xea806e,flipX:false,tint:0xffffff,
  revision:1,requires:'raincheck',sceneId:'harbor',finalePatterns:['momentum-cutoff','captured-line','momentum-cutoff'],
  resources:{ground:'art/map-presentation-20261018/encore-neutral.webp',colorGround:'art/map-presentation-20261018/encore-color.webp',venue:'art/chapter-venues-20261024/encore.webp'},
  encounter:{roles:['stage-cue-emitter','objective-disruptor','spotlight-captain'],labels:['码头再会','顺线通电','双路汇流','收工加演'],eventId:null},
  performanceFinale:{patterns:['momentum-vector','captured-line','momentum-vector'],summary:'压轴首末段按走位预判，中段锁定落点，顺序随串场路线变化；躲开三段声浪后靠近涂染。'},
 });
 assert.equal(briefing.goal,'接通十处主设施与四处串场站，前往帆顶完成返场压轴。');
 assert.equal(briefing.progression,'第3、7处主设施完成时，各选择一次本场编排。');
 assert.equal(pacingSteps.length,3);assert.equal(story.title,'这一排留给你们');
});
test('fifth chapter is a revisit of the existing harbor, not new geometry or art',()=>{
 assert.deepEqual(getChapterContent('homecoming').resources,getChapterContent('encore').resources);
 assert.equal(getPublicChapter('homecoming').devices,HARBOR_STAGE_DEVICES);
 assert.equal(getPublicChapter('encore').devices,HARBOR_STAGE_DEVICES);
 assert.equal(HOMECOMING_STAGE_CONFIG.props,HARBOR_STAGE_CONFIG.props);assert.equal(HOMECOMING_STAGE_CONFIG.terrain,HARBOR_STAGE_CONFIG.terrain);
 assert.equal(HOMECOMING_STAGE_CONFIG.chapterId,'homecoming');
 assert.equal(HARBOR_STAGE_DEVICES.length,10);
 // Eight authored stations on four lines; one line per zone gives the four a run completes.
 const sideSet=new ChapterSideSet('homecoming');
 assert.equal(sideSet.definitions.length,8);assert.equal(sideSet.snapshot([]).total,4);
});
test('dialogue uses the three established actors and reads as lines, not a manual',()=>{
 for(const beat of BEATS){
  const lines=HOMECOMING_CHAPTER.story[beat];
  assert.equal(lines[0][0],'旁白',beat);
  for(const actor of ACTORS)assert(lines.some(([speaker])=>speaker===actor),beat+' lacks '+actor);
  for(const [speaker,text] of lines){
   assert(['旁白',...ACTORS].includes(speaker),speaker);
   assert(text.length<=44,'overlong line: '+text);
   assert.doesNotMatch(text,/接通后|依次|开放|完成|前往|跟着/,text);
  }
 }
 const all=JSON.stringify([HOMECOMING_CHAPTER.story,HOMECOMING_CHAPTER.pacingSteps,HOMECOMING_CHAPTER.briefing]);
 assert.doesNotMatch(all,/高清|精美|全新美术|全新场景|重制|专属|限定|新装备|新道具|绯樱|苍海|炎上|金星|幻夜/);
 assert.match(HOMECOMING_CHAPTER.story.place+HOMECOMING_CHAPTER.story.intro[0][1],/白天|太阳/);
});
test('midpoint copy describes the state after both relays',()=>{
 const text=HOMECOMING_CHAPTER.story.midpoint.map(([,line])=>line).join('');
 assert.match(text,/两侧调音亭/);assert.match(text,/串场/);
 assert.doesNotMatch(text,/渡口|南区|入口|集合灯|校音/,'south-gate and calibration wording belongs elsewhere');
 assert(text.indexOf('左')>=0&&text.indexOf('左')<text.indexOf('右'),'left must be told before right');
});
test('the game state at the midpoint matches what the midpoint says',()=>{
 const objectives=new ChapterObjectiveContract('homecoming'),sideSet=new ChapterSideSet('homecoming');
 const devices=[...getPublicChapter('homecoming').devices,...sideSet.definitions].map(d=>({...d,complete:false}));
 const device=id=>devices.find(d=>d.id===id),main=id=>device('harbor-'+id);
 for(const d of devices)if(d.required&&d.zone===0)d.complete=true;
 for(const id of ['homecoming-side-0-0','homecoming-side-0-1']){device(id).complete=true;sideSet.completed(device(id),devices);}
 main('north-entry').complete=true;
 main('east-relay').complete=true;
 assert.equal(objectives.canReceive(main('stage-left'),devices),false);
 main('west-relay').complete=true;
 assert.equal(objectives.canReceive(main('stage-left'),devices),true);
 assert.equal(objectives.canReceive(main('stage-right'),devices),false);
 assert.equal(sideSet.canReceive(device('homecoming-side-2-0'),devices),true,'north side line may still be open');
 assert.equal(sideSet.canReceive(device('homecoming-side-3-0'),devices),true,'and is not yet committed');
 assert.equal(sideSet.zoneComplete(1,devices),false);
});
for(const relays of [['west-relay','east-relay'],['east-relay','west-relay']])test('real storyReady fires only after both relays: '+relays[0]+' first',async()=>{
 const {OldStreetScene}=await import('../src/systems/OldStreetScene.mjs');
 const devices=getPublicChapter('homecoming').devices.map(d=>({...d,paint:0,sequenceIndex:0,complete:false}));
 const owner={config:HOMECOMING_STAGE_CONFIG,items:new Map(),updateRestoration(){},scene:{paintZone:{devices}},
  state:new OldStreetState(HOMECOMING_STAGE_CONFIG.props,HOMECOMING_STAGE_CONFIG.terrain)};
 const ready=()=>OldStreetScene.prototype.storyReady.call(owner);
 const complete=id=>{const d=devices.find(row=>row.id==='harbor-'+id);d.complete=true;OldStreetScene.prototype.restore.call(owner,d);};
 for(const id of ['meeting','west-deck','shed','control','crossing','north-entry',relays[0]]){
  complete(id);assert.equal(ready(),false,'midpoint fired early at '+id);
 }
 complete(relays[1]);assert.equal(ready(),true);
 complete('stage-left');assert.equal(ready(),true);
});
test('real paint system: opposite branches, west relay first, side-before-gate order',async()=>{
 const {loadBattleScene}=await import('./helpers/loadBattleScene.mjs');
 const {PaintZoneSystem}=loadBattleScene({Phaser:{Scene:class{},Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}},includeOwners:true});
 const scene={_userCastPresentation:true,battleData:{stageId:1,campaignChapterId:'homecoming'},oldStreet:{clearLine:()=>true},player:{x:500,y:1630,hp:5},_facilityCompletionFx:{play:()=>true}};
 const zone=new PaintZoneSystem(scene);scene.paintZone=zone;
 zone.devices=[...getPublicChapter('homecoming').devices,...zone.sideSet.definitions].map(d=>({...d,paint:0,complete:false,sequenceIndex:0}));
 zone._redrawDevice=()=>{};zone._emitProgress=()=>{};zone.clearGate=()=>{};
 let finished=0;zone.onAllComplete=()=>finished++;zone._refreshLockVisuals();
 const device=id=>zone.devices.find(d=>d.id===id);
 const paint=id=>{for(let hit=0;hit<2&&!device(id).complete;hit++)assert(zone.applyPaint(device(id),999,'blue'),id);assert(device(id).complete,id);};
 assert.equal(zone.applyPaint(device('homecoming-side-2-0'),999,'blue'),false,'north station is closed in the south zone');
 paint('homecoming-side-1-1');
 assert.equal(zone.applyPaint(device('homecoming-side-0-0'),999,'blue'),false,'first station commits the branch');
 paint('homecoming-side-1-0');
 assert.equal(zone.currentZone,0,'side branch alone cannot open the north');
 for(const id of ['meeting','west-deck','shed','control'])paint('harbor-'+id);
 assert.equal(zone.currentZone,0);
 paint('harbor-crossing');assert.equal(zone.currentZone,1);
 paint('harbor-north-entry');paint('harbor-west-relay');
 assert.equal(zone.canReceivePaint(device('harbor-stage-left')),false);
 paint('harbor-east-relay');paint('homecoming-side-2-0');paint('harbor-stage-left');
 assert.equal(zone.canReceivePaint(device('harbor-stage-right')),true);
 paint('harbor-stage-right');assert.equal(zone.complete,false,'north side line still owed');assert.equal(finished,0);
 paint('homecoming-side-2-1');
 assert.equal(zone.complete,true);assert.equal(finished,1);assert.equal(zone.getPaintedCount(),10);
 assert.equal(zone.sideSet.snapshot(zone.devices).completed,4);
 assert(zone.devices.every(d=>!d.chapterAwaitingCalibration));
});
test('authored beats play back and supply the result text under the owner cast',()=>{
 configureUserCast(true);
 try{
  for(const beat of BEATS){
   const story=getChapterStory('homecoming',beat,'kai');
   assert.equal(story.lines.length,HOMECOMING_CHAPTER.story[beat].length);
   assert.equal(new PublicStoryPlayback(story).length,story.lines.length);
  }
  const result=getPublicJourneyResult({chapterId:'homecoming',performerId:'enjo',victory:true,recorded:true,persisted:true});
  assert.equal(result.text,HOMECOMING_CHAPTER.story.outro[0][1]);assert.match(result.next,/回港加演后落幕/);
 }finally{configureUserCast(false);}
});
test('briefing uses canonical map labels instead of competing device aliases',()=>{
 const {rule}=HOMECOMING_CHAPTER.briefing;
 for(const word of ['码头集合灯','栈桥侧灯','器材间接线','调度亭接线','中段配电','调音区入口','东西声部','无需驻点校音'])assert(rule.includes(word),word);
 for(const alias of ['西侧甲板','设备棚','控制舱','左台灯'])assert(!rule.includes(alias),alias);
 assert(rule.indexOf('帆顶左灯')<rule.indexOf('右灯'));
});
