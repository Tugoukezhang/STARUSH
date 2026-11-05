import test from 'node:test';import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const setup=()=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);return e;};
const data={stageId:1,performerId:'sakura',campaignChapterId:'opening'};
function preflight(e){const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'preflight'});h.scene.create();h.click('[data-route-choice=east]');return h;}

test('route and arrangement travel together through actual member, tour and wallet Scene boundaries',()=>{
 for(const destination of ['roster','tour','workshop']){
  const e=setup(),h=preflight(e),v=h.scene._publicShell;
  v.arrangementPlan=e.loadRuntime('utils/publicArrangementPlan.mjs').createArrangementPlan(['wide_brush','echo'],data);
  const before=e.storage.getItem('starush.public-profile');h.click('[data-nav='+destination+']');const [key,next]=h.starts.at(-1);
  assert.equal(next.routePlan?.id,'east');assert.deepEqual(plain(next.arrangementPlan.choices),['wide_brush','echo']);h.shutdown();
  const target=e.harness(key==='IdolRosterScene'?e.IdolRosterScene:key==='TourRouteScene'?e.TourRouteScene:e.TitleScene,next);target.scene.create();
  target.click(destination==='workshop'?'[data-action=confirm-preparation]':'[data-action=back]');const returned=target.starts.at(-1)[1];assert.equal(returned.routePlan?.id,'east');target.shutdown();
  const title=e.harness(e.TitleScene,returned);title.scene.create();title.scene._publicShell.showPage('preflight');
  assert.equal(title.query('[data-route-choice=east]').getAttribute('aria-pressed'),'true');title.click('[data-action=start]');
  assert.equal(title.starts.at(-1)[1].publicRoutePlan.id,'east');assert.equal(e.storage.getItem('starush.public-profile'),before);title.shutdown();
 }
});

test('cancelled member and venue previews retain route, committed changes cannot resurrect it',()=>{
 for(const kind of ['member','chapter']){
  const e=setup();e.seed(['opening','neon','encore']);const h=preflight(e),v=h.scene._publicShell;
  h.click(kind==='member'?'[data-action=preflight-member]':'[data-action=preflight-chapter]');
  h.click(kind==='member'?'[data-member=kai]':'[data-chapter=neon]');h.click('[data-action=back]');
  assert.equal(h.query('[data-route-choice=east]').getAttribute('aria-pressed'),'true');
  if(kind==='member')e.profile.selectPublicPerformer('kai');else e.profile.selectPublicChapter('neon');v.render();
  assert.equal(v.routeSelection,null);
  if(kind==='member')e.profile.selectPublicPerformer('sakura');else e.profile.selectPublicChapter('opening');v.render();
  assert.equal(h.query('[data-route-choice=auto]').getAttribute('aria-pressed'),'true');assert.equal(v.getArrangementHandoff().routePlan,undefined);h.shutdown();
 }
});

test('explicit profile deletion drops transient preparation but unrelated or failed writes do not',()=>{
 for(const key of ['starush.public-profile',null]){
  const e=setup(),h=preflight(e),v=h.scene._publicShell;
  v.arrangementPlan=e.loadRuntime('utils/publicArrangementPlan.mjs').createArrangementPlan(['wide_brush','echo'],data);
  e.window.dispatchEvent({type:'storage',key:'starush.player-preferences',newValue:null});assert.equal(v.routeSelection.id,'east');
  e.window.dispatchEvent({type:'storage',key,newValue:null});assert.equal(v.routeSelection,null);assert.equal(v.arrangementPlan,null);h.shutdown();
 }
 const e=setup(),h=preflight(e),v=h.scene._publicShell;e.storage.setItem=()=>{throw Error('QA quota');};e.profile.selectPublicChapter('opening');v.render();assert.equal(v.routeSelection.id,'east');h.shutdown();
});

test('new document state and invalid handoff default to automatic without touching storage',()=>{
 const e=setup(),h=preflight(e),route=plain(h.scene._publicShell.routeSelection);h.shutdown();
 for(const routePlan of [undefined,{...route,performerId:'kai'},{...route,chapterId:'neon'},{...route,rulesetId:'old'}]){
  const before=e.storage.getItem('starush.public-profile'),next=e.harness(e.TitleScene,{openPage:'preflight',routePlan});next.scene.create();assert.equal(next.query('[data-route-choice=auto]').getAttribute('aria-pressed'),'true');assert.equal(e.storage.getItem('starush.public-profile'),before);next.shutdown();
 }
});

const D='objective-disruptor',E='stage-cue-emitter',C='spotlight-captain';
test('never-linked remote expiry cannot become a linked release when a later solo host fires',()=>{
 const e=setup(),{PublicStage1EncounterDirector:R}=e.loadRuntime('systems/PublicStage1EncounterDirector.mjs'),d=new R({...data,campaignChapterId:'neon'});
 assert(d.enableChapterEvents());assert(d.begin({now:0}));d.advance(1,{completed:2,total:10});assert(d.beginAuthoredRole(D));
 d.observeChapterEvent({disruptorState:'disrupting',remoteDisruptor:true});assert.equal(d.getChapterEventSnapshot().status,'approach');
 d.resolveAuthoredRole(D,'window-expired');assert.equal(d.getChapterEventSnapshot().status,'expired');
 d.advance(2,{completed:5,total:10});assert(d.beginAuthoredRole(E));assert.equal(d.noteChapterEventRelease(E),false);assert.equal(d.getChapterEventSnapshot().status,'expired');
});

test('genuinely linked expiry still records its later release, and reset removes link provenance',()=>{
 const e=setup(),{ChapterEncounterEvent:R}=e.loadRuntime('utils/chapterEncounterEvents.mjs');
 for(const id of ['neon','encore']){
  const r=new R(id),partner=id==='neon'?E:C,secondary=id==='neon'?E:D;
  const roles={[D]:{state:'active'},[partner]:{state:'active'}};
  r.observe({disruptorState:'disrupting',remoteDisruptor:true,captainSubphase:'entrance'},roles);r.begin(secondary,roles);assert.equal(r.snapshot().status,'linked');
  roles[D]={state:'resolved',outcome:'window-expired'};assert.equal(r.action(roles),null);assert.equal(r.snapshot().status,'expired');assert(r.released(partner));assert.equal(r.snapshot().status,'released');assert.equal(r.released(partner),false);
  r.reset();assert.equal(r.snapshot(),null);assert.equal(r.released(partner),false);
 }
});

test('harbor reviews name the real landing attack, neon reviews retain emitted pulse semantics',()=>{
 const e=setup(),a=e.loadRuntime('utils/chapterEncounterEvents.mjs');
 for(const status of ['approach','linked','interrupted','released','expired','completed','preempted']){
  const r=a.getChapterEventReview({id:'harbor-cue-relay',status},'encore');assert.doesNotMatch(r.text+r.hint,/声浪|弹体/);assert.match(r.hint,/落击/);
 }
 assert.match(a.getChapterEventReview({id:'harbor-cue-relay',status:'released'},'encore').text,/落击/);
 const neon=a.getChapterEventReview({id:'neon-linked-cue',status:'released'},'neon');assert.match(neon.text,/声浪.*弹体/);
});

test('event correction reaches result and field report consumers without changing their save format',()=>{
 const e=setup(),a=e.loadRuntime('utils/chapterEncounterEvents.mjs');
 const run={...data,chapterId:'encore',victory:false,recorded:true,persisted:true,durationMs:1234,choices:[],actions:0,
  rulesetId:e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID,encounterEvent:{id:'harbor-cue-relay',status:'released'}};
 const m=e.loadRuntime('systems/BattleSurfaceView.mjs').getPublicResultSurfaceModel({buttons:[]},run);assert.match(m.encounterReview.text,/落击/);assert.doesNotMatch(m.encounterReview.text,/弹体/);
 const side=new(e.loadRuntime('utils/chapterSideSets.mjs').ChapterSideSet)('encore');run.chapterSideSet=side.snapshot([]);
 const report=e.loadRuntime('utils/publicChapterReports.mjs');run.fieldReport=report.captureChapterFieldReport(run);
 assert.deepEqual(plain(run.fieldReport.event),run.encounterEvent);assert.match(report.getChapterFieldReview(run).event,/落击/);assert.equal(a.getChapterEventReview(run.encounterEvent,'neon'),null);
});
