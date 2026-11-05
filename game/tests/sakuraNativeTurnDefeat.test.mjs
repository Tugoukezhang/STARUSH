import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EventEmitter} from 'node:events';
import {SakuraNativePresentation,preloadSakuraNative,SAKURA_NATIVE_ART,SAKURA_DIRECTION_ART} from '../src/systems/SakuraNativePresentation.mjs';
import {captureSakuraDefeat,SakuraDefeatPresentation} from '../src/systems/SakuraDefeatPresentation.mjs';
import {nativeWorldMatrices} from '../src/utils/sakuraNativePose.mjs';
import {sampleNativeDefeat} from '../src/utils/sakuraNativeDefeat.mjs';
const front=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-native-20261004/rig.json',import.meta.url))),directions=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-details-20261004/views.json',import.meta.url))),turns=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-turn-native-20261004/views.json',import.meta.url)));
function node(){return {active:true,vertices:[],width:375,height:667,addVertices(v,uv,ix){this.vertices=ix.map(i=>({x:v[i*2],y:v[i*2+1],u:uv[i*2],v:uv[i*2+1],setUVs(u,v){this.u=this.tu=u;this.v=this.tv=v;return this;}}));return this;},setOrtho(){return this;},setPosition(x,y){this.x=x;this.y=y;return this;},setDepth(d){this.depth=d;return this;},setAlpha(a){this.alpha=a;return this;},setTint(){return this;},preUpdate(){},destroy(){this.active=false;}};}
function fixture(){const made=[],timers=[],scene={_sakuraNativeDirectionsRequested:true,_sakuraNativeTurnRequested:true,player:{x:200,y:400,active:true,hp:0},battleData:{stageId:1,performerId:'sakura'},events:new EventEmitter(),textures:{exists:()=>true},cache:{json:{get:key=>key===SAKURA_NATIVE_ART.dataKey?front:key===SAKURA_DIRECTION_ART.dataKey?directions:turns}},time:{delayedCall(delay,fn){const t={delay,fn,removed:false,remove(){this.removed=true;}};timers.push(t);return t;}},add:{mesh(){const n=node();made.push(n);return n;},ellipse(){const n=node();made.push(n);return n;}}};return {scene,made,timers};}
test('native turns use authored intermediate meshes once, share gait, freeze, and preempt for attack',()=>{
 const f=fixture(),v=new SakuraNativePresentation(f.scene),nodes=v.allNodes.slice();v.update(40,4,0,null,false,false);
 assert.equal(v.state.turnFrame,1,'right turn must show true frontRight perspective');assert.equal(v.activeRig.view,'three-quarter-frontRight');assert.equal(v.nodes.length,7);
 assert.equal(v.allNodes.filter(n=>n.node.alpha>0).length,7);assert.equal(v.clock.travel,4);assert.equal(v.clock.gaitTime,4/96*1000);
 const saved=structuredClone(v.state);v.update(5020,40,0,null,true,true);assert.deepEqual(v.state,saved);
 v.update(5040,4,0,null,false,false);v.update(5060,4,0,null,false,false);v.update(5080,4,0,null,false,false);assert.equal(v.state.renderDirection,'right');assert.equal(v.state.turning,false);
 v.update(5100,0,0,{id:1,phase:'release',progress:.5,direction:'left'},false,false);assert.equal(v.state.turnFrame,null);assert.equal(v.activeRig.direction,'left');assert.equal(v.state.attackId,1);
 v.update(5120,0,-4,null,false,false);assert.equal(v.state.turnFrame,2);assert.equal(v.state.lowerRenderDirection,'backLeft');assert.equal(v.state.visualRecovery,true);assert.equal(v.activeRig.direction,'left');
 assert.deepEqual(v.allNodes,nodes);v.destroy();v.destroy();assert(f.made.every(n=>!n.active));
});
test('continuous automatic attacks cannot swallow a walking turn or delay the attack pose',()=>{
 const f=fixture(),v=new SakuraNativePresentation(f.scene);v.update(40,4,0,{id:2,phase:'release',progress:.5,direction:'right'},false,false);
 assert.equal(v.state.turnFrame,1);assert.equal(v.activeRig.view,'three-quarter-frontRight');assert.equal(v.state.attackId,2);assert.equal(v.state.attackPhase,'release');assert(v.pose.focus);v.destroy();
});
test('preload includes only explicit new turn exports and requested missing view fails closed',()=>{
 const calls=[],s={load:{image:(...a)=>calls.push(a),json:(...a)=>calls.push(a)}};preloadSakuraNative(s);
 assert.equal(s._sakuraNativeTurnRequested,true);assert.equal(calls.length,6);assert.match(calls[4][1],/sakura-hand-art-20261005\/turns.webp$/);
 const f=fixture();f.scene.cache.json.get=key=>key===SAKURA_NATIVE_ART.dataKey?front:key===SAKURA_DIRECTION_ART.dataKey?directions:{views:{}};
 assert.throws(()=>new SakuraNativePresentation(f.scene),/turn.*load/i);
});
test('native lethal snapshot survives actor release, articulates feet-stable collapse and completes once',()=>{
 for(const [dx,dy]of [[0,0],[-4,0],[4,0],[0,-4]]){
  const f=fixture(),v=new SakuraNativePresentation(f.scene);v.update(100,dx,dy,{id:1,phase:'release',progress:.5,direction:dy<0?'up':dx<0?'left':dx>0?'right':'down'},false,false);
  const a={nativeSakura:true,freshSakura:true,disposed:false,scene:f.scene,sakuraView:v};
  for(const outcome of ['victory','defense-defeat'])assert.equal(captureSakuraDefeat(a,outcome),null);
  const saved=captureSakuraDefeat(a,'player-defeat');assert.equal(saved.native,true);assert.notEqual(saved.pose,v.pose);const initial=nativeWorldMatrices(saved.rig,saved.pose),head=saved.rig.bones.findIndex(b=>b.name==='head'),feet=['foot.R','foot.L'].map(n=>saved.rig.bones.findIndex(b=>b.name===n));
  assert.equal(saved.worldDepth,v.worldDepth);v.destroy();let done=0;const p=new SakuraDefeatPresentation(f.scene,saved,()=>done++);assert(p.started);assert(p.native);assert.equal(p.native.nodes.length,saved.rig.meshes.length);assert.equal(p.native.nodes[0].node.depth,saved.worldDepth);
  f.scene.events.emit('update',1000,160);f.scene.events.emit('update',1160,160);f.scene.events.emit('update',1320,160);
  const world=p.native.world;assert(world[head][5]>initial[head][5]+30,'head must visibly settle lower');
  for(const i of feet)assert(Math.hypot(world[i][4]-initial[i][4],world[i][5]-initial[i][5])<.01,'foot anchor changed');
  assert.equal(done,0);f.timers.at(-1).fn();assert.equal(done,1);assert.equal(p.disposed,true);assert.equal(f.scene.events.listenerCount('update'),0);p.destroy();assert.equal(done,1);assert(f.made.every(n=>!n.active));
 }
});
test('native cancellation, invalid snapshots and missing texture cannot leak or block result',()=>{
 const f=fixture(),v=new SakuraNativePresentation(f.scene),a={nativeSakura:true,freshSakura:true,scene:f.scene,sakuraView:v};
 f.scene.player.hp=1;assert.equal(captureSakuraDefeat(a,'player-defeat'),null);f.scene.player.hp=0;f.scene.battleData.practiceMode=true;assert.equal(captureSakuraDefeat(a,'player-defeat'),null);f.scene.battleData.practiceMode=false;
 const saved=captureSakuraDefeat(a,'player-defeat');assert(saved);let done=0;const p=new SakuraDefeatPresentation(f.scene,saved,()=>done++),queued=p.native.update;p.destroy();p.destroy();assert.doesNotThrow(()=>queued(1000,16),'same-frame cached callback after destroy');for(const t of f.timers)t.fn();assert.equal(done,0);assert.equal(f.scene.events.listenerCount('update'),0);assert(f.timers.every(t=>t.removed));
 f.scene.textures.exists=()=>false;const missing=new SakuraDefeatPresentation(f.scene,saved,()=>done++);assert.equal(missing.started,false);missing.destroy();v.destroy();
});
test('early defeat anticipation cannot lift the feet of a fully extended captured leg',()=>{
 for(const rig of [...Object.values(directions.views),...Object.values(turns.views)]){
  const captured={bones:structuredClone(rig.rest),fold:0,blink:false,focus:false},base=nativeWorldMatrices(rig,captured);
  const feet=['foot.R','foot.L'].map(n=>rig.bones.findIndex(b=>b.name===n));
  for(let elapsed=0;elapsed<=560;elapsed+=10){
   const world=nativeWorldMatrices(rig,sampleNativeDefeat(rig,captured,elapsed));
   for(const i of feet)assert(Math.hypot(world[i][4]-base[i][4],world[i][5]-base[i][5])<.01,`${rig.view} foot lifted at ${elapsed}ms`);
  }
 }
});
