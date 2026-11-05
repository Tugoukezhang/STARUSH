import test from 'node:test';import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
test('real fixture rejection does not consume contacts or stamp ground; real finish captures completion',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.seed(['opening','neon','encore','raincheck']);e.profile.equipPublicPerformer('sakura','rain_relay');
 const {PublicStage1PerformerRun:Run}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
 const {PaintZoneSystem:Zone}=e.loadRuntime('systems/PaintZoneSystem.js');
 const {ChapterObjectiveContract}=e.loadRuntime('utils/chapterObjectives.mjs');
 const {BattleScene:Scene}=e.loadRuntime('scenes/BattleScene.js');const floor=[];
 const scene=Object.assign(Object.create(Scene.prototype),{_userCastPresentation:true,_battlePaused:false,_battleEnded:false,_encoreCharge:0,_specialCharge:0,
  battleData:{stageId:1,performerId:'sakura',campaignChapterId:'raincheck',publicPreparation:e.loadRuntime('utils/publicPreparation.mjs').getPreparationSnapshot(e.profile.loadPublicProfile(),'sakura')},
  time:{now:1000},player:{x:0,y:0,hp:5,active:true},oldStreet:{clearLine:()=>true},_isPublicStage1Round:()=>true,
  _stampGroundSplat:(...args)=>floor.push(args),_showPublicBattleNotice(){}});
 const run=new Run(scene);scene.publicPerformerRun=run;scene._publicSakuraEncoreEndsAt=6000;
 const devices=[['wrong1',10,['purple'],100],['wrong2',20,['purple'],100],['valid1',30,[],100],['valid2',40,[],20],['valid3',50,[],100],['rooftop-north-center',5,[],100]].map(([id,x,colorSequence,paintMax])=>({id,x,y:0,colorSequence,paintMax,paint:0,sequenceIndex:0,zone:0,complete:false,chapterAwaitingCalibration:id==='rooftop-north-center'}));
 const zone=Object.assign(Object.create(Zone.prototype),{scene,devices,currentZone:0,finaleMode:false,chapterObjectives:new ChapterObjectiveContract('raincheck'),_redrawDevice(){},_emitProgress(){},_completeDevice(d){d.complete=true;scene._addPublicEncoreCharge(10);scene.result=run.finish(true);scene._battleEnded=true;}});scene.paintZone=zone;
 assert.equal(run.releaseRainRelay({x:0,y:0}),2);
 assert.deepEqual(devices.map(d=>d.paint),[0,0,20,20,0,0]);assert.equal(scene._encoreCharge,0);
 assert.equal(floor.length,1,'rejected contacts leave no floor paint; synchronous settlement stops presentation');
 assert.equal(scene.result.modificationReview.id,'rain_relay');assert.equal(scene.result.modificationReview.releases,2);assert.equal(scene.result.persisted,true);
 assert.equal(scene.result.actions,0);
});
