import test from 'node:test';import assert from 'node:assert/strict';import {loadBattleScene} from './helpers/loadBattleScene.mjs';import {resolvePublicObjectiveGuidanceTarget} from '../src/systems/PublicObjectiveGuidance.mjs';
const {PaintZoneSystem}=loadBattleScene({Phaser:{Scene:class{}},includeOwners:true});
function fixture(){
 const near={id:'near',required:true,zone:0,x:100,y:100,sourceLabel:'灯柱',publicStage1Suppressed:true},far={id:'far',required:true,zone:0,x:200,y:200,sourceLabel:'灯箱'};
 const zone=Object.assign(Object.create(PaintZoneSystem.prototype),{chapterObjectives:{},devices:[near,far],currentZone:0,finaleMode:false,complete:false});
 const scene={player:{x:95,y:95},paintZone:zone,publicStage1Finale:{snapshot:()=>({active:false})},_publicStage1ObjectiveDisruptor:{active:true,x:120,y:180,publicStage1ObjectiveDevice:near}};
 return {scene,zone,near,far};
}
test('actual nearest-objective query excludes suppressed facilities and retains another real legal objective',()=>{
 const {scene,zone,far}=fixture();assert.equal(zone.getNearestObjective(95,95),far);assert.equal(resolvePublicObjectiveGuidanceTarget(scene).key,'far');
});
test('all suppressed objectives guide the actual blocker, then restore a facility when suppression clears',()=>{
 const {scene,zone,far}=fixture();far.publicStage1Suppressed=true;assert.equal(zone.getNearestObjective(95,95),null);const target=resolvePublicObjectiveGuidanceTarget(scene);assert.equal(target.state,'blocker');assert.equal(target.label,'清除干扰');assert.equal(target.x,120);far.publicStage1Suppressed=false;assert.equal(resolvePublicObjectiveGuidanceTarget(scene).key,'far');
});
