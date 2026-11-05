import test from 'node:test';
import assert from 'node:assert/strict';
import {SakuraCombat} from '../src/systems/SakuraCombat.mjs';
import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';

function fixture(){
  const gfx={depth:0,commands:[],setDepth(v){this.depth=v;return this;},clear(){this.commands=[];return this;},lineStyle(...v){this.commands.push(['style',...v]);return this;},lineBetween(...v){this.commands.push(['line',...v]);return this;},destroy(){this.destroyed=true;}};
  const scene={player:{x:187.5,y:587,hp:5,active:true},currentColor:'pink',_battlePaused:false,_battlePerformerContract:{publicActionOwnerId:'sakura'},oldStreet:{clearLine:()=>true},add:{graphics:()=>gfx}};
  const run={member:{id:'sakura'},alive:()=>true,now:()=>100,effects:()=>({paintRadiusBonus:0,actionPower:1})};
  const combat=new SakuraCombat(scene,run);scene.publicPerformerRun={sakuraCombat:combat};
  const view={worldDepth:9.2,state:{native:true},setWorldDepth(d){this.worldDepth=d;},handWorld:()=>({x:187.5,y:560})};
  const actor=Object.assign(Object.create(ActorPresentation.prototype),{scene,sakuraView:view,disposed:false});scene.actorPresentation=actor;
  assert(combat.beginBasic({active:true,x:187.5,y:490},0,333));
  const pose=combat.snapshot(100);Object.assign(view.state,{attackId:pose.id,attackPhase:pose.phase});
  return {scene,combat,view,actor,gfx};
}

test('Sakura fan cue shares actor world order before allocation and after street sorting',()=>{
  const {combat,view,actor,gfx}=fixture(),attack=structuredClone(combat.attack);
  actor.setWorldDepth(9.55);combat.draw(100);
  assert(gfx.commands.length>0);
  assert(gfx.depth>view.worldDepth&&gfx.depth<view.worldDepth+.001,'Fan cue must be just above its actor, not the old fixed 8.8 plane');
  const commands=structuredClone(gfx.commands);
  actor.setWorldDepth(9.35);
  assert(gfx.depth>view.worldDepth&&gfx.depth<view.worldDepth+.001);
  assert.deepEqual(combat.attack,attack,'World sorting cannot move captured legal attack geometry or its timing');
  assert.deepEqual(gfx.commands,commands,'Sorting must not redraw or repaint combat');
  combat.destroy();combat.destroy();assert(gfx.destroyed);
});

test('non-Sakura actors do not lose their presenter branch when propagating combat depth',()=>{
  for(const key of ['venusView','genyaView','kaiView','enjoView']){
    let received;
    const actor=Object.assign(Object.create(ActorPresentation.prototype),{scene:{publicPerformerRun:{}},disposed:false,[key]:{setWorldDepth:d=>received=d}});
    actor.setWorldDepth(9.45);assert.equal(received,9.45);
  }
});

test('legacy fan fallback retains its fixed plane; a visible native cue freezes during pause',()=>{
  const {scene,combat,actor,gfx}=fixture();scene.actorPresentation=null;combat.draw(100);assert.equal(gfx.depth,8.8);
  scene.actorPresentation=actor;actor.setWorldDepth(9.6);combat.draw(100);
  const commands=structuredClone(gfx.commands);scene._battlePaused=true;combat.draw(180);assert.deepEqual(gfx.commands,commands);
  combat.clear();assert.equal(combat.attack,null);assert.equal(gfx.commands.length,0);
});
