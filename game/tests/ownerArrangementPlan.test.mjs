import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
import {createArrangementPlan,normalizeArrangementPlan,getArrangementPlanReview} from '../src/utils/publicArrangementPlan.mjs';
import {getPublicBuildModel} from '../src/utils/publicBuildContent.mjs';
import {getRetryCampaignBattleData,getNextCampaignBattleData} from '../src/utils/publicCampaignResult.mjs';
import {createFinaleTrialData,createRehearsalData} from '../src/utils/publicFinaleTrial.mjs';
const data={stageId:1,practiceMode:false,defenseMode:false,performerId:'sakura',characterId:'sakura',team:[{characterId:'sakura'}],campaignChapterId:'opening'};
const choices=['wide_brush','echo'],make=(d=data,ids=choices)=>createArrangementPlan(ids,d);

test('strict session-only intent is copied, context-bound and never enables hidden or special modes',()=>{
 const ids=[...choices],p=make(data,ids);assert(p);ids[0]='tempo';assert.deepEqual(p.choices,choices);assert(Object.isFrozen(p)&&Object.isFrozen(p.choices));
 for(const d of [{...data,performerId:'kai'},{...data,campaignChapterId:'neon'},{...data,stageId:2},{...data,practiceMode:true},{...data,defenseMode:true},{...data,p15SetlistCueExperiment:true},{...data,publicFinaleTrial:{version:1}}])assert.equal(normalizeArrangementPlan(p,d),null);
 for(const p0 of [null,[],{}, {...p,extra:true},{...p,version:2},{...p,rulesetId:'old'}, {...p,choices:['echo','wide_brush']},{...p,choices:['wide_brush','toString']}])assert.equal(normalizeArrangementPlan(p0,data),null);
});
test('all three members and venues use the original nine pair pool and live preparation effects',()=>{
 for(const performerId of ['sakura','kai','enjo'])for(const campaignChapterId of ['opening','neon','encore'])for(const first of ['wide_brush','relay','tempo'])for(const second of ['echo','overdrive','recovery']){
  const d={...data,performerId,campaignChapterId},p=make(d,[first,second]);assert(p);
  for(const trainingLevel of [1,2,3]){const prep={version:1,performerId,trainingLevel,equipmentId:null},build=getPublicBuildModel(prep,performerId,p.choices);assert(build);assert.deepEqual(build.choices,[first,second]);}
 }
});
test('partial and alternative actual choices are reviewed honestly, never auto-granted or marked achievements',()=>{
 const p=make();let r=getArrangementPlanReview(p,data,[]);assert.equal(r.matched,0);assert.deepEqual(r.rows.map(r=>r.state),['pending','pending']);
 r=getArrangementPlanReview(p,data,['tempo']);assert.equal(r.matched,0);assert.deepEqual(r.rows.map(r=>r.state),['changed','pending']);
 r=getArrangementPlanReview(p,data,choices);assert.equal(r.matched,2);assert.deepEqual(r.rows.map(r=>r.state),['matched','matched']);
 assert.equal(getArrangementPlanReview(p,data,['echo']),null);assert.equal(getArrangementPlanReview(p,{...data,performerId:'kai'},choices),null);
});
test('same-station retry retains canonical intent but next station and special modes cannot inherit it',()=>{
 const e=loadScenes();e.seed(['opening','neon','encore']);const profile=plain(e.profile.loadPublicProfile()),d={...data,publicArrangementPlan:make()};
 const retry=getRetryCampaignBattleData(d,profile);assert.deepEqual(retry.publicArrangementPlan,d.publicArrangementPlan);assert.notEqual(retry.publicArrangementPlan,d.publicArrangementPlan);
 const next=getNextCampaignBattleData({victory:true,recorded:true,chapterId:'opening'},d,profile);assert.equal(next.campaignChapterId,'neon');assert.equal(next.publicArrangementPlan,undefined);
 for(const entry of [createFinaleTrialData(d,choices,profile),createRehearsalData(d,choices,profile,{chapterId:'opening',focus:'clear'})]){assert(entry);assert.equal(entry.publicArrangementPlan,undefined);}
});

// Desk start opens preflight; the library is reached through the arrangement sheet (native dialog).
function openArrangementSheet(h){
 assert.equal(h.root.dataset.page,'preflight');h.click('[data-action=preflight-arrangement]');
 const sheet=h.query('dialog.ui-sheet');assert(sheet?.open,'arrangement sheet must open as a modal dialog');assert(sheet.contains(h.query('[data-action=preflight-library]')));return sheet;
}
function openLibrary(h){openArrangementSheet(h);h.click('[data-action=preflight-library]');assert.equal(h.root.dataset.page,'library');}
function shell(){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.TitleScene);h.scene.create();h.click('[data-action=start]');openLibrary(h);return {e,h};
}
test('real library explicit plan reaches preflight and Title without granting choices or writing storage',()=>{
 const {e,h}=shell(),before=e.storage.getItem('starush.public-profile');
 assert.equal(h.root.querySelector('.shell-selection-footer').querySelectorAll('button').length,1);
 h.click('[data-arrangement=tempo]');h.click('[data-arrangement=overdrive]');h.click('[data-action=plan-use]');
 assert.equal(h.root.dataset.page,'preflight');assert(h.query('[data-arrangement-plan]'));assert(h.query('[data-action=plan-clear]').querySelector('svg').children.length>0);assert.equal(e.storage.getItem('starush.public-profile'),before);
 h.click('[data-action=start]');const d=h.starts.at(-1)[1];assert.deepEqual(plain(d.publicArrangementPlan.choices),['tempo','overdrive']);assert.equal(d.publicPreparation.trainingLevel,1);assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});
test('clear and confirmed member/chapter changes invalidate intent instead of silently reusing another context',()=>{
 const {e,h}=shell();h.click('[data-action=plan-use]');openArrangementSheet(h);h.click('[data-action=plan-clear]');assert.equal(h.query('[data-arrangement-plan]'),null);
 openLibrary(h);h.click('[data-action=plan-use]');assert(h.query('[data-arrangement-plan]'));h.click('[data-action=preflight-member]');
 const [key,d]=h.starts.at(-1);assert.equal(key,'IdolRosterScene');h.shutdown();
 // Member selection lives behind the actor-switch sheet; previewing kai does not deploy, confirming does.
 const roster=e.harness(e.IdolRosterScene,d);roster.scene.create();roster.click('[data-action=actor-switch]');roster.click('[data-member=kai]');
 assert.equal(e.profile.loadPublicProfile().selectedId,'sakura');roster.click('[data-action=confirm-member]');assert.equal(e.profile.loadPublicProfile().selectedId,'kai');
 const [target,returned]=roster.starts.at(-1);assert.equal(target,'TitleScene');roster.shutdown();
 const title=e.harness(e.TitleScene,returned);title.scene.create();title.scene._publicShell.showPage('preflight');assert.equal(title.query('[data-arrangement-plan]'),null);
 title.click('[data-action=start]');assert.equal(title.starts.at(-1)[1].publicArrangementPlan,undefined);title.shutdown();
});
test('saved training and equipment changes recalculate combined plan while leaving plan transient',()=>{
 const {e,h}=shell();e.seed(['opening','neon','encore']);h.scene._publicShell.render();h.click('[data-action=plan-use]');
 const current=e.profile.loadPublicProfile(),expected=e.loadRuntime('utils/publicPreparation.mjs').getPreparationSnapshot(current,'sakura');
 const saved=e.profile.applyPublicPreparationPlan(expected,{trainingLevel:2,equipmentId:'wide_nozzle'});assert.equal(saved.preparationStatus,'planned');h.scene._publicShell.render();
 assert.match(h.query('[data-plan-effect=paintRadiusBonus]').textContent,/\+52/);const before=e.storage.getItem('starush.public-profile');h.click('[data-action=start]');
 const d=h.starts.at(-1)[1];assert.equal(d.publicPreparation.trainingLevel,2);assert.equal(d.publicPreparation.equipmentId,'wide_nozzle');assert.deepEqual(plain(d.publicArrangementPlan.choices),choices);assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});
test('shared non-Title menus hand canonical session intent to actual Title preparation',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.TourRouteScene);h.scene.create();h.scene._publicShell.showPage('library');h.click('[data-action=plan-use]');
 assert.equal(h.starts.at(-1)[0],'TitleScene');assert.equal(h.starts.at(-1)[1].openPage,'preflight');assert.deepEqual(plain(h.starts.at(-1)[1].arrangementPlan.choices),choices);h.shutdown();
});
function runFixture(){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const {PublicStage1PerformerRun}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
 const create=e.document.createElement.bind(e.document);
 e.document.createElement=(...args)=>{const node=create(...args),query=node.querySelector.bind(node);node.querySelector=selector=>selector==='.battle-visual-copy span'?query('.battle-visual-copy')?.querySelector('span'):query(selector);return node;};
 const scene={battleData:{...data,publicArrangementPlan:make()},_userCastPresentation:true,_isFinaleTrialRound:()=>false,time:{now:100,delayedCall(){return {remove(){}};}},player:{hp:5,active:true},input:{enabled:true,keyboard:{enabled:true,resetKeys(){}}},_setBattlePaused(value){this._battlePaused=value;},_clearBattlePauseOverlay(){},_updateHUD(){},battleRecord:{playerHitCount:0}};
 const run=new PublicStage1PerformerRun(scene);scene.publicPerformerRun=run;return {e,scene,run};
}
test('real choice surface marks plan but all original choices stay live and only actual clicks grant effects',()=>{
 const {e,scene,run}=runFixture();assert.equal(run.effects().paintRadiusBonus,0);assert.equal(run.growth.choices.length,0);run.openChoice();
 const root=e.document.getElementById('run-choice');assert.equal(root.querySelector('[data-choice=wide_brush]').dataset.plannedChoice,'true');assert.equal(run.growth.choices.length,0);
 root.querySelector('[data-choice=tempo]').click();assert.deepEqual(plain(run.growth.choices),[]);root.querySelector('[data-action=confirm-choice]').click();assert.deepEqual(plain(run.growth.choices),['tempo']);assert.equal(run.effects().paintRadiusBonus,0);assert.equal(run.effects().chargeMultiplier,1.5);
 run.openChoice();const next=e.document.getElementById('run-choice');next.querySelector('[data-choice=overdrive]').click();assert.deepEqual(plain(run.growth.choices),['tempo']);next.querySelector('[data-action=confirm-choice]').click();assert.deepEqual(plain(run.growth.choices),['tempo','overdrive']);
 scene.time.now=200;const result=run.finish(true);assert(result.arrangementPlan);const model=e.loadRuntime('systems/BattleSurfaceView.mjs').getPublicResultSurfaceModel({buttons:[]},result);
 assert.equal(model.arrangementReview.matched,0);assert.deepEqual(plain(model.arrangementReview.rows.map(r=>r.state)),['changed','changed']);assert(!e.storage.getItem('starush.public-profile').includes('arrangementPlan'));assert(!e.storage.getItem('starush.public-profile').includes('publicArrangementPlan'));run.destroy();
});
test('partial defeat preserves pending plan row without calling it executed',()=>{
 const {e,scene,run}=runFixture();run.choiceOpen=true;assert(run.choose('wide_brush'));scene.time.now=200;scene.player.hp=0;const result=run.finish(false);
 const model=e.loadRuntime('systems/BattleSurfaceView.mjs').getPublicResultSurfaceModel({buttons:[]},result);assert.equal(model.arrangementReview.matched,1);assert.deepEqual(plain(model.arrangementReview.rows.map(r=>r.state)),['matched','pending']);run.destroy();
});

test('sparse arrays are invalid plans and invalid executed choices',()=>{
 const p=make();for(const ids of [Array(2),Object.assign(Array(2),{0:'wide_brush'}),Object.assign(Array(2),{1:'echo'})])assert.equal(make(data,ids),null);
 assert.equal(getArrangementPlanReview(p,data,Array(1)),null);
});
test('previewing another venue is cancellable, but confirming it clears plan permanently for this menu session',()=>{
 const {e,h}=shell();e.seed(['opening','neon','encore']);h.scene._publicShell.render();h.click('[data-action=plan-use]');
 // Venue selection is the Tour root scene; preflight no longer carries a chapter shortcut.
 const tourVisit=(from,commit)=>{
  from.click('[data-nav=tour]');const [key,d]=from.starts.at(-1);assert.equal(key,'TourRouteScene');from.shutdown();
  const tour=e.harness(e.TourRouteScene,d);tour.scene.create();tour.click('[data-chapter=neon]');
  if(!commit)assert.equal(e.profile.getPublicCampaignProgress().selectedChapterId,'opening');
  tour.click(commit?'[data-action=confirm-chapter]':'[data-action=back]');const [target,returned]=tour.starts.at(-1);assert.equal(target,'TitleScene');tour.shutdown();
  const title=e.harness(e.TitleScene,returned);title.scene.create();title.scene._publicShell.showPage('preflight');return title;
 };
 const previewed=tourVisit(h,false);assert(previewed.query('[data-arrangement-plan]'));
 const confirmed=tourVisit(previewed,true);assert.equal(e.profile.getPublicCampaignProgress().selectedChapterId,'neon');assert.equal(confirmed.query('[data-arrangement-plan]'),null);
 e.profile.selectPublicChapter('opening');confirmed.scene._publicShell.render();assert.equal(confirmed.query('[data-arrangement-plan]'),null);confirmed.shutdown();
});
test('same-station retry consumes fresh saved rank and each owner-specific equipment without granting planned effects',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.seed(['opening','neon','encore']);
 const prep=e.loadRuntime('utils/publicPreparation.mjs'),{PublicStage1PerformerRun}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
 for(const [id,equipmentId]of [['sakura','travelling_nozzle'],['kai','return_edge'],['enjo','delayed_hammer']]){
  e.profile.selectPublicPerformer(id);e.profile.recordPublicRun({runId:'plan-gear-fixture-'+id,performerId:id,chapterId:'opening',victory:true});
  const expected=prep.getPreparationSnapshot(e.profile.loadPublicProfile(),id);assert.equal(e.profile.applyPublicPreparationPlan(expected,{trainingLevel:2,equipmentId}).preparationStatus,'planned');
  const d={...data,performerId:id,publicArrangementPlan:make({...data,performerId:id})},retry=getRetryCampaignBattleData(d,plain(e.profile.loadPublicProfile()));
  assert.equal(retry.publicPreparation.trainingLevel,2);assert.equal(retry.publicPreparation.equipmentId,equipmentId);
  const s={battleData:retry,_userCastPresentation:true,time:{now:100},player:{hp:5},_isFinaleTrialRound:()=>false};const r=new PublicStage1PerformerRun(s);
  assert.deepEqual(plain(r.effects()),getPublicBuildModel(retry.publicPreparation,id,[]).effects);assert.deepEqual(plain(r.growth.choices),[]);assert.equal(r.getBuildSnapshot().modification.id,equipmentId);
 }
});

test('bottom-member navigation and root return retain the current plan across real Scene boundaries',()=>{
 const {e,h}=shell();h.click('[data-action=plan-use]');h.click('[data-nav=roster]');const [key,d]=h.starts.at(-1);assert.equal(key,'IdolRosterScene');assert.deepEqual(plain(d.arrangementPlan.choices),choices);h.shutdown();
 const roster=e.harness(e.IdolRosterScene,d);roster.scene.create();roster.click('[data-action=back]');const [target,returned]=roster.starts.at(-1);assert.equal(target,'TitleScene');assert.deepEqual(plain(returned.arrangementPlan.choices),choices);roster.shutdown();
 const title=e.harness(e.TitleScene,returned);title.scene.create();title.click('[data-nav=tour]');const [tourKey,tourData]=title.starts.at(-1);assert.equal(tourKey,'TourRouteScene');assert.deepEqual(plain(tourData.arrangementPlan.choices),choices);title.shutdown();
 const tour=e.harness(e.TourRouteScene,tourData);tour.scene.create();tour.click('[data-action=back]');assert.deepEqual(plain(tour.starts.at(-1)[1].arrangementPlan.choices),choices);tour.shutdown();
});
// The wallet is a quiet resource now; the training handoff is preflight-training (Member preparation->member-training is the other route).
test('training handoff and root preparation back do not discard an otherwise valid plan',()=>{
 const {e,h}=shell();h.click('[data-action=plan-use]');assert.equal(h.root.dataset.page,'preflight');h.click('[data-action=preflight-training]');const [key,d]=h.starts.at(-1);assert.equal(key,'TitleScene');assert(d.openPreparation);assert.deepEqual(plain(d.arrangementPlan.choices),choices);h.shutdown();
 const workshop=e.harness(e.TitleScene,d);workshop.scene.create();const before=e.storage.getItem('starush.public-profile');workshop.click('[data-action=confirm-preparation]');assert.equal(workshop.root.dataset.page,'preflight');assert.equal(workshop.starts.length,0);assert.deepEqual(plain(workshop.scene._publicShell.arrangementPlan.choices),choices);assert.equal(e.storage.getItem('starush.public-profile'),before);workshop.shutdown();
});

