import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { PerformerSecondaryMotion, secondaryWeights, secondaryGrid, PerformerSecondarySurface } from '../src/systems/PerformerSecondarySurface.mjs';

const ids=['venus','genya','kai','enjo'];
test('face, crown roots, torso and 88px foot seam stay pinned for every member',()=>{
  for(const id of ids){
    for(const x of [44,48,56,64,72,80,84])for(const y of [28,32,40,48,56,64,72])
      assert.deepEqual(secondaryWeights(id,x,y),{hair:0,cloth:0});
    for(let x=0;x<=128;x+=4)assert.deepEqual(secondaryWeights(id,x,88),{hair:0,cloth:0});
    assert.ok(secondaryWeights(id,96,48).hair>0);
    assert.ok(secondaryWeights(id,44,80).cloth>0);
  }
});
test('run and stop are frame-rate independent, short hair is restrained, no idle oscillator',()=>{
  const end=[];
  for(const fps of [15,30,60]){
    const m=new PerformerSecondaryMotion('genya'),dt=1000/fps;m.sample(0,0,0);
    for(let n=1;n<=fps;n++)m.sample(n*dt,250*dt/1000,0);
    end.push({...m.value});assert.ok(m.value.hair<-1);
    for(let n=1;n<=fps;n++)m.sample(1000+n*dt,0,0);
    assert.ok(Math.abs(m.value.hair)<.001);assert.ok(Math.abs(m.value.cloth)<.001);
  }
  for(const value of end)assert.ok(Math.abs(value.hair-end[0].hair)<1e-8);
  const a=new PerformerSecondaryMotion('kai'),b=new PerformerSecondaryMotion('genya');
  a.sample(0,0,0);b.sample(0,0,0);a.sample(100,25,0);b.sample(100,25,0);
  assert.ok(Math.abs(a.value.hair)<Math.abs(b.value.hair)*.4);
  const idle=new PerformerSecondaryMotion('venus');for(let n=0;n<100;n++)idle.sample(n*16,0,0);
  assert.deepEqual(idle.value,{hair:0,cloth:0});
});
test('pause ignores wall time; teleport resets rather than stretching the body',()=>{
  const m=new PerformerSecondaryMotion('genya');m.sample(0,0,0);m.sample(100,25,0);
  const pose={...m.value};m.sample(5000,0,0,true);m.sample(10000,0,0,true);
  assert.deepEqual(m.value,pose);m.sample(20000,0,0);assert.deepEqual(m.value,pose);
  m.sample(20016,1000,0);assert.deepEqual(m.value,{hair:0,cloth:0});
});
test('grid has pinned boundary and UVs never bleed outside the selected cropped atlas frame',()=>{
  const grid=secondaryGrid();assert.ok(grid.vertices.length/2<=1600);
  for(let i=0;i<grid.vertices.length;i+=2){const x=grid.vertices[i]+64,y=64-grid.vertices[i+1];
    assert.ok(x>=0&&x<=128&&y>=0&&y<=88);
    assert.equal(grid.uvs[i],x/128);assert.equal(grid.uvs[i+1],y/128);
  }
});
function image(){return {active:true,visible:true,x:80,y:100,alpha:.5,depth:12,scaleX:.5,scaleY:.5,
  texture:{key:'walk'},frame:{name:17,u0:.25,u1:.5,v0:.3,v1:.4},tintTopLeft:0xffb4c1,
  setVisible(v){this.visible=v;return this;}};}
function fakeMesh(){return {vertices:[],active:true,visible:true,destroys:0,
  setSize(){return this;},setOrtho(){return this;},setVisible(v){this.visible=v;return this;},
  setTexture(k,f){this.textureKey=k;this.frameName=f;return this;},setPosition(x,y){this.x=x;this.y=y;return this;},
  setScale(x,y){this.scaleX=x;this.scaleY=y;return this;},setDepth(d){this.depth=d;return this;},setAlpha(a){this.alpha=a;return this;},
  addVertices(coords,uvs){for(let i=0;i<coords.length;i+=2)this.vertices.push({x:coords[i],y:coords[i+1],
    setUVs(u,v){this.u=u;this.v=v;return this;}});return this;},
  destroy(){this.active=false;this.destroys++;}};}
test('one mesh replaces one upper cel; frame, tint, depth, pause and cleanup follow the owner',()=>{
  const mesh=fakeMesh(),scene={sys:{renderer:{gl:{}}},add:{mesh:()=>mesh}};
  const surface=new PerformerSecondarySurface(scene,'genya'),first=image();
  surface.present(first,0,0,0,false);assert.equal(first.visible,false);assert.equal(mesh.visible,true);
  surface.restore();assert.equal(first.visible,true);surface.present(first,100,25,0,false);
  assert.equal(mesh.textureKey,'walk');assert.equal(mesh.frameName,17);assert.equal(mesh.depth,12);assert.equal(mesh.alpha,.5);
  for(const v of mesh.vertices){assert.ok(v.u>=.25&&v.u<=.5);assert.ok(v.v>=.3&&v.v<=.368751);assert.equal(v.color,0xffb4c1);}
  const fixed=mesh.vertices.filter(v=>v.baseX===64&&v.baseY===48);assert.ok(fixed.length);
  for(const v of fixed){assert.equal(v.x,0);assert.equal(v.y,16);}
  const next=image();next.texture.key='hurt';next.frame.name=3;surface.restore();first.visible=false;
  surface.present(next,116,0,0,false);assert.equal(mesh.textureKey,'hurt');assert.equal(next.visible,false);assert.equal(first.visible,false);
  surface.setDepth(14);assert.equal(mesh.depth,14);
  surface.destroy();surface.destroy();assert.equal(mesh.destroys,1);assert.equal(next.visible,true);
});
test('Canvas and incomplete texture fixtures keep the original Image rendering',()=>{
  const surface=new PerformerSecondarySurface({add:{}},'kai'),source=image();
  surface.present(source,0,0,0,false);assert.equal(source.visible,true);assert.equal(surface.mesh,null);
  surface.destroy();surface.destroy();
});

const local=fileURLToPath(new URL('../',import.meta.url));
const root=existsSync(path.join(local,'package.json'))?local:'D:/STARUSH/03-\u7a0b\u5e8f';
const native=createRequire(path.join(root,'package.json')),{transformSync}=native('esbuild'),cache=new Map();
function load(file){
  const rel=path.relative(root,file),staged=path.join(local,rel);if(existsSync(staged))file=staged;
  if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const base=file.startsWith(local)?path.join(root,path.relative(local,path.dirname(file))):path.dirname(file);
  const require=id=>id.startsWith('.')?load(path.resolve(base,id)):native(id);
  vm.runInThisContext(`(function(require,module,exports){${transformSync(readFileSync(file,'utf8'),{format:'cjs',loader:'js'}).code}\n})`,{filename:file})(require,module,module.exports);
  return module.exports;
}
const {ActorPresentation}=load(path.join(root,'src/systems/ActorPresentation.mjs'));
function displayNode(x=0,y=0,key='',frame=0){
  const n={...image(),x,y,texture:{key},tintTopLeft:0xffffff,destroys:0};
  n.setFrame=f=>{n.frame={name:f,u0:0,u1:.25,v0:0,v1:1/12};return n;};n.setFrame(frame);
  n.setDisplaySize=()=>{n.scaleX=n.scaleY=.5;return n;};
  for(const [m,fields]of Object.entries({setPosition:['x','y'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tintTopLeft'],setAngle:['angle'],setRotation:['rotation'],setScale:['scaleX','scaleY']}))n[m]=function(...a){fields.forEach((f,i)=>this[f]=a[i]);return this;};
  for(const m of ['setOrigin','setScrollFactor','setCrop','fillStyle','fillCircle','lineStyle','strokeCircle'])n[m]=()=>n;
  n.destroy=()=>{n.active=false;n.destroys++;};return n;
}
test('actual ActorPresentation swaps locomotion/shot/hurt/turn on one surface and cleans it once',()=>{
  for(const id of ids){
    let meshCount=0;const mesh=fakeMesh();
    const scene={sys:{renderer:{gl:{}}},battleData:{stageId:1,performerId:id},player:{x:100,y:200,hp:5,active:true},playerGfx:displayNode(),
      battleRecord:{playerHitCount:0},publicPerformerRun:{actions:0,member:{id}},textures:{exists:()=>true},
      add:{image:displayNode,rectangle:displayNode,mesh:()=>{meshCount++;return mesh;}}};
    const actor=new ActorPresentation(scene),draw=t=>actor.drawPlayer(t,true,0xffffff);
    draw(0);scene.player.x-=4;draw(40);assert.equal(mesh.textureKey,`performer-${id}-turn`);
    actor.notifyBasicShot(45,1,0,333);draw(50);assert.equal(mesh.textureKey,`performer-${id}-basic`);
    scene.battleRecord.playerHitCount++;draw(60);assert.equal(mesh.textureKey,`performer-${id}-reactions`);
    const pose=mesh.frameName;scene._battlePaused=true;draw(500);assert.equal(mesh.frameName,pose);
    scene._battlePaused=false;draw(600);assert.equal(mesh.textureKey,`performer-${id}-walk`);
    for(const n of [actor.playerImage,actor.reactionImage,actor.basicShotImage,actor.turnImage])assert.equal(n.visible,false);
    assert.equal(meshCount,1);actor.setWorldDepth(10.52);assert.equal(mesh.depth,10.52);
    actor.destroy();actor.destroy();assert.equal(mesh.destroys,1);
  }
});
