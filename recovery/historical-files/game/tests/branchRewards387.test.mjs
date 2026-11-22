import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {ChapterSideSet,getChapterSideBranchReward} from '../src/utils/chapterSideSets.mjs';
import {PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS} from '../src/systems/PublicStage1SakuraActionContract.mjs';
const {BattleScene:B,PaintZoneSystem:P}=loadBattleScene({Phaser:{Scene:class{}},includeOwners:true});
const src=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
const callback=src.slice(src.indexOf('    this.paintZone.onDeviceComplete = (device) => {'),src.indexOf('    this.paintZone.onZoneComplete ='));
function setup(chapter='opening',branch='west',member='sakura'){
 const sideSet=new ChapterSideSet(chapter,branch),devices=sideSet.definitions.map(d=>({...d,paint:0,complete:false})),notices=[];
 const s=Object.assign(Object.create(B.prototype),{_userCastPresentation:true,battleData:{stageId:1,performerId:member,campaignChapterId:chapter},player:{hp:5},_specialCharge:0,_encoreCharge:0,
 _isPublicStage1Round:()=>true,_isPublicSakuraEncoreWindowActive:()=>false,_updateHUD(){},_showPublicBattleNotice:text=>notices.push(text),_facilityCompletionFx:{play:()=>true},oldStreet:{restore(){}},
 publicPerformerRun:{context:{modeId:'campaign'},effects:()=>({chargeMultiplier:1}),onChargeAward(){}},support:{addValue(){}}});
 const z=Object.assign(Object.create(P.prototype),{scene:s,devices,sideSet,currentZone:0,_refreshLockVisuals(){},_redrawDevice(){},_maybeAdvanceZone(){},_emitProgress(){}});s.paintZone=z;
 new Function('PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS',callback).call(s,PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS);
 return {s,z,devices,sideSet,notices,rows:devices.filter(d=>d.zone===0&&d.sideBranch===branch)};
}
for(const member of ['sakura','kai','enjo'])for(const branch of ['west','east'])test(member+' '+branch+' real completion callback grants one branch reward, not one per station or repeat',()=>{
 const f=setup('opening',branch,member),reward=getChapterSideBranchReward('opening',branch);
 f.z._completeDevice(f.rows[0]);assert.equal(f.s._specialCharge,0);f.z._completeDevice(f.rows[1]);assert.equal(f.s._specialCharge,reward.special);assert.equal(f.s._encoreCharge,reward.encore);
 const notices=f.notices.filter(t=>t.startsWith('串场接力'));assert.equal(notices.length,1);
 f.z._completeDevice(f.rows[0]);f.z._completeDevice(f.rows[1]);assert.equal(f.s._specialCharge,reward.special);
});
test('real cap/multiplier reports actual gain; no overflow bank and no life reward',()=>{
 const f=setup('opening','east');f.s._specialCharge=95;f.s._encoreCharge=98;f.s.publicPerformerRun.effects=()=>({chargeMultiplier:1.5});
 f.rows.forEach(d=>f.z._completeDevice(d));assert.equal(f.s._specialCharge,100);assert.equal(f.s._encoreCharge,100);assert.equal(f.s.player.hp,5);
 assert(f.notices.includes('串场接力 · 行动 +5 · 安可 +2'));f.s._specialCharge=0;f.rows.forEach(d=>f.z._completeDevice(d));assert.equal(f.s._specialCharge,0);
});
test('restored complete devices never reissue rewards and opposite/malformed/incomplete branches cannot reward',()=>{
 const f=setup();f.rows.forEach(d=>d.complete=true);f.s._specialCharge=31;f.rows.forEach(d=>f.z._completeDevice(d));assert.equal(f.s._specialCharge,31);
 assert.equal(f.sideSet.completionReward({...f.rows[1]},f.devices),null);
 const opposite=f.devices.find(d=>d.sideBranch==='east');opposite.complete=true;assert.equal(f.sideSet.completionReward(opposite,f.devices),null);
 f.rows[0].complete=false;assert.equal(f.sideSet.completionReward(f.rows[1],f.devices),null);
});
test('harbor needs real calibration completion, roof supply and other chapter charge stay distinct',()=>{
 for(const chapter of ['neon','encore','raincheck','homecoming']){
 const f=setup(chapter,'east');f.rows[0].paint=52;f.rows[0].chapterAwaitingCalibration=true;
 assert.equal(f.sideSet.completionReward(f.rows[0],f.devices),null);f.rows.forEach(d=>f.z._completeDevice(d));assert.equal(f.s._specialCharge,22);assert.equal(f.s._encoreCharge,8);
 }
});
test('restore rebuild, paused/dead/ended and non-campaign owners cannot award a branch',()=>{
 for(const patch of [{_restoringPublicBattleCheckpoint:true},{_battlePaused:true},{_battleEnded:true},{_userCastPresentation:false},{player:{hp:0}},{publicPerformerRun:{context:{modeId:'practice'}}}]){
 const f=setup();Object.assign(f.s,patch);f.rows.forEach(d=>f.z._completeDevice(d));assert.equal(f.s._specialCharge,0);assert.equal(f.s._encoreCharge,0);
 }
});
