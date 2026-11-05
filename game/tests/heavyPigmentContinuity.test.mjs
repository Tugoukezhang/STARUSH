import test from 'node:test';import assert from 'node:assert/strict';
import{UserWeaponFx,HEAVY_COMIC_LANDING}from'../src/systems/UserWeaponFx.mjs';
import{COLOR_HEX}from'../src/utils/config.js';
function fixture(bank=true){const nodes=[],scene={_userCastPresentation:true,player:{active:true,hp:5},publicPerformerRun:{now:()=>500},oldStreet:{clearLine:()=>true},textures:{exists:k=>bank||k!==HEAVY_COMIC_LANDING.key,getFrame:(_k,f)=>({name:f,width:256,height:256})},add:{image(x,y,key,frame){const n={x,y,key,frame,active:true};for(const method of['setOrigin','setDisplaySize','setAlpha','setRotation','setDepth','setPosition','setVisible','setFrame'])n[method]=()=>n;n.setTint=v=>{n.tint=v;return n;};n.destroy=()=>{n.active=false;};nodes.push(n);return n;}}};return{nodes,fx:new UserWeaponFx(scene,'enjo')};}
test('ordinary heavy contact and low spread use the actual pigment, not fixed white or member hue',()=>{
 for(const[color,hex]of Object.entries(COLOR_HEX)){const{fx}=fixture();assert(fx.impact({x:100,y:100,radius:32,color,hit:true,deposition:true}));const rows=fx.rows.filter(r=>r.node.key===HEAVY_COMIC_LANDING.key);assert.equal(rows.length,2);assert(rows.every(r=>r.node.tint===hex),color);assert.deepEqual(rows.map(r=>r.frameOffset),[4,0]);}
});
test('neutral bank has an explicit versioned path; legacy fallback remains unmodified white',()=>{
 assert.equal(HEAVY_COMIC_LANDING.path,'art/heavy-pigment-contact-20261029/landing.webp');
 const{fx}=fixture(false);fx.impact({x:100,y:100,radius:32,color:'orange',hit:true,deposition:true});assert(fx.rows.every(r=>r.node.key!==HEAVY_COMIC_LANDING.key));assert(fx.rows.filter(r=>r.kind==='impact').every(r=>r.node.tint===0xffffff));
});
test('inherited names and absent pigments retain the neutral fallback, never a non-color tint',()=>{
 for(const color of ['constructor','toString','__proto__','unknown',undefined]){const{fx}=fixture();assert(fx.impact({x:100,y:100,radius:32,color,hit:true}));assert(fx.rows.every(r=>r.node.tint===0xffffff));}
});
