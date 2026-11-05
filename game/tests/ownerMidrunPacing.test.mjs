import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PublicStage1EncounterDirector as Director,PUBLIC_STAGE1_ENCOUNTER_PHASES} from '../src/systems/PublicStage1EncounterDirector.mjs';
import {STAGE1_PAINT_GATE_Y} from '../src/utils/stage1PaintRound.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
const E='stage-cue-emitter',D='objective-disruptor',C='spotlight-captain';
const roles={opening:[E,D,C],neon:[D,E,C],encore:[E,C,D]};
const data=(id='opening')=>({stageId:1,performerId:'sakura',campaignChapterId:id});
function setup(id='opening',{events=true,pacing=true}={}){
  const d=new Director(data(id));
  if(events)d.enableChapterEvents();
  if(pacing){assert.equal(typeof d.enableChapterPacing,'function');assert(d.enableChapterPacing());}
  assert(d.begin({now:0}));return d;
}
const progress=(d,n,now=100)=>d.advance(now,{completed:n,total:10});
const north=d=>d.observeChapterPacing({zone:1,playerY:STAGE1_PAINT_GATE_Y-1});
const finish=(d,role)=>{assert(d.beginAuthoredRole(role));assert(d.resolveAuthoredRole(role,'painted'));};

test('existing count-only counterexample raises north pressure while player is still south',()=>{
  const d=setup('opening',{pacing:false});
  d.chapterPacingEnabled=true;d.chapterNorthEntered=false;
  const s=progress(d,5);
  assert.equal(s.phaseId,'movement-build');assert.equal(s.cadence.unlitMax,3);
  assert.equal(s.cadence.unlitSpawnMs,1500);
});

for(const id of Object.keys(roles))test(id+' south completion cannot start later solo roles or north cadence',()=>{
  const d=setup(id);progress(d,10);
  assert.deepEqual(d.getPendingAuthoredRoles(),[roles[id][0]]);
  finish(d,roles[id][0]);assert.deepEqual(d.getPendingAuthoredRoles(),[]);
  const s=progress(d,10,200);assert.equal(s.phaseId,'movement-build');assert.match(s.phaseLabel,/南区/);
  assert(!d.canEnterFinale());
});

test('unlock alone, exact border and invalid observations cannot activate the north latch',()=>{
  const d=setup();progress(d,5);
  for(const row of [{zone:0,playerY:500},{zone:1,playerY:1000},{zone:1,playerY:STAGE1_PAINT_GATE_Y},
    {zone:1,playerY:NaN},{zone:1,playerY:Infinity},{zone:1,playerY:-1},{zone:2,playerY:500},{zone:'1',playerY:500},{zone:1}]){
    assert.equal(d.observeChapterPacing(row),false);assert.equal(d.chapterNorthEntered,false);
  }
  assert(north(d));const s=progress(d,5,200);
  assert.equal(s.phaseId,'pressure-stack');assert.match(s.phaseLabel,/北区/);
});

test('north latch is monotonic through backtracking and malformed updates',()=>{
  const d=setup();progress(d,5);assert(north(d));
  for(const row of [{zone:0,playerY:1700},{zone:1,playerY:1200},{zone:null,playerY:null}])d.observeChapterPacing(row);
  assert.equal(d.chapterNorthEntered,true);
  assert.equal(progress(d,8).phaseId,'high-point-chase');
});

for(const id of Object.keys(roles))test(id+' fast progress cannot erase or bypass previous role completion',()=>{
  const d=setup(id,{events:false});progress(d,10);assert(north(d));
  for(const role of roles[id]){
    assert.deepEqual(d.getPendingAuthoredRoles(),[role]);assert(d.beginAuthoredRole(role));
    assert.deepEqual(d.getPendingAuthoredRoles(),[]);assert(!d.canEnterFinale());
    assert(!d.resolveAuthoredRole(role,'cleanup'));assert(d.resolveAuthoredRole(role,'painted'));
  }
  assert(d.canEnterFinale());
});

test('neon retains its real south-side linked emitter before five objectives or north entry',()=>{
  const d=setup('neon');progress(d,2);assert(d.beginAuthoredRole(D));
  d.observeChapterEvent({remoteDisruptor:true,disruptorState:'windup'});
  assert.deepEqual(d.getPendingAuthoredRoles(),[]);
  d.observeChapterEvent({remoteDisruptor:true,disruptorState:'disrupting'});
  assert.deepEqual(d.getPendingAuthoredRoles(),[E]);assert(d.beginAuthoredRole(E));
  assert.equal(d.getChapterEventSnapshot().status,'linked');assert.equal(d.chapterNorthEntered,false);
});

test('neon preemption does not turn an unlinked emitter into an early southern solo event',()=>{
  const d=setup('neon');progress(d,2);finish(d,D);progress(d,5);
  assert.deepEqual(d.getPendingAuthoredRoles(),[]);
  north(d);assert.deepEqual(d.getPendingAuthoredRoles(),[E]);
});

test('harbor captain waits for physical north entry but retains its early linked disruptor',()=>{
  const d=setup('encore');progress(d,2);finish(d,E);progress(d,5);
  assert.deepEqual(d.getPendingAuthoredRoles(),[]);
  d.observeChapterPacing({zone:1,playerY:1000});assert.deepEqual(d.getPendingAuthoredRoles(),[]);
  north(d);assert(d.beginAuthoredRole(C));
  d.observeChapterEvent({captainSubphase:'entrance'});
  assert.deepEqual(d.getPendingAuthoredRoles(),[D]);assert(d.beginAuthoredRole(D));
  assert.equal(d.getChapterEventSnapshot().id,'harbor-cue-relay');
});

test('expired linked windows still reach the ordinary final-role fallback after entry',()=>{
  const d=setup('encore');progress(d,2);finish(d,E);progress(d,5);north(d);assert(d.beginAuthoredRole(C));
  d.observeChapterEvent({captainSubphase:'recovery'});
  assert.deepEqual(d.getPendingAuthoredRoles(),[]);assert(d.resolveAuthoredRole(C,'encounter-complete'));
  progress(d,8);assert.deepEqual(d.getPendingAuthoredRoles(),[D]);finish(d,D);
  progress(d,10);assert(d.canEnterFinale());
});

test('all periodic claim paths and actual cadence use the same south-side phase boundary',()=>{
  const d=setup('opening');progress(d,8);
  assert(d.claimStageCueEmitterOpportunity(20000));
  assert.equal(d.claimObjectiveDisruptorOpportunity(20000),false);
  assert.equal(d.claimSpotlightCaptainOpportunity(20000),false);
  north(d);const s=progress(d,8,21000);
  assert.equal(s.cadence.unlitMax,PUBLIC_STAGE1_ENCOUNTER_PHASES[3].unlitMax);
  assert.equal(s.cadence.unlitSpawnMs,PUBLIC_STAGE1_ENCOUNTER_PHASES[3].unlitSpawnMs);
  assert(d.claimObjectiveDisruptorOpportunity(31000));assert(d.claimSpotlightCaptainOpportunity(31000));
});

test('reset releases only transient pacing state and retry begins in south again',()=>{
  const d=setup();progress(d,10);north(d);d.reset();
  assert.equal(d.chapterNorthEntered,false);assert.equal(d.observeChapterPacing({zone:1,playerY:500}),false);
  assert(d.begin({now:1000}));assert.equal(progress(d,5,1100).phaseId,'movement-build');
  assert.deepEqual(d.getPendingAuthoredRoles(),[E]);assert(!d.canEnterFinale());
});

test('pacing is explicit opt-in and fails closed for unsupported routes or active mutation',()=>{
  for(const patch of [{practiceMode:true},{defenseMode:true},{stageId:2},{performerId:'venus'},{campaignChapterId:'unknown'}]){
    const d=new Director({...data(),...patch});assert.equal(typeof d.enableChapterPacing,'function');
    assert.equal(d.enableChapterPacing(),false);
  }
  const legacy=setup('opening',{pacing:false});progress(legacy,10);
  assert.equal(legacy.snapshot(200).phaseId,'high-point-chase');
  assert.deepEqual(legacy.getPendingAuthoredRoles(),[E,D,C]);
  assert.equal(legacy.enableChapterPacing(),false);
});

test('actual Scene consumes actual zone and player position before choosing and spawning roles',()=>{
  const B=loadBattleScene({Phaser:{Scene:class {}}}),d=setup(),started=[],banners=[];
  const s={_userCastPresentation:true,_isPublicStage1Round:()=>true,player:{x:500,y:1050},
    publicStage1Encounter:d,publicPerformerRun:{now:()=>5000},
    paintZone:{getObjectiveProgress:()=>({completed:5,total:10,zone:1}),isComplete:()=>false},
    _showRoundBanner:text=>banners.push(text),
    _spawnPublicStage1StageCueEmitter(){started.push(E);return {};},
    _spawnPublicStage1ObjectiveDisruptor(){started.push(D);return {};},
    _spawnPublicStage1SpotlightCaptain(){started.push(C);return {};}};
  B.prototype._updatePublicStage1Encounter.call(s);assert.deepEqual(started,[E]);
  assert(d.resolveAuthoredRole(E,'recovery-complete'));
  B.prototype._updatePublicStage1Encounter.call(s);assert.deepEqual(started,[E]);assert.equal(d.chapterNorthEntered,false);
  s.player.y=STAGE1_PAINT_GATE_Y-1;
  B.prototype._updatePublicStage1Encounter.call(s);assert.deepEqual(started,[E,D]);assert.equal(d.chapterNorthEntered,true);
  assert(banners.some(s=>s.startsWith('北区')));
});

test('Scene enables pacing only in the current cast branch and preflight describes actual traversal',()=>{
  const src=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
  const block=src.slice(src.indexOf('this.publicStage1Encounter = new PublicStage1EncounterDirector'),src.indexOf('this.publicStage1Finale = new PublicStage1FinaleController'));
  assert.match(block,/if\s*\(this\._userCastPresentation\)[\s\S]*enableChapterPacing/);
  const copy=readFileSync(new URL('../src/utils/chapterEncounterContent.mjs',import.meta.url),'utf8');
  assert.match(copy,/进入北区/);
});
