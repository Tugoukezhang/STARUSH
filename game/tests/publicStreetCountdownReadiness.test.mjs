import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';
import {isOldStreetChapter} from '../src/utils/oldStreetMap.mjs';
import {isNeonStreetChapter,NEON_STREET_CONFIG} from '../src/utils/neonStreetMap.mjs';
import {isHarborStageChapter,HARBOR_STAGE_CONFIG} from '../src/utils/harborStageMap.mjs';
const source=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
function method(start,end,...deps){
 const a=source.indexOf(start),b=end?source.indexOf(end,a+start.length):source.lastIndexOf('\n}');
 assert(a>=0&&b>a,'Missing actual BattleScene method '+start);
 const params=deps.map(([name])=>name),values=deps.map(([,value])=>value);
 return Function(...params,'return ({'+source.slice(a,b)+'});')(...values);
}
const countdown=method('  _beginPublicRoundCountdown() {','  _pinHud(')._beginPublicRoundCountdown;
const update=method('  update(time, delta) {','  _onPlayerDeath() {',['COLOR_HEX',{pink:0xff4488}]).update;

test('street and collision preparation precedes first countdown banner without starting gameplay',()=>{
 const events=[],timers=[];
 const s={_battleEnded:false,_preparePublicStreetWorld(){events.push('street');},_showRoundBanner(v){events.push(v);},time:{delayedCall(ms,fn){timers.push({ms,fn});}},_beginPublicPaintRound(){events.push('start');}};
 countdown.call(s);assert.deepEqual(events,['street','3']);
 for(let i=0;i<3;i++){const t=timers.shift();assert.equal(t.ms,900);t.fn();}
 assert.deepEqual(events,['street','3','2','1','开演']);
 assert.equal(timers[0].ms,450);timers.shift().fn();assert.equal(events.at(-1),'start');
});

test('preparing three public streets is idempotent and leaves round, objectives and timers idle',()=>{
 const constructions=[],cameras=[];
 const helpers=method('  _preparePublicStreetWorld() {','  _beginPublicPaintRound() {',
  ['isOldStreetChapter',isOldStreetChapter],['isNeonStreetChapter',isNeonStreetChapter],['isHarborStageChapter',isHarborStageChapter],
  ['NEON_STREET_CONFIG',NEON_STREET_CONFIG],['HARBOR_STAGE_CONFIG',HARBOR_STAGE_CONFIG],
  ['OldStreetScene',class{constructor(scene,config){this.config=config;constructions.push(scene);}}],
  ['OpeningStreetCamera',class{constructor(scene){cameras.push(scene);}}],['supportsStreetOverview',()=>true]);
 for(const chapter of ['opening','neon','encore']){
  const s={battleData:{stageId:1,campaignChapterId:chapter},_isPublicStage1Round:()=>true,physics:{add:{staticGroup(){}}}};
  helpers._preparePublicStreetWorld.call(s);const street=s.oldStreet,camera=s.openingStreetCamera;
  assert(street&&camera);helpers._preparePublicStreetWorld.call(s);assert.equal(s.oldStreet,street);assert.equal(s.openingStreetCamera,camera);
  assert.equal(s.paintZone,undefined);assert.equal(s._paintRoundEndsAt,undefined);
 }
 assert.equal(constructions.length,3);assert.equal(cameras.length,3);
 for(const s of [
  {battleData:{stageId:1,practiceMode:true},physics:{add:{staticGroup(){}}}},
  {battleData:{stageId:1},physics:{add:{staticGroup(){}}},_battleEnded:true}]){
  helpers._preparePublicStreetWorld.call(s);assert.equal(s.oldStreet,undefined);
 }
});

test('public pre-round update neutralizes movement before processing combat; hidden and active routes continue',()=>{
 const body={vx:250,vy:0,setVelocity(x,y){this.vx=x;this.vy=y;},stop(){this.vx=0;this.vy=0;}};let clearCount=0;const idleDraws=[];
 const sentinel=Error('movement path');
 const s={player:{active:true,body},_isPublicStage1Round:()=>true,_isPublicSakuraEncoreWindowActive:()=>false,
  _clearTouchMovementState(){clearCount++;this._touchMoveActive=false;},_updatePublicStage1AttackCues(){throw sentinel;},isMoving:true,_touchMoveActive:true,
  currentColor:'pink',actorPresentation:{drawPlayer(...args){idleDraws.push(args);}}};
 update.call(s,0,16);assert.equal(body.vx,0);assert.equal(body.vy,0);assert.equal(s.isMoving,false);assert.equal(s._touchMoveActive,false);assert.equal(clearCount,1);
 assert.deepEqual(idleDraws,[[0,false,0xff4488]],'Pre-round must queue its real idle render, not blank the actor');
 s.paintZone={};assert.throws(()=>update.call(s,0,16),e=>e===sentinel);
 s.paintZone=null;s._isPublicStage1Round=()=>false;assert.throws(()=>update.call(s,0,16),e=>e===sentinel);
});

test('prepared street rejects pre-round interaction then preserves active and legacy interaction paths',()=>{
 let opened=0,interactions=0;
 const scene={player:{x:0,y:0},_isPublicStage1Round:()=>true};
 const street=Object.assign(Object.create(OldStreetScene.prototype),{scene,items:new Map([['gate',{}]]),state:{interact(){interactions++;return true;}},showOpened(){opened++;}});
 assert.equal(street.interact('gate'),false);assert.equal(interactions,0);
 scene.paintZone={};assert.equal(street.interact('gate'),true);assert.equal(opened,1);
 scene.paintZone=null;scene._isPublicStage1Round=()=>false;assert.equal(street.interact('gate'),true);
 scene._battlePaused=true;assert.equal(street.interact('gate'),false);
});
