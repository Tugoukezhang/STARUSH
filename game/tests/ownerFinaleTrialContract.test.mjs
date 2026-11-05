import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
import {createFinaleTrialData,getFinaleTrialState,finishFinaleTrialRound,nextFinaleTrialData,retryFinaleTrialData,FINALE_TRIAL_CHOICES,isFinaleTrialUnlocked} from '../src/utils/publicFinaleTrial.mjs';
import {resolvePublicRunContext} from '../src/utils/publicRunContext.mjs';
const profile={version:1,clears:3,campaign:{version:1,selectedChapterId:'opening',chapterClears:{opening:1,neon:1,encore:1},completed:true}};
const base={stageId:1,practiceMode:false,defenseMode:false,performerId:'sakura',characterId:'sakura',team:[{characterId:'sakura'}],campaignChapterId:'opening',publicRunGoal:{kind:'standard'},publicRoutePlan:{id:'east'}};
const data=()=>createFinaleTrialData(base,['wide_brush','echo'],profile);
test('explicit unlock, meaningful pools, member and experiment fail-closed',()=>{
 assert.deepEqual(FINALE_TRIAL_CHOICES,[['wide_brush','tempo'],['echo','overdrive']]);
 assert.equal(createFinaleTrialData(base,['relay','recovery'],profile),null);
 assert.equal(createFinaleTrialData(base,['wide_brush','echo'],{...profile,clears:0}),null);
 for(const change of [{performerId:'venus'},{characterId:'kai'},{practiceMode:true},{p15KaiPrototypeExperiment:true}])assert.equal(createFinaleTrialData({...base,...change},['tempo','overdrive'],profile),null);
 assert.equal(data().publicRunGoal,undefined);assert.equal(data().publicRoutePlan,undefined);
});
test('three original chapter rounds carry exact HP, totals and unchanged build; retry starts whole attempt',()=>{
 let d=data();assert.equal(getFinaleTrialState(d).startHp,5);
 for(const [i,hp]of [4,3,2].entries()){
  assert.equal(getFinaleTrialState(d).roundIndex,i);
  const r=finishFinaleTrialRound(d,{victory:true,hp,durationMs:12000,hitCount:1,actions:2});
  assert.equal(r.complete,i===2);assert.equal(r.rounds.length,i+1);assert.equal(r.totalHits,i+1);
  const retry=retryFinaleTrialData(d);assert.equal(getFinaleTrialState(retry).roundIndex,0);assert.equal(getFinaleTrialState(retry).startHp,5);
  if(i<2){d=nextFinaleTrialData(d,r);assert.equal(getFinaleTrialState(d).startHp,hp);}else assert.equal(nextFinaleTrialData(d,r),null);
 }
});
test('defeat and malformed carry cannot advance or fall back into campaign',()=>{
 const d=data(),r=finishFinaleTrialRound(d,{victory:false,hp:0,durationMs:32000,hitCount:5,actions:0});
 assert.equal(nextFinaleTrialData(d,r),null);assert.equal(r.complete,false);
 assert.equal(getFinaleTrialState({...d,campaignChapterId:'neon'}),null);
 assert.equal(getFinaleTrialState({...d,publicFinaleTrial:{...d.publicFinaleTrial,roundIndex:1}}),null);
 assert.equal(finishFinaleTrialRound(d,{victory:true,hp:6,durationMs:1,hitCount:0,actions:0}),null);
});
test('real consumers isolate trial before campaign saves and legacy writes',async()=>{
 const {PublicStage1PerformerRun}=await import('../src/systems/PublicStage1PerformerRun.mjs');
 const {configureUserCast}=await import('../src/utils/userCast.mjs');configureUserCast(true);
 const s={battleData:data(),_userCastPresentation:true,_isFinaleTrialRound:()=>true,time:{now:100},player:{hp:4},battleRecord:{playerHitCount:1}};
 const run=new PublicStage1PerformerRun(s);s.publicPerformerRun=run;
 assert.deepEqual(run.growth.choices,['wide_brush','echo']);assert.equal(run.getAttemptProgress(),null);
 const first=run.finish(true);assert.equal(first.trial,true);assert.equal(first.recorded,false);assert.equal(first.persisted,false);assert.equal(run.finish(true),first);
 const scene=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 assert.match(scene,/const isOpeningChapter = !this\._isFinaleTrialRound\?\.\(\)/);
 assert.match(scene,/return beginFinaleTrialRound\(this\)/);assert.match(scene,/return showFinaleTrialResult\(this\)/);
});
test('trial does not inherit the uncleared south-street movement clamp',()=>{
 const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const part=source.match(/const clampedY = ([\s\S]*?);\r?\n/)[1];
 const run=new Function('STAGE1_PAINT_GATE_Y','gateFloor','return '+part);
 const fixture={player:{y:430},paintZone:{clampPlayerY:()=>948},_isFinaleTrialRound:()=>true};
 assert.equal(run.call(fixture,930,948),430);
 fixture._isFinaleTrialRound=()=>false;assert.equal(run.call(fixture,930,948),948);
});
test('trial spawn synchronizes existing street collision history, not just sprite/body',()=>{
 const e=loadScenes(),{placeFinaleTrialPlayer}=e.loadRuntime('systems/FinaleTrialRuntime.mjs');
 const scene={oldStreet:{lastPlayer:{x:500,y:1708},finaleDestination:()=>({x:500,y:430})},
  player:{setPosition(x,y){this.x=x;this.y=y;},body:{reset(x,y){this.center={x,y};}}}};
 placeFinaleTrialPlayer(scene);
 assert.deepEqual(plain(scene.oldStreet.lastPlayer),{x:500,y:430});
 assert.deepEqual(plain(scene.player.body.center),{x:500,y:430});
});
test('trial transition leaves pause lifecycle teardown to its existing Scene shutdown owner',()=>{
 const e=loadScenes(),{handleFinaleTrialAction}=e.loadRuntime('systems/FinaleTrialRuntime.mjs');
 let cleanups=0,restarted;
 const scene={battleData:data(),_clearBattlePauseLifecycle(){cleanups++;},
  _releaseBattleRuntimeObjects(){},scene:{restart(d){restarted=d;}}};
 assert.equal(handleFinaleTrialAction(scene,'trial-retry'),true);
 assert.equal(cleanups,0);assert.equal(restarted.publicFinaleTrial.roundIndex,0);
});
test('pause return goes to the actual desk; result return explicitly names trial preparation',()=>{
 const e=loadScenes(),{handleFinaleTrialAction}=e.loadRuntime('systems/FinaleTrialRuntime.mjs');
 let started;
 handleFinaleTrialAction({battleData:data(),_releaseBattleRuntimeObjects(){},_clearBattlePauseLifecycle(){},
  scene:{start(...args){started=args;}}},'title');
 assert.equal(started[1].openPage,'desk');
 const source=fs.readFileSync(new URL('../src/systems/FinaleTrialRuntime.mjs',import.meta.url),'utf8');
 assert(source.includes("'返回连演准备'"));
});
test('actual Scene admission rejects a cleared/reset profile before it can fall through to campaign',()=>{
 const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const start=source.indexOf("if(Object.hasOwn(this.initialBattleData||{},'publicFinaleTrial')");
 assert(start>=0,'actual Scene mode admission block must exist');
 const block=source.slice(start,source.indexOf('setBattleHudVisible(false);',start));
 const admit=new Function('getFinaleTrialState','isFinaleTrialUnlocked','loadPublicProfile','resolvePublicRunContext',block);
 for(const [current,expected]of [[profile,false],[{version:1,clears:0},true],[{...profile,persisted:false},true]]){
  let rejected=false;
  admit.call({initialBattleData:data(),scene:{start(){rejected=true;}}},getFinaleTrialState,isFinaleTrialUnlocked,()=>current,resolvePublicRunContext);
  assert.equal(rejected,expected);
 }
 for(const marker of [null,false,undefined,{},[]]){
  let rejected=false;
  admit.call({initialBattleData:{...data(),publicFinaleTrial:marker},scene:{start(){rejected=true;}}},getFinaleTrialState,isFinaleTrialUnlocked,()=>profile,resolvePublicRunContext);
  assert.equal(rejected,true,'invalid explicit mode must be rejected before battle creation');
 }
});
test('actual UI unlock and Title handoff use chosen real performer and legal upfront choices without writes',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 let h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('tour');h.click('[data-action=tour-modes]');h.click('[data-action=hub-finale-trial]');
 assert.equal(h.query('[data-action=trial-start]'),null);h.shutdown();
 e.seed(['opening','neon','encore']);e.profile.selectPublicPerformer('kai');
 h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('tour');h.click('[data-action=tour-modes]');h.click('[data-action=hub-finale-trial]');
 const before=e.storage.getItem('starush.public-profile');
 h.click('[data-trial-choice=tempo]');h.click('[data-trial-choice=overdrive]');h.click('[data-action=trial-start]');
 const [key,d]=h.starts.at(-1);assert.equal(key,'BattleScene');assert.equal(d.performerId,'kai');
 assert.deepEqual(plain(d.publicFinaleTrial.choices),['tempo','overdrive']);assert.equal(d.campaignChapterId,'opening');
 assert.equal(e.storage.getItem('starush.public-profile'),before);assert.equal(d.publicRunGoal,undefined);
 h.shutdown();
});
