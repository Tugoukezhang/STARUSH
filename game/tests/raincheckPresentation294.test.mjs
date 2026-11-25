import {PUBLIC_CHAPTER_CONTENT} from '../src/utils/publicChapterContent.mjs';
import test,{before,after} from 'node:test';import assert from 'node:assert/strict';
import {createDocument} from './helpers/publicShellHarness.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {PublicStage1FinaleController} from '../src/systems/PublicStage1FinaleController.mjs';
import {PublicStage1EncounterDirector} from '../src/systems/PublicStage1EncounterDirector.mjs';
import {PublicCombatFeedbackView} from '../src/systems/PublicCombatFeedbackView.mjs';
import {syncPublicBossPresentation,PUBLIC_BOSS_LABELS} from '../src/systems/PublicBossPresentation.mjs';
import {isProtectedPublicStage1Boss,canEnemyBePublicStage1PaintTarget} from '../src/systems/PublicStage1EnemyRoles.mjs';
import {configureUserCast} from '../src/utils/userCast.mjs';
import {createPublicRoutePlan} from '../src/utils/publicRoutePlan.mjs';
import {resolveFinaleReturnPath} from '../src/utils/chapterFinaleContent.mjs';
import {getChapterEncounterSummary,resolveChapterEmitterPlan} from '../src/utils/chapterEncounterContent.mjs';
import {getChapterChaserProfile} from '../src/utils/chapterChaserContent.mjs';
import {ChapterObjectiveContract} from '../src/utils/chapterObjectives.mjs';
import {ChapterSideSet} from '../src/utils/chapterSideSets.mjs';
import {PublicRunProgression} from '../src/utils/publicRunProgression.mjs';
import {ROOFTOP_TERRAIN} from '../src/utils/rooftopMap.mjs';
import {PUBLIC_RULESET_ID} from '../src/utils/releaseIdentity.mjs';
import {captureChapterFieldReport,normalizeChapterFieldReport,getChapterFieldReview} from '../src/utils/publicChapterReports.mjs';

// B294: fourth-chapter integration. Real controllers, director, contracts and BattleScene finale entry;
// only the DOM, Phaser events and the slices of scene work unrelated to the announcement are doubles.
before(()=>configureUserCast(true));
after(()=>configureUserCast(false));

function dom(){
  const doc=createDocument();
  const wave=doc.createElement('div');wave.id='wave-text';const clock=doc.createElement('div');clock.id='round-clock';
  doc.getElementById('hud').append(wave,clock);
  return doc;
}
function events(){
  const handlers=new Map();
  return {once(type,fn){handlers.set(type,[...(handlers.get(type)||[]),fn]);},
    off(type,fn){handlers.set(type,(handlers.get(type)||[]).filter(item=>item!==fn));}};
}
function scene(data={}){
  const battleData={stageId:1,practiceMode:false,defenseMode:false,campaignChapterId:'raincheck',...data};
  return {battleData,_userCastPresentation:true,_battleEnded:false,_battlePaused:false,events:events(),time:{now:0},
    publicStage1Finale:new PublicStage1FinaleController(battleData),
    _publicStage1FinaleBoss:{active:true,hp:84,maxHp:84,publicStage1CuePulse:null},player:{hp:4},
    _isPublicStage1Round:()=>true,_isFinaleTrialRound:()=>false};
}
const strip=doc=>doc.querySelector('.public-boss-strip');
const text=(doc,name)=>strip(doc)?.querySelector('.public-boss-'+name)?.textContent;

test('raincheck has its own boss identity on the strip',()=>{
  const doc=dom(),s=scene();
  assert.equal(typeof PUBLIC_BOSS_LABELS.raincheck,'string');
  const chapters=PUBLIC_CHAPTER_CONTENT.map(chapter=>chapter.id);
  assert.deepEqual(Object.keys(PUBLIC_BOSS_LABELS).sort(),chapters.toSorted());
  assert.equal(new Set(Object.values(PUBLIC_BOSS_LABELS)).size,chapters.length,'no chapter reuses another boss name');
  assert.ok(s.publicStage1Finale.begin({now:0}));
  assert.ok(syncPublicBossPresentation(s,s.publicStage1Finale.snapshot(10),{doc}));
  assert.equal(text(doc,'name'),PUBLIC_BOSS_LABELS.raincheck);
  assert.equal(strip(doc).dataset.chapter,'raincheck');
  assert.equal(strip(doc).getAttribute('aria-label'),'雨后返场 BOSS '+PUBLIC_BOSS_LABELS.raincheck);
});

test('guidance follows the real raincheck patterns, protection, weak points and recovery',()=>{
  const doc=dom(),s=scene(),f=s.publicStage1Finale,sync=now=>{s.time.now=now;syncPublicBossPresentation(s,f.snapshot(now),{doc});};
  assert.ok(f.begin({now:0}));
  const expected=['定点蓄势','二维预判','定点蓄势'];
  for(const [index,status] of expected.entries()){
    const base=(index+1)*100;
    sync(base);
    assert.equal(strip(doc).dataset.phase,'attack');
    assert.equal(text(doc,'status'),status);
    assert.equal(text(doc,'instruction'),'防护中 · 先闪避');
    assert.equal(text(doc,'count'),'破绽 '+index+'/3');
    assert.ok(f.recordAttackResolved(base+10));
    sync(base+20);
    assert.equal(text(doc,'status'),'收势 · 等待破绽');
    assert.equal(text(doc,'instruction'),'等待弱点 · 自由移动');
    s._publicStage1FinaleWeakPoint={active:true};sync(base+30);
    assert.equal(text(doc,'status'),'破绽开放');
    assert.equal(text(doc,'instruction'),'弱点开放 · 瞄准标记');
    s._publicStage1FinaleWeakPoint=null;
    assert.ok(f.recordWeakPointResolved(base+40));
  }
  sync(500);
  assert.equal(strip(doc).dataset.phase,'boss-recovery');
  assert.equal(text(doc,'status'),'集中涂染 · 已染 0%');
  assert.equal(text(doc,'instruction'),'本体开放 · 集中攻击');
  assert.equal(text(doc,'count'),'破绽 3/3');
});

test('east route order and blocked-hit protection read real state',()=>{
  const data={performerId:'sakura',stageId:1,campaignChapterId:'raincheck'};
  const doc=dom(),s=scene({performerId:'sakura',publicRoutePlan:createPublicRoutePlan('east',data)}),f=s.publicStage1Finale;
  assert.ok(f.begin({now:0}));
  s.time.now=100;syncPublicBossPresentation(s,f.snapshot(100),{doc});
  assert.equal(text(doc,'status'),'二维预判','east swaps the first two authored beats');
  s._publicStage1FinaleBoss.publicBlockedHitAt=100;
  s.time.now=300;syncPublicBossPresentation(s,f.snapshot(300),{doc});
  assert.equal(text(doc,'instruction'),'攻击被挡 · 先闪避');
  s.time.now=800;syncPublicBossPresentation(s,f.snapshot(800),{doc});
  assert.equal(text(doc,'instruction'),'防护中 · 先闪避');

  const boss={active:true,hp:84,publicStage1EnemyRole:'finale-boss',publicStage1EnemyState:'windup'};
  assert.equal(isProtectedPublicStage1Boss(boss),true);
  assert.equal(canEnemyBePublicStage1PaintTarget(boss),false);
  boss.publicStage1EnemyState='recovery';
  assert.equal(isProtectedPublicStage1Boss(boss),false);
  assert.equal(canEnemyBePublicStage1PaintTarget(boss),true);
});

test('a released raincheck pulse has no return leg, so no return guidance is claimed',()=>{
  const args={attackIndex:0,origin:{x:500,y:300},capture:{capturedX:500,capturedY:600},speed:180,lifetimeMs:5000,
    width:1000,height:1778,clearLine:()=>true};
  assert.equal(resolveFinaleReturnPath({...args,chapterId:'raincheck'}),null);
  assert.ok(resolveFinaleReturnPath({...args,chapterId:'encore'}),'same geometry does return in encore');
  const doc=dom(),s=scene();assert.ok(s.publicStage1Finale.begin({now:0}));
  s._publicStage1FinaleBoss.publicStage1CuePulse={active:true};
  syncPublicBossPresentation(s,s.publicStage1Finale.snapshot(10),{doc});
  assert.equal(text(doc,'status'),'避开攻势');
});

test('real BattleScene finale entry announces the raincheck boss instead of passing undefined',()=>{
  const doc=dom(),Phaser={Scene:class{},Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}};
  const BattleScene=loadBattleScene({Phaser,document:doc});
  const s=Object.assign(Object.create(BattleScene.prototype),scene(),{time:{now:100},
    paintZone:{isComplete:()=>true,enterFinaleMode(){}},
    _showRoundBanner(){},_spawnPublicStage1FinaleBoss(){},_startPublicStage1FinaleAttack(){return true;},
    _clearPublicStage1ObjectiveRouteCue(){}});
  const view=new PublicCombatFeedbackView(s,doc);
  s._combatFeedback=view;s._getPublicCombatFeedback=()=>view;
  assert.equal(s._beginPublicStage1Finale(),true);
  assert.equal(view.bossName.textContent,PUBLIC_BOSS_LABELS.raincheck);
  assert.equal(view.bossUntil,2500);
  assert.equal(strip(doc).dataset.entrance,'true');
  assert.equal(text(doc,'tag'),'BOSS 登场');
  assert.equal(text(doc,'status'),'定点蓄势 · 设施已点亮');
  assert.equal(view.bossNode.hidden,true,'the mounted strip carries the arrival');
});

test('hidden routes stay outside the raincheck strip',()=>{
  const doc=dom(),s=scene({stageId:2});
  assert.equal(syncPublicBossPresentation(s,{active:true,phase:'attack',weakPointsResolved:0,weakPointCount:3},{doc}),null);
  assert.equal(strip(doc),null);
});

test('raincheck summary describes its own rules, not the opening or a linked interrupt',()=>{
  const summary=getChapterEncounterSummary('raincheck');
  for(const absent of ['旧街','实际进入北区','已有联动','突进','守卫'])assert.equal(summary.includes(absent),false,absent);
  for(const present of ['连续驻留1.5秒','清零','排水沟不可通行','第3、7处','串场站不计入','没有联动事件','第2、5、8处','顺序随串场路线变化','连续校音仅用于主线中央灯'])
    assert.equal(summary.includes(present),true,present);
});

test('other chapter summaries keep their existing content',()=>{
  assert.ok(getChapterEncounterSummary('opening').startsWith('旧街定线'));
  assert.ok(getChapterEncounterSummary('unknown').startsWith('旧街定线'));
  assert.ok(getChapterEncounterSummary('neon').includes('街口联动'));
  assert.ok(getChapterEncounterSummary('encore').includes('港湾落击'));
  for(const id of ['opening','neon','encore'])assert.ok(getChapterEncounterSummary(id).includes('实际进入北区'),id);
});

test('summary claims match the rooftop objective contract',()=>{
  const player={x:500,y:1278,hp:5,active:true};
  const node=()=>({id:'rooftop-south-center',zone:0,paint:52,paintMax:52,x:500,y:1278,complete:false,chapterAwaitingCalibration:true});
  const links=[{id:'rooftop-south-west',complete:true},{id:'rooftop-south-east',complete:true}];
  const start=()=>{const c=new ChapterObjectiveContract('raincheck'),d=node();c.sync([d,...links]);c.advance(0,player,[d],0,()=>true);c.advance(100,player,[d],0,()=>true);return {c,d};};

  const locked=new ChapterObjectiveContract('raincheck');
  assert.equal(locked.isLocked(node(),[node(),links[0],{id:'rooftop-south-east',complete:false}]),true,'both side branches are required');
  const {d:timed}=start();assert.equal(timed.chapterCalibrationDurationMs,1500);assert.equal(timed.chapterCalibrationMs,100);

  const left=start();left.c.advance(200,{...player,x:900},[left.d],0,()=>true);assert.equal(left.d.chapterCalibrationMs,0,'leaving');
  const hidden=start();hidden.c.advance(200,player,[hidden.d],0,()=>false);assert.equal(hidden.d.chapterCalibrationMs,0,'occlusion');
  const pressed=start();pressed.d.publicStage1Suppressed=true;pressed.c.advance(200,player,[pressed.d],0,()=>true);assert.equal(pressed.d.chapterCalibrationMs,0,'suppression');

  assert.deepEqual(ROOFTOP_TERRAIN.map(row=>row.id),['west-drain','east-drain']);
});

test('summary claims match choice checkpoints, encounter order and the absence of chasers or events',()=>{
  const run=new PublicRunProgression({performerId:'sakura'});
  assert.equal(run.checkpointFor(2),null);assert.equal(run.checkpointFor(3),1);
  assert.ok(run.choose('relay'));
  assert.equal(run.checkpointFor(6),null);assert.equal(run.checkpointFor(7),2);

  const director=new PublicStage1EncounterDirector({stageId:1,campaignChapterId:'raincheck',performerId:'sakura'});
  assert.equal(director.enableChapterPacing(),false,'no north-entry pacing');
  assert.equal(director.enableChapterEvents(),false,'no linked event');
  assert.ok(director.begin({now:0}));
  const progress=completed=>{director.snapshot(0,{completed,total:10});return director.getPendingAuthoredRoles();};
  assert.deepEqual(progress(1),[]);
  for(const [completed,role] of [[2,'stage-cue-emitter'],[5,'objective-disruptor'],[8,'spotlight-captain']]){
    assert.deepEqual(progress(completed-1),[],'before '+role);
    assert.deepEqual(progress(completed),[role]);
    assert.ok(director.beginAuthoredRole(role));assert.ok(director.resolveAuthoredRole(role,'painted'));
  }
  progress(10);
  assert.equal(director.canEnterFinale(),true);
  assert.equal(director.getChapterEventSnapshot(),null);

  assert.equal(getChapterChaserProfile('raincheck'),null);
  const plan=resolveChapterEmitterPlan({chapterId:'raincheck',origin:{x:100,y:100},player:{x:400,y:500},horizontalVelocity:200,
    windupMs:800,speed:180,width:1000,height:1778});
  assert.equal(plan.pattern,'captured-line');
  assert.deepEqual({...plan.capture},{capturedX:400,capturedY:500},'locks the position at capture');
});

function fieldRun(chapterId,extra={}){
  return {rulesetId:PUBLIC_RULESET_ID,performerId:'sakura',chapterId,encounterEvent:null,finaleResponses:[],
    chapterSideSet:new ChapterSideSet(chapterId,'west').snapshot([]),...extra};
}

test('raincheck report with no event states it is by design, with the serialized shape unchanged',()=>{
  const finaleResponses=[{index:0,pattern:'captured-line',outcome:'evaded'},{index:1,pattern:'momentum-vector',outcome:'hit'}];
  const run=fieldRun('raincheck',{finaleResponses}),report=captureChapterFieldReport(run);
  assert.deepEqual(Object.keys(report),['version','sideSet','event','finaleResponses']);
  assert.equal(report.event,null);
  assert.deepEqual(report.finaleResponses,finaleResponses);
  assert.deepEqual(normalizeChapterFieldReport(JSON.parse(JSON.stringify(report)),run),report);
  const review=getChapterFieldReview({...run,fieldReport:report});
  assert.equal(review.event,'本章按设计不设联动事件；这里没有记录属正常，不计为打断或完成。');
  assert.equal(review.resolved,2);
});

test('raincheck reports still reject linked events; chapters with events keep the not-recorded wording',()=>{
  for(const id of ['neon-linked-cue','harbor-cue-relay'])
    assert.equal(captureChapterFieldReport(fieldRun('raincheck',{encounterEvent:{id,status:'interrupted'}})),null,id);
  const reviewOf=chapterId=>{const run=fieldRun(chapterId);return getChapterFieldReview({...run,fieldReport:captureChapterFieldReport(run)}).event;};
  assert.equal(reviewOf('opening'),'本站无联动事件；未记录为打断。');
  for(const id of ['neon','encore'])assert.equal(reviewOf(id),'本场未记录到联动，不推定为打断或完成。',id);
});
