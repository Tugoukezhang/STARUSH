import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
import {existsSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {PUBLIC_RULESET_ID} from '../src/utils/releaseIdentity.mjs';

const RULES=PUBLIC_RULESET_ID;
const run=(runId,extra={})=>({runId,performerId:'sakura',chapterId:'opening',victory:true,
  durationMs:40000,choices:['wide_brush','recovery'],performance:{hitCount:2,actions:4},...extra});

test('current rules never overwrite or compare with unversioned historical records',()=>{
  const e=loadScenes(),p=e.profile,api=e.loadRuntime('utils/publicPerformanceRecords.mjs');
  const old=p.recordPublicRun(run('legacy',{durationMs:1000,performance:{hitCount:0,actions:1}}));
  const raw=e.storage.getItem('starush.public-profile'),history=plain(old.performance);
  assert.equal(api.getPublicPerformanceRecord(old,'opening','sakura',RULES),null);
  assert.equal(e.storage.getItem('starush.public-profile'),raw,'Reading old saves must never migrate/write');
  const saved=p.recordPublicRun(run('current',{rulesetId:RULES}));
  assert.equal(saved.lastRun.rulesetId,RULES);
  assert.deepEqual(plain(saved.performance.records),history.records);
  assert.equal(api.getPublicPerformanceRecord(saved,'opening','sakura',RULES).bestTime.durationMs,40000);
  assert.equal(api.getPublicPerformanceRecord(saved,'opening','sakura').bestTime.durationMs,1000);
  const detached=api.getPublicPerformanceRecord(saved,'opening','sakura',RULES);detached.bestTime.durationMs=1;
  assert.equal(api.getPublicPerformanceRecord(p.loadPublicProfile(),'opening','sakura',RULES).bestTime.durationMs,40000);
});

test('current records survive quota retry once, retain historical rewards, and reject silent ruleset loss',()=>{
  const e=loadScenes(),p=e.profile,write=e.storage.setItem;
  p.recordPublicRun(run('old'));const disk=JSON.parse(e.storage.getItem('starush.public-profile'));
  e.storage.setItem=()=>{throw Error('quota');};
  const pending=p.recordPublicRun(run('queued',{rulesetId:RULES,durationMs:30000}));
  assert.equal(pending.persisted,false);assert.equal(pending.performance.rulesets[RULES]['opening:sakura'].bestTime.durationMs,30000);
  assert.equal(e.storage.getItem('starush.public-profile'),JSON.stringify(disk));
  e.storage.setItem=write;const saved=p.retryPublicProfileSave();
  assert.equal(saved.persisted,true);assert.equal(saved.clears,2);assert.equal(p.retryPublicProfileSave().clears,2);
  assert.deepEqual(plain(saved.performance.records),disk.performance.records);
  const raw=JSON.stringify({...saved,performance:{...saved.performance,rulesets:undefined}});
  e.storage.setItem('starush.public-profile',raw);
  const rejected=p.selectPublicPerformer('kai');assert.equal(rejected.persisted,false);assert(rejected.recovery);
  assert.equal(e.storage.getItem('starush.public-profile'),raw);
});

test('corrupt rulesets and malformed run identities never become legacy successes',()=>{
  for(const rulesets of [[],{'bad id':{}},{[RULES]:{'opening:sakura':{bestTime:{durationMs:-1},bestHits:{}}}}]){
    const e=loadScenes(),p=e.profile,saved=p.recordPublicRun(run('old'));
    const raw=JSON.stringify({...saved,performance:{...saved.performance,rulesets}});e.storage.setItem('starush.public-profile',raw);
    const result=p.recordPublicRun(run('no-overwrite',{rulesetId:RULES}));
    assert.equal(result.persisted,false);assert(result.recovery);assert.equal(e.storage.getItem('starush.public-profile'),raw);
  }
  for(const rulesetId of ['',null,123,'bad id']){
    const e=loadScenes();assert.equal(e.profile.recordPublicRun(run('invalid',{rulesetId})).clears,0);
  }
});

test('current-cast challenges require current-rule records and cannot evaluate against another ruleset',()=>{
  const e=loadScenes(),p=e.profile,cast=e.loadRuntime('utils/userCast.mjs'),goals=e.loadRuntime('utils/publicRunGoals.mjs');
  p.recordPublicRun(run('legacy'));p.selectPublicChapter('opening');cast.configureUserCast(true);
  assert.equal(goals.getPublicRunGoalOptions(p.loadPublicProfile()).find(v=>v.id==='pace').available,false);
  assert.equal(goals.selectPublicRunGoal(p.loadPublicProfile(),'pace'),false);
  p.recordPublicRun(run('current',{rulesetId:RULES}));p.selectPublicChapter('opening');
  assert.equal(goals.selectPublicRunGoal(p.loadPublicProfile(),'pace'),true);
  const goal=goals.capturePublicRunGoal(p.loadPublicProfile());assert.equal(goal.rulesetId,RULES);assert.equal(goal.target,40000);
  assert.equal(goals.evaluatePublicRunGoal(goal,run('old-fast',{durationMs:2000})),null);
  assert.equal(goals.evaluatePublicRunGoal(goal,run('new-fast',{durationMs:30000,rulesetId:RULES})).status,'met');
  cast.configureUserCast(false);assert.equal(goals.capturePublicRunGoal(p.loadPublicProfile()),null);
});

test('the actual current-cast result writer stamps rules and establishes a new record, not a false improvement',()=>{
  const e=loadScenes(),p=e.profile;p.recordPublicRun(run('old',{durationMs:1000}));
  e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const {PublicStage1PerformerRun}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
  const scene={_userCastPresentation:{},battleData:{stageId:1,performerId:'sakura',campaignChapterId:'opening'},
    time:{now:0},player:{hp:5,maxHp:5},battleRecord:{playerHitCount:2},paintZone:{getObjectiveProgress:()=>({completed:10,total:10}),finaleMode:true}};
  const owner=new PublicStage1PerformerRun(scene);scene.time.now=40000;const result=owner.finish(true);
  assert.equal(result.rulesetId,RULES);assert.equal(result.performanceComparison.firstRecord,true);
  assert.equal(result.performanceComparison.newBestTime,false);assert.equal(p.loadPublicProfile().lastRun.rulesetId,RULES);
});

test('current archive separates readable history without writes or enabling current challenges',()=>{
  const e=loadScenes();e.profile.recordPublicRun(run('old'));e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const raw=e.storage.getItem('starush.public-profile'),h=e.harness(e.TitleScene);h.scene.create();
  h.click('[data-action=home-records]');
  const text=h.text;
  assert.match(text,/当前规则/);assert.match(text,/历史纪录/);assert.match(text,/40\.00秒/);
  assert.equal(e.storage.getItem('starush.public-profile'),raw);h.shutdown();
});

test('release fingerprint is deterministic, changes with shipped inputs, and ignores unrelated QA files',async()=>{
  const location=new URL('../scripts/release-identity.mjs',import.meta.url);
  assert.ok(existsSync(location),'A deterministic release fingerprint must exist');
  const {createReleaseIdentity}=await import(location),root=mkdtempSync(path.join(tmpdir(),'starush-release-'));
  try{
    mkdirSync(path.join(root,'src'));mkdirSync(path.join(root,'scripts'));
    for(const file of ['index.html','package.json','package-lock.json','vite.config.js','scripts/runtime-payload.mjs','scripts/release-identity.mjs','src/main.js'])writeFileSync(path.join(root,file),'original');
    const assets=[{file:'sprite.webp',sha256:'a'}],first=createReleaseIdentity(root,assets);
    assert.match(first.buildId,/^rc-[a-f0-9]{12}$/);assert.equal(first.rulesetId,RULES);
    assert.deepEqual(createReleaseIdentity(root,assets),first);
    writeFileSync(path.join(root,'unrelated-qa.json'),'not shipped');assert.deepEqual(createReleaseIdentity(root,assets),first);
    writeFileSync(path.join(root,'src/main.js'),'changed');assert.notEqual(createReleaseIdentity(root,assets).buildId,first.buildId);
    writeFileSync(path.join(root,'src/main.js'),'original');assert.notEqual(createReleaseIdentity(root,[{file:'sprite.webp',sha256:'b'}]).buildId,first.buildId);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('valid future ruleset IDs cannot resolve inherited object properties or contaminate legacy entries',()=>{
  const e=loadScenes(),p=e.profile,saved=p.recordPublicRun(run('future',{rulesetId:'constructor'}));
  assert.equal(Object.hasOwn(saved.performance.rulesets,'constructor'),true);
  assert.equal(Object.hasOwn(JSON.parse(e.storage.getItem('starush.public-profile')).performance.rulesets,'constructor'),true);
  assert.equal(saved.performance.rulesets.constructor['opening:sakura'].bestTime.durationMs,40000);
  assert.deepEqual(plain(saved.performance.records),{});
  assert.equal(p.loadPublicProfile().performance.rulesets.constructor['opening:sakura'].bestTime.durationMs,40000);
});
