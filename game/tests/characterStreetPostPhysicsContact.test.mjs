import test from 'node:test';
import assert from 'node:assert/strict';
import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';
import {OldStreetState,OLD_STREET_PROPS} from '../src/utils/oldStreetMap.mjs';
import {RefinedActionController} from '../src/utils/sakuraRefinedMotion.mjs';

function fixture(from){
 const player={active:true,...from};
 player.body={reset(x,y){player.x=x;player.y=y;}};
 const order=[],scene={player,playerGfx:{clear(){order.push('clear');}}};
 const street=Object.assign(Object.create(OldStreetScene.prototype),{scene,state:new OldStreetState(),lastPlayer:{...from}});
 street.sync=()=>order.push('world');scene.oldStreet=street;
 const motion=new RefinedActionController({});let last={...from},now=0;
 const actor=Object.assign(Object.create(ActorPresentation.prototype),{scene,playerImage:{active:true},pendingPlayerFrame:null,disposed:false});
 actor.drawPlayerFrame=()=>{order.push('actor');assert(street.clearLine(player,player,8),'rendered player penetrates the real street footprint');motion.update(now,player.x-last.x,player.y-last.y);last={x:player.x,y:player.y};};
 return {player,street,actor,scene,order,motion,flush(){now+=16.67;actor.pendingPlayerFrame={now,moving:true,bulletColor:1};actor.flushPlayerFrame();}};
}

test('post-physics drawing never exposes a storefront penetration or a solver-induced reverse step',()=>{
 const p=OLD_STREET_PROPS.find(p=>p.id==='frontage-east-entry'),r=p.footprint,y=r.y+r.height/2;
 const f=fixture({x:r.x-20,y});
 f.player.x+=4;f.flush();assert.equal(f.motion.direction,'right');const accepted=f.player.x,distance=f.motion.distance;
 // Model Arcade Sprite writeback before the queued presentation subscriber.
 f.player.x=r.x+2;f.flush();assert.equal(f.player.x,accepted);assert.equal(f.motion.direction,'right');assert.equal(f.motion.distance,distance);
 f.flush();assert.equal(f.motion.direction,'right');assert.equal(f.motion.distance,distance);
 assert.deepEqual(f.order.slice(-3),['clear','actor','world']);
});

test('existing slide semantics remain valid for all four wall approach directions',()=>{
 const r=OLD_STREET_PROPS.find(p=>p.id==='frontage-east-entry').footprint;
 for(const [from,to]of [[{x:r.x-20,y:r.y+20},{x:r.x+2,y:r.y+20}],
  [{x:r.x+r.width+20,y:r.y+20},{x:r.x+r.width-2,y:r.y+20}],
  [{x:r.x+20,y:r.y-20},{x:r.x+20,y:r.y+2}],
  [{x:r.x+20,y:r.y+r.height+20},{x:r.x+20,y:r.y+r.height-2}]]){
  const f=fixture(from),expected=f.street.slide(from,to);Object.assign(f.player,to);f.flush();
  assert.deepEqual({x:f.player.x,y:f.player.y},expected);assert.equal(f.motion.distance,0);
 }
});

test('pause/result/disposed/inactive frames do not settle or draw; routes without a street retain queued drawing',()=>{
 for(const state of [{_battlePaused:true},{_battleEnded:true},{_publicBattleDialog:true}]){
  const f=fixture({x:500,y:1708});Object.assign(f.scene,state);f.street.settlePlayer=()=>assert.fail('inactive settlement');f.flush();assert.deepEqual(f.order,[]);
 }
 const f=fixture({x:500,y:1708});delete f.scene.oldStreet;let draws=0;f.actor.drawPlayerFrame=()=>draws++;f.flush();assert.equal(draws,1);
 for(const disabled of ['disposed','player']){const f=fixture({x:500,y:1708});if(disabled==='disposed')f.actor.disposed=true;else f.player.active=false;f.flush();assert.deepEqual(f.order,[]);}
});
