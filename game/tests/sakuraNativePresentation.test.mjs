import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SakuraNativePresentation,preloadSakuraNative,SAKURA_NATIVE_ART,SAKURA_DIRECTION_ART,SAKURA_NATIVE_TURN_ART} from '../src/systems/SakuraNativePresentation.mjs';
import {sampleNativeClip,composeNativePose,nativeWorldMatrices,skinNativeMesh,SakuraNativeClock} from '../src/utils/sakuraNativePose.mjs';
import {captureSakuraDefeat} from '../src/systems/SakuraDefeatPresentation.mjs';
const rig=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-native-20261004/rig.json',import.meta.url)));
function node(){return {active:true,vertices:[],width:375,height:667,
  addVertices(v,uv,indices){this.vertices=indices.map(i=>({x:v[i*2],y:v[i*2+1],u:uv[i*2],v:uv[i*2+1],setUVs(u,v){this.u=this.tu=u;this.v=this.tv=v;return this;}}));return this;},
  setOrtho(){return this;},setPosition(x,y){this.x=x;this.y=y;return this;},setDepth(d){this.depth=d;return this;},
  setAlpha(a){this.alpha=a;return this;},setTint(){return this;},preUpdate(){this.updated=(this.updated??0)+1;},destroy(){this.active=false;}};}
function fixture(){const made=[],scene={player:{x:500,y:1000,active:true,alpha:1},cache:{json:{get:()=>rig}},textures:{exists:()=>true},
  add:{ellipse(){const n=node();made.push(n);return n;},mesh(){const n=node();made.push(n);return n;}}};return {scene,made,view:new SakuraNativePresentation(scene)};}
test('native package is bounded, original, and single-view status remains explicit',()=>{
  assert.equal(rig.view,'near-front-2d');assert.equal(rig.finalArt,false);
  assert.equal(rig.bones.length,21);assert.equal(rig.meshes.length,10);
  assert.equal(rig.meshes.reduce((sum,m)=>sum+m.vertices.length,0),1185);
  assert.equal(rig.atlasSize[0]*rig.atlasSize[1]*4,3*1024*1024);
  const atlas=fs.readFileSync(new URL('../public/art/sakura-native-20261004/parts.png',import.meta.url));
  assert.equal(atlas.readUInt32BE(16),1024);assert.equal(atlas.readUInt32BE(20),768);assert.equal(atlas[25],6);
  assert.ok(atlas.length<600000);assert.ok(JSON.stringify(rig).length<250000);
});
test('native attack cannot replace lower-body locomotion or retime it',()=>{
  for(const t of [0,170,370,500,830]){
    const base=sampleNativeClip(rig.clips.walk,t),baseWorld=nativeWorldMatrices(rig,base);
    for(const phase of ['windup','release','recovery'])for(const progress of [0,.4,.9,1]){
      const composed=composeNativePose(rig,base,{phase,progress}),world=nativeWorldMatrices(rig,composed);
      for(const mesh of rig.meshes.filter(m=>m.name.startsWith('leg.')))assert.deepEqual(skinNativeMesh(rig,mesh,composed,world),skinNativeMesh(rig,mesh,base,baseWorld));
    }
  }
});
test('real world motion drives mesh positions and weapon socket; pause and cleanup are owned',()=>{
  const {scene,view,made}=fixture();view.update(20,5,0,{id:1,phase:'release',progress:.5,direction:'right'},false,false);
  assert.equal(view.state.travel,5);assert.equal(view.state.moving,true);
  const before=structuredClone(view.state),positions=view.nodes.map(n=>n.node.vertices.map(v=>[v.x,v.y]));
  view.update(5020,50,0,null,true,true);assert.deepEqual(view.state,before);
  assert.deepEqual(view.nodes.map(n=>n.node.vertices.map(v=>[v.x,v.y])),positions);
  const hand=view.handWorld();scene.player.x+=20;scene.player.y-=10;
  assert.equal(view.handWorld().x-hand.x,20);assert.equal(view.handWorld().y-hand.y,-10);
  view.setWorldDepth(12);assert.ok(view.nodes.every(n=>n.node.depth>=12&&n.node.depth<12.001));
  for(let i=1;i<=12;i++)view.update(5020+i*20,0,0,null,false,false);
  assert.equal(view.state.moving,false);assert.equal(view.state.settling,false);assert.equal(view.state.phase,0);
  view.destroy();view.destroy();assert.ok(made.every(n=>!n.active));assert.equal(view.upper,null);
});
test('transparent physics proxy cannot hide art; visible flash layer owns presentation alpha',()=>{
  const {scene,view}=fixture();scene.player.alpha=0;scene.playerGfx={alpha:.65};
  view.update(30,0,0,null,false,false);
  assert.ok(view.nodes.every(({node})=>node.alpha===.65));
  assert.equal(view.shadow.alpha,.65*.16);
});
test('preload never substitutes old parts, missing package fails closed, and native defeat does not borrow old art',()=>{
  const calls=[],scene={load:{image:(...a)=>calls.push(a),json:(...a)=>calls.push(a)}};
  preloadSakuraNative(scene);assert.equal(scene._sakuraNativePresentationRequested,true);
  assert.deepEqual(calls,[[SAKURA_NATIVE_ART.key,SAKURA_NATIVE_ART.texture],[SAKURA_NATIVE_ART.dataKey,SAKURA_NATIVE_ART.data],[SAKURA_DIRECTION_ART.key,SAKURA_DIRECTION_ART.texture],[SAKURA_DIRECTION_ART.dataKey,SAKURA_DIRECTION_ART.data],[SAKURA_NATIVE_TURN_ART.key,SAKURA_NATIVE_TURN_ART.texture],[SAKURA_NATIVE_TURN_ART.dataKey,SAKURA_NATIVE_TURN_ART.data]]);
  assert.throws(()=>new SakuraNativePresentation({cache:{json:{get:()=>null}}}),/failed to load/);
  assert.equal(captureSakuraDefeat({nativeSakura:true},'player-defeat'),null);
  const c=new SakuraNativeClock();c.update(0,0,0,false);c.update(30,7.5,0,false);const phase=c.gaitTime;c.update(5030,80,0,true);
  assert.equal(c.gaitTime,phase);assert.equal(c.travel,7.5);
});
