import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicStage1PerformerRun} from '../src/systems/PublicStage1PerformerRun.mjs';
import {configureUserCast} from '../src/utils/userCast.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
const BattleScene=loadBattleScene({Phaser:{Scene:class{}}});

test('all three owners consume actual equipped range, training power and charge multipliers with choices',()=>{
 configureUserCast(true);
 try{for(const id of ['sakura','kai','enjo'])for(const item of ['wide_nozzle','rhythm_sync','focus_lens']){
  const stamps=[],contacts=[],timers=[],preparation={version:1,performerId:id,trainingLevel:2,equipmentId:item};
  const s={_userCastPresentation:true,battleData:{stageId:1,performerId:id,publicPreparation:preparation},
   time:{now:1000,delayedCall(delay,callback){const timer={delay,callback,remove(){}};timers.push(timer);return timer;}},
   player:{x:500,y:1500,hp:4,maxHp:5,body:{velocity:{x:0,y:-250}}},_battlePerformerContract:{publicActionOwnerId:id},_specialCharge:100,
   oldStreet:{clearLine:()=>true},enemies:{getChildren:()=>[]},paintZone:{devices:[],currentZone:0,applyPaintAt(...args){contacts.push(args);return true;}},
   _stampGroundSplat(...args){stamps.push(args);},_paintPublicStage1TargetsAt:()=>false,_showRoundBanner(){},_updateHUD(){},
   _isPublicStage1Round:()=>true,_addPublicEncoreCharge(){}};
  const r=new PublicStage1PerformerRun(s);s.publicPerformerRun=r;
  r.growth.choose('wide_brush');r.growth.choose('overdrive');
  const power=1.1*(item==='focus_lens'?1.15:1)*1.5,bonus=40+(item==='wide_nozzle'?12:0);
  assert.equal(r.triggerAction(),true,id+'/'+item);for(const t of timers)t.callback();
  const radius={sakura:60,kai:72,enjo:190}[id],amount={sakura:24,kai:20,enjo:52}[id];
  assert(stamps.length>0);assert(Math.abs(stamps[0][3]-(radius+bonus)*Math.sqrt(power))<1e-9,'actual ground footprint ignored preparation');
  assert(Math.abs(contacts[0][2]-amount*power)<1e-9,'actual fixture paint ignored preparation');
  assert(Math.abs(contacts[0][3]-stamps[0][3])<1e-9,'visible and real footprints differ');
  BattleScene.prototype._awardPublicSakuraActionCharge.call(s,'required-anchor');
  assert(Math.abs(s._specialCharge-22*(item==='rhythm_sync'?1.15:1))<1e-9,'actual charge award ignored preparation');
  preparation.trainingLevel=3;preparation.equipmentId=null;assert(Math.abs(r.effects().actionPower-power)<1e-9,'live menu mutation changed an in-flight run');
  r.destroy();assert.equal(r.timers.size,0);
 }}finally{configureUserCast(false);}
});
