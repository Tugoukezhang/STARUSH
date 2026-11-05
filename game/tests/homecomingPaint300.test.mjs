import test from 'node:test';import assert from 'node:assert/strict';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {getPublicChapter} from '../src/utils/publicCampaign.mjs';
import {HOMECOMING_STAGE_CONFIG,HARBOR_STAGE_CONFIG} from '../src/utils/harborStageMap.mjs';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
import {streetVisibleBounds,projectStreetSurfaceContact} from '../src/systems/WorldGroundingPresentation.mjs';
const {PaintZoneSystem}=loadBattleScene({Phaser:{Scene:class{},Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}},includeOwners:true});
function fixture(){
 const s={_userCastPresentation:true,battleData:{stageId:1,campaignChapterId:'homecoming'},oldStreet:{clearLine:()=>true},player:{x:500,y:1630,hp:5},_facilityCompletionFx:{play:()=>true}};
 const z=new PaintZoneSystem(s);s.paintZone=z;
 z.devices=[...getPublicChapter('homecoming').devices,...z.sideSet.definitions].map(d=>({...d,paint:0,complete:false,sequenceIndex:0}));
 z._redrawDevice=()=>{};z._emitProgress=()=>{};z.clearGate=()=>{};z.events=[];z.finished=0;
 z.onDeviceComplete=d=>z.events.push(d.id);z.onAllComplete=()=>z.finished++;z._refreshLockVisuals();return z;
}
test('real paint loop completes ten main plus four branch facilities without a calibration softlock',()=>{
 const z=fixture(),device=id=>z.devices.find(d=>d.id===id),paint=id=>{for(let i=0;i<2&&!device(id).complete;i++)assert(z.applyPaint(device(id),999,'blue'),id);assert(device(id).complete,id);};
 assert.equal(z.applyPaint(device('harbor-stage-right'),999,'blue'),false);
 for(const id of ['harbor-meeting','harbor-west-deck','harbor-shed','harbor-control','harbor-crossing'])paint(id);
 assert.equal(z.currentZone,0,'main route alone cannot advance before the selected side branch');
 paint('homecoming-side-0-1');paint('homecoming-side-0-0');assert.equal(z.currentZone,1);
 assert.equal(z.applyPaint(device('homecoming-side-1-0'),999,'blue'),false,'opposite southern branch stays unselected');
 paint('harbor-north-entry');paint('harbor-east-relay');assert.equal(z.canReceivePaint(device('harbor-stage-left')),false);
 paint('harbor-west-relay');paint('harbor-stage-left');paint('harbor-stage-right');assert.equal(z.complete,false);
 paint('homecoming-side-3-0');paint('homecoming-side-3-1');
 assert.equal(z.getPaintedCount(),10);assert.equal(z.sideSet.snapshot(z.devices).completed,4);assert.equal(z.complete,true);assert.equal(z.finished,1);
 assert.equal(z.events.length,14);assert(z.devices.every(d=>!d.chapterAwaitingCalibration));
 assert.equal(z.applyPaint(device('harbor-stage-right'),999,'blue'),false);assert.equal(z.finished,1);
});
test('nearest targets and suppression respect the current dependency frontier',()=>{
 const z=fixture(),locked=z.devices.find(d=>d.id==='harbor-control');
 assert.notEqual(z.getNearestCurrentZonePaintable(locked.x,locked.y),locked);
 const first=z.devices.find(d=>d.id==='harbor-meeting');z.setDeviceSuppressed(first,true);
 assert.equal(z.applyPaint(first,999,'blue'),false);assert.equal(locked.paint,0);
 z.setDeviceSuppressed(first,false);assert(z.applyPaint(first,999,'blue'));assert(z.applyPaint(first,999,'blue'));
 const next=z.devices.find(d=>d.id==='harbor-west-deck');assert.equal(z.canReceivePaint(next),true);
});
test('return scene preserves original harbor geometry and all route nodes are outside collision',()=>{
 assert.equal(HARBOR_STAGE_CONFIG.chapterId,'encore');assert.equal(HOMECOMING_STAGE_CONFIG.chapterId,'homecoming');
 assert.equal(HOMECOMING_STAGE_CONFIG.props,HARBOR_STAGE_CONFIG.props);
 const state=new OldStreetState(HOMECOMING_STAGE_CONFIG.props,HOMECOMING_STAGE_CONFIG.terrain);
 for(const d of fixture().devices)assert(state.clearLine(d,d,12),'node inside collision: '+d.id);
});
test('revisited harbor keeps measured building bounds and pigment contact coordinates',()=>{
 for(const art of ['shed','control','mixer','stage']){
  const bounds={x:20,y:30,width:400,height:500};
  assert.deepEqual(streetVisibleBounds(art,bounds,'homecoming'),streetVisibleBounds(art,bounds,'encore'));
 }
 const prop=HOMECOMING_STAGE_CONFIG.props.find(p=>p.art==='shed'),source={width:460,height:450},point={x:prop.footprint.x,y:prop.footprint.y};
 assert.deepEqual(projectStreetSurfaceContact(prop,source,point,30,'homecoming'),projectStreetSurfaceContact(prop,source,point,30,'encore'));
});
