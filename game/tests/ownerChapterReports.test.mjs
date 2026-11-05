import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,plain,storageFixture} from './helpers/publicShellHarness.mjs';
import {captureChapterFieldReport,normalizeChapterFieldReport,normalizeChapterReports,getChapterFieldReview} from '../src/utils/publicChapterReports.mjs';
import {PUBLIC_RULESET_ID} from '../src/utils/releaseIdentity.mjs';
import * as profileApi from '../src/utils/publicRunProgression.mjs';
const key='starush.public-profile';
const side=chapterId=>({chapterId,total:4,completed:2,zones:[{zone:0,branch:'west',completed:2},{zone:1,branch:null,completed:0}]});
const run=(chapterId='opening',id='report-one')=>({runId:id,chapterId,performerId:'sakura',rulesetId:PUBLIC_RULESET_ID,victory:false,durationMs:12000,chapterSideSet:side(chapterId),finaleResponses:[]});
const summary=(chapter='opening',id='report-one')=>{const r=run(chapter,id);return {...r,fieldReport:captureChapterFieldReport(r)};};

test('reports capture only actual bounded evidence and never convert absence into success',()=>{
 const r=run(),report=captureChapterFieldReport(r);assert(report);assert.equal(report.event,null);assert.deepEqual(report.finaleResponses,[]);assert.equal(report.sideSet.completed,2);
 r.chapterSideSet.zones[0].completed=0;assert.equal(report.sideSet.zones[0].completed,2);
 assert.match(getChapterFieldReview({...summary(),fieldReport:report}).event,/未记录/);
 assert.equal(captureChapterFieldReport({...run(),chapterSideSet:undefined}),null);
 for(const change of [{performerId:'venus'},{rulesetId:'owner-three-chapter-v1'},{chapterId:'bad'}])assert.equal(captureChapterFieldReport({...run(),...change}),null);
});
test('strict metadata rejects sparse data, cross-chapter events, unknown version and unsupported outcomes',()=>{
 const r=run('neon'),p=captureChapterFieldReport(r);assert(p);
 for(const change of [{version:2},{extra:true},{sideSet:{...p.sideSet,zones:Array(2)}},{finaleResponses:Array(1)},{event:{id:'harbor-cue-relay',status:'interrupted'}},{finaleResponses:[{index:0,pattern:'captured-line',outcome:'win'}]}])assert.equal(normalizeChapterFieldReport({...p,...change},r),null);
 assert.equal(captureChapterFieldReport({...r,encounterEvent:{id:'neon-linked-cue',status:'released'}}).event.status,'released');
});
test('writer persists one latest terminal report per chapter, replay is idempotent and reports cannot unlock chapters',()=>{
 const e=loadScenes();const r=summary();let p=e.profile.recordPublicRun(r);assert(p.persisted);assert.equal(p.chapterReports.chapters.opening.runId,r.runId);assert.equal(p.campaign.clearedChapterIds.length,0);
 p=e.profile.recordPublicRun(r);assert.equal(p.attempts,1);
 e.profile.recordPublicRun(summary('neon','locked'));assert.equal(e.profile.loadPublicProfile().chapterReports.chapters.neon,undefined);
 p=e.profile.recordPublicRun({...summary('opening','second'),victory:true});assert.equal(p.chapterReports.chapters.opening.runId,'second');
 assert.deepEqual(Object.keys(p.chapterReports.chapters),['opening']);
 p.chapterReports.chapters.opening.fieldReport.sideSet.zones[0].completed=0;assert.equal(e.profile.loadPublicProfile().chapterReports.chapters.opening.fieldReport.sideSet.zones[0].completed,2);
});
test('legacy counted clears do not invent events, and later legacy results preserve existing field reports',()=>{
 const e=loadScenes();e.seed(['opening']);assert.equal(e.profile.loadPublicProfile().chapterReports,undefined);
 e.profile.recordPublicRun(summary());e.profile.recordPublicRun({runId:'legacy-next',performerId:'sakura',chapterId:'neon',victory:true});
 const p=e.profile.loadPublicProfile();assert(p.chapterReports.chapters.opening);assert.equal(p.chapterReports.chapters.neon,undefined);
});
test('failed saves merge actual report exactly once over newer valid progress and retry survives reload',()=>{
 const storage=storageFixture(),e=loadScenes({storage});e.seed([]);const old=storage.getItem(key),set=storage.setItem;storage.setItem=()=>{throw Error('quota');};
 let p=e.profile.recordPublicRun({...summary(),victory:true});assert.equal(p.persisted,false);assert.equal(storage.getItem(key),old);assert(p.hasPendingSave);
 storage.setItem=set;p=e.profile.retryPublicProfileSave();assert(p.persisted);assert.equal(p.attempts,1);
 const fresh=loadScenes({storage}).profile.loadPublicProfile();assert.equal(fresh.chapterReports.chapters.opening.runId,'report-one');assert.equal(fresh.attempts,1);
});
test('malformed, future or removed previously known archives protect original raw save',()=>{
 for(const mode of ['future','invalid','removed','entry-removed','last-future','last-invalid']){
  const e=loadScenes();e.profile.recordPublicRun(summary());const raw=JSON.parse(e.storage.getItem(key));
  if(mode==='future')raw.chapterReports.version=2;else if(mode==='removed')delete raw.chapterReports;else if(mode==='entry-removed')delete raw.chapterReports.chapters.opening;
  else if(mode==='last-future')raw.lastRun.fieldReport.version=2;else if(mode==='last-invalid')raw.lastRun.fieldReport.sideSet.completed=9;else raw.chapterReports.chapters.opening.fieldReport.sideSet.completed=9;
  const text=JSON.stringify(raw);e.storage.setItem(key,text);const p=e.profile.loadPublicProfile();assert(p.recovery,mode);assert.equal(p.persisted,false);e.profile.selectPublicPerformer('kai');assert.equal(e.storage.getItem(key),text);
 }
});
test('backup preview and restore carry canonical reports without repairing forged archive data',()=>{
 const e=loadScenes();e.profile.recordPublicRun(summary());const source=e.profile.getPublicProfileBackupSource();assert.equal(source.status,'ready');
 const target=storageFixture();const proposal=profileApi.previewPublicProfileRestore(plain(source.profile),target);assert.equal(proposal.status,'ready');assert.equal(profileApi.confirmPublicProfileRestore(proposal,target).status,'restored');
 assert.deepEqual(plain(profileApi.loadPublicProfile(target).chapterReports),plain(source.profile.chapterReports));
 const bad=plain(source.profile);bad.chapterReports.chapters.neon={...bad.chapterReports.chapters.opening,chapterId:'neon'};assert.equal(profileApi.previewPublicProfileRestore(bad,target).status,'invalid-profile');
});
test('chapter page exists on hub/archive, browsing never saves and preparing still requires existing confirmation',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('playhub');h.click('[data-action=hub-chapter-archive]');
 assert.equal(h.root.dataset.page,'chapterArchive');assert(!h.text.includes('最近一次现场 · 尚未保存'),'No pending scene exists on a fresh profile');const before=e.storage.getItem(key);
 h.click('[data-report-chapter=neon]');assert(h.query('[data-action=report-prepare]').disabled);assert.match(h.text,/尚未开放/);assert.equal(e.storage.getItem(key),before);
 h.click('[data-report-chapter=opening]');h.click('[data-action=report-prepare]');assert.equal(h.root.dataset.page,'tour');assert.equal(e.storage.getItem(key),before);assert(h.query('[data-action=confirm-chapter]'));h.shutdown();
});
test('archive validates durable run bindings and never mutates caller objects',()=>{
 const e=loadScenes();e.profile.recordPublicRun(summary());const p=plain(e.profile.loadPublicProfile()),valid=normalizeChapterReports(p.chapterReports,p);assert(valid);
 const bad=plain(valid);bad.chapters.opening.runId='invented';assert.equal(normalizeChapterReports(bad,p),null);
 assert.equal(normalizeChapterReports({...valid,chapters:{...valid.chapters,unknown:valid.chapters.opening}},p),null);
});
test('historical rule reports remain loadable but capture always belongs to the current rules',()=>{
 const e=loadScenes();e.profile.recordPublicRun(summary());const p=plain(e.profile.loadPublicProfile());p.chapterReports.chapters.opening.rulesetId='owner-three-chapter-v12';p.lastRun.rulesetId='owner-three-chapter-v12';
 assert(normalizeChapterReports(p.chapterReports,p));assert.equal(captureChapterFieldReport({...run(),rulesetId:'owner-three-chapter-v12'}),null);
});
test('real ordinary result captures map evidence before cleanup for all three members',()=>{
 for(const performerId of ['sakura','kai','enjo']){
  const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const {PublicStage1PerformerRun}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
  const scene={battleData:{stageId:1,performerId,campaignChapterId:'opening'},_userCastPresentation:true,_isFinaleTrialRound:()=>false,_isPublicStage1Round:()=>true,
   time:{now:100,delayedCall(){return {remove(){}};}},player:{hp:5,active:true},battleRecord:{playerHitCount:0},paintZone:{devices:[],sideSet:{snapshot:()=>side('opening')}}};
  const r=new PublicStage1PerformerRun(scene);scene.publicPerformerRun=r;scene.time.now=500;const result=r.finish(false);assert.equal(result.fieldReport.sideSet.completed,2);assert.equal(e.profile.loadPublicProfile().chapterReports.chapters.opening.performerId,performerId);r.destroy();
 }
});
test('preparation and replay atomic commits retain all archive protection flags',()=>{
 for(const mode of ['equipment','replay']){
  const e=loadScenes();e.profile.recordPublicRun({...summary(),victory:true});
  if(mode==='equipment')assert.equal(e.profile.equipPublicPerformer('sakura','wide_nozzle').preparationStatus,'equipped');
  else {const p=e.profile.loadPublicProfile();assert.equal(e.profile.selectPublicReplaySession({performerId:'kai',chapterId:'opening'},{performerId:p.selectedId,chapterId:p.campaign.selectedChapterId}).sessionStatus,'selected');}
  const raw=JSON.parse(e.storage.getItem(key));delete raw.chapterReports;const text=JSON.stringify(raw);e.storage.setItem(key,text);assert(e.profile.loadPublicProfile().recovery,mode);e.profile.selectPublicPerformer('enjo');assert.equal(e.storage.getItem(key),text);
 }
});
test('backup rejects same-run contradictions and impossible losses',()=>{
 const s=storageFixture();profileApi.recordPublicRun({...summary(),victory:true},s);const p=profileApi.getPublicProfileBackupSource({},s).profile;
 for(const change of [r=>r.victory=false,r=>r.durationMs++,r=>r.performerId='kai']){const bad=plain(p);change(bad.chapterReports.chapters.opening);assert.equal(profileApi.previewPublicProfileRestore(bad,storageFixture()).status,'invalid-profile');}
});
test('pending report replays exactly once over another writer durable chapter result',()=>{
 const e=loadScenes();e.seed([]);const set=e.storage.setItem;e.storage.setItem=()=>{throw Error('quota');};e.profile.recordPublicRun({...summary('opening','pending'),victory:true});e.storage.setItem=set;
 profileApi.recordPublicRun({...summary('opening','concurrent'),victory:true},e.storage);
 const p=e.profile.retryPublicProfileSave();assert.equal(p.clears,2);assert.equal(p.attempts,2);assert(p.recordedRunIds.includes('pending')&&p.recordedRunIds.includes('concurrent'));assert.equal(p.chapterReports.chapters.opening.runId,'pending');
 assert.equal(e.profile.retryPublicProfileSave().attempts,2);
});
test('canonical backup comparisons do not depend on object property order',()=>{
 const s=storageFixture();profileApi.recordPublicRun(summary(),s);const p=profileApi.getPublicProfileBackupSource({},s).profile;
 const original=p.chapterReports.chapters.opening.fieldReport.sideSet;p.chapterReports.chapters.opening.fieldReport.sideSet=Object.fromEntries(Object.entries(original).reverse());
 assert.equal(profileApi.previewPublicProfileRestore(p,storageFixture()).status,'ready');
});
test('actual finale-trial and rehearsal finish paths never save ordinary chapter reports',()=>{
 const e=loadScenes();e.seed(['opening','neon','encore']);e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const api=e.loadRuntime('utils/publicFinaleTrial.mjs'),prep=e.loadRuntime('utils/publicPreparation.mjs'),Run=e.loadRuntime('systems/PublicStage1PerformerRun.mjs').PublicStage1PerformerRun;
 const profile=e.profile.loadPublicProfile(),base={stageId:1,performerId:'sakura',characterId:'sakura',team:[{characterId:'sakura'}],practiceMode:false,defenseMode:false,publicPreparation:prep.getPreparationSnapshot(profile,'sakura')};
 for(const data of [api.createFinaleTrialData(base,['wide_brush','echo'],profile),api.createRehearsalData(base,['wide_brush','echo'],profile,{chapterId:'opening',focus:'clear'})]){
  assert(data);const before=e.storage.getItem(key),scene={battleData:data,_isFinaleTrialRound:()=>true,_isPublicStage1Round:()=>true,_userCastPresentation:true,time:{now:100},player:{hp:5,active:true},battleRecord:{playerHitCount:0}};
  const r=new Run(scene);scene.publicPerformerRun=r;scene.time.now=200;assert(r.finish(false).trial);assert.equal(e.storage.getItem(key),before);assert.equal(e.profile.loadPublicProfile().chapterReports,undefined);r.destroy();
 }
});
