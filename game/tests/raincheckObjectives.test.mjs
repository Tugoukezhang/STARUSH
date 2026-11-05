import test from 'node:test';import assert from 'node:assert/strict';
import {ChapterObjectiveContract,getChapterObjectiveSummary} from '../src/utils/chapterObjectives.mjs';
const node=()=>({id:'rooftop-south-center',zone:0,paint:52,paintMax:52,x:500,y:1100,complete:false,chapterAwaitingCalibration:true});
const player={x:500,y:1100,hp:5,active:true};
const connected=d=>[d,{id:'rooftop-south-west',complete:true},{id:'rooftop-south-east',complete:true}];
test('raincheck uses an explicit continuous 1500ms calibration contract',()=>{
 const c=new ChapterObjectiveContract('raincheck'),d=node();c.sync(connected(d));
 assert.equal(c.requiresCalibration(d),true);assert.equal(d.chapterCalibrationDurationMs,1500);
 assert.match(getChapterObjectiveSummary('raincheck'),/连续/);
 c.advance(0,player,[d],0,()=>true);let done=[];
 for(let t=100;t<=1400;t+=100)done=c.advance(t,player,[d],0,()=>true);
 assert.deepEqual(done,[]);assert.equal(d.chapterCalibrationMs,1400);
 assert.deepEqual(c.advance(1500,player,[d],0,()=>true),[d]);
});
test('leaving, suppression and occlusion reset rooftop hold, but suspension grants no elapsed credit',()=>{
 for(const condition of ['leave','suppressed','blocked']){
  const c=new ChapterObjectiveContract('raincheck'),d=node();c.sync(connected(d));c.advance(0,player,[d],0,()=>true);c.advance(100,player,[d],0,()=>true);
  if(condition==='suppressed')d.publicStage1Suppressed=true;
  c.advance(200,condition==='leave'?{...player,x:800}:player,[d],0,()=>condition!=='blocked');assert.equal(d.chapterCalibrationMs,0);
 }
 const c=new ChapterObjectiveContract('raincheck'),d=node();c.sync(connected(d));c.advance(0,player,[d],0,()=>true);c.advance(100,player,[d],0,()=>true);c.suspend();c.advance(9000,player,[d],0,()=>true);assert.equal(d.chapterCalibrationMs,100);
});
test('rooftop calibration centres wait for both branch lamps, old harbor keeps accumulated time',()=>{
 const c=new ChapterObjectiveContract('raincheck'),d=node(),a={id:'rooftop-south-west',complete:true},b={id:'rooftop-south-east',complete:false};
 assert.equal(c.isLocked(d,[d,a,b]),true);c.sync([d,a,b]);assert.equal(d.chapterLocked,true);assert.deepEqual(c.advance(100,player,[d,a,b],0,()=>true),[]);assert.equal(d.chapterCalibrationMs,0);b.complete=true;assert.equal(c.isLocked(d,[d,a,b]),false);
 const h=new ChapterObjectiveContract('encore'),e={...node(),id:'harbor-stage-left'};h.sync([e]);h.advance(0,player,[e],0,()=>true);h.advance(100,player,[e],0,()=>true);h.advance(200,{...player,x:900},[e],0,()=>true);assert.equal(e.chapterCalibrationMs,100);assert.equal(e.chapterCalibrationDurationMs,1000);
});
