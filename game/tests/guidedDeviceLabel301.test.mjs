import test from 'node:test';import assert from 'node:assert/strict';
import {layoutDeviceLabels} from '../src/systems/ChapterScenePresentation.mjs';
const d={id:'harbor-meeting',sourceLabel:'码头集合灯',sceneArt:'signal',paintPolicy:'performer',required:true,x:180,y:300,zone:0,paint:0,paintMax:26};
const player={x:180,y:380},camera={scrollX:0,scrollY:0};
test('an active objective locator owns its name once instead of a second boxed device label',()=>{
 assert.equal(layoutDeviceLabels([d],0,player,camera).length,1);
 assert.equal(layoutDeviceLabels([d],0,player,camera,d.id).length,0);
 assert.equal(layoutDeviceLabels([d],0,player,camera,'other').length,1);
});
test('critical lock, suppression and calibration instructions are never hidden with the name',()=>{
 for(const flags of [{chapterLocked:true,chapterLockReason:'先接栈桥侧灯'},{publicStage1Suppressed:true},{chapterAwaitingCalibration:true,chapterCalibrationMs:200,chapterCalibrationDurationMs:1000}]){
  assert.equal(layoutDeviceLabels([{...d,...flags}],0,player,camera,d.id).length,1);
 }
});

test('the runtime shares the visible guide name in every chapter and restores the label when it closes',async()=>{
 const {loadBattleScene}=await import('./helpers/loadBattleScene.mjs');
 const {PaintZoneSystem}=loadBattleScene({Phaser:{Scene:class{}},includeOwners:true});
 for(const id of ['opening','neon','encore','raincheck','homecoming']){
  const marker={lastKey:d.id,root:{hidden:false}};
  const label={setVisible(value){this.visible=value;},setPosition(){return this;},setText(){return this;}};
  const zone=Object.assign(Object.create(PaintZoneSystem.prototype),{chapterObjectives:{id},devices:[{...d,label}],
    currentZone:0,scene:{player,cameras:{main:camera},_publicObjectiveGuidance:marker}});
  zone.updateDeviceLabels();assert.equal(label.visible,false,id);
  marker.root.hidden=true;zone.updateDeviceLabels();assert.equal(label.visible,true,id);
  marker.root.hidden=false;marker.lastKey='another';zone.updateDeviceLabels();assert.equal(label.visible,true,id);
 }
});
