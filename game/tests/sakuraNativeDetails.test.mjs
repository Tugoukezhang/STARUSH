import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SakuraNativeDetails,composeNativeDetails,nativeExpressionRegion} from '../src/utils/sakuraNativeDetails.mjs';
import {sampleDirectionalPose} from '../src/utils/sakuraNativeDirections.mjs';
import {nativeWorldMatrices,skinNativeMesh} from '../src/utils/sakuraNativePose.mjs';
import {SakuraNativePresentation,SAKURA_DIRECTION_ART} from '../src/systems/SakuraNativePresentation.mjs';
const directions=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-details-20261004/views.json',import.meta.url)));
const front=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-native-20261004/rig.json',import.meta.url)));
test('secondary motion settles, is time-based, resets teleports, and never starts a fake hit',()=>{
 const outcomes=[];
 for(const hz of [30,60,120]){
  const d=new SakuraNativeDetails();d.update(0,0,0,null,'left',false,0);
  for(let i=1;i<=hz;i++)d.update(i*1000/hz,120/hz,0,null,'left',false,0);
  outcomes.push(d.secondary.hair);assert.ok(Math.abs(d.secondary.hair)>2);
  for(let i=1;i<=hz*2;i++)d.update(1000+i*1000/hz,0,0,null,'left',false,0);
  assert.ok(Math.abs(d.secondary.hair)<.001);assert.equal(d.reaction,0);
  d.update(3100,60,0,null,'right',false,0);assert.equal(d.secondary.hair,0);
 }
 assert.ok(Math.max(...outcomes)-Math.min(...outcomes)<.001);
});
test('damage uses actual sequence, held hurt does not restart, and paused native time cannot age it',()=>{
 const d=new SakuraNativeDetails();d.update(0,0,0,null,'left',false,0);
 d.update(30,0,0,null,'left',true,1);assert.equal(d.reaction,1);
 d.update(30,0,0,null,'left',true,1);assert.equal(d.reaction,1);
 d.update(290,0,0,null,'left',true,1);assert.equal(d.reaction,0);
 d.update(310,0,0,null,'left',true,2);assert.equal(d.reaction,1);
 d.update(330,0,0,null,'left',false,2);assert.ok(d.reaction>0);
 const legacy=new SakuraNativeDetails();legacy.update(0,0,0,null,'right',true);
 legacy.update(300,0,0,null,'right',true);assert.equal(legacy.reaction,0);
});
test('expression composition falls through missing attack region; closed eye wins only during impact',()=>{
 const r={expressions:{blink:[1,2,3,4]},meshes:[]},part={name:'head',region:[0,0,20,30]};
 assert.deepEqual(nativeExpressionRegion(r,part,{focus:true,blink:false},0),part.region);
 assert.deepEqual(nativeExpressionRegion(r,part,{focus:true,blink:true},0),r.expressions.blink);
 r.expressions.focus=[5,6,7,8];
 assert.deepEqual(nativeExpressionRegion(r,part,{focus:true,blink:true},0),r.expressions.focus);
 assert.deepEqual(nativeExpressionRegion(r,part,{focus:true},1),r.expressions.blink);
 assert.deepEqual(nativeExpressionRegion(r,{name:'leg.R',region:[3,4,5,6]},{blink:true},1),[3,4,5,6]);
});
test('new export locally weights ponytail, preserves face and every lower-body/attack bone',()=>{
 assert.equal(directions.finalArt,false);assert.deepEqual(Object.keys(directions.views),['left','up','right']);
 for(const r of Object.values(directions.views)){
  assert.equal(r.bones.length,17);assert.equal(r.meshes.length,7);
  const base=sampleDirectionalPose(r,{clock:30,gaitTime:120,locomotionWeight:.8},{phase:'release',progress:.5});
  const hair=composeNativeDetails(r,base,{secondary:{hair:8,hem:0},reaction:0});
  const ponyRoot=r.bones.findIndex(b=>b.name==='pony.root');
  assert.ok(Math.abs(hair.bones[ponyRoot][2]-base.bones[ponyRoot][2]-8*Math.PI/180*.7)<1e-9);
  const composed=composeNativeDetails(r,base,{secondary:{hair:8,hem:0},reaction:1});
  for(const [i,b]of r.bones.entries())if(/^(hip|root|thigh\.|shin\.|foot\.|upper\.|forearm\.|fan)/.test(b.name))assert.deepEqual(composed.bones[i],base.bones[i]);
  const head=r.meshes.find(m=>m.name==='head'),a=skinNativeMesh(r,head,base),b=skinNativeMesh(r,head,hair);
  const face=head.uv.map(([u,v],i)=>r.direction==='left'?u<.5&&v>.4:r.direction==='right'?u>.68&&v>.4:u>.6&&v>.2);
  assert.ok(face.some(Boolean));face.forEach((yes,i)=>{if(yes)assert.deepEqual(b[i],a[i]);});
  assert.ok(b.some((p,i)=>Math.hypot(p[0]-a[i][0],p[1]-a[i][1])>.5));
  for(const m of r.meshes.filter(m=>m.name.startsWith('leg.')))assert.deepEqual(skinNativeMesh(r,m,composed),skinNativeMesh(r,m,base));
  for(const weights of head.weights)assert.ok(Math.abs(weights.reduce((s,w)=>s+w[1],0)-1)<1e-9);
  for(const m of r.meshes)for(const weights of m.weights)assert.ok(weights.every(([i,w])=>i>=0&&i<r.bones.length&&w>=0));
  assert.ok(nativeWorldMatrices(r,composed).flat().every(Number.isFinite));
  if(r.direction==='up')assert.equal(r.expressions,undefined);else assert.ok(r.expressions.blink);
 }
});
function node(){return {active:true,vertices:[],width:375,height:667,addVertices(v,uv,ii){this.vertices=ii.map(i=>({x:v[i*2],y:v[i*2+1],u:uv[i*2],v:uv[i*2+1],setUVs(u,v){this.u=this.tu=u;this.v=this.tv=v;return this;}}));return this;},setOrtho(){return this;},setDepth(){return this;},setAlpha(a){this.alpha=a;return this;},setPosition(){return this;},setTint(){return this;},preUpdate(){},destroy(){this.active=false;}};}
test('actual presenter uses registered expression, accepts hit sequence, freezes and disposes every node',()=>{
 const made=[],scene={_sakuraNativeDirectionsRequested:true,player:{x:187.5,y:587},textures:{exists:()=>true},cache:{json:{get:key=>key.includes('directions')?directions:front}},add:{mesh(){const n=node();made.push(n);return n;},ellipse(){const n=node();made.push(n);return n;}}};
 const view=new SakuraNativePresentation(scene);view.update(20,-2,0,{direction:'left',phase:'release',progress:.5},false,false,0);
 assert.equal(view.state.direction,'left');view.update(40,0,0,null,false,true,1);
 assert.ok(view.state.hitReaction>0);assert.equal(view.state.expression,'blink');
 const before=structuredClone(view.state);view.update(9000,20,0,null,true,true,2);assert.deepEqual(view.state,before);
 view.update(9020,0,0,null,false,true,1);assert.ok(view.state.hitReaction>0);
 for(let i=1;i<=20;i++)view.update(9020+i*20,0,0,null,false,true,1);assert.equal(view.state.hitReaction,0);
 assert.ok(SAKURA_DIRECTION_ART.data.includes('sakura-details-20261004'));
 view.destroy();view.destroy();assert.ok(made.every(n=>!n.active));
});
