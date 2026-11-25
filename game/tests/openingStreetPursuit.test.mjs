import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

// Actual Scene methods over the real opening map, StreetChaseNavigation and OldStreetScene slide/settle.
const env=loadScenes(),src=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
const block=src.slice(src.indexOf('  _spawnUnlitBlob() {'),src.indexOf('  _getPublicStage1EncounterCadence() {'));
const round=env.loadRuntime('utils/stage1PaintRound.mjs'),{OldStreetState}=env.loadRuntime('utils/oldStreetMap.mjs');
const {OldStreetScene}=env.loadRuntime('systems/OldStreetScene.mjs');
const deps={...env.loadRuntime('utils/chapterChaserContent.mjs'),...env.loadRuntime('systems/PublicStage1EnemyRoles.mjs'),...round,
 getBattleChapter:env.campaign.getBattleChapter,getPublicStage1ReactionColor:()=>'pink',GAME_WIDTH:375,GAME_HEIGHT:667,
 Phaser:{Math:{Between:(a,b)=>Math.round((a+b)/2),Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}},drawCapturedAttackCue(){}};
const Methods=new Function(...Object.keys(deps),'return class {'+block+'};')(...Object.values(deps));
const MIN_Y=round.STAGE1_PAINT_GATE_Y+18,CASTS=['sakura','kai','enjo'];

function sprite(x,y){
 const e={active:true,x,y,setAlpha:()=>e,setDepth:()=>e,destroy(){e.active=false;}};
 e.body={moves:true,reset(nx,ny){e.x=nx;e.y=ny;}};return e;
}
function graphics(){const g={active:true,setDepth:()=>g,setPosition:()=>g,clear:()=>g,once(){},destroy(){g.active=false;}};return g;}
function makeScene({chapter='opening',performerId='sakura',data={},patch={},street=true}={}){
 const s=new Methods(),timers=[],list=[];
 Object.assign(s,{battleData:{stageId:1,campaignChapterId:chapter,performerId,...data},_userCastPresentation:true,
  _isPublicStage1Round:()=>true,_isFinaleTrialRound:()=>false,_battleEnded:false,_battlePaused:false,timers,
  paintZone:{isComplete:()=>false,clampPlayerY:y=>Math.max(MIN_Y,y),devices:[],currentZone:0,sideSet:null},
  player:{active:true,hp:100,x:350,y:1275},cameras:{main:{scrollX:0,scrollY:900}},
  time:{addEvent:cfg=>{const t={...cfg,elapsed:0,removed:false,remove(){t.removed=true;}};timers.push(t);return t;}},
  enemies:{add:e=>list.push(e),getChildren:()=>list},physics:{add:{sprite}},add:{graphics},
  _getPublicStage1EncounterCadence:()=>({unlitMax:4}),_countUnlitBlobs:()=>list.filter(e=>e.active&&e.unlitBlob).length,
  _configureCenteredArcadeCircle(){},_drawUnlitBlobGfx(){},_syncManualPhysicsBody(){},_setPublicRunNotice(){},
  _publicStage1ColorCueSequence:0},patch);
 if(street){
  const o=Object.create(OldStreetScene.prototype);
  Object.assign(o,{scene:s,config:null,state:new OldStreetState(),disposed:false,enemyPositions:new WeakMap(),lastPlayer:{...s.player}});
  s.oldStreet=o;
 }
 return s;
}
function spawn(s,at={x:350,y:1425}){
 s._spawnUnlitBlob();const e=s.enemies.getChildren().at(-1);assert(e,'spawn refused');
 e.body.reset(at.x,at.y);return e;
}
// Mirrors BattleScene.update order: Clock timer events, chaser update, manual move, gate clamp, street settle.
function frame(s,e,now,delta){
 for(const t of s.timers){
  if(t.removed||!(delta>0))continue;
  t.elapsed+=delta;while(t.elapsed>=t.delay){t.elapsed-=t.delay;t.callback();}
 }
 const before={x:e.x,y:e.y};
 s._updateChapterChaser(e,now,delta);
 const dt=delta/1000;e.x+=e.moveVx*dt;e.y+=e.moveVy*dt;
 if(e.y!==s.paintZone.clampPlayerY(e.y))e.y=s.paintZone.clampPlayerY(e.y);
 e.body.reset(e.x,e.y);s.oldStreet?.settleEnemy(e);
 return {before,after:{x:e.x,y:e.y}};
}
function chase(s,e,{frames=1000,delta=16,move=null}={}){
 let routed=0,maxDetour=0,i=0;const real=s.oldStreet.chaseWaypoint.bind(s.oldStreet);
 s.oldStreet.chaseWaypoint=(...args)=>{routed++;return real(...args);};
 for(;i<frames&&(move||Math.hypot(e.x-s.player.x,e.y-s.player.y)>24);i++){
  move?.(i,s.player);
  if(move&&i>move.after&&Math.hypot(e.x-s.player.x,e.y-s.player.y)<=24)break;
  const {before,after}=frame(s,e,i*delta,delta);
  assert(s.oldStreet.state.clearLine(before,after,12),'body crossed cover '+JSON.stringify({before,after}));
  assert(after.y>=MIN_Y,'left legal zone '+JSON.stringify(after));
  assert(Math.hypot(after.x-before.x,after.y-before.y)<=48*delta/1000+1e-6,'exceeded opening approach speed');
  maxDetour=Math.max(maxDetour,Math.abs(after.x-350));
 }
 return {i,routed,maxDetour,distance:Math.hypot(e.x-s.player.x,e.y-s.player.y)};
}
const zero=e=>{assert.equal(e.moveVx,0);assert.equal(e.moveVy,0);};

for(const performerId of CASTS)test(performerId+' restored opening chaser derives eligibility without a spawn-only flag',()=>{
 const s=makeScene({performerId});
 const {applyPublicBattleCheckpointCombat}=env.loadRuntime('systems/PublicBattleCombatCheckpoint.mjs');
 const result=applyPublicBattleCheckpointCombat(s,{combat:{elites:[],finale:null,chasers:[
  {x:350,y:1425,hp:36,color:'pink',vx:0,vy:-48,motion:null,guardId:null},
 ]}});
 assert(result.restored.includes('chasers'));const e=s.enemies.getChildren()[0];
 assert.equal(e.ordinaryStreetPursuit,undefined,'real restore does not copy transient spawn metadata');
 const r=chase(s,e);assert(r.routed>0,'restored owner was stranded on legacy vector');
 assert(r.distance<=24,'restored owner stalled '+JSON.stringify(r));assert.equal(e.hp,36);
 assert.equal(e.chapterChaserMotion,undefined);assert.equal(e.chaseTimer.delay,720);
});

test('a cached opening route survives a real pause interval without clock catch-up',()=>{
 const s=makeScene(),e=spawn(s);let clock=100;s.publicPerformerRun={now:()=>clock};
 frame(s,e,90000,16);const nav=s.oldStreet.chaseNavigation,cached=nav.routes.get(e),position={x:e.x,y:e.y};
 assert(cached);s._battlePaused=true;s._updateChapterChaser(e,999999,16);zero(e);
 assert.equal(nav.routes.get(e),cached);assert.deepEqual({x:e.x,y:e.y},position);
 s._battlePaused=false;clock=116;const f=frame(s,e,1000000,16);
 assert.equal(nav.routes.get(e),cached,'wall-clock gap cannot force a private-time route replan');
 assert(Math.hypot(f.after.x-f.before.x,f.after.y-f.before.y)<=48*.016+1e-6);
});

for(const performerId of CASTS)test(performerId+' opening chaser detours the actual record shop into contact',()=>{
 const s=makeScene({performerId}),e=spawn(s);
 assert.equal(e.chapterChaserMotion,undefined,'opening must not gain chapter rush/guard motion');
 assert.equal(e.chaseTimer?.delay,720);
 assert(!s.oldStreet.state.clearLine(e,s.player,12),'fixture must start blocked by the record shop');
 const r=chase(s,e);
 assert(r.routed>0,'actual street navigation unused');
 assert(r.distance<=24,'stalled: '+JSON.stringify({...r,x:e.x,y:e.y}));
 assert(r.maxDetour>=110,'reached contact without a real detour');
 assert.equal(e.hp,e.maxHp);assert.equal(s.player.hp,100);assert.equal(e.active,true);assert.equal(e.ordinaryStreetPursuit,true);
});

test('clear direct line overwrites the stale timer vector with a straight 48px/s approach',()=>{
 const s=makeScene();s.player.x=560;s.player.y=1100;const e=spawn(s,{x:560,y:1300});
 assert(s.oldStreet.state.clearLine(e,s.player,12));
 e.moveVx=31;e.moveVy=7;s._updateChapterChaser(e,0,16);
 assert(Math.abs(e.moveVx)<1e-9);assert(Math.abs(e.moveVy+48)<1e-9);
});

test('legacy 720ms timer is retained but the routed step owns blocked movement',()=>{
 const s=makeScene(),e=spawn(s);const timer=s.timers[0];
 assert.equal(timer.delay,720);assert.equal(timer.loop,true);
 timer.callback();assert(Math.abs(e.moveVx)<1e-9);assert(Math.abs(e.moveVy+48)<1e-9,'fallback retarget changed');
 s._updateChapterChaser(e,0,16);
 assert(Math.abs(e.moveVx)>1,'blocked direct vector survived routing');
 assert(Math.abs(Math.hypot(e.moveVx,e.moveVy)-48)<1e-9);
});

test('long frames and near waypoints clamp the step to remaining distance',()=>{
 const s=makeScene();s.player.x=560;s.player.y=1290;const e=spawn(s,{x:560,y:1300});
 frame(s,e,0,1000);
 assert(Math.abs(e.x-560)<1e-6&&Math.abs(e.y-1290)<1e-6,'overshot: '+e.x+','+e.y);
 const s2=makeScene(),e2=spawn(s2);let wp=null;const real=s2.oldStreet.chaseWaypoint.bind(s2.oldStreet);
 s2.oldStreet.chaseWaypoint=(...args)=>(wp=real(...args));
 for(let i=0;i<40;i++){
  wp=null;const before={x:e2.x,y:e2.y};frame(s2,e2,i*250,250);
  assert(s2.oldStreet.state.clearLine(before,e2,12),'long frame crossed cover');
  if(wp)assert(Math.hypot(e2.x-before.x,e2.y-before.y)<=Math.hypot(wp.x-before.x,wp.y-before.y)+1e-6,'passed its waypoint');
 }
});

test('missing or invalid route results hold position instead of crossing cover',()=>{
 for(const result of [null,undefined,{x:NaN,y:1200},{x:350},{x:Infinity,y:1},{x:350,y:1425}]){
  const s=makeScene(),e=spawn(s);s.oldStreet.chaseWaypoint=()=>result;e.moveVx=40;e.moveVy=-40;
  const {before,after}=frame(s,e,0,16);zero(e);assert.deepEqual(after,before);
 }
 const s=makeScene(),e=spawn(s,{x:340,y:1350});e.moveVx=40;e.moveVy=-40;
 s._updateChapterChaser(e,0,16);zero(e);
 const frozen=makeScene(),f=spawn(frozen);frozen.oldStreet.chaseFrozen=true;f.moveVx=40;
 frozen._updateChapterChaser(f,0,16);zero(f);
});

test('pause, choice, dialog and invalid clock/delta/position never route',()=>{
 const cases=[s=>{s._battlePaused=true;},s=>{s.publicPerformerRun={now:()=>0,choiceOpen:true};},
  s=>{s._sessionExperience={isBlocking:()=>true};},s=>{s.publicPerformerRun={now:()=>NaN};},
  s=>{s.player.x=NaN;},s=>{s.player.active=false;},s=>{s.player.hp=0;},s=>{s.player=null;},
  (s,e)=>{e.x=NaN;},(s,e)=>{e.y=Infinity;}];
 const run=(mutate,delta,now)=>{
  const s=makeScene(),e=spawn(s);let calls=0;s.oldStreet.chaseWaypoint=()=>{calls++;return {x:e.x,y:e.y-10};};
  mutate(s,e);e.moveVx=40;e.moveVy=-40;s._updateChapterChaser(e,now,delta);
  assert.equal(calls,0);zero(e);
 };
 for(const mutate of cases)run(mutate,16,0);
 for(const delta of [0,-16,NaN,Infinity,undefined])run(()=>{},delta,0);
 run(()=>{},16,NaN);
});

test('routing uses the pausable performer clock and the enemy as cache owner',()=>{
 const s=makeScene(),e=spawn(s);let seen=null;s.publicPerformerRun={now:()=>4321,choiceOpen:false};
 s.oldStreet.chaseWaypoint=(a,b,owner,now)=>{seen={a,b,owner,now};return {x:a.x,y:a.y-100};};
 s._updateChapterChaser(e,999999,16);
 assert.equal(seen.now,4321);assert.equal(seen.owner,e);assert.deepEqual(seen.b,{x:350,y:1275});
 assert(Math.abs(e.moveVy+48)<1e-9);
});

test('moving target replans actual navigation and still reaches legal contact',()=>{
 const s=makeScene(),e=spawn(s),target={x:600,y:1480};
 assert(s.oldStreet.state.clearLine(target,target,12));
 const move=(i,p)=>{if(i===move.after){p.x=target.x;p.y=target.y;}};move.after=120;
 const r=chase(s,e,{frames:1500,move});
 assert(r.i>move.after);assert(r.distance<=24,'lost moving target: '+JSON.stringify({...r,x:e.x,y:e.y}));
});

test('dead enemies and ended battles never route or revive',()=>{
 const s=makeScene(),e=spawn(s);let calls=0;s.oldStreet.chaseWaypoint=()=>{calls++;return {x:e.x,y:e.y-10};};
 e.hp=0;e.moveVx=40;e.moveVy=-40;s._updateChapterChaser(e,0,16);zero(e);
 e.active=false;s._updateChapterChaser(e,16,16);zero(e);
 assert.equal(calls,0);assert.equal(e.hp,0);assert.equal(e.active,false);
 const ended=makeScene(),f=spawn(ended);let endedCalls=0;ended.oldStreet.chaseWaypoint=()=>{endedCalls++;return {x:f.x,y:f.y-10};};
 ended._battleEnded=true;f.moveVx=40;ended._updateChapterChaser(f,0,16);zero(f);assert.equal(endedCalls,0);
});

test('later chapters keep chapter motion; legacy and ineligible opening keep the timer owner',()=>{
 for(const chapter of ['neon','encore']){
  const s=makeScene({chapter}),e=spawn(s);
  assert(e.chapterChaserMotion,'chapter motion missing');assert.equal(e.chaseTimer,undefined);assert.notEqual(e.ordinaryStreetPursuit,true);
 }
 const variants=[{data:{practiceMode:true}},{data:{defenseMode:true}},{data:{publicFinaleTrial:{chapterId:'opening'}}},
  {data:{publicFinaleTrial:false}},{data:{publicFinaleTrial:null}},{data:{stageId:null}},
  ...['p15ManualFocusExperiment','p15SetlistCueExperiment','p15HostileProjectileExperiment',
   'p15IntegratedActionCompositionExperiment','p15KaiPrototypeExperiment','p15PerformanceHighPointArcExperiment']
   .map(flag=>({data:{[flag]:true}})),
  {patch:{_isFinaleTrialRound:()=>true}},{patch:{_userCastPresentation:false}},{patch:{_qRebaseTrialRequested:true}},
  {performerId:'mio'},{performerId:null},{data:{stageId:2}},{street:false}];
 for(const variant of variants){
  const s=makeScene(variant),e=spawn(s),label=JSON.stringify(variant);let calls=0;
  if(s.oldStreet)s.oldStreet.chaseWaypoint=()=>{calls++;return {x:e.x,y:e.y-10};};
  assert.equal(e.chaseTimer?.delay,720,label);assert.notEqual(e.ordinaryStreetPursuit,true,label);
  e.moveVx=31;e.moveVy=7;s._updateChapterChaser(e,0,16);
  assert.equal(calls,0);assert.equal(e.moveVx,31);assert.equal(e.moveVy,7);
  s.timers[0].callback();assert(Math.abs(e.moveVy+48)<1e-9,'legacy retarget changed');
 }
 const s=makeScene();let calls=0;s.oldStreet.chaseWaypoint=()=>{calls++;return {x:0,y:0};};
 const base={active:true,x:350,y:1425,hp:5,moveVx:5,moveVy:6};
 for(const other of [{...base,type:'normal'},{...base,ordinaryStreetPursuit:true,unlitBlob:false},
  {...base,ordinaryStreetPursuit:true,unlitBlob:true,publicStage1EnemyRole:'other'}]){
  s._updateChapterChaser(other,0,16);assert.equal(other.moveVx,5);assert.equal(other.moveVy,6);
 }
 assert.equal(calls,0);
});

for(const [chapter,file,configName,x] of [
 ['raincheck','rooftopMap','ROOFTOP_CONFIG',195],
 ['homecoming','harborStageMap','HOMECOMING_STAGE_CONFIG',730],
]) test(chapter+' pursues around its own solid cover using the ordinary contact enemy',()=>{
 const s=makeScene({chapter}),config=env.loadRuntime('utils/'+file+'.mjs')[configName];
 s.oldStreet.state=new OldStreetState(config.props,config.terrain);
 Object.assign(s.player,{x,y:1170});
 const enemy=spawn(s,{x,y:1360});
 assert.equal(s.oldStreet.clearLine(enemy,s.player,12),false,'fixture must block a straight approach');
 const result=chase(s,enemy);
 assert(result.routed>0 && result.distance<=24,JSON.stringify(result));
 assert.equal(enemy.chapterChaserMotion,undefined);
});
