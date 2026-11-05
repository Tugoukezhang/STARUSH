import test from 'node:test';import assert from 'node:assert/strict';
import {PublicStage1PerformerRun as Run} from '../src/systems/PublicStage1PerformerRun.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {getPublicResultSurfaceModel} from '../src/systems/BattleSurfaceView.mjs';
const {BattleScene:Battle,PaintZoneSystem:PaintZone}=loadBattleScene({Phaser:{Scene:class{}},includeOwners:true});
function setup(id='sakura'){
 const hits=[],fx=[],ground=[];
 const scene=Object.assign(Object.create(Battle.prototype),{_userCastPresentation:true,_battlePaused:false,_battleEnded:false,
  _encoreCharge:100,_specialCharge:30,player:{active:true,hp:5,x:0,y:0},time:{now:1000},battleData:{stageId:1,performerId:id},
  _battlePerformerContract:{publicActionOwnerId:id},publicStage1Round:{getPerformerId:()=>id},
  _isPublicStage1Round:()=>true,_isPublicSakuraEncoreWindowActive:()=>false,_clearPublicEncoreProjectiles:()=>0,
  _spawnPaintEncoreBurst(){},_showRoundBanner(){},_showPublicBattleNotice(){},_updateHUD(){},
  oldStreet:{clearLine:(_a,b)=>!b.blocked},_stampGroundSplat:(...args)=>ground.push(args),
  actorPresentation:{userCastView:{weaponFx:{choice:(...args)=>fx.push(args)}}},
  paintZone:{currentZone:0,finaleMode:false,devices:[],canReceivePaint:d=>!d.chapterLocked&&!d.chapterAwaitingCalibration,
   burstRelight(){},applyPaint(d,n){if(d.reject)return false;hits.push({id:d.id,n});d.paint=(d.paint||0)+n;return true;}}});
 const run=Object.assign(Object.create(Run.prototype),{scene,member:{id,color:'blue'},destroyed:false,pausedAt:null,pausedMs:0,modificationReleases:0,
  buildContext:{modification:{id:'rain_relay',name:'雨后继电器'}},effects:()=>({paintRadiusBonus:0,actionPower:1}),getAbilityState:()=>({encore:{canRelease:true}})});
 scene.publicPerformerRun=run;
 const device=(id,x,extra={})=>{const d={id,x,y:0,zone:0,complete:false,...extra};scene.paintZone.devices.push(d);return d;};
 return{scene,run,device,hits,fx,ground};
}
test('all three performers get at most two nearest exact fixture contacts on actual Encore release',()=>{
 for(const id of ['sakura','kai','enjo']){const f=setup(id);f.device('far',379);f.device('near',80);f.device('mid',200);
  assert.equal(f.scene._triggerPublicRelightBurst(),true);assert.deepEqual(f.hits,[{id:'near',n:20},{id:'mid',n:20}]);
  assert.equal(f.run.modificationReleases,2);assert.equal(f.fx.length,2);assert.equal(f.ground.length,2);
  assert.equal(f.scene._encoreCharge,0);assert.equal(f.scene._specialCharge,30);assert.equal(f.scene._triggerPublicRelightBurst(),false);
  assert.equal(f.hits.length,2);
 }
});
test('no enemies required; range boundary accepted, far/walled/locked/calibration/suppressed/completed/future-zone targets excluded',()=>{
 const f=setup();f.device('blocked',40,{blocked:true});f.device('locked',50,{chapterLocked:true});f.device('calibration',60,{chapterAwaitingCalibration:true});
 f.device('suppressed',70,{publicStage1Suppressed:true});f.device('done',80,{complete:true});f.device('future',90,{zone:1});f.device('outside',380.01);f.device('edge',380);
 f.scene._triggerPublicRelightBurst();assert.deepEqual(f.hits,[{id:'edge',n:20}]);assert.equal(f.fx.length,1);
});
test('no equipment and failed release never trigger the new behavior',()=>{
 for(const mutate of [f=>f.run.buildContext.modification=null,f=>f.run.buildContext.modification.id='return_edge',f=>f.scene._encoreCharge=99,f=>f.scene._battlePaused=true,f=>f.scene._battleEnded=true]){
  const f=setup();f.device('near',90);mutate(f);f.scene._triggerPublicRelightBurst();assert.deepEqual(f.hits,[]);assert.equal(f.run.modificationReleases,0);
 }
});
test('ordinary Encore resolves first; already completed fixtures are not repainted by the relay',()=>{
 const f=setup();const a=f.device('ordinary',60);f.device('remaining',120);
 f.scene.paintZone.burstRelight=()=>{a.complete=true;};f.scene._triggerPublicRelightBurst();assert.deepEqual(f.hits,[{id:'remaining',n:20}]);
});
test('rejected paint produces no fake beam/count, and synchronous settlement stops the second target',()=>{
 const f=setup();f.device('reject',60,{reject:true});f.device('accept',120);f.scene._triggerPublicRelightBurst();assert.equal(f.run.modificationReleases,1);assert.equal(f.fx.length,1);
 assert.equal(f.ground.length,1,'only the accepted fixture gets a ground mark');
 const g=setup();g.device('finisher',60);g.device('later',120);let captured;
 g.scene.paintZone.applyPaint=(d,n)=>{captured=g.run.modificationReleases;g.scene._battleEnded=true;g.hits.push({id:d.id,n});return true;};
 g.scene._triggerPublicRelightBurst();assert.equal(captured,1);assert.deepEqual(g.hits,[{id:'finisher',n:20}]);assert.equal(g.fx.length,0);
});
test('Encore-only relay contributions remain visible with zero special actions',()=>{
 const run={performerId:'sakura',chapterId:'raincheck',choices:[],actions:0,durationMs:1000,
  build:{preparation:{version:1,performerId:'sakura',trainingLevel:1,equipmentId:'rain_relay'}},
  modificationReview:{id:'rain_relay',releases:2}};
 assert.deepEqual(getPublicResultSurfaceModel({buttons:[]},run).modificationReview,{name:'雨后继电器',releases:2});
 assert.equal(getPublicResultSurfaceModel({buttons:[]},{...run,modificationReview:{id:'rain_relay',releases:99}}).modificationReview,null);
});
test('finale disables relay and result contact bounds follow the Encore window',()=>{
 const f=setup();f.device('near',60);f.scene.paintZone.finaleMode=true;assert.equal(f.run.releaseRainRelay({x:0,y:0}),0);assert.equal(f.hits.length,0);
 const base={performerId:'sakura',chapterId:'raincheck',choices:[],actions:0,build:{preparation:{version:1,performerId:'sakura',trainingLevel:1,equipmentId:'rain_relay'}}};
 for(const [durationMs,releases,accepted]of [[4999,2,true],[4999,3,false],[5000,4,true],[5000,5,false]])assert.equal(!!getPublicResultSurfaceModel({buttons:[]},{...base,durationMs,modificationReview:{id:'rain_relay',releases}}).modificationReview,accepted);
});
