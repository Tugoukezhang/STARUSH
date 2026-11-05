import test from 'node:test';import assert from 'node:assert/strict';
import {ChapterObjectiveContract,getChapterObjectiveSummary} from '../src/utils/chapterObjectives.mjs';
import {ChapterSideSet,getChapterSideSetSummary,hasCompletedChapterSideBranch} from '../src/utils/chapterSideSets.mjs';
import {getChapterEncounterSummary} from '../src/utils/chapterEncounterContent.mjs';
import {RAINCHECK_CHAPTER} from '../src/utils/raincheckChapter.mjs';
import {ROOFTOP_DEVICES} from '../src/utils/rooftopMap.mjs';
import {validateChapterContent} from '../src/utils/publicChapterContent.mjs';

const SOUTH='rooftop-south-center',NORTH='rooftop-north-center';
const LINKS=['rooftop-south-west','rooftop-south-east','rooftop-north-west','rooftop-north-east'];
const side=(branchRow,sideIndex)=>'raincheck-side-'+branchRow+'-'+sideIndex;
// Branch rows are authored as: 0 south-west, 1 south-east, 2 north-west, 3 north-east.
const SOUTH_WEST=[side(0,0),side(0,1)],SOUTH_EAST=[side(1,0),side(1,1)],NORTH_WEST=[side(2,0),side(2,1)],NORTH_EAST=[side(3,0),side(3,1)];
const CLEAR=()=>true,BLOCKED=()=>false;

function rig(done=[],{center=SOUTH,links=LINKS,awaiting=true,mutate=null}={}){
 const devices=[...ROOFTOP_DEVICES,...new ChapterSideSet('raincheck').definitions].map(d=>({...d,complete:false}));
 for(const id of [...links,...done])devices.find(d=>d.id===id).complete=true;
 const central=devices.find(d=>d.id===center);central.chapterAwaitingCalibration=awaiting;
 mutate?.(devices);
 const owner=new ChapterObjectiveContract('raincheck');owner.sync(devices);
 const near={x:central.x,y:central.y,hp:5,active:true},far={...near,x:central.x+113};
 const r={owner,devices,central,near,far,now:0};
 owner.advance(0,near,devices,central.zone,CLEAR); // Primes the clock with a zero delta.
 return r;
}
function run(r,{player=r.near,line=CLEAR,n=1,step=100,list=r.devices}={}){
 let done=[];
 for(let i=0;i<n;i++){r.now+=step;done=r.owner.advance(r.now,player,list,r.central.zone,line);}
 return done;
}

test('authored zones match: south center and its branches are zone 0, north are zone 1',()=>{
 assert.equal(ROOFTOP_DEVICES.find(d=>d.id===SOUTH).zone,0);assert.equal(ROOFTOP_DEVICES.find(d=>d.id===NORTH).zone,1);
 const defs=new ChapterSideSet('raincheck').definitions;
 for(const id of [...SOUTH_WEST,...SOUTH_EAST])assert.equal(defs.find(d=>d.id===id).zone,0,id);
 for(const id of [...NORTH_WEST,...NORTH_EAST])assert.equal(defs.find(d=>d.id===id).zone,1,id);
});

test('either complete same-zone same-branch pair buffers only that zone central node',()=>{
 for(const [done,south,north] of [[SOUTH_WEST,true,false],[SOUTH_EAST,true,false],[NORTH_WEST,false,true],[NORTH_EAST,false,true],
  [[...SOUTH_WEST,...NORTH_EAST],true,true]]){
  const r=rig(done),at=id=>r.devices.find(d=>d.id===id).chapterCalibrationBuffered;
  assert.equal(at(SOUTH),south,done.join());assert.equal(at(NORTH),north,done.join());
 }
});

test('mixed, partial, wrong-zone or merely counted stations never buffer',()=>{
 for(const done of [[],[side(0,0)],[side(0,1)],[side(1,0)],
  [side(0,0),side(1,1)],[side(0,1),side(1,0)],[side(0,0),side(1,0)],[side(0,1),side(1,1)],
  NORTH_WEST,NORTH_EAST,[side(0,0),side(2,1)],[side(0,0),side(1,1),side(2,0)],[side(0,1),side(1,0),...NORTH_EAST]]){
  const r=rig(done);
  assert.equal(r.central.chapterCalibrationBuffered,false,done.join());
  run(r,{n:5});run(r,{player:r.far});
  assert.equal(r.central.chapterCalibrationMs,0,'unsupplied progress resets: '+done.join());
 }
});

test('main links are prerequisites, not supply',()=>{
 assert.equal(rig([]).central.chapterCalibrationBuffered,false);
});

test('arbitrary flags and malformed rows cannot stand in for the authored station',()=>{
 const edit=(id,change)=>devices=>Object.assign(devices.find(d=>d.id===id),change);
 const cases={
  wrongZone:edit(side(0,1),{zone:1}),wrongIndex:edit(side(0,1),{sideIndex:0}),wrongBranch:edit(side(0,1),{sideBranch:'east'}),
  notSideSet:edit(side(0,1),{chapterSideSet:false}),truthyComplete:edit(side(0,1),{complete:'yes'}),incomplete:edit(side(0,1),{complete:false}),
  renamed:edit(side(0,1),{id:'fake-station'}),otherChapter:edit(side(0,1),{id:'encore-side-0-1'}),
  missing:devices=>devices.splice(devices.findIndex(d=>d.id===side(0,1)),1),
 };
 for(const [name,mutate] of Object.entries(cases))assert.equal(rig(SOUTH_WEST,{mutate}).central.chapterCalibrationBuffered,false,name);
});

test('sync overwrites a forged flag, in both directions',()=>{
 const forged=rig([],{mutate:d=>{d.find(x=>x.id===SOUTH).chapterCalibrationBuffered=true;}});
 assert.equal(forged.central.chapterCalibrationBuffered,false);
 const denied=rig(SOUTH_WEST,{mutate:d=>{d.find(x=>x.id===SOUTH).chapterCalibrationBuffered=false;}});
 assert.equal(denied.central.chapterCalibrationBuffered,true);
});

test('real side-set play agrees: the selected branch buffers exactly when zoneComplete is true',()=>{
 const sets=new ChapterSideSet('raincheck'),r=rig([]);
 for(const id of SOUTH_EAST){
  const station=r.devices.find(d=>d.id===id);
  assert.equal(sets.canReceive(station,r.devices),true);
  assert.equal(sets.zoneComplete(0,r.devices),false);assert.equal(hasCompletedChapterSideBranch('raincheck',0,r.devices),false);
  station.complete=true;sets.completed(station,r.devices);
 }
 r.owner.sync(r.devices);
 assert.equal(sets.zoneComplete(0,r.devices),true);assert.equal(r.central.chapterCalibrationBuffered,true);
 assert.notEqual(sets.lockReason(r.devices.find(d=>d.id===side(0,0)),r.devices),'','the other branch stays locked');
});

test('buffered progress is preserved on leaving and on occlusion, and is not advanced there',()=>{
 for(const interrupt of [r=>({player:r.far}),()=>({line:BLOCKED})]){
  const r=rig(SOUTH_WEST);run(r,{n:6});assert.equal(r.central.chapterCalibrationMs,600);
  assert.deepEqual(run(r,{...interrupt(r),n:20}),[]);
  assert.equal(r.central.chapterCalibrationMs,600);
  run(r);assert.equal(r.central.chapterCalibrationMs,700,'resumes without catching up the time away');
 }
});

test('buffered progress close to full never auto-completes while away',()=>{
 const r=rig(SOUTH_WEST);run(r,{n:14});
 assert.deepEqual(run(r,{player:r.far,n:50}),[]);assert.deepEqual(run(r,{line:BLOCKED,n:50}),[]);
 assert.equal(r.central.chapterCalibrationMs,1400);assert.equal(r.central.complete,false);
 assert.deepEqual(run(r),[r.central]);
});

test('suppression resets buffered progress, near or away, and allows no progress while held',()=>{
 for(const where of ['near','far']){
  const r=rig(SOUTH_WEST);run(r,{n:9});
  r.central.publicStage1Suppressed=true;
  assert.deepEqual(run(r,{player:r[where],n:3}),[]);assert.equal(r.central.chapterCalibrationMs,0,where);
  r.central.publicStage1Suppressed=false;run(r);
  assert.equal(r.central.chapterCalibrationMs,100,'restarts from zero after release');
  assert.equal(r.central.chapterCalibrationBuffered,true,'supply itself survives suppression');
 }
});

test('paused clock: buffered progress is kept with no catch-up, and long gaps stay capped',()=>{
 const r=rig(SOUTH_WEST);run(r,{n:5});
 r.owner.suspend();r.now+=60000;
 assert.deepEqual(r.owner.advance(r.now,r.near,r.devices,0,CLEAR),[]);
 assert.equal(r.central.chapterCalibrationMs,500,'the first tick after a pause has zero delta');
 run(r);assert.equal(r.central.chapterCalibrationMs,600);
 run(r,{step:60000});assert.equal(r.central.chapterCalibrationMs,700,'an unsuspended gap is capped to one step');
 run(r,{player:r.far,n:3,step:60000});run(r);
 assert.equal(r.central.chapterCalibrationMs,800,'time spent away is not repaid on return');
});

test('suppression still resets on the first tick after a pause',()=>{
 const r=rig(SOUTH_WEST);run(r,{n:5});
 r.owner.suspend();r.central.publicStage1Suppressed=true;r.now+=5000;
 r.owner.advance(r.now,r.near,r.devices,0,CLEAR);
 assert.equal(r.central.chapterCalibrationMs,0);
});

test('without supply the original continuous 1500ms rule is unchanged',()=>{
 const left=rig([]);run(left,{n:9});run(left,{player:left.far});assert.equal(left.central.chapterCalibrationMs,0);
 const hidden=rig([]);run(hidden,{n:9});run(hidden,{line:BLOCKED});assert.equal(hidden.central.chapterCalibrationMs,0);
 const pressed=rig([]);run(pressed,{n:9});pressed.central.publicStage1Suppressed=true;run(pressed);assert.equal(pressed.central.chapterCalibrationMs,0);
 const steady=rig([]);assert.deepEqual(run(steady,{n:14}),[]);assert.deepEqual(run(steady),[steady.central]);
});

test('supply grants no faster hold, no longer range and no skipped prerequisite',()=>{
 const r=rig(SOUTH_WEST);
 assert.equal(r.central.chapterCalibrationDurationMs,1500);assert.equal(r.central.chapterCalibrationRadius,112);
 assert.deepEqual(run(r,{n:14}),[]);assert.deepEqual(run(r),[r.central]);
 const edge=rig(SOUTH_WEST);
 run(edge,{player:{...edge.near,x:edge.central.x+112}});assert.equal(edge.central.chapterCalibrationMs,100,'112 is in range');
 run(edge,{player:edge.far});assert.equal(edge.central.chapterCalibrationMs,100,'113 is out of range');
 const locked=rig(SOUTH_WEST,{links:['rooftop-south-west']});
 assert.equal(locked.central.chapterLocked,true);assert.equal(locked.central.chapterCalibrationBuffered,true);
 assert.equal(locked.owner.canReceive({...locked.central,chapterAwaitingCalibration:false},locked.devices),false);
 run(locked,{n:20});assert.equal(locked.central.chapterCalibrationMs,0);
});

test('advance on only [central] after sync(all) keeps the sync-derived flag',()=>{
 const r=rig(SOUTH_WEST),list=[r.central];
 run(r,{n:6,list});run(r,{player:r.far,list});
 assert.equal(r.central.chapterCalibrationBuffered,true);assert.equal(r.central.chapterCalibrationMs,600);
 const plain=rig([]),only=[plain.central];
 run(plain,{n:6,list:only});run(plain,{player:plain.far,list:only});assert.equal(plain.central.chapterCalibrationMs,0);
});

test('finishing supply mid-run grants no progress and never restores what was already lost',()=>{
 const r=rig([]);run(r,{n:6});
 for(const id of SOUTH_WEST)r.devices.find(d=>d.id===id).complete=true;
 r.owner.sync(r.devices);
 assert.equal(r.central.chapterCalibrationBuffered,true);assert.equal(r.central.chapterCalibrationMs,600);
 const lost=rig([]);run(lost,{n:6});run(lost,{player:lost.far});
 for(const id of SOUTH_WEST)lost.devices.find(d=>d.id===id).complete=true;
 lost.owner.sync(lost.devices);assert.equal(lost.central.chapterCalibrationMs,0);
});

test('restore derives the buffer from saved device truth alone',()=>{
 const restore=done=>{
  const source=rig(done);run(source,{n:7});
  // Same fields, in the same order, that the checkpoint DTO saves and re-applies.
  const saved=JSON.parse(JSON.stringify(source.devices.map(d=>({id:d.id,complete:d.complete===true,
   calibrating:d.chapterAwaitingCalibration===true,calibrationMs:d.chapterCalibrationMs||0}))));
  assert(saved.every(row=>!Object.hasOwn(row,'chapterCalibrationBuffered')));
  const devices=[...ROOFTOP_DEVICES,...new ChapterSideSet('raincheck').definitions].map(d=>({...d,complete:false}));
  for(const row of saved){
   const d=devices.find(x=>x.id===row.id);
   Object.assign(d,{complete:row.complete,chapterCalibrationMs:row.calibrationMs});
   if(row.calibrating)d.chapterAwaitingCalibration=true;
  }
  const owner=new ChapterObjectiveContract('raincheck');owner.sync(devices);
  const central=devices.find(d=>d.id===SOUTH);
  owner.advance(50000,{x:central.x+113,y:central.y,hp:5},devices,0,CLEAR);
  return central;
 };
 const kept=restore(SOUTH_EAST);assert.equal(kept.chapterCalibrationBuffered,true);assert.equal(kept.chapterCalibrationMs,700);
 const mixed=restore([side(0,0),side(1,1)]);assert.equal(mixed.chapterCalibrationBuffered,false);assert.equal(mixed.chapterCalibrationMs,0);
});

test('harbor is unaffected: no flag, 1000ms, keeps progress on leave and on suppression',()=>{
 const build=withSide=>{
  const stage={id:'harbor-stage-left',x:500,y:800,zone:0,complete:false,chapterAwaitingCalibration:true};
  const owner=new ChapterObjectiveContract('encore');
  const devices=[stage,...new ChapterSideSet('encore').definitions.map(d=>({...d,complete:withSide}))];
  owner.sync(devices);owner.advance(0,stage,devices,0,CLEAR);
  const near={x:500,y:800,hp:5},far={x:613,y:800,hp:5},trace=[];let now=0;
  const step=(player,line=CLEAR)=>{now+=100;const done=owner.advance(now,player,devices,0,line);trace.push(stage.chapterCalibrationMs);return done;};
  for(let i=0;i<4;i++)step(near);
  step(far);step(near,BLOCKED);
  stage.publicStage1Suppressed=true;step(near);stage.publicStage1Suppressed=false;
  for(let i=0;i<5;i++)step(near);
  return {stage,trace,devices,done:step(near)};
 };
 const supplied=build(true),plain=build(false);
 assert.deepEqual(supplied.trace,plain.trace,'completed harbor stations change nothing');
 assert.equal(supplied.stage.chapterCalibrationDurationMs,1000);
 assert.deepEqual(supplied.done,[supplied.stage]);
 assert.equal(supplied.trace[6],400,'leave, occlusion and suppression all keep harbor progress');
 assert(supplied.devices.every(d=>!Object.hasOwn(d,'chapterCalibrationBuffered')));
});

test('other chapters get no flag, and chapter IDs cannot supply each other',()=>{
 for(const id of ['opening','neon','encore']){
  const devices=new ChapterSideSet(id).definitions.map(d=>({...d,complete:true}));
  new ChapterObjectiveContract(id).sync(devices);
  assert(devices.every(d=>!Object.hasOwn(d,'chapterCalibrationBuffered')),id);
  assert.equal(devices.length,8);assert.equal(devices[3].id,id+'-side-1-1');
  assert.equal(hasCompletedChapterSideBranch('raincheck',0,devices),false,id);
 }
 assert.equal(hasCompletedChapterSideBranch('unknown',0,[]),false);
});

test('other-chapter copy is unchanged',()=>{
 assert.equal(getChapterObjectiveSummary('encore'),'舞台双灯喷满后，靠近各自灯柱累计校准1秒；离开保留进度。');
 assert.equal(getChapterObjectiveSummary('neon'),'先接通两侧门灯，再涂染汇流中枢。');
 assert.equal(getChapterSideSetSummary('opening'),'南北两区各选一条串场线，完成两站；第一站完成后另一线留待复演。旧街同线两站可自由安排先后。');
 for(const id of ['opening','neon','encore'])assert(!getChapterEncounterSummary(id).includes('储备'),id);
});

test('raincheck copy explains the route benefit, never calls required stations optional, and keeps authored data',()=>{
 const c=RAINCHECK_CHAPTER,copy=[c.briefing.rule,getChapterObjectiveSummary('raincheck'),getChapterEncounterSummary('raincheck')];
 for(const text of copy){
  assert.match(text,/同线两站/,text);assert.match(text,/储备/,text);assert.match(text,/压制/,text);assert.match(text,/1\.5秒/,text);
 }
 assert.match(getChapterSideSetSummary('raincheck'),/储备/);
 const story=[...c.story.intro,...c.story.midpoint,...c.story.outro];
 assert(!story.some(([,line])=>line.includes('刚刚一走开')),'the stale always-resets line is gone');
 assert(story.some(([,line])=>line.includes('备用电')));
 for(const [speaker,line] of story)if(speaker!=='旁白')assert(line.length<=45,line);
 for(const text of [...copy,getChapterSideSetSummary('raincheck'),...story.map(([,line])=>line)])assert.doesNotMatch(text,/可选|选做|非必要|optional/i,text);
 assert.equal(c.encounter.eventId,null);
 assert.deepEqual(c.encounter.roles,['stage-cue-emitter','objective-disruptor','spotlight-captain']);
 assert.deepEqual(c.finalePatterns,['captured-line','momentum-cutoff','captured-line']);
 assert.deepEqual(validateChapterContent(),[]);
});
