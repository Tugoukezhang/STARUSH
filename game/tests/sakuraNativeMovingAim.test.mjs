import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EventEmitter} from 'node:events';
import {SakuraNativePresentation,SAKURA_NATIVE_ART,SAKURA_DIRECTION_ART} from '../src/systems/SakuraNativePresentation.mjs';
import {captureSakuraDefeat,SakuraDefeatPresentation} from '../src/systems/SakuraDefeatPresentation.mjs';
const front=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-conformance-20261004/rig.json',import.meta.url)));
const directions=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-details-20261004/views.json',import.meta.url)));
const turns=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-turn-native-20261004/views.json',import.meta.url)));
const moves={down:[0,4],up:[0,-4],left:[-4,0],right:[4,0]};
function node(){return {active:true,vertices:[],width:375,height:667,addVertices(v,uv,ix){this.vertices=ix.map(i=>({x:v[i*2],y:v[i*2+1],u:uv[i*2],v:uv[i*2+1],setUVs(u,v){this.u=this.tu=u;this.v=this.tv=v;return this;}}));return this;},setOrtho(){return this;},setPosition(x,y){this.x=x;this.y=y;return this;},setDepth(d){this.depth=d;return this;},setAlpha(a){this.alpha=a;return this;},setTint(){return this;},preUpdate(){},destroy(){this.active=false;}};}
function fixture(){const made=[],timers=[],scene={_sakuraNativeDirectionsRequested:true,_sakuraNativeTurnRequested:true,player:{x:200,y:400,active:true,hp:5},battleData:{stageId:1,performerId:'sakura'},events:new EventEmitter(),textures:{exists:()=>true},cache:{json:{get:k=>k===SAKURA_NATIVE_ART.dataKey?front:k===SAKURA_DIRECTION_ART.dataKey?directions:turns}},time:{delayedCall(delay,fn){const t={delay,fn,removed:false,remove(){this.removed=true;}};timers.push(t);return t;}},add:{mesh(){const n=node();made.push(n);return n;},ellipse(){const n=node();made.push(n);return n;}}};const view=new SakuraNativePresentation(scene);return {scene,made,timers,view};}
const attack=(direction,phase='release',progress=.35)=>({id:1,direction,phase,progress,kind:'basic'});
const positions=nodes=>Object.fromEntries(nodes.map(n=>[n.part.name,n.node.vertices.map(v=>[v.x,v.y])]));
function advance(f,move,aim){for(let now=40;now<=400;now+=40)f.view.update(now,...moves[move],attack(aim),false,false);}

test('committed upper aim differs from actual movement without replacing or retiming lower meshes',()=>{
 for(const move of Object.keys(moves))for(const aim of Object.keys(moves)){
  const f=fixture(),base=fixture();advance(f,move,aim);
  for(let now=40;now<=400;now+=40)base.view.update(now,...moves[move],null,false,false);
  assert.equal(f.view.state.upperRenderDirection,aim,`${move}/${aim} must visibly face committed aim`);
  assert.equal(f.view.state.lowerRenderDirection,move);
  const legs=f.view.nodes.filter(n=>n.part.name.startsWith('leg.'));
  assert.deepEqual(positions(legs),positions(base.view.nodes.filter(n=>n.part.name.startsWith('leg.'))),'exact old gait pixels');
  assert.deepEqual(f.view.clock,base.view.clock,'no independent gait clock');
  assert.equal(f.view.allNodes.length,59);assert.equal(f.made.length,60,'no per-frame allocations');
  assert.equal(f.view.nodes.length,aim==='down'?10:7);
  assert.equal(f.view.nodes.filter(n=>n.part.name==='head').length,1);
  assert.equal(f.view.nodes.filter(n=>n.part.name==='fan.open').length,1);
  assert.equal(f.view.allNodes.filter(n=>n.node.alpha>0).length,f.view.nodes.length,'no ghost full banks');
  assert.equal(f.view.nodes.find(n=>n.part.name==='head'),f.view.groups[aim].find(n=>n.part.name==='head'));
  f.view.destroy();base.view.destroy();
 }
});

test('upper and lower hips share screen registration including front breathing and walking bob',()=>{
 const f=fixture();advance(f,'down','up');
 assert(f.view.layers?.length===2,'mixed facing must retain two visible layer records');
 for(let i=0;i<50;i++){
  f.view.update(420+i*20,0,4,attack('up','recovery',i/50),false,false);
  const hips=f.view.layers.map(l=>{const j=l.rig.bones.findIndex(b=>b.name==='hip');return [(l.world[j][4]-l.rootShift[0]-l.rig.anchor[0])*l.rig.scale,(l.world[j][5]-l.rootShift[1]-l.rig.anchor[1])*l.rig.scale];});
  assert(Math.hypot(hips[0][0]-hips[1][0],hips[0][1]-hips[1][1])<1e-8,'hips must not separate');
  for(const n of f.view.nodes)for(const v of n.node.vertices)assert([v.x,v.y,v.tu,v.tv].every(Number.isFinite));
  f.view.setWorldDepth(13);
  const depths=f.view.nodes.map(n=>n.node.depth);assert(depths.every((d,j)=>d>=13&&d<13.001&&(!j||d>depths[j-1])),'same authored painter order');
 }
 f.view.destroy();
});

test('bounded independent upper turn, pause, target change and release back to locomotion are owned',()=>{
 const f=fixture();advance(f,'right','right');
 f.view.update(420,4,0,attack('left','windup',.1),false,false);
 assert.equal(f.view.state.lowerRenderDirection,'right');
 assert.notEqual(f.view.state.upperRenderDirection,'left','opposite upper turn must not teleport');
 assert(f.view.state.upperTurning);
 const state=structuredClone(f.view.state),pixels=positions(f.view.nodes),hand=f.view.handWorld();
 f.view.update(5420,-80,0,null,true,true);assert.deepEqual(f.view.state,state);assert.deepEqual(positions(f.view.nodes),pixels);assert.deepEqual(f.view.handWorld(),hand);
 for(let i=1;i<=12;i++)f.view.update(5420+i*20,4,0,attack('left'),false,false);
 assert.equal(f.view.state.upperRenderDirection,'left');
 for(let i=13;i<=26;i++)f.view.update(5420+i*20,4,0,null,false,false);
 assert.equal(f.view.state.upperRenderDirection,'right');assert.equal(f.view.layers.length,1);
 const nodes=f.view.allNodes.slice();f.view.destroy();f.view.destroy();assert(nodes.every(n=>!n.node.active));
});

test('visible hand socket belongs to upper attack bank, not hidden movement fan',()=>{
 const f=fixture();advance(f,'left','right');
 assert.equal(f.view.activeRig.direction,'right');
 const l=f.view.layers.find(l=>l.nodes.some(n=>n.part.name==='fan.open')),m=l.world[l.rig.fanBone];
 assert.deepEqual(f.view.handWorld(),{x:f.scene.player.x+(m[4]-l.rootShift[0]-l.rig.anchor[0])*l.rig.scale,y:f.scene.player.y+(m[5]-l.rootShift[1]-l.rig.anchor[1])*l.rig.scale});
 const before=f.view.handWorld();f.scene.player.x+=10;assert.equal(f.view.handWorld().x-before.x,10);f.view.destroy();
});

test('a settled upper aim cannot rewind into the slower lower turn when movement catches up',()=>{
 const f=fixture();advance(f,'left','right');
 assert.equal(f.view.state.upperRenderDirection,'right');
 for(let now=420;now<=580;now+=20){
  f.view.update(now,4,0,attack('right'),false,false);
  assert.equal(f.view.state.upperRenderDirection,'right','upper aim must not inherit a still-turning leg bank at '+now);
 }
 assert.equal(f.view.state.lowerRenderDirection,'right');assert.equal(f.view.layers.length,1);f.view.destroy();
});

test('mixed lethal snapshot starts pixel-identical and preserves the actually visible foot anchors',()=>{
 const f=fixture();advance(f,'down','left');f.scene.player.hp=0;
 const saved=captureSakuraDefeat({nativeSakura:true,freshSakura:true,scene:f.scene,sakuraView:f.view},'player-defeat');
 assert.equal(saved.layers?.length,2,'death must capture actual mixed layers, not substitute whole aim rig');
 const pixels=positions(f.view.nodes);f.view.destroy();let done=0;
 const p=new SakuraDefeatPresentation(f.scene,saved,()=>done++),n=p.native;
 assert(p.started);assert.deepEqual(positions(n.nodes),pixels,'death must not change clothing or boots at start');
 const lower=n.layers.find(l=>l.nodes.some(n=>n.part.name==='leg.R')),feet=['foot.R','foot.L'].map(k=>lower.rig.bones.findIndex(b=>b.name===k)),first=feet.map(i=>lower.world[i].slice(4));
 for(let dt=20;dt<=540;dt+=20){f.scene.events.emit('update',400+dt,20);for(let j=0;j<feet.length;j++)assert(Math.hypot(lower.world[feet[j]][4]-first[j][0],lower.world[feet[j]][5]-first[j][1])<.01,'captured moving foot must stay planted');assert.equal(n.nodes.filter(x=>x.part.name==='head').length,1);}
 f.timers.at(-1).fn();assert.equal(done,1);assert.equal(n.disposed,true);assert.equal(f.scene.events.listenerCount('update'),0);assert(f.made.every(x=>!x.active));p.destroy();
});

test('one-bank fallback and same-facing attacks keep the established visible set',()=>{
 const f=fixture();advance(f,'up','up');assert.equal(f.view.layers?.length,1);assert.deepEqual(f.view.nodes,f.view.groups.up);f.view.destroy();
 const g=fixture();delete g.scene._sakuraNativeDirectionsRequested;delete g.scene._sakuraNativeTurnRequested;g.view.destroy();
 const v=new SakuraNativePresentation(g.scene);v.update(40,4,0,attack('right'),false,false);assert.equal(v.activeRig,front);assert.equal(v.nodes.length,10);v.destroy();
});
