import assert from 'node:assert/strict';
import { PublicStage1PerformerRun } from '../src/systems/PublicStage1PerformerRun.mjs';
const calls=[];
function scene(id){return {battleData:{performerId:id},_battlePerformerContract:{publicActionOwnerId:id},_battleEnded:false,_battlePaused:false,time:{now:100,delayedCall:(ms,fn)=>{calls.push(['timer',ms,fn]);return {remove(){}};}},player:{x:100,y:200,hp:3,maxHp:5,body:{velocity:{x:250,y:0}}},_specialCharge:100,paintZone:{applyPaintAt(...a){calls.push(['paint',...a]);},getPaintedCount:()=>0},enemies:{getChildren:()=>[{active:true,x:120,y:210,paintEnemy:true},{active:true,x:200,y:220,paintEnemy:true},{active:true,x:300,y:200,paintEnemy:true}]},_paintPublicStage1TargetsAt(...a){calls.push(['target',...a]);},_stampGroundSplat(){},_showRoundBanner(){},_updateHUD(){},_triggerPublicSakuraLeadCue(){calls.push(['sakura']);this._specialCharge=0;return true;},_selectPublicSakuraLeadCueTarget(){return {active:true,x:160,y:170};}};}
for(const id of ['sakura','kai','venus','genya','enjo']){
 calls.length=0;const s=scene(id),run=new PublicStage1PerformerRun(s);
 const targets=s.enemies.getChildren().map(e=>({...e,publicStage1EnemyRole:'unlit-chaser'}));s.enemies.getChildren=()=>targets;
 assert.equal(run.triggerAction(),true,id);assert.equal(s._specialCharge,0);assert.equal(run.triggerAction(),false);
 if(id==='kai'){assert.equal(run.movement(0,250).vx,700);assert.equal(s.player.hp,3);s.time.now+=161;assert.equal(run.movement(0,250).vx,0);}
 if(id==='venus') assert.equal(calls.filter(c=>c[0]==='target').length,3);
 if(id==='genya'){assert.equal(calls.filter(c=>c[0]==='timer').length,2);calls.filter(c=>c[0]==='timer').forEach(c=>c[2]());assert.equal(calls.filter(c=>c[0]==='paint').length,3);}
 if(id==='enjo') assert.equal(calls.find(c=>c[0]==='paint')[4],190);
 run.destroy();assert.equal(run.triggerAction(),false);
}
const s=scene('venus'), run=new PublicStage1PerformerRun(s);
s._battlePerformerContract.publicActionOwnerId=null;assert.equal(run.triggerAction(),false);
s._battlePerformerContract.publicActionOwnerId='venus';s._battlePaused=true;assert.equal(run.triggerAction(),false);
console.log('public performer run: five distinct actions, ownership, cost, cleanup pass');
