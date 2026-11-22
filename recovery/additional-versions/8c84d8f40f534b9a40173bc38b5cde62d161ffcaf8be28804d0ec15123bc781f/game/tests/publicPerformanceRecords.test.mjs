import assert from 'node:assert/strict';
import test from 'node:test';
import { loadScenes, plain } from './helpers/publicShellHarness.mjs';

const run = (runId, extra = {}) => ({ runId, performerId:'sakura', chapterId:'opening',
  victory:true, durationMs:40000, choices:['wide_brush','echo'],
  performance:{hitCount:2, actions:4}, ...extra });

test('real victories retain independent fastest and fewest-hit records; losses and duplicates cannot replace them', () => {
  const e=loadScenes(), p=e.profile;
  let saved=p.recordPublicRun(run('first'));
  assert(saved.performance,'Measured victory must create a finite performance record');
  const key='opening:sakura';
  assert.deepEqual(plain(saved.performance.records[key]),{bestTime:{durationMs:40000,hitCount:2,actions:4},bestHits:{durationMs:40000,hitCount:2,actions:4}});
  saved=p.recordPublicRun(run('fast',{durationMs:30000,performance:{hitCount:3,actions:5}}));
  assert.equal(saved.performance.records[key].bestTime.durationMs,30000);
  assert.equal(saved.performance.records[key].bestHits.hitCount,2);
  saved=p.recordPublicRun(run('clean',{durationMs:50000,performance:{hitCount:0,actions:2}}));
  assert.equal(saved.performance.records[key].bestTime.hitCount,3);
  assert.equal(saved.performance.records[key].bestHits.hitCount,0);
  const before=plain(saved.performance);
  saved=p.recordPublicRun(run('loss',{victory:false,durationMs:1000,performance:{hitCount:0,actions:0}}));
  assert.deepEqual(plain(saved.performance),before);
  const count=saved.clears;
  saved=p.recordPublicRun(run('fast',{durationMs:1,performance:{hitCount:0,actions:0}}));
  assert.equal(saved.clears,count);assert.deepEqual(plain(saved.performance),before);
  saved.performance.records[key].bestTime.durationMs=1;
  assert.equal(p.loadPublicProfile().performance.records[key].bestTime.durationMs,30000,'Returned profile must be detached');
});

test('legacy/unmeasured runs never fabricate no-hit records; numeric invalid samples are excluded', () => {
  const e=loadScenes(),p=e.profile;
  for(const performance of [undefined,{hitCount:NaN,actions:1},{hitCount:-1,actions:1},{hitCount:1,actions:Infinity}]) {
    const saved=p.recordPublicRun(run('legacy-'+p.loadPublicProfile().attempts,{performance}));
    assert.equal(saved.performance,undefined);
  }
  assert.equal(p.loadPublicProfile().clears,4,'Missing telemetry must not invalidate old result contracts');
});

test('pending save retries merge records without double settlement or rewriting future/corrupt records', () => {
  const e=loadScenes(),p=e.profile,write=e.storage.setItem;
  e.storage.setItem=()=>{throw Error('quota');};
  const pending=p.recordPublicRun(run('pending'));
  assert.equal(pending.persisted,false);assert(pending.performance);
  e.storage.setItem=write;
  const saved=p.retryPublicProfileSave();assert.equal(saved.persisted,true);assert.equal(saved.clears,1);
  assert.equal(saved.performance.records['opening:sakura'].bestTime.durationMs,40000);
  for(const bad of [{version:99,records:{}},{version:1,records:{'opening:sakura':{bestTime:{durationMs:-1},bestHits:{}}}}]) {
    const raw=JSON.stringify({...saved,performance:bad});e.storage.setItem('starush.public-profile',raw);
    const result=p.recordPublicRun(run('must-not-write'));
    assert.equal(result.persisted,false);assert(result.recovery);assert.equal(e.storage.getItem('starush.public-profile'),raw);
  }
});

test('retry merges a newer external run and rejects later silent loss of measured records', () => {
  const e=loadScenes(),p=e.profile,write=e.storage.setItem;
  p.recordPublicRun(run('stored',{durationMs:45000}));
  const disk=JSON.parse(e.storage.getItem('starush.public-profile'));
  e.storage.setItem=()=>{throw Error('quota');};
  p.recordPublicRun(run('local',{durationMs:30000,performance:{hitCount:4,actions:5}}));
  e.storage.setItem=write;
  disk.attempts++;disk.clears++;disk.clearsByPerformer.sakura++;disk.campaign.chapterClears.opening++;
  disk.recordedRunIds.push('external');
  disk.performance.records['opening:sakura'].bestHits={durationMs:48000,hitCount:0,actions:3};
  e.storage.setItem('starush.public-profile',JSON.stringify(disk));
  const saved=p.retryPublicProfileSave();assert.equal(saved.clears,3);
  assert.equal(saved.performance.records['opening:sakura'].bestTime.durationMs,30000);
  assert.equal(saved.performance.records['opening:sakura'].bestHits.hitCount,0);
  assert.equal(p.retryPublicProfileSave().clears,3);
  const raw=JSON.stringify({...saved,performance:undefined});e.storage.setItem('starush.public-profile',raw);
  const result=p.selectPublicPerformer('kai');assert.equal(result.persisted,false);assert(result.recovery);
  assert.equal(e.storage.getItem('starush.public-profile'),raw);
});

test('unrecognized run identity never invents a measured Sakura record', () => {
  const e=loadScenes();const result=e.profile.recordPublicRun(run('invalid-member',{performerId:'typo'}));
  assert.equal(result.performance,undefined);
});

test('result counters reject overflow rather than write a profile that cannot reload', () => {
  const e=loadScenes(),p=e.profile;
  const max=Number.MAX_SAFE_INTEGER;
  const saved=p.recordPublicRun(run('seed'));
  saved.attempts=max; saved.clears=max; saved.clearsByPerformer.sakura=max;
  saved.campaign.chapterClears.opening=max;
  const raw=JSON.stringify(saved);e.storage.setItem('starush.public-profile',raw);
  const result=p.recordPublicRun(run('overflow'));
  assert.equal(result.attempts,max);assert.equal(result.clears,max);
  assert.equal(result.recordedRunIds.includes('overflow'),false);
  assert.equal(e.storage.getItem('starush.public-profile'),raw);
});

test('records stay isolated by chapter/member and the tour shows current member goals without granting rewards', () => {
  const e=loadScenes(),p=e.profile;
  p.recordPublicRun(run('sakura'));
  p.recordPublicRun(run('kai',{performerId:'kai',durationMs:45000,performance:{hitCount:0,actions:3}}));
  p.recordPublicRun(run('neon',{chapterId:'neon',durationMs:42000,performance:{hitCount:1,actions:3}}));
  p.selectPublicChapter('opening');
  const before=plain(p.loadPublicProfile()),h=e.harness(e.TourRouteScene);h.scene.create();
  assert(h.query('.shell-performance-record'),'Tour must surface actual replay records');
  assert.match(h.query('.shell-performance-record').textContent,/40\.00秒/);
  assert.match(h.query('.shell-performance-record').textContent,/最少受击.*2/);
  h.click('[data-chapter=neon]');assert.match(h.query('.shell-performance-record').textContent,/42\.00秒/);
  assert.deepEqual(plain(p.loadPublicProfile()),before);h.shutdown();
  p.selectPublicPerformer('kai');const k=e.harness(e.TourRouteScene);k.scene.create();
  assert.match(k.query('.shell-performance-record').textContent,/苍海/);
  assert.match(k.query('.shell-performance-record').textContent,/无伤通关/);k.shutdown();
});

test('real performer result captures damage events before cleanup; restored HP cannot fake no-hit', () => {
  const e=loadScenes(),{PublicStage1PerformerRun}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
  const s={battleData:{stageId:1,performerId:'kai',campaignChapterId:'opening'},time:{now:0},
    player:{hp:5,maxHp:5},battleRecord:{playerHitCount:2},
    paintZone:{getObjectiveProgress:()=>({completed:10,total:10}),finaleMode:true}};
  const r=new PublicStage1PerformerRun(s);r.actions=3;s.time.now=40000;
  const result=r.finish(true);
  assert(result.performance,'Real result must capture measured damage events');
  assert.deepEqual(plain(result.performance),{hitCount:2,actions:3});
  assert.equal(result.performanceComparison.noHit,false);assert.equal(result.performanceComparison.firstRecord,true);
  assert.equal(e.profile.loadPublicProfile().performance.records['opening:kai'].bestHits.hitCount,2);
  s.battleRecord.playerHitCount=0;assert.equal(r.finish(true).performance.hitCount,2);
});

test('result shows measured hits and honest record comparison; legacy result does not claim zero hits', () => {
  const e=loadScenes(),api=e.loadRuntime('systems/BattleSurfaceView.mjs');
  const scene={input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},events:{once(){},off(){}}};
  const make=data=>new api.BattleSurfaceView(scene,{mode:'result',model:api.getPublicResultSurfaceModel({buttons:[]},data),onAction(){}},e.document);
  const v=make({...run('ui'),actions:4,persisted:true,performanceComparison:{hitCount:2,firstRecord:false,newBestTime:true,newFewestHits:false,noHit:false}});
  assert.match(v.root.querySelector('.battle-result-stats').textContent,/受击.*2 次/);
  assert.match(v.root.querySelector('.battle-performance-record').textContent,/刷新个人用时/);
  assert.doesNotMatch(v.root.querySelector('.battle-performance-record').textContent,/无伤/);v.destroy();
  const legacy=make({...run('old'),performance:undefined});
  assert.equal(legacy.root.querySelector('.battle-performance-record'),null);legacy.destroy();
});

test('all fifteen member/chapter records preserve existing reward and training conservation', () => {
  const e=loadScenes(),p=e.profile,prep=e.loadRuntime('utils/publicPreparation.mjs');
  for(const chapterId of ['opening','neon','encore'])for(const {id:performerId} of p.PUBLIC_PERFORMERS)
    p.recordPublicRun(run(chapterId+'-'+performerId,{chapterId,performerId}));
  let saved=p.loadPublicProfile();assert.equal(Object.keys(saved.performance.records).length,15);
  assert.equal(saved.clears,15);assert.deepEqual(plain(prep.getPreparationResources(saved)),{earned:54,spent:0,balance:54});
  for(const {id} of p.PUBLIC_PERFORMERS){assert.equal(p.trainPublicPerformer(id,1).preparationStatus,'trained');assert.equal(p.trainPublicPerformer(id,2).preparationStatus,'trained');}
  saved=p.loadPublicProfile();assert.deepEqual(plain(prep.getPreparationResources(saved)),{earned:54,spent:45,balance:9});
  for(const {id} of p.PUBLIC_PERFORMERS)assert.equal(p.trainPublicPerformer(id,3).preparationStatus,'max-level');
  const before=plain(saved.performance);p.recordPublicRun(run('failed',{victory:false}));
  assert.deepEqual(plain(p.loadPublicProfile().performance),before);
  assert.deepEqual(plain(prep.getPreparationResources(p.loadPublicProfile())),{earned:54,spent:45,balance:9});
});
