import test from'node:test';import assert from'node:assert/strict';
import {UserWeaponFx}from'../src/systems/UserWeaponFx.mjs';
function setup(){let time=500;const nodes=[];const scene={_userCastPresentation:true,player:{x:0,y:0,hp:5,active:true},publicPerformerRun:{now:()=>time},textures:{exists:()=>true},oldStreet:{clearLine:()=>true},add:{image(x,y,key,frame){const n={x,y,key,frame,active:true,setOrigin(){return this},setDisplaySize(w,h){this.w=w;this.h=h;return this},setTint(){return this},setAlpha(v){this.alpha=v;return this},setDepth(){return this},setRotation(v){this.rotation=v;return this},setFrame(v){this.frame=v;return this},destroy(){this.active=false}};nodes.push(n);return n;}}};return{scene,fx:new UserWeaponFx(scene,'sakura'),nodes,at:v=>time=v};}
test('eight flight headings select authored projected banks, never rotate the flattened ground raster upright',()=>{
 for(let bank=0;bank<8;bank++){const f=setup(),angle=bank*Math.PI/4;assert(f.fx.impact({x:100,y:100,radius:108,color:'pink',angle,deposition:true}));const n=f.nodes[0];assert.equal(n.rotation,0);assert.equal(n.frame,bank*6);f.at(600);f.fx.update(600,{depth:12});assert.equal(n.frame,bank*6+2);assert.equal(f.fx.lastFrame[0].frame,2);assert.equal(f.fx.lastFrame[0].angle,angle);}
});
test('tight cover retries one smaller ground spread instead of silently losing an otherwise drawable landing',()=>{
 const f=setup();f.scene.oldStreet.clearLine=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<=20;
 assert(f.fx.impact({x:100,y:100,radius:108,color:'pink',deposition:true}));assert.equal(f.nodes.length,1);assert(f.nodes[0].w*.43<=20+.001);assert.equal(f.fx.stats.ground,1);
});
