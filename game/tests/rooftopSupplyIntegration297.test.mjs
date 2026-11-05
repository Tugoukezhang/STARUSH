import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {getPublicChapter} from '../src/utils/publicCampaign.mjs';
const {PaintZoneSystem}=loadBattleScene({Phaser:{Scene:class{},Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}},includeOwners:true});
function fixture(id='raincheck'){
 const s={_userCastPresentation:true,battleData:{stageId:1,campaignChapterId:id},oldStreet:{clearLine:()=>true},player:{x:500,y:1278,hp:5},_facilityCompletionFx:{play:()=>true}};
 const z=new PaintZoneSystem(s);s.paintZone=z;
 z.devices=[...getPublicChapter(id).devices,...z.sideSet.definitions].map(d=>({...d,paint:0,complete:false,sequenceIndex:0}));
 z._redrawDevice=()=>{};z._emitProgress=()=>{};z.events=[];z.onDeviceComplete=d=>z.events.push(d.id);
 z._refreshLockVisuals();return {s,z,center:z.devices.find(d=>d.id==='rooftop-south-center')};
}
function prepare(z,center){
 for(const suffix of ['south-west','south-east'])assert(z.applyPaint(z.devices.find(d=>d.id==='rooftop-'+suffix),999,'blue'));
 assert(z.applyPaint(center,999,'blue'));assert(center.chapterAwaitingCalibration);
}
test('real PaintZone side completion enables reserve, preserves hold, and completes exactly once',()=>{
 const {s,z,center}=fixture();prepare(z,center);
 const stations=z.devices.filter(d=>d.chapterSideSet&&d.zone===0&&d.sideBranch==='west');
 assert(z.applyPaint(stations[0],999,'blue'));assert.equal(center.chapterCalibrationBuffered,false);
 assert(z.applyPaint(stations[1],999,'blue'));assert.equal(center.chapterCalibrationBuffered,true);
 assert.equal(z.devices.find(d=>d.id==='rooftop-north-center').chapterCalibrationBuffered,false);
 z.updateChapterObjectives(0);for(let t=100;t<=600;t+=100)z.updateChapterObjectives(t);
 assert.equal(center.chapterCalibrationMs,600);s.player.x=800;z.updateChapterObjectives(700);assert.equal(center.chapterCalibrationMs,600);
 s.player.x=500;for(let t=800;t<=1600;t+=100)z.updateChapterObjectives(t);
 assert(center.complete);assert.equal(z.events.filter(id=>id===center.id).length,1);
 z.updateChapterObjectives(1700);assert.equal(z.events.length,5);assert.equal(z.getPaintedCount(),3);
});
test('suppression clears raincheck progress at the event, including set/release between updates',()=>{
 const {z,center}=fixture();prepare(z,center);center.chapterCalibrationMs=700;
 assert(z.setDeviceSuppressed(center,true));assert.equal(center.chapterCalibrationMs,0);
 assert(z.setDeviceSuppressed(center,false));assert.equal(center.chapterCalibrationMs,0);
});
test('suppression selection may include the current raincheck calibration but paint never does',()=>{
 const {z,center}=fixture();prepare(z,center);
 assert.notEqual(z.getNearestCurrentZonePaintable(center.x,center.y),center);
 assert.equal(z.getNearestCurrentZonePaintable(center.x,center.y,true),center);
 assert.equal(z.canReceivePaint(center),false);assert.equal(z.applyPaint(center,999,'blue'),false);
 z.setDeviceSuppressed(center,true);assert.notEqual(z.getNearestCurrentZonePaintable(center.x,center.y,true),center);
});
test('other chapters preserve calibration on suppression, and cannot use the raincheck selector exception',()=>{
 const {z}=fixture('encore');z.currentZone=1;const d=z.devices.find(d=>d.id.endsWith('stage-left'));
 z.applyPaint(d,999,'blue');z.applyPaint(d,999,'blue');assert(d.chapterAwaitingCalibration);d.chapterCalibrationMs=500;z.setDeviceSuppressed(d,true);assert.equal(d.chapterCalibrationMs,500);
 z.setDeviceSuppressed(d,false);assert.notEqual(z.getNearestCurrentZonePaintable(d.x,d.y,true),d);
});
test('real enemy target-selection and scheduling paths explicitly enable raincheck calibration targets',()=>{
 const source=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 assert.equal((source.match(/getNearestCurrentZonePaintable\?\.\(this\.player\.x, this\.player\.y, this\.battleData\?\.campaignChapterId==='raincheck'\)/g)||[]).length,3);
});
