import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import * as api from '../src/systems/SakuraLayeredPresentation.mjs';
import {SAKURA_SECONDARY_ART} from '../src/systems/SakuraSecondaryMotion.mjs';
import {SAKURA_SECONDARY_REGISTRATION} from '../src/systems/SakuraSecondaryRegistration.mjs';

test('all sixty upper cels have registered parts and bounded mobile atlases',()=>{
 assert.equal(Object.keys(SAKURA_SECONDARY_REGISTRATION).length,60);let bytes=0;
 for(const art of Object.values(SAKURA_SECONDARY_ART)){
  const data=fs.readFileSync(new URL('../public/'+art.path,import.meta.url)),w=data.readUInt32BE(16),h=data.readUInt32BE(20);
  assert.ok(w<=2048&&h<=2048);assert.equal(data[25],6);assert.equal(w%art.frameWidth,0);assert.equal(h%art.frameHeight,0);
  assert.ok(w/art.frameWidth*h/art.frameHeight>=300);bytes+=w*h*4;
 }
 assert.ok(bytes<=24*1024*1024);
});

test('secondary motion is driven by realized displacement, settles and does not mutate physics',()=>{
 assert.equal(typeof api.advanceSakuraSecondary,'function','missing independent attachment motion');
 const s={};const advance=(dt,dx=0,dy=0,attack=null,yaw=0)=>api.advanceSakuraSecondary(s,dt,dx,dy,attack,yaw);
 advance(0);for(let i=0;i<60;i++)advance(1000/60);
 assert.equal(s.secondary.hair,0);assert.equal(s.secondary.hem,0);
 for(let i=0;i<24;i++)advance(1000/60,4);
 assert.ok(s.secondary.hair<-4);assert.ok(Math.abs(s.secondary.hair)<=8);
 const start=s.secondary.hair;advance(1000/60,-4);assert.ok(Math.abs(s.secondary.hair-start)<2,'no reversal snap');
 for(let i=0;i<90;i++)advance(1000/60);
 assert.ok(Math.abs(s.secondary.hair)<.01);assert.ok(Math.abs(s.secondary.hem)<.01);
});

test('rate-independent damping, bounded action/turn interruption and teleport reset',()=>{
 assert.equal(typeof api.advanceSakuraSecondary,'function');
 const snapshots=[];
 for(const hz of [30,60,120]){const s={};api.advanceSakuraSecondary(s,0,0,0,null,0);
  for(let i=0;i<hz;i++)api.advanceSakuraSecondary(s,1000/hz,240/hz,0,null,0);
  snapshots.push(s.secondary.hair);
  for(let i=0;i<100;i++){api.advanceSakuraSecondary(s,1000/hz,-240/hz,0,{direction:'right',phase:'release'},i%8);assert.ok(Math.abs(s.secondary.hair)<=8);}
  api.advanceSakuraSecondary(s,16,900,0,null,0);assert.equal(s.secondary.hair,0);
 }
 assert.ok(Math.max(...snapshots)-Math.min(...snapshots)<.01);
});

function image(x,y,key,frame){const n={x,y,texture:{key},frame,active:true};
 for(const [method,keys] of Object.entries({setDisplaySize:['width','height'],setPosition:['x','y'],setOrigin:['originX','originY'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint'],setRotation:['rotation'],setScale:['scaleX','scaleY'],setFrame:['frame']}))n[method]=function(...v){keys.forEach((k,i)=>this[k]=v[i]??v[0]);return this;};
 n.setTexture=function(k,f){this.texture.key=k;this.frame=f;return this;};n.destroy=function(){this.active=false;this.destroyCount=(this.destroyCount||0)+1;};return n;
}

test('all upper banks share registered separate nodes, pause/tint/alpha and idempotent disposal',()=>{
 const scene={player:{x:160,y:400,body:{radius:4}},playerGfx:{alpha:.6},textures:{exists:()=>true},add:{image}};
 const v=new api.SakuraLayeredPresentation(scene);v.update(0,0,0,null,false);
 assert.equal(v.secondaryNodes?.length,2,'hair and hem need independent render nodes');
 const body=structuredClone(scene.player.body),ids=[...v.secondaryNodes];
 const dirs=['down','left','right','up'];let time=0;
 for(const direction of dirs)for(const phase of ['windup','release','recover']){
  scene.player.x+=2;v.update(time+=16,2,0,{direction,phase,progress:.4},false);
  assert.ok(v.secondaryNodes.every(n=>n.alpha===.6&&Number.isInteger(n.frame)&&n.frame>=0&&n.frame<300));
  assert.equal(v.upperBlend.alpha,0);
 }
 const saved=structuredClone(v.state);v.update(time+=8000,0,0,null,true);assert.deepEqual(v.state,saved);
 v.update(time+=16,0,0,null,false,true,1);assert.ok(v.secondaryNodes.every(n=>n.tint===0xFFD1D9));
 assert.deepEqual(scene.player.body,body);assert.deepEqual(v.secondaryNodes,ids);
 v.destroy();v.destroy();assert.ok(ids.every(n=>!n.active&&n.destroyCount===1));
});
