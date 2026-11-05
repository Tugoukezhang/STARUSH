import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './motionStageFixture.mjs';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';

test('Sakura complete body stays together on both sides of scenery after further updates',()=>{
  const f=fixture(),view=f.actor.sakuraView;
  const street={scene:f.s,items:new Map(),storyOffered:true,nearestInteraction:()=>null};
  const nodes=[...view.legs,view.upper,view.upperBlend,...view.secondaryNodes];
  f.draw(0);
  for(const [i,y]of [350,550].entries()){
    f.s.player.y=y;f.draw(20+i*100);
    OldStreetScene.prototype.sync.call(street);
    const depth=9.2+(y+26)/10000;
    const depths=nodes.map(n=>n.depth);
    for(const n of nodes){assert.ok(Math.abs(n.depth-depth)<.00002,`split depth ${n.depth} vs ${depth}`);assert.equal(n.depth<9.2482,y===350);}
    assert.ok(view.legs.every(n=>n.depth<view.upper.depth));
    assert.ok(view.secondaryNodes.every(n=>n.depth>view.upper.depth));
    f.draw(40+i*100,2,0);
    assert.deepEqual(nodes.map(n=>n.depth),depths,'update must not reset to fixed depths');
    f.s._battlePaused=true;f.draw(45+i*100);assert.deepEqual(nodes.map(n=>n.depth),depths);f.s._battlePaused=false;
  }
  f.actor.destroy();f.actor.setWorldDepth(9.3);assert.ok(nodes.every(n=>!n.active));
});

test('non-Sakura sorting and missing Sakura art retain safe fallbacks',()=>{
  const f=fixture('kai');f.draw(0);f.actor.setWorldDepth(9.25);
  assert.ok(f.actor.footRig.nodes.every(n=>Math.abs(n.depth-9.25)<.00002));
  const missing=fixture('sakura',['hair-20260922']);assert.equal(missing.actor.sakuraView,undefined);
  assert.equal(missing.actor.drawPlayer(0,false,0xffffff),false);missing.actor.setWorldDepth(9.25);
});
