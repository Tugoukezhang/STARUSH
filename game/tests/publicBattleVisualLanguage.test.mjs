import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { loadBattleScene } from './helpers/loadBattleScene.mjs';

const Phaser={Scene:class{},Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}};
const Scene=loadBattleScene({Phaser});
function fixture(publicMode=true){
  const nodes=[],tweens=[],events=new EventEmitter();
  function node(type,args){const n=new EventEmitter();Object.assign(n,{type,args,active:true,commands:[],x:0,y:0});
    for(const key of ['setDepth','setAlpha','setName'])n[key]=v=>{n[key.slice(3).toLowerCase()]=v;return n;};
    n.setPosition=(x,y)=>{Object.assign(n,{x,y});return n;};
    for(const key of ['lineStyle','lineBetween','fillStyle','fillTriangle','fillRect','setStrokeStyle'])n[key]=(...a)=>{n.commands.push([key,...a]);return n;};
    n.destroy=()=>{if(!n.active)return;n.active=false;n.emit('destroy');};nodes.push(n);return n;
  }
  const s=Object.assign(Object.create(Scene.prototype),{player:{x:800,y:1500,active:true},_isPublicStage1Round:()=>publicMode,
    actorPresentation:{visualMetrics:{groundOffset:26}},events,presentationPolishFx:[],
    add:{graphics:()=>node('Graphics',[]),circle:(...a)=>node('Circle',a),rectangle:(...a)=>node('Rectangle',a)},
    tweens:{add:o=>{tweens.push(o);return o;}}});
  return {s,nodes,tweens,events};
}

test('public C-position uses one open foot accent in actual large-world coordinates, never a viewport frame',()=>{
  const f=fixture();f.s._spawnCPositionPresentationFx();f.s._spawnCenterStageFx();
  assert.equal(f.nodes.length,1,'old three polish nodes and screen frame/columns must not stack in public');
  const n=f.nodes[0];assert.equal(n.name,'public-center-stage-accent');assert.equal(n.type,'Graphics');
  assert.equal(n.x,800);assert.equal(n.y,1526);assert.equal(n.depth,9.2+1526/10000-.000004);
  assert(n.commands.some(c=>c[0]==='lineBetween'));assert(n.commands.every(c=>['lineStyle','lineBetween'].includes(c[0])));
  for(const c of n.commands.filter(c=>c[0]==='lineBetween'))for(const v of c.slice(1))assert(Math.abs(v)<=34);
  assert.equal(f.tweens.length,1);assert.equal(f.tweens[0].duration,760);assert.equal(f.tweens[0].alpha,0);
});

test('postupdate follows actual feet and world sorting without advancing pose or moving any physics object',()=>{
  const f=fixture();f.s._spawnCPositionPresentationFx();const n=f.nodes[0];
  Object.assign(f.s.player,{x:910,y:1610});f.events.emit('postupdate');
  assert.equal(n.x,910);assert.equal(n.y,1636);assert.equal(n.depth,9.2+1636/10000-.000004);
  assert.equal(f.s.player.x,910);assert.equal(f.s.player.y,1610);
});

test('tween completion, repeated cleanup and tracker eviction all remove foot-follow listeners',()=>{
  const f=fixture();f.s._spawnCPositionPresentationFx();assert.equal(f.events.listenerCount('postupdate'),1);
  f.tweens[0].onComplete();assert.equal(f.events.listenerCount('postupdate'),0);assert.equal(f.s.presentationPolishFx.length,0);
  for(let i=0;i<12;i++)f.s._spawnCPositionPresentationFx();assert.equal(f.s.presentationPolishFx.length,8);
  assert.equal(f.events.listenerCount('postupdate'),8);f.s._clearPresentationPolishFx();f.s._clearPresentationPolishFx();
  assert.equal(f.events.listenerCount('postupdate'),0);assert(f.nodes.every(n=>!n.active));
  f.tweens.forEach(t=>t.onComplete());assert.equal(f.events.listenerCount('postupdate'),0);
});

test('hidden diagnostics retain the exact legacy spotlight, circles, screen frame and three columns',()=>{
  const f=fixture(false);f.s._spawnCPositionPresentationFx();f.s._spawnCenterStageFx();
  assert.deepEqual(f.nodes.map(n=>n.type),['Graphics','Circle','Circle','Rectangle','Graphics','Graphics','Graphics']);
  assert.equal(f.events.listenerCount('postupdate'),0);assert.equal(f.tweens.length,6);
  assert.equal(f.nodes[3].depth,50);assert(f.nodes.slice(4).every(n=>n.depth===49));
});

test('choice footer corrects its actual text span rather than only the already-dark button parent',()=>{
  const css=readFileSync(new URL('../src/styles/freshExperience.css',import.meta.url),'utf8');
  const span=css.match(/#game-container #run-choice\.battle-surface \.battle-surface-footer button > span\s*\{([^}]+)\}/);
  assert(span,'specific nested label rule must override the old #run-choice span color');
  assert.match(span[1],/color:\s*inherit/);assert.match(span[1],/font-size:\s*16px/);
});
