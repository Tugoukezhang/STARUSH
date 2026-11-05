import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {LayeredSeamMeshes} from '../src/systems/LayeredPoseTransition.mjs';
import * as seamModule from '../src/systems/LayeredPoseTransition.mjs';
import * as venusModule from '../src/systems/VenusLayeredPresentation.mjs';
import {buildKaiPose} from '../src/systems/KaiLayeredPresentation.mjs';
const require=createRequire(import.meta.url);
const Texture=require('../node_modules/phaser/src/gameobjects/components/Texture.js');
const Matrix4=require('../node_modules/phaser/src/math/Matrix4.js');
const Vertex=require('../node_modules/phaser/src/geom/mesh/Vertex.js');
const meshSource=fs.readFileSync(new URL('../node_modules/phaser/src/gameobjects/mesh/Mesh.js',import.meta.url),'utf8');
const start=meshSource.indexOf('setOrtho: function')+'setOrtho: '.length;
const setOrtho=Function('return ('+meshSource.slice(start,meshSource.indexOf('\n    },',start)+6)+')')();
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`projected ${a} != authored ${b}`);
function fixture(width,height){
  const created=[],textures=new Map(['cardinal','diagonal'].map((key,i)=>[key,{key,get:()=>({
    cutWidth:104,cutHeight:i?103:101,realWidth:104,realHeight:i?103:101
  })}]));
  const scene={sys:{textures:{get:key=>textures.get(key)}},textures:{getFrame:()=>({
    cutX:4,cutY:4,cutWidth:50,cutHeight:75,source:{width:1024,height:1024}
  })},add:{mesh(x,y,key){
    const n={scene,_sizeComponent:true,projectionMatrix:new Matrix4(),dirtyCache:[],width,height,vertices:[],destroyed:0};
    n.setTexture=Texture.setTexture;n.setFrame=Texture.setFrame;
    n.setSizeToFrame=function(){this.width=this.frame.realWidth;this.height=this.frame.realHeight;return this;};
    n.setOrtho=setOrtho;n.setTexture(key);n.width=width;n.height=height;
    n.addVertices=(xy,uv,indices)=>{n.vertices=indices.map(i=>new Vertex(xy[i*2],xy[i*2+1],0,uv[i*2],uv[i*2+1]));};
    for(const method of ['setPosition','setDepth','setAlpha','setTint','setVisible'])n[method]=()=>n;
    n.preUpdate=()=>{for(const v of n.vertices)v.transformCoordinatesLocal(n.projectionMatrix,n.width,n.height,0);};
    n.destroy=()=>n.destroyed++;created.push(n);return n;
  }}};
  return {created,seams:new LayeredSeamMeshes(scene,'cardinal')};
}
for(const [w,h]of [[256,256],[375,667],[320,568]]){
  test(`actual Phaser texture resize and orthographic projection remain world-sized at ${w}x${h}`,()=>{
    const {seams,created}=fixture(w,h),raw=buildKaiPose({root:{x:128,y:128},facing:'down',state:'walk',clock:0,phase:.2});
    const original=structuredClone(raw),images=new Map(raw.parts.map(p=>[p.name,{setVisible(){}}]));
    for(const key of ['cardinal','diagonal','diagonal','cardinal','diagonal','cardinal']){
      const pose={...raw,parts:raw.parts.map(p=>({...p,textureKey:key}))};
      seams.render(pose,images,9.8,1,0xffffff);
      for(const n of seams.nodes.values())for(const v of n.vertices){near(v.vx,v.x);near(v.vy,-v.y);}
    }
    assert.equal(created.length,3);assert.deepEqual(raw,original);
    seams.destroy();seams.destroy();assert(created.every(n=>n.destroyed===1));
  });
}
test('failure reproducer: real Phaser texture handoff resizes a mesh unless projection is refreshed',()=>{
  const {created,seams}=fixture(256,256),pose=buildKaiPose({root:{x:128,y:128},facing:'down',state:'idle',clock:0});
  seams.render(pose,new Map(pose.parts.map(p=>[p.name,{setVisible(){}}])),9.8,1,0xffffff);
  const n=created[0];n.setTexture('diagonal');n.preUpdate();
  assert.equal(n.width,104);assert.equal(n.height,103);
  near(n.vertices[0].vx,n.vertices[0].x*104/256);
  assert(Math.abs(n.vertices[0].vx-n.vertices[0].x)>1);
  seams.destroy();
});
test('Venus skirt waist follows the actual shirt hem, not its dangling ornament bounds',()=>{
  assert.equal(typeof seamModule.buildLayeredWaistBinding,'function');
  const hems=venusModule.VENUS_WAIST_HEMS;
  assert.equal(Object.keys(hems).length,8);assert(hems['down-right/torso']<.81);
  const pose=venusModule.buildVenusPose({root:{x:100,y:100},facing:'down',state:'walk',clock:80,phase:.2});
  const raw=structuredClone(pose),torso=pose.parts.find(p=>p.name==='torso'),skirt=pose.parts.find(p=>p.name==='skirt');
  for(const angle of [-24,0,24]){
    torso.angle=angle;const before=structuredClone(pose);
    const anchor=seamModule.buildLayeredWaistBinding(pose,hems[torso.frame]);
    const bound=seamModule.buildLayeredSeamVertices(pose,skirt,anchor),unbound=seamModule.buildLayeredSeamVertices(pose,skirt);
    const top=bound.find(v=>v.v===0&&v.u===.5);near(top.x,anchor.x);near(top.y,anchor.y);
    assert.deepEqual(bound.filter(v=>v.v===1),unbound.filter(v=>v.v===1),'hem and leg overlap must not move');
    for(let i=0;i<bound.length;i++)assert(Math.hypot(bound[i].x-unbound[i].x,bound[i].y-unbound[i].y)<=6);
    assert.deepEqual(pose,before);
  }
  assert.deepEqual(pose.feet,raw.feet);assert.deepEqual(pose.legs,raw.legs);
  assert.equal(seamModule.buildLayeredWaistBinding(pose,undefined),null);
});
