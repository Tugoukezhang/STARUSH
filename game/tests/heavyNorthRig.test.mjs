import test from 'node:test';import assert from 'node:assert/strict';
import * as poses from '../src/systems/HeavyRigPose.mjs';
import {HeavyLimbRig} from '../src/systems/HeavyLimbRig.mjs';
const KEY='enjo-north-rig-20261029';
const node=()=>{const n={texture:{key:'legacy'},visible:true};for(const k of ['setTexture','setOrigin','setPosition','setScale','setFlipX','setRotation','setAlpha','setTint','setDepth','setCrop','setVisible'])n[k]=(...a)=>{if(k==='setTexture')n.texture.key=a[0];if(k==='setVisible')n.visible=a[0];return n;};n.destroy=()=>{n.destroyed=true;};return n;};
function fixture(north=true){const made=[],scene={player:{x:100,y:200},playerGfx:{alpha:1},textures:{exists:key=>north||key!==KEY,getFrame:()=>({width:256,height:256})},add:{image:()=>{const n=node();made.push(n);return n;}}},body=node(),v=new HeavyLimbRig(scene,body);return{v,body,made,scene};}
const opts={clock:100,elapsed:16,dx:0,dy:0,state:'attack',flip:false,frozen:false,attack:{phase:'windup',progress:.4,released:false,angle:-Math.PI/2}};
test('north actual ordinary attack uses a layered rear body instead of old north cels',()=>{
 const {v,body}=fixture();assert(v.update(opts));assert.equal(v.direction,'north');assert.equal(body.texture.key,KEY);assert(v.tipWorld());assert(v.bounds());
});
test('north source is opt-in and missing bank retains original fallback',()=>{
 const {v,made}=fixture(false);assert.equal(v.update(opts),false);assert.equal(made.length,0);
});
test('rear pose retains fixed short limbs, closed palms, continuous weapon path and returns ready',()=>{
 assert.equal(typeof poses.sampleNorthHeavyRig,'function');let previous;
 for(let age=0;age<=420;age++){
  const p=poses.sampleNorthHeavyRig(age,0);
  for(const side of ['near','far']){assert(p.arms[side].error<.011);assert(p.legs[side].error<.011);assert(p.legs[side].lengths.reduce((a,b)=>a+b)<25);}
  if(previous)assert(Math.hypot(p.tip.x-previous.x,p.tip.y-previous.y)<6);
  previous=p.tip;
 }
 assert.deepEqual(poses.sampleNorthHeavyRig(420,0),poses.sampleNorthHeavyRig(null,0));
});
test('pause does not advance rear geometry and switching south hides every extra piece',()=>{
 const{v,made}=fixture();assert(v.update(opts));const p=structuredClone(v.pose);v.update({...opts,clock:900,frozen:true,attack:{...opts.attack,progress:.9}});assert.deepEqual(v.pose,p);
 assert(!v.update({...opts,attack:{...opts.attack,angle:Math.PI/2}}));assert(made.every(n=>!n.visible));v.destroy();assert(made.every(n=>n.destroyed));
});
