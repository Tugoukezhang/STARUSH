import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
import {getRehearsalConfig,isRehearsalUnlocked,evaluateRehearsal,REHEARSAL_FOCI} from '../src/utils/publicRehearsal.mjs';
import {createRehearsalData,getFinaleTrialState,finishFinaleTrialRound,nextFinaleTrialData,retryFinaleTrialData,isFinaleTrialUnlocked} from '../src/utils/publicFinaleTrial.mjs';
import {resolvePublicRunContext} from '../src/utils/publicRunContext.mjs';
const profile={version:1,clears:1,campaign:{version:1,selectedChapterId:'neon',chapterClears:{opening:1,neon:0,encore:0}}};
const base={stageId:1,practiceMode:false,defenseMode:false,performerId:'sakura',characterId:'sakura',team:[{characterId:'sakura'}],campaignChapterId:'neon',publicRunGoal:{kind:'standard'},publicRoutePlan:{id:'west'}};
const setup={chapterId:'opening',focus:'clear'},make=(options=setup)=>createRehearsalData(base,['wide_brush','echo'],profile,options);
test('only saved-cleared venues and canonical categorical goals enter rehearsal',()=>{
 assert.deepEqual(REHEARSAL_FOCI.map(r=>r.id),['clear','clean','action']);assert(getRehearsalConfig(setup));
 for(const value of [null,[],{}, {...setup,chapterId:'toString'},{...setup,focus:'constructor'},{...setup,extra:true}])assert.equal(getRehearsalConfig(value),null);
 assert(isRehearsalUnlocked(profile,'opening'));assert(!isRehearsalUnlocked(profile,'neon'));
 for(const p of [{version:1,clears:0},{...profile,persisted:false},{...profile,recovery:{}},{...profile,hasPendingSave:true}])assert(!isRehearsalUnlocked(p,'opening'));
 assert.equal(make({chapterId:'neon',focus:'clear'}),null);assert.equal(make({...setup,focus:'invalid'}),null);assert.equal(isFinaleTrialUnlocked(profile),false);
});
test('single venue is a real isolated trial, finishes once and retries original setup',()=>{
 const d=make({chapterId:'opening',focus:'action'}),state=getFinaleTrialState(d);assert.equal(d.campaignChapterId,'opening');assert.equal(state.roundCount,1);assert.deepEqual(state.chapterIds,['opening']);assert.equal(state.startHp,5);
 assert.equal(d.publicRunGoal,undefined);assert.equal(d.publicRoutePlan,undefined);assert(isFinaleTrialUnlocked(profile,d));
 const r=finishFinaleTrialRound(d,{victory:true,hp:4,durationMs:12000,hitCount:1,actions:1});assert(r.complete&&r.focusOutcome.met);assert.equal(r.recorded,false);assert.equal(r.persisted,false);assert.equal(nextFinaleTrialData(d,r),null);
 const retry=retryFinaleTrialData(d);assert.deepEqual(retry.publicFinaleTrial.rehearsal,{chapterId:'opening',focus:'action'});assert.equal(getFinaleTrialState(retry).startHp,5);assert.deepEqual(retry.publicFinaleTrial.rounds,[]);
 assert.equal(getFinaleTrialState({...d,publicFinaleTrial:{...d.publicFinaleTrial,roundIndex:1,rounds:[r.rounds[0]]}}),null);
});
test('course ready never masquerades as complete and a clear can honestly miss its goal',()=>{
 assert.equal(evaluateRehearsal({...setup,focus:'action'},{victory:false,actions:1,hitCount:0}).met,false);
 assert.equal(evaluateRehearsal({...setup,focus:'clean'},{victory:false,actions:0,hitCount:1}).state,'missed');
 for(const [focus,hits,actions,met]of [['clear',2,0,true],['clean',0,0,true],['clean',1,1,false],['action',0,0,false],['action',1,1,true]]){
  const r=finishFinaleTrialRound(make({...setup,focus}),{victory:true,hp:4,durationMs:10,hitCount:hits,actions});assert(r.victory&&r.complete);assert.equal(r.focusOutcome.met,met);
 }
 const failed=finishFinaleTrialRound(make({...setup,focus:'action'}),{victory:false,hp:0,durationMs:10,hitCount:5,actions:1});assert(!failed.complete&&!failed.focusOutcome.met);
});
test('three members share authoritative saved setup without rehearsal writes or rewards',()=>{
 for(const id of ['sakura','kai','enjo']){const d=createRehearsalData({...base,performerId:id,characterId:id,team:[{characterId:id}]},['tempo','overdrive'],profile,setup);assert(d);assert.equal(d.performerId,id);assert.equal(getFinaleTrialState(d).roundCount,1);}
 assert.equal(createRehearsalData({...base,performerId:'venus'},['tempo','overdrive'],profile,setup),null);
 const before=structuredClone(profile);make();assert.deepEqual(profile,before);
});
test('real hub/menu/Title handoff respects clear gates and never writes an unlock or preparation',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 let h=e.harness(e.TitleScene);h.scene.create();const pristine=e.storage.getItem('starush.public-profile');h.scene._publicShell.showPage('tour');h.click('[data-action=tour-modes]');h.click('[data-action=hub-rehearsal]');assert(h.query('[data-action=rehearsal-start]').disabled);assert.match(h.text,/该场地保存通关后开放排练/);assert.equal(e.storage.getItem('starush.public-profile'),pristine);h.shutdown();
 e.seed(['opening']);e.profile.selectPublicPerformer('enjo');h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('tour');h.click('[data-action=tour-modes]');h.click('[data-action=hub-rehearsal]');const before=e.storage.getItem('starush.public-profile');
 assert(h.query('[data-rehearsal-chapter=neon]').disabled);h.click('[data-rehearsal-focus=action]');h.click('[data-rehearsal-choice=tempo]');h.click('[data-rehearsal-choice=overdrive]');h.click('[data-action=rehearsal-start]');
 const [key,d]=h.starts.at(-1);assert.equal(key,'BattleScene');assert.equal(d.performerId,'enjo');assert.equal(d.campaignChapterId,'opening');assert.deepEqual(plain(d.publicFinaleTrial.rehearsal),{chapterId:'opening',focus:'action'});assert.deepEqual(plain(d.publicFinaleTrial.choices),['tempo','overdrive']);assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});
test('actual shared HUD shows live focus without inventing a saved personal goal',()=>{
 const e=loadScenes(),doc=e.document;for(const id of ['hud','run-goal']){const el=doc.createElement('div');el.id=id;doc.body.append(el);}
 const {syncPublicBattleHud}=e.loadRuntime('systems/BattleSurfaceView.mjs');
 const scene={battleData:make({...setup,focus:'action'}),_isPublicStage1Round:()=>true,_isFinaleTrialRound:()=>true,publicPerformerRun:{member:{id:'sakura',name:'步枪手'},actions:0,canAct:()=>false,getGoalProgress:()=>null},battleRecord:{playerHitCount:0},player:{hp:5,maxHp:5}};
 syncPublicBattleHud(scene,doc);assert.equal(doc.getElementById('run-goal').hidden,false);assert.match(doc.getElementById('run-goal').textContent,/行动 0 次/);
 scene.publicPerformerRun.actions=1;syncPublicBattleHud(scene,doc);assert.match(doc.getElementById('run-goal').textContent,/行动 1 次/);assert.notEqual(doc.getElementById('run-goal').dataset.status,'passed');
 scene._isFinaleTrialRound=()=>false;syncPublicBattleHud(scene,doc);assert.equal(doc.getElementById('run-goal').hidden,true);
});
test('result return restores exact rehearsal course and choices, retry resets same single venue',()=>{
 const e=loadScenes(),{handleFinaleTrialAction}=e.loadRuntime('systems/FinaleTrialRuntime.mjs');let started,restarted;
 const d=make({...setup,focus:'clean'}),scene={battleData:d,_releaseBattleRuntimeObjects(){},scene:{start(...args){started=args;},restart(data){restarted=data;}}};
 assert(handleFinaleTrialAction(scene,'trial-title'));assert.equal(started[1].openPage,'rehearsal');assert.deepEqual(plain(started[1].rehearsalSetup),{chapterId:'opening',focus:'clean',choices:['wide_brush','echo']});
 scene._battleResultNavigating=false;assert(handleFinaleTrialAction(scene,'trial-retry'));assert.equal(restarted.campaignChapterId,'opening');assert.equal(getFinaleTrialState(plain(restarted)).roundCount,1);
});

test('all three venues, members and courses complete and retry without changing the saved profile',()=>{
 const e=loadScenes();e.seed(['opening','neon','encore']);const p=plain(e.profile.loadPublicProfile()),before=JSON.stringify(p);
 for(const chapterId of ['opening','neon','encore'])for(const id of ['sakura','kai','enjo'])for(const focus of ['clear','clean','action']){
  const d=createRehearsalData({...base,performerId:id,characterId:id,team:[{characterId:id}]},['tempo','overdrive'],p,{chapterId,focus});assert(d);
  const result=finishFinaleTrialRound(d,{victory:true,hp:5,durationMs:100,hitCount:0,actions:1});assert(result.complete&&result.focusOutcome.met);assert.equal(nextFinaleTrialData(d,result),null);
  const retry=retryFinaleTrialData(d);assert.equal(retry.campaignChapterId,chapterId);assert.deepEqual(retry.publicFinaleTrial.rehearsal,{chapterId,focus});assert.deepEqual(retry.publicFinaleTrial.rounds,[]);
 }assert.equal(JSON.stringify(p),before);
});

test('pause returns to desk while preserving the complete session setup for reopening rehearsal',()=>{
 const e=loadScenes(),{handleFinaleTrialAction}=e.loadRuntime('systems/FinaleTrialRuntime.mjs');let started;
 const d=make({...setup,focus:'action'}),scene={battleData:d,_releaseBattleRuntimeObjects(){},scene:{start(...args){started=args;}}};
 assert(handleFinaleTrialAction(scene,'title'));assert.equal(started[1].openPage,'desk');assert.deepEqual(plain(started[1].rehearsalSetup),{chapterId:'opening',focus:'action',choices:['wide_brush','echo']});
 e.seed(['opening']);e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.TitleScene,started[1]);h.scene.create();h.scene._publicShell.showPage('tour');h.click('[data-action=tour-modes]');h.click('[data-action=hub-rehearsal]');
 assert.equal(h.query('[data-rehearsal-focus=action]').getAttribute('aria-pressed'),'true');h.shutdown();
});

test('trial result reuses the formal performer header instead of the retired white-text block',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const {showFinaleTrialResult}=e.loadRuntime('systems/FinaleTrialRuntime.mjs');
 const result=finishFinaleTrialRound(make(),{victory:true,hp:5,durationMs:100,hitCount:0,actions:1});
 const scene={battleData:make(),_publicRunResult:result,input:{enabled:true,keyboard:{enabled:true,resetKeys(){}}},time:{delayedCall(){return {remove(){}};}}};
 showFinaleTrialResult(scene);const header=e.document.getElementById('battle-result').querySelector('.battle-performance-header');assert(header);assert(header.querySelector('.battle-performer-visual'));assert(header.querySelector('h2'));scene._battleResultPanel.destroy();
});

test('course miss has a short clear heading and explicitly preserves the boss victory in its eyebrow',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const {showFinaleTrialResult}=e.loadRuntime('systems/FinaleTrialRuntime.mjs');
 const d=make({...setup,focus:'clean'}),result=finishFinaleTrialRound(d,{victory:true,hp:4,durationMs:100,hitCount:1,actions:1});
 const scene={battleData:d,_publicRunResult:result,input:{enabled:true,keyboard:{enabled:true,resetKeys(){}}},time:{delayedCall(){return {remove(){}};}}};showFinaleTrialResult(scene);
 const root=e.document.getElementById('battle-result');assert.equal(root.querySelector('h2').textContent,'课题未达成');assert.match(root.querySelector('.battle-eyebrow').textContent,/压轴完成/);scene._battleResultPanel.destroy();
});

test('actual Scene admits a saved single venue and returns reset rehearsal to its own locked setup',()=>{
 const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8'),start=source.indexOf("if(Object.hasOwn(this.initialBattleData||{},'publicFinaleTrial')");
 assert(start>=0,'actual Scene mode admission block must exist');
 const block=source.slice(start,source.indexOf('setBattleHudVisible(false);',start)),admit=new Function('getFinaleTrialState','isFinaleTrialUnlocked','loadPublicProfile','resolvePublicRunContext',block),d=make({...setup,focus:'clean'});
 let redirect;const scene={initialBattleData:d,scene:{start(key,data){redirect=data;}}};
 admit.call(scene,getFinaleTrialState,isFinaleTrialUnlocked,()=>profile,resolvePublicRunContext);assert.equal(redirect,undefined);
 admit.call(scene,getFinaleTrialState,isFinaleTrialUnlocked,()=>({version:1,clears:0}),resolvePublicRunContext);assert.equal(redirect.openPage,'rehearsal');assert.deepEqual(redirect.rehearsalSetup,{chapterId:'opening',focus:'clean',choices:['wide_brush','echo']});
 scene.initialBattleData={...d,publicFinaleTrial:{...d.publicFinaleTrial,rehearsal:{chapterId:'invalid',focus:'clean'}}};admit.call(scene,getFinaleTrialState,isFinaleTrialUnlocked,()=>profile,resolvePublicRunContext);assert.equal(redirect.openPage,'finaleTrial');
});

test('a rehearsal draft from earlier progress can still enter an available room after a restore',()=>{
 const e=loadScenes();
 const {getRehearsalMenuSetup}=e.loadRuntime('systems/RehearsalMenu.mjs');
 const saved={chapterId:'neon',focus:'action',choices:['tempo','overdrive']};
 const next=getRehearsalMenuSetup(profile,'neon',saved);
 assert.equal(next.chapterId,'opening');assert.equal(next.focus,'action');
 assert.deepEqual(plain(next.choices),saved.choices);
 assert.equal(saved.chapterId,'neon');
});
