import test from 'node:test';
import assert from 'node:assert/strict';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {getPublicChapter} from '../src/utils/publicCampaign.mjs';
import {getCompactDeviceLabel,getDevicePresentation} from '../src/systems/ChapterScenePresentation.mjs';
const {PaintZoneSystem}=loadBattleScene({Phaser:{Scene:class{},Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}},includeOwners:true});
function fixture(id,extra={}){
 const s={_userCastPresentation:true,battleData:{stageId:1,campaignChapterId:id},oldStreet:{clearLine:()=>true},player:{x:500,y:430,hp:5},...extra};
 const z=new PaintZoneSystem(s);z.devices=getPublicChapter(id).devices.map(d=>({...d,paint:0,complete:false,sequenceIndex:0}));
 z._redrawDevice=()=>{};z._emitProgress=()=>{};z._completeDevice=d=>{d.complete=true;z.completions=(z.completions||0)+1;};s.paintZone=z;
 z._refreshLockVisuals();return {s,z,get:suffix=>z.devices.find(d=>d.id.endsWith(suffix))};
}
test('neon junction dependencies reject real paint until both branches complete',()=>{
 const {z,get}=fixture('neon'),junction=get('-crossing');
 assert.equal(z.applyPaint(junction,999,'pink'),false,'locked junction accepted paint');
 assert.equal(junction.paint,0);assert.equal(junction.chapterLocked,true);
 assert(!z.getNearestPaintable(junction.x,junction.y)||z.getNearestPaintable(junction.x,junction.y)!==junction);
 z.applyPaint(get('-listening'),999,'blue');assert.equal(z.applyPaint(junction,999,'pink'),false);
 z.applyPaint(get('-cafe'),999,'blue');assert.equal(z.applyPaint(junction,999,'pink'),true);assert(junction.complete);
 assert.equal(z.devices.filter(d=>d.complete).length,3,'dependencies do not grant remote progress');
});
test('harbor lamps need legal nearby contact after full paint, once only',()=>{
 const {s,z,get}=fixture('encore'),lamp=get('-stage-left');z.currentZone=1;s.player={x:500,y:430,hp:5};
 assert(z.applyPaint(lamp,26,'pink'));assert(z.applyPaint(lamp,26,'pink'));
 assert.equal(lamp.complete,false,'remote paint must not finish a calibration lamp');
 assert.equal(lamp.chapterAwaitingCalibration,true);assert.equal(z.canReceivePaint(lamp),false);
 assert.equal(z.hitTest(lamp.x,lamp.y),null);assert.equal(z.getObjectiveReach(lamp),112);
 z.updateChapterObjectives(0);z.updateChapterObjectives(1000);assert.equal(lamp.chapterCalibrationMs,0);
 s.player={x:350,y:390,hp:5};
 for(let n=1;n<=5;n++)z.updateChapterObjectives(1000+n*100);
 assert.equal(lamp.chapterCalibrationMs,500);assert(!lamp.complete);
 s._battlePaused=true;z.updateChapterObjectives(2500);s._battlePaused=false;z.updateChapterObjectives(3500);
 assert.equal(lamp.chapterCalibrationMs,500,'pause cannot become a catch-up hold');
 s.oldStreet.clearLine=()=>false;z.updateChapterObjectives(3600);assert.equal(lamp.chapterCalibrationMs,500);
 s.oldStreet.clearLine=()=>true;for(let n=1;n<=5;n++)z.updateChapterObjectives(3600+n*100);
 assert(lamp.complete);assert.equal(z.completions,1);z.updateChapterObjectives(9000);assert.equal(z.completions,1);
});
test('calibration survives leaving the area but cannot tick while suppressed, ended or inactive',()=>{
 const {s,z,get}=fixture('encore'),lamp=get('-stage-right');z.currentZone=1;s.player={x:650,y:390,hp:5};
 z.applyPaint(lamp,26,'blue');z.applyPaint(lamp,26,'blue');z.updateChapterObjectives(0);z.updateChapterObjectives(100);
 assert.equal(lamp.chapterCalibrationMs,100);s.player.x=500;z.updateChapterObjectives(200);assert.equal(lamp.chapterCalibrationMs,100);
 s.player.x=650;lamp.publicStage1Suppressed=true;z.updateChapterObjectives(300);assert.equal(lamp.chapterCalibrationMs,100);
 lamp.publicStage1Suppressed=false;s._battleEnded=true;z.updateChapterObjectives(400);assert.equal(lamp.chapterCalibrationMs,100);
});
test('status and shared bars distinguish locked wiring from actual calibration',()=>{
 const n=fixture('neon'),junction=n.get('-crossing');
 assert.equal(getDevicePresentation(junction,0).state,'locked');assert.match(getCompactDeviceLabel(junction,0),/双侧/);
 const h=fixture('encore'),lamp=h.get('-stage-left');h.z.currentZone=1;h.z.applyPaint(lamp,26,'pink');h.z.applyPaint(lamp,26,'pink');
 assert.equal(getDevicePresentation(lamp,1).state,'calibrating');assert.equal(getDevicePresentation(lamp,1).progress,0);
 assert.match(getCompactDeviceLabel(lamp,1),/靠近校准/);
});
test('opening and hidden/legacy fixtures retain normal completion without new goals',()=>{
 for(const [id,extra]of [['opening',{}],['neon',{_userCastPresentation:false}],['encore',{battleData:{stageId:1,campaignChapterId:'encore',practiceMode:true}}]]){
  const {z}=fixture(id,extra),d=z.devices[0];assert(z.applyPaint(d,999,'pink'));if(d.colorSequence.length>1)z.applyPaint(d,999,'pink');assert(d.complete);
 }
});

test('destroy disposes the exact chapter clock and a new run owns fresh calibration',()=>{
 const {s,z,get}=fixture('encore'),lamp=get('-stage-left'),owner=z.chapterObjectives;
 z.currentZone=1;s.player={x:350,y:390,hp:5};z.applyPaint(lamp,26,'blue');z.applyPaint(lamp,26,'blue');
 z.updateChapterObjectives(0);z.updateChapterObjectives(100);assert.equal(lamp.chapterCalibrationMs,100);
 for(const d of z.devices)d.label=null;
 z.destroy();assert.equal(z.chapterObjectives,null);assert.equal(owner.disposed,true);assert.equal(z.devices.length,0);
 assert.equal(owner.advance(1000,s.player,[lamp],1,()=>true).length,0);assert.equal(lamp.chapterCalibrationMs,100);
 const next=fixture('encore');assert.notEqual(next.z.chapterObjectives,owner);
 assert.equal(next.get('-stage-left').chapterCalibrationMs,0);assert(!next.get('-stage-left').chapterAwaitingCalibration);
});

test('legacy route keeps its original visible paint target selector',()=>{
 const {z}=fixture('neon',{_userCastPresentation:false}),original={id:'visible-legacy-target'};
 z.getNearestPaintable=(x,y)=>x===5&&y===6?original:null;
 assert.equal(z.getNearestObjective(5,6),original);
});
