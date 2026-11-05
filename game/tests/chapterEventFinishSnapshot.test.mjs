import test from 'node:test';import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const E='stage-cue-emitter',D='objective-disruptor',C='spotlight-captain',KEY='starush.public-profile';
const side=chapterId=>({chapterId,total:4,completed:2,zones:[{zone:0,branch:'west',completed:2},{zone:1,branch:null,completed:0}]});
// Real Director + real PerformerRun + real BattleScene release bodies; the Scene object only stubs drawing and spawning.
function fixture(chapter,{seed=chapter==='encore'?['opening','neon']:['opening'],directorChapter=chapter,storage}={}){
 const e=loadScenes(storage?{storage}:{});e.seed(seed);e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const {PublicStage1EncounterDirector:Dir}=e.loadRuntime('systems/PublicStage1EncounterDirector.mjs'),{PublicStage1PerformerRun:Run}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
 const {BattleScene:B}=e.loadRuntime('scenes/BattleScene.js'),d=new Dir({stageId:1,campaignChapterId:directorChapter});assert(d.enableChapterEvents());assert(d.begin({now:0}));
 const calls=[];for(const name of ['advance','observeChapterEvent','getChapterEventAction','acknowledgeChapterEvent','noteChapterEventRelease','beginAuthoredRole','resolveAuthoredRole','reset']){
  const original=d[name].bind(d);d[name]=(...args)=>{calls.push(name);return original(...args);};}
 const scene={battleData:{stageId:1,performerId:'sakura',campaignChapterId:chapter},_userCastPresentation:true,_isFinaleTrialRound:()=>false,_isPublicStage1Round:()=>true,_battleEnded:false,
  time:{now:100,delayedCall(){return {remove(){}};}},player:{hp:5,active:true},battleRecord:{playerHitCount:0},paintZone:{devices:[],sideSet:{snapshot:()=>side(chapter)}},publicStage1Encounter:d,
  _drawPublicStage1StageCueEmitterGfx(){},_drawPublicStage1SpotlightCaptainGfx(){},_isPublicHarborGroundStrike:()=>false,
  _spawnPublicStage1StageCuePulse(host){const pulse={active:true};host.publicStage1CuePulse=pulse;return pulse;},
  _updatePublicChapterEncounterEvent(){calls.push('scene-update');B.prototype._updatePublicChapterEncounterEvent.call(this);},_showPublicBattleNotice(){}};
 const r=new Run(scene);scene.publicPerformerRun=r;return {e,d,r,B,scene,calls};
}
function linkNeon(f){const {d}=f;d.advance(10,{completed:2,total:10});d.beginAuthoredRole(D);d.observeChapterEvent({disruptorState:'disrupting',remoteDisruptor:true});d.beginAuthoredRole(E);
 f.emitter={active:true,gfx:{clear(){}}};f.scene._publicStage1StageCueEmitter=f.emitter;f.scene._updatePublicChapterEncounterEvent();
 assert.deepEqual(plain(f.r.encounterEvent),{id:'neon-linked-cue',status:'linked'});return f;}
function linkEncore(f){const {d}=f;d.advance(10,{completed:2,total:10});d.beginAuthoredRole(E);d.resolveAuthoredRole(E,'recovery-complete');d.advance(20,{completed:5,total:10});d.beginAuthoredRole(C);
 d.observeChapterEvent({captainSubphase:'entrance'});d.beginAuthoredRole(D);f.captain={active:true,gfx:{clear(){}},publicStage1CaptainSubphase:'captured-cue'};f.scene._publicStage1SpotlightCaptain=f.captain;
 f.scene._updatePublicChapterEncounterEvent();assert.deepEqual(plain(f.r.encounterEvent),{id:'harbor-cue-relay',status:'linked'});return f;}
const release=f=>f.emitter?f.B.prototype._releasePublicStage1StageCueEmitter.call(f.scene,f.emitter):f.B.prototype._releasePublicStage1SpotlightCaptainCue.call(f.scene,f.captain);
const lose=f=>{f.scene.player.hp=0;f.scene.player.active=false;};
const lastEvent=f=>plain(f.e.profile.loadPublicProfile().lastRun?.fieldReport?.event??null);

for(const [chapter,link,id] of [['neon',linkNeon,'neon-linked-cue'],['encore',linkEncore,'harbor-cue-relay']])for(const victory of [false,true]){
 test(`${chapter} ${victory?'victory':'defeat'} on the release frame reports the Director's released event without a Scene update`,()=>{
  const f=link(fixture(chapter));assert(release(f));assert.deepEqual(plain(f.d.getChapterEventSnapshot()),{id,status:'released'});
  if(!victory)lose(f);f.calls.length=0;f.scene.time.now=9000;const result=f.r.finish(victory);
  assert.deepEqual(plain(result.encounterEvent),{id,status:'released'});assert.deepEqual(plain(result.fieldReport.event),{id,status:'released'});
  assert.equal(result.persisted,true);assert.deepEqual(lastEvent(f),{id,status:'released'});
  assert.deepEqual(plain(f.e.profile.loadPublicProfile().chapterReports.chapters[chapter].fieldReport.event),{id,status:'released'});
  const review=f.e.loadRuntime('systems/BattleSurfaceView.mjs').getPublicResultSurfaceModel({buttons:[]},result).encounterReview;assert.equal(review.status,'released');
  assert.deepEqual(f.calls,[],'finish must only read the Director snapshot; no update/action/observe/advance side effects');
  assert.deepEqual(plain(f.d.getChapterEventSnapshot()),{id,status:'released'});
 });
}
test('interrupted, expired and completed latest Director states win over a stale linked copy',()=>{
 const cases={interrupted:d=>{d.resolveAuthoredRole(D,'painted');assert(d.acknowledgeChapterEvent(d.getChapterEventAction({emitterState:'windup'})));},
  expired:d=>{d.resolveAuthoredRole(D,'window-expired');assert.equal(d.getChapterEventAction({emitterState:'windup'}),null);},
  completed:d=>{d.resolveAuthoredRole(E,'recovery-complete');assert.equal(d.getChapterEventAction({}),null);}};
 for(const [status,move] of Object.entries(cases)){const f=linkNeon(fixture('neon'));move(f.d);assert.equal(f.d.getChapterEventSnapshot().status,status);
  f.calls.length=0;lose(f);const result=f.r.finish(false);assert.equal(result.encounterEvent.status,status);assert.equal(result.fieldReport.event.status,status);assert.equal(lastEvent(f).status,status);assert.deepEqual(f.calls,[]);}
});
test('reset, wrong-chapter, malformed and missing Director snapshots preserve the last valid record',()=>{
 const reset=linkNeon(fixture('neon'));assert(release(reset));reset.scene._updatePublicChapterEncounterEvent();reset.d.reset();assert.equal(reset.d.getChapterEventSnapshot(),null);
 lose(reset);assert.equal(reset.r.finish(false).encounterEvent.status,'released');
 const wrong=fixture('neon',{directorChapter:'encore'});assert(wrong.r.recordEncounterEvent({id:'neon-linked-cue',status:'linked'}));linkEncore({...wrong,scene:{...wrong.scene,_updatePublicChapterEncounterEvent(){}},r:{encounterEvent:{id:'harbor-cue-relay',status:'linked'}}});
 assert.equal(wrong.d.getChapterEventSnapshot().id,'harbor-cue-relay');assert.deepEqual(plain(wrong.r.finish(true).encounterEvent),{id:'neon-linked-cue',status:'linked'});
 for(const director of [{getChapterEventSnapshot:()=>({id:'neon-linked-cue',status:'bogus'})},{getChapterEventSnapshot:()=>({id:'invented',status:'released'})},{getChapterEventSnapshot:()=>'released'},{},null,undefined]){
  const f=fixture('neon');assert(f.r.recordEncounterEvent({id:'neon-linked-cue',status:'interrupted'}));f.scene.publicStage1Encounter=director;lose(f);
  const result=f.r.finish(false);assert.deepEqual(plain(result.encounterEvent),{id:'neon-linked-cue',status:'interrupted'});assert.equal(result.fieldReport.event.status,'interrupted');}
 const none=fixture('neon');none.scene.publicStage1Encounter=null;const result=none.r.finish(true);assert.equal(Object.hasOwn(result,'encounterEvent'),false);assert.equal(result.fieldReport.event,null);
});
test('failed first save keeps the captured result on retry; successful repeats are idempotent',()=>{
 const f=linkNeon(fixture('neon'));assert(release(f));lose(f);const set=f.e.storage.setItem;f.e.storage.setItem=(k,v)=>{if(k===KEY)throw new Error('QuotaExceededError');return set(k,v);};
 const first=f.r.finish(false);assert.equal(first.persisted,false);assert.equal(first.encounterEvent.status,'released');assert.equal(first.fieldReport.event.status,'released');
 f.scene.publicStage1Encounter={getChapterEventSnapshot:()=>({id:'neon-linked-cue',status:'interrupted'})};f.e.storage.setItem=set;
 const retry=f.r.finish(false);assert.equal(retry,first);assert.equal(retry.persisted,true);assert.equal(retry.encounterEvent.status,'released');assert.equal(retry.fieldReport.event.status,'released');assert.equal(lastEvent(f).status,'released');
 const saved=f.e.storage.getItem(KEY);assert.equal(f.r.finish(false),first);assert.equal(f.e.storage.getItem(KEY),saved);
 assert.equal(f.e.profile.loadPublicProfile().recordedRunIds.filter(id=>id===first.runId).length,1);
});
test('legacy presentation and finale trial never read the chapter Director at finish',()=>{
 const legacy=linkNeon(fixture('neon'));assert(release(legacy));legacy.scene._userCastPresentation=false;let reads=0;const snap=legacy.d.getChapterEventSnapshot.bind(legacy.d);
 legacy.d.getChapterEventSnapshot=()=>{reads++;return snap();};const before=plain(legacy.r.encounterEvent);legacy.r.finish(true);assert.equal(legacy.r.encounterEvent.status,before.status);
 const e=loadScenes();e.seed(['opening','neon','encore']);e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const api=e.loadRuntime('utils/publicFinaleTrial.mjs'),prep=e.loadRuntime('utils/publicPreparation.mjs'),Run=e.loadRuntime('systems/PublicStage1PerformerRun.mjs').PublicStage1PerformerRun,profile=e.profile.loadPublicProfile();
 const data=api.createFinaleTrialData({stageId:1,performerId:'sakura',characterId:'sakura',team:[{characterId:'sakura'}],practiceMode:false,defenseMode:false,publicPreparation:prep.getPreparationSnapshot(profile,'sakura')},['wide_brush','echo'],profile);
 const scene={battleData:data,_isFinaleTrialRound:()=>true,_isPublicStage1Round:()=>true,_userCastPresentation:true,time:{now:100},player:{hp:5,active:true},battleRecord:{playerHitCount:0},
  publicStage1Encounter:{getChapterEventSnapshot(){reads++;return {id:'neon-linked-cue',status:'released'};}}};
 const r=new Run(scene);scene.time.now=200;const result=r.finish(false);assert(result.trial);assert.equal(Object.hasOwn(result,'encounterEvent'),false);assert.equal(reads,0);
});
