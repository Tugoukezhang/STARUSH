import test from 'node:test';
import assert from 'node:assert/strict';
import {ChapterObjectiveContract} from '../src/utils/chapterObjectives.mjs';
import {HARBOR_STAGE_DEVICES,HARBOR_STAGE_PROPS,HARBOR_STAGE_TERRAIN} from '../src/utils/harborStageMap.mjs';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
import {HOMECOMING_CIRCUIT_ROUTES,getHomecomingCircuitState,sampleCircuitPath,circuitPathLength} from '../src/utils/homecomingCircuit.mjs';

const SOUTH=['meeting','west-deck','shed','control','crossing'];
const NORTH=['north-entry','west-relay','east-relay','stage-left','stage-right'];
const near=(actual,expected,label)=>assert(Math.abs(actual-expected)<1e-9,`${label}: ${actual} != ${expected}`);
const segments=route=>route.points.slice(1).map((to,i)=>[route.points[i],to]);
const routeOf=(from,to)=>HOMECOMING_CIRCUIT_ROUTES.find(r=>r.from==='harbor-'+from&&r.to==='harbor-'+to);

// Every state assertion goes through the real contract, so chapterLocked is never hand-set.
function setup(completed=[],suppressed=[]){
 const devices=HARBOR_STAGE_DEVICES.map(d=>({...d,complete:completed.includes(d.id.slice(7)),publicStage1Suppressed:suppressed.includes(d.id.slice(7))}));
 new ChapterObjectiveContract('homecoming').sync(devices);
 return devices;
}
const stateOf=(devices,from,to,zone)=>getHomecomingCircuitState(routeOf(from,to),devices,zone);

test('routes are exactly the dependency edges the real contract enforces',()=>{
 // HOMECOMING_LINKS is private: derive edges by withholding one device at a time.
 const contract=new ChapterObjectiveContract('homecoming'),enforced=[];
 for(const source of HARBOR_STAGE_DEVICES)for(const target of HARBOR_STAGE_DEVICES){
  const devices=HARBOR_STAGE_DEVICES.map(d=>({...d,complete:d.id!==source.id}));
  if(contract.isLocked(target,devices))enforced.push(source.id+'>'+target.id);
 }
 const authored=HOMECOMING_CIRCUIT_ROUTES.map(r=>r.from+'>'+r.to);
 assert.equal(authored.length,10);
 assert.deepEqual([...authored].sort(),enforced.sort());
 assert.equal(new Set(authored).size,10,'edges are unique');
 assert.equal(new Set(HOMECOMING_CIRCUIT_ROUTES.map(r=>r.id)).size,10,'ids are unique');
 for(const r of HOMECOMING_CIRCUIT_ROUTES)for(const id of [r.id,r.from,r.to])assert.match(id,/^harbor-/);
});
test('every route starts and ends on its exact fixture',()=>{
 const at=id=>HARBOR_STAGE_DEVICES.find(d=>d.id===id);
 for(const r of HOMECOMING_CIRCUIT_ROUTES){
  const first=r.points[0],last=r.points[r.points.length-1];
  assert.deepEqual([first.x,first.y],[at(r.from).x,at(r.from).y],r.id+' start');
  assert.deepEqual([last.x,last.y],[at(r.to).x,at(r.to).y],r.id+' end');
 }
});
test('authored waypoints match the production route sheet',()=>{
 const sheet={
  'meeting>west-deck':[[500,1630],[500,1510],[240,1510],[240,1450]],
  'west-deck>shed':[[240,1450],[280,1250]],
  'shed>control':[[280,1250],[400,1250],[400,1050],[740,1050]],
  'control>crossing':[[740,1050],[740,1005],[500,1005]],
  'crossing>north-entry':[[500,1005],[500,850]],
  'north-entry>west-relay':[[500,850],[400,850],[400,690],[280,690]],
  'north-entry>east-relay':[[500,850],[600,850],[600,690],[720,690]],
  'west-relay>stage-left':[[280,690],[190,690],[190,350],[350,350],[350,300]],
  'east-relay>stage-left':[[720,690],[810,690],[810,270],[350,270],[350,300]],
  'stage-left>stage-right':[[350,300],[650,300]],
 };
 for(const [edge,coords] of Object.entries(sheet)){
  const r=routeOf(...edge.split('>'));
  assert.deepEqual(r.points.map(p=>[p.x,p.y]),coords,edge);
 }
});
test('no segment crosses a building, water or a closed barrier at radius 3',()=>{
 const state=new OldStreetState(HARBOR_STAGE_PROPS,HARBOR_STAGE_TERRAIN);
 assert(state.blockers().some(p=>p.id==='south-transport')&&state.blockers().some(p=>p.id==='north-transport'),'barriers start closed');
 assert(state.blockers().some(p=>p.id==='west-water')&&state.blockers().some(p=>p.id==='east-water'),'water is included');
 for(const r of HOMECOMING_CIRCUIT_ROUTES)for(const [a,b] of segments(r)){
  assert.equal(state.clearLine(a,b,3),true,`${r.id} (${a.x},${a.y})-(${b.x},${b.y})`);
 }
});
test('collision check itself rejects a cable through each blocker class',()=>{
 const state=new OldStreetState(HARBOR_STAGE_PROPS,HARBOR_STAGE_TERRAIN);
 assert.equal(state.clearLine({x:280,y:1250},{x:280,y:900},3),false,'equipment shed');
 assert.equal(state.clearLine({x:240,y:1450},{x:60,y:1450},3),false,'west water');
 assert.equal(state.clearLine({x:500,y:1300},{x:500,y:1150},3),false,'south barrier');
});
test('barrier sprites do not cover a cable under any vertical anchor',()=>{
 // Footprints are only 15 tall; test the art box extended a full sprite height both ways.
 const sprites=HARBOR_STAGE_PROPS.filter(p=>p.art==='barrier').map(p=>({id:p.id,
  footprint:{x:p.x-p.width/2,y:p.y-p.height,width:p.width,height:p.height*2}}));
 assert.equal(sprites.length,2);
 const state=new OldStreetState(sprites);
 for(const r of HOMECOMING_CIRCUIT_ROUTES)for(const [a,b] of segments(r))assert.equal(state.clearLine(a,b,3),true,r.id);
});

test('fresh run: every route is dormant, including before the first device',()=>{
 const devices=setup();
 for(const r of HOMECOMING_CIRCUIT_ROUTES)assert.equal(getHomecomingCircuitState(r,devices,0),'dormant',r.id);
});
test('south chain walks dormant, ready, complete per edge',()=>{
 for(let i=0;i<SOUTH.length-1;i++){
  const [from,to]=[SOUTH[i],SOUTH[i+1]];
  assert.equal(stateOf(setup(SOUTH.slice(0,i)),from,to,0),'dormant',from);
  assert.equal(stateOf(setup(SOUTH.slice(0,i+1)),from,to,0),'ready',from);
  assert.equal(stateOf(setup(SOUTH.slice(0,i+2)),from,to,0),'complete',from);
 }
});
test('cross-zone edge stays dormant in zone 0 even when crossing is complete',()=>{
 const devices=setup(SOUTH);
 assert.equal(devices.find(d=>d.id==='harbor-north-entry').chapterLocked,false,'contract alone would allow it');
 assert.equal(stateOf(devices,'crossing','north-entry',0),'dormant');
 assert.equal(stateOf(devices,'crossing','north-entry',1),'ready');
 // Zone wins over completion, so an out-of-order flag cannot light the north early.
 assert.equal(stateOf(setup([...SOUTH,'north-entry']),'crossing','north-entry',0),'dormant');
 assert.equal(stateOf(setup([...SOUTH,'north-entry']),'crossing','north-entry',1),'complete');
});
test('north routes stay dormant in zone 0 whatever their flags say',()=>{
 const devices=setup([...SOUTH,...NORTH]);
 for(const r of HOMECOMING_CIRCUIT_ROUTES.filter(r=>r.to!=='harbor-north-entry'&&NORTH.includes(r.to.slice(7)))){
  assert.equal(getHomecomingCircuitState(r,devices,0),'dormant',r.id);
  assert.equal(getHomecomingCircuitState(r,devices,1),'complete',r.id);
 }
});
test('completed south routes stay complete after moving to zone 1',()=>{
 const devices=setup(SOUTH);
 for(let i=0;i<SOUTH.length-1;i++)assert.equal(stateOf(devices,SOUTH[i],SOUTH[i+1],1),'complete',SOUTH[i]);
});
test('left stage waits for both relays through the real lock',()=>{
 const base=[...SOUTH,'north-entry'];
 let devices=setup(base);
 assert.equal(stateOf(devices,'west-relay','stage-left',1),'dormant');
 assert.equal(stateOf(devices,'east-relay','stage-left',1),'dormant');
 devices=setup([...base,'west-relay']);
 assert.equal(devices.find(d=>d.id==='harbor-stage-left').chapterLocked,true);
 assert.equal(stateOf(devices,'west-relay','stage-left',1),'waiting');
 assert.equal(stateOf(devices,'east-relay','stage-left',1),'dormant');
 devices=setup([...base,'east-relay']);
 assert.equal(stateOf(devices,'west-relay','stage-left',1),'dormant');
 assert.equal(stateOf(devices,'east-relay','stage-left',1),'waiting');
 devices=setup([...base,'west-relay','east-relay']);
 assert.equal(stateOf(devices,'west-relay','stage-left',1),'ready');
 assert.equal(stateOf(devices,'east-relay','stage-left',1),'ready');
 assert.equal(stateOf(devices,'stage-left','stage-right',1),'dormant');
 devices=setup([...base,'west-relay','east-relay','stage-left']);
 assert.equal(stateOf(devices,'west-relay','stage-left',1),'complete');
 assert.equal(stateOf(devices,'east-relay','stage-left',1),'complete');
 assert.equal(stateOf(devices,'stage-left','stage-right',1),'ready');
});
test('a suppressed destination reports suppressed instead of ready',()=>{
 assert.equal(stateOf(setup(['meeting'],['west-deck']),'meeting','west-deck',0),'suppressed');
 assert.equal(stateOf(setup(['meeting']),'meeting','west-deck',0),'ready');
});
test('ready and suppressed agree with the real canReceive gate',()=>{
 const contract=new ChapterObjectiveContract('homecoming');
 const devices=setup(['meeting'],['west-deck']),target=devices.find(d=>d.id==='harbor-west-deck');
 assert.equal(stateOf(devices,'meeting','west-deck',0),'suppressed');
 assert.equal(contract.canReceive(target,devices),false);
 target.publicStage1Suppressed=false;
 assert.equal(stateOf(devices,'meeting','west-deck',0),'ready');
 assert.equal(contract.canReceive(target,devices),true);
});
test('suppression never dims a completed circuit',()=>{
 for(const suppressed of [['west-deck'],['meeting'],['meeting','west-deck']]){
  assert.equal(stateOf(setup(['meeting','west-deck'],suppressed),'meeting','west-deck',0),'complete',suppressed.join());
 }
});
test('suppression on a complete source does not block a ready route',()=>{
 assert.equal(stateOf(setup(['meeting'],['meeting']),'meeting','west-deck',0),'ready');
});
test('unmet dependencies outrank suppression, and an open source outranks both',()=>{
 const base=[...SOUTH,'north-entry','west-relay'];
 assert.equal(stateOf(setup(base,['stage-left']),'west-relay','stage-left',1),'waiting');
 assert.equal(stateOf(setup(SOUTH,['north-entry']),'crossing','north-entry',0),'dormant');
 assert.equal(stateOf(setup([],['meeting','west-deck']),'meeting','west-deck',0),'dormant');
});
test('state reads the live lock flag and does not re-derive dependencies',()=>{
 const devices=setup(['meeting']);
 devices.find(d=>d.id==='harbor-west-deck').chapterLocked=true;
 assert.equal(stateOf(devices,'meeting','west-deck',0),'waiting');
});
test('state lookup leaves devices untouched',()=>{
 const devices=setup(['meeting']),before=JSON.stringify(devices);
 for(const r of HOMECOMING_CIRCUIT_ROUTES)getHomecomingCircuitState(r,devices,0);
 assert.equal(JSON.stringify(devices),before);
});

test('path length sums every segment',()=>{
 const expected={'meeting>west-deck':120+260+60,'west-deck>shed':Math.hypot(40,200),'shed>control':120+200+340,
  'control>crossing':45+240,'crossing>north-entry':155,'north-entry>west-relay':100+160+120,'north-entry>east-relay':100+160+120,
  'west-relay>stage-left':90+340+160+50,'east-relay>stage-left':90+420+460+30,'stage-left>stage-right':300};
 for(const [edge,length] of Object.entries(expected))near(circuitPathLength(routeOf(...edge.split('>')).points),length,edge);
});
test('sampling clamps at both ends and hits the exact fixtures',()=>{
 for(const r of HOMECOMING_CIRCUIT_ROUTES){
  const length=circuitPathLength(r.points),first=r.points[0],last=r.points[r.points.length-1];
  for(const d of [0,-50]){const s=sampleCircuitPath(r.points,d);assert.deepEqual([s.x,s.y],[first.x,first.y],r.id);}
  for(const d of [length,length+50,Number.MAX_SAFE_INTEGER]){const s=sampleCircuitPath(r.points,d);assert.deepEqual([s.x,s.y],[last.x,last.y],r.id);}
 }
});
test('sampling lands on every join and takes the incoming heading there',()=>{
 for(const r of HOMECOMING_CIRCUIT_ROUTES){
  let walked=0;
  for(const [a,b] of segments(r)){
   walked+=Math.hypot(b.x-a.x,b.y-a.y);
   const s=sampleCircuitPath(r.points,walked);
   near(s.x,b.x,r.id+' x');near(s.y,b.y,r.id+' y');
   near(s.angle,Math.atan2(b.y-a.y,b.x-a.x),r.id+' angle');
  }
 }
});
test('sampling just past a join turns onto the next segment',()=>{
 const points=routeOf('shed','control').points;
 const before=sampleCircuitPath(points,119),after=sampleCircuitPath(points,121);
 near(before.angle,0,'east');near(after.angle,-Math.PI/2,'north');
 near(before.x,399,'before x');near(before.y,1250,'before y');
 near(after.x,400,'after x');near(after.y,1249,'after y');
});
test('sampling uses screen-space radians in all four cardinal directions',()=>{
 const points=routeOf('west-relay','stage-left').points;
 near(sampleCircuitPath(points,60).angle,Math.PI,'west');
 near(sampleCircuitPath(points,200).angle,-Math.PI/2,'north');
 near(sampleCircuitPath(points,450).angle,0,'east');
 near(sampleCircuitPath([{x:0,y:0},{x:0,y:10}],5).angle,Math.PI/2,'south');
 const diagonal=routeOf('west-deck','shed').points,s=sampleCircuitPath(diagonal,circuitPathLength(diagonal)/2);
 near(s.x,260,'mid x');near(s.y,1350,'mid y');near(s.angle,Math.atan2(-200,40),'diagonal');
});
test('fine sampling travels the authored length with no jump across joins',()=>{
 const step=0.5;
 for(const r of HOMECOMING_CIRCUIT_ROUTES){
  const length=circuitPathLength(r.points);
  let traveled=0,previous=sampleCircuitPath(r.points,0);
  for(let d=step;d<length;d+=step){
   const s=sampleCircuitPath(r.points,d),hop=Math.hypot(s.x-previous.x,s.y-previous.y);
   assert(hop<=step+1e-9,`${r.id} jumped ${hop} at ${d}`);
   traveled+=hop;previous=s;
  }
  const end=sampleCircuitPath(r.points,length);
  traveled+=Math.hypot(end.x-previous.x,end.y-previous.y);
  // Chords cut each corner by at most one step.
  assert(traveled<=length+1e-6&&traveled>=length-step*r.points.length,`${r.id} traveled ${traveled} of ${length}`);
 }
});
