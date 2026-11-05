import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const E='stage-cue-emitter',D='objective-disruptor',C='spotlight-captain';
function setup(chapter,enabled=true){const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const {PublicStage1EncounterDirector:R}=e.loadRuntime('systems/PublicStage1EncounterDirector.mjs');const d=new R({stageId:1,campaignChapterId:chapter});if(enabled){assert.equal(typeof d.enableChapterEvents,'function');assert(d.enableChapterEvents());}assert(d.begin({now:0}));return {e,d};}
function neon(){const f=setup('neon'),d=f.d;d.advance(10,{completed:2,total:10});assert.deepEqual(plain(d.getPendingAuthoredRoles()),[D]);d.beginAuthoredRole(D);assert(!d.getPendingAuthoredRoles().includes(E));d.observeChapterEvent({disruptorState:'disrupting',remoteDisruptor:true});assert(d.getPendingAuthoredRoles().includes(E));d.beginAuthoredRole(E);return f;}
function harbor(){const f=setup('encore'),d=f.d;d.advance(10,{completed:2,total:10});d.beginAuthoredRole(E);d.resolveAuthoredRole(E,'recovery-complete');d.advance(20,{completed:5,total:10});d.beginAuthoredRole(C);d.observeChapterEvent({captainSubphase:'entrance'});assert(d.getPendingAuthoredRoles().includes(D));d.beginAuthoredRole(D);return f;}

test('chapter event gates are opt-in; hidden/defense/opening cannot enable',()=>{
 const {e,d}=setup('neon',false);d.advance(1,{completed:2,total:10});d.beginAuthoredRole(D);assert(!d.getPendingAuthoredRoles().includes(E));
 const {PublicStage1EncounterDirector:R}=e.loadRuntime('systems/PublicStage1EncounterDirector.mjs');assert.equal(typeof d.enableChapterEvents,'function');assert.equal(d.enableChapterEvents(),false);
 for(const data of [{stageId:1,practiceMode:true,campaignChapterId:'neon'},{stageId:1,defenseMode:true,campaignChapterId:'encore'},{stageId:2,campaignChapterId:'neon'},{stageId:1,campaignChapterId:'opening'}])assert.equal(new R(data).enableChapterEvents(),false);
});
test('neon early interruption emits one exact cancel action and requires acknowledgement',()=>{
 const {d}=neon();assert.deepEqual(plain(d.getChapterEventSnapshot()),{id:'neon-linked-cue',status:'linked'});
 d.resolveAuthoredRole(D,'painted');const action=d.getChapterEventAction({emitterState:'windup'});assert.equal(action.kind,'interrupt-emitter');
 assert.equal(d.acknowledgeChapterEvent({...action,kind:'other'}),false);assert(d.acknowledgeChapterEvent(action));
 assert.equal(d.getChapterEventAction({emitterState:'windup'}),null);assert.equal(d.getChapterEventSnapshot().status,'interrupted');
});
test('actual release wins over late interruption; missing or recovering host cannot be cancelled',()=>{
 const {d}=neon();assert(d.noteChapterEventRelease(E));d.resolveAuthoredRole(D,'painted');assert.equal(d.getChapterEventAction({emitterState:'recovery'}),null);assert.equal(d.getChapterEventSnapshot().status,'released');
 const x=neon().d;x.resolveAuthoredRole(D,'painted');assert.equal(x.getChapterEventAction({emitterState:null}),null);assert.equal(x.getChapterEventAction({emitterState:'recovery'}),null);
});
test('preemption before linking retains original solo opportunity and never invents an interrupt',()=>{
 const {d}=setup('neon');d.advance(1,{completed:2,total:10});d.beginAuthoredRole(D);d.resolveAuthoredRole(D,'painted');assert(!d.getPendingAuthoredRoles().includes(E));assert.equal(d.getChapterEventSnapshot(),null);
 d.advance(2,{completed:5,total:10});assert(d.beginAuthoredRole(E));assert.equal(d.getChapterEventSnapshot(),null);
});
test('neon never falls back to an automatic local pair or introduces captain before the deferred emitter',()=>{
 const {e,d}=setup('neon');d.advance(1,{completed:10,total:10});assert.deepEqual(plain(d.getPendingAuthoredRoles()),[D]);
 assert(d.beginAuthoredRole(D));assert(d.resolveAuthoredRole(D,'objective-unavailable'));assert.deepEqual(plain(d.getPendingAuthoredRoles()),[E]);
 d.beginAuthoredRole(E);d.resolveAuthoredRole(E,'recovery-complete');assert.deepEqual(plain(d.getPendingAuthoredRoles()),[C]);d.beginAuthoredRole(C);d.resolveAuthoredRole(C,'painted');assert(d.canEnterFinale());
 const src=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');assert(src.includes('if(!restore&&relayContext&&!placement)return null;'),'A fresh unavailable remote lane must defer; only an explicit saved body may bypass placement');
});
test('harbor relay permits approaching during intro and cannot masquerade a completed objective as an arrival',()=>{
 const {d}=harbor();assert.equal(d.getChapterEventSnapshot().id,'harbor-cue-relay');d.resolveAuthoredRole(D,'painted');
 const a=d.getChapterEventAction({captainSubphase:'captured-cue'});assert.equal(a.kind,'interrupt-captain');assert(d.acknowledgeChapterEvent(a));
 const x=setup('encore').d;x.advance(1,{completed:10,total:10});x.beginAuthoredRole(E);x.resolveAuthoredRole(E,'painted');x.beginAuthoredRole(C);x.observeChapterEvent({captainSubphase:'recovery'});assert(!x.getPendingAuthoredRoles().includes(D));
 x.resolveAuthoredRole(C,'encounter-complete');assert(x.getPendingAuthoredRoles().includes(D));assert(x.beginAuthoredRole(D));assert(x.resolveAuthoredRole(D,'objective-unavailable'));assert(x.canEnterFinale());
 const y=harbor().d;y.resolveAuthoredRole(D,'objective-unavailable');assert.equal(y.getChapterEventSnapshot().status,'preempted');
});
test('relay placement requires a visible reachable remote enemy and remote unfinished objective',()=>{
 const e=loadScenes(),a=e.loadRuntime('utils/chapterEncounterEvents.mjs');assert.equal(typeof a.resolveChapterRelayPlacement,'function');
 const input={player:{x:500,y:1500},view:{x:312.5,y:1060,width:375,height:667},devices:[{id:'remote',x:500,y:1120,zone:0},{id:'near',x:500,y:1430,zone:0}],currentZone:0,range:280,canReceive:()=>true,clearLine:()=>true};
 const p=a.resolveChapterRelayPlacement(input);assert(p);assert.equal(p.device.id,'remote');assert(Math.hypot(p.x-500,p.y-1500)>280);assert(p.y>=1172&&p.y<=1607);assert(Object.isFrozen(p));
 for(const patch of [{clearLine:()=>false},{canReceive:()=>false},{devices:[input.devices[1]]},{exclude:input.devices[0]},{range:NaN}])assert.equal(a.resolveChapterRelayPlacement({...input,...patch}),null);
});
test('stock neon road geometry admits a remote relay without putting the host in the frontage',()=>{
 const e=loadScenes(),{OldStreetState}=e.loadRuntime('utils/oldStreetMap.mjs'),m=e.loadRuntime('utils/neonStreetMap.mjs'),world=new OldStreetState(m.NEON_STREET_PROPS);
 const resolve=e.loadRuntime('utils/chapterEncounterEvents.mjs').resolveChapterRelayPlacement,p={x:480,y:1660};
 const r=resolve({player:p,view:{x:292.5,y:1218.5,width:375,height:667},devices:m.NEON_STREET_DEVICES.filter(d=>d.id==='neonstreet-listening'),currentZone:0,range:280,canReceive:()=>true,clearLine:(a,b,pad)=>world.clearLine(a,b,pad)});
 assert(r,'Actual central street needs a visible reachable host even when the side lamp is farther than220px away');assert(world.clearLine(p,r,16));assert(Math.hypot(r.x-p.x,r.y-p.y)>280);
});
test('rules2 remains readable history and cannot seed rules3 challenges',()=>{
 const {e}=setup('neon');e.profile.recordPublicRun({runId:'old-v2',performerId:'sakura',chapterId:'opening',victory:true,choices:[],durationMs:10000,performance:{hitCount:1,actions:1},rulesetId:'owner-three-chapter-v2'});
 const profile=e.profile.loadPublicProfile(),goals=e.loadRuntime('utils/publicRunGoals.mjs');
 assert.equal(e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID,'owner-three-chapter-v14');
 assert.equal(goals.getPublicRunGoalOptions(profile).find(g=>g.id==='pace').available,false);
 assert(profile.performance.rulesets['owner-three-chapter-v2']['opening:sakura']);assert(profile.campaign.clearedChapterIds.includes('opening'));
 const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'records'});h.scene.create();assert.match(h.text,/规则 2/);h.shutdown();
});
test('expired window is not player interruption; reset drops all event state and duplicate role starts reject',()=>{
 const {d}=neon();assert(!d.beginAuthoredRole(E));d.resolveAuthoredRole(D,'window-expired');assert.equal(d.getChapterEventAction({emitterState:'windup'}),null);assert.equal(d.getChapterEventSnapshot().status,'expired');assert(d.noteChapterEventRelease(E));assert.equal(d.getChapterEventSnapshot().status,'released');
 d.reset();assert.equal(d.getChapterEventSnapshot(),null);assert(d.begin({now:100}));d.advance(101,{completed:2,total:10});assert.deepEqual(plain(d.getPendingAuthoredRoles()),[D]);
});
test('Scene cancels exact cue host/timer only, and never removes an already released pulse',()=>{
 const {e,d}=neon(),{BattleScene:B}=e.loadRuntime('scenes/BattleScene.js');assert.equal(typeof B.prototype._updatePublicChapterEncounterEvent,'function');
 d.resolveAuthoredRole(D,'painted');const events=[],clears=[];
 const s={_userCastPresentation:true,publicStage1Encounter:d,_publicStage1StageCueEmitter:{active:true,publicStage1EnemyState:'windup'},
  _clearPublicStage1StageCueEmitter(reason){clears.push(reason);d.resolveAuthoredRole(E,reason);this._publicStage1StageCueEmitter=null;return true;},
  publicPerformerRun:{recordEncounterEvent:r=>events.push(plain(r))},_showPublicBattleNotice(){}};
 B.prototype._updatePublicChapterEncounterEvent.call(s);assert.deepEqual(clears,['interrupted']);assert.equal(events.at(-1).status,'interrupted');
 B.prototype._updatePublicChapterEncounterEvent.call(s);assert.equal(clears.length,1);
 const h=harbor().d;h.resolveAuthoredRole(D,'painted');let removed=0,recoveries=0;const captain={active:true,publicStage1CaptainSubphase:'captured-cue',publicStage1CaptainCueTimer:{remove:()=>removed++}};
 Object.assign(s,{publicStage1Encounter:h,_publicStage1SpotlightCaptain:captain,_releasePublicStage1SpotlightCaptainCue(c){assert.equal(c,captain);assert.equal(c.publicStage1ChapterCueInterrupted,true);recoveries++;return true;}});
 B.prototype._updatePublicChapterEncounterEvent.call(s);assert.equal(removed,1);assert.equal(recoveries,1);assert.equal(h.getChapterEventSnapshot().status,'interrupted');
});
test('real captain release body respects an interrupted cue while retaining original recovery cleanup',()=>{
 const source=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8'),block=source.slice(source.indexOf('  _releasePublicStage1SpotlightCaptainCue('),source.indexOf('  _clearPublicStage1SpotlightCaptain('));
 const F=new Function('PUBLIC_STAGE1_ENEMY_STATES','P16_017_SPOTLIGHT_CAPTAIN_RECOVERY_MS','return class {'+block+'}');
 const K=F({RECOVERY:'recovery'},2600);let shots=0,timers=0;const c={active:true,publicStage1ChapterCueInterrupted:true,gfx:{clear(){}}};
 const s={_publicStage1SpotlightCaptain:c,_battleEnded:false,_drawPublicStage1SpotlightCaptainGfx(){},_spawnPublicStage1StageCuePulse(){shots++;return {active:true};},time:{delayedCall(){timers++;return {};}}};
 assert(K.prototype._releasePublicStage1SpotlightCaptainCue.call(s,c));assert.equal(shots,0);assert.equal(timers,1);assert.equal(c.publicStage1EnemyState,'recovery');
 c.publicStage1ChapterCueInterrupted=false;K.prototype._releasePublicStage1SpotlightCaptainCue.call(s,c);assert.equal(shots,1);
});
test('validated event review survives finale/result but never enters permanent save',()=>{
 const {e}=setup('neon'),{PublicStage1PerformerRun:R}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs'),scene={_userCastPresentation:true,battleData:{stageId:1,performerId:'sakura',campaignChapterId:'neon'},time:{now:0}};
 const r=new R(scene);assert.equal(typeof r.recordEncounterEvent,'function');assert(!r.recordEncounterEvent({id:'invented',status:'interrupted'}));assert(!r.recordEncounterEvent({id:'harbor-cue-relay',status:'interrupted'}));
 assert(r.recordEncounterEvent({id:'neon-linked-cue',status:'interrupted'}));scene.time.now=10000;const result=r.finish(false);assert.equal(result.encounterEvent.status,'interrupted');
 assert(!JSON.stringify(e.profile.loadPublicProfile()).includes('encounterEvent'));assert(!r.recordEncounterEvent({id:'neon-linked-cue',status:'released'}));
 const m=e.loadRuntime('systems/BattleSurfaceView.mjs').getPublicResultSurfaceModel({buttons:[]},result);assert.match(m.encounterReview.text,/取消/);
 const h=e.harness(e.TitleScene),{BattleSurfaceView:V}=e.loadRuntime('systems/BattleSurfaceView.mjs'),view=new V(h.scene,{mode:'result',model:m,onAction(){}},e.document);assert.match(view.root.textContent,/联动/);view.destroy();
});
