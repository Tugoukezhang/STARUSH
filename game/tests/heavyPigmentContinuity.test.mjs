import {BLUE_SPELL_FX} from '../src/utils/blueAcademyArt.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import{UserWeaponFx,HEAVY_COMIC_LANDING,RIFLE_PIGMENT_DEPOSITION}from'../src/systems/UserWeaponFx.mjs';
import{COLOR_HEX}from'../src/utils/config.js';
function fixture(bank=true){const nodes=[],scene={_userCastPresentation:true,player:{active:true,hp:5},publicPerformerRun:{now:()=>500},oldStreet:{clearLine:()=>true},textures:{exists:k=>bank||k!==HEAVY_COMIC_LANDING.key,getFrame:(_k,f)=>({name:f,width:256,height:256})},add:{image(x,y,key,frame){const n={x,y,key,frame,active:true};for(const method of['setOrigin','setDisplaySize','setAlpha','setRotation','setDepth','setPosition','setVisible','setFrame'])n[method]=()=>n;n.setTint=v=>{n.tint=v;return n;};n.destroy=()=>{n.active=false;};nodes.push(n);return n;}}};return{nodes,fx:new UserWeaponFx(scene,'enjo')};}
test('the confirmed book-mage keeps her illustrated impact and deposits the actual ground pigment',()=>{
 for(const [color,hex] of Object.entries(COLOR_HEX)){
  const {fx}=fixture();assert(fx.impact({x:100,y:100,radius:32,color,hit:true,deposition:true,contacts:[{kind:'enemy',x:108,y:99}]}));
  const deposit=fx.rows.find(row=>row.kind==='deposition'),contact=fx.rows.find(row=>row.kind==='impact');
  assert.equal(deposit.node.key,RIFLE_PIGMENT_DEPOSITION.key);assert.equal(deposit.pigment,hex);assert.equal(deposit.node.tint,hex);
  assert.equal(contact.node.key,BLUE_SPELL_FX.key);assert.equal(contact.node.tint,0xffffff);
  assert.deepEqual([contact.x,contact.y],[108,99]);assert.equal(fx.contactFragments.rows[0].color,hex);
 }
});
test('the confirmed spell uses its own art when the archived hammer bank is absent',()=>{
 const {fx}=fixture(false);fx.impact({x:100,y:100,radius:32,color:'orange',hit:true,deposition:true});
 assert(fx.rows.every(r=>r.node.key!==HEAVY_COMIC_LANDING.key));
 assert.equal(fx.rows.find(r=>r.kind==='impact').node.key,BLUE_SPELL_FX.key);
});
test('inherited names and absent pigments retain the neutral fallback, never a non-color tint',()=>{
 for(const color of ['constructor','toString','__proto__','unknown',undefined]){const{fx}=fixture();assert(fx.impact({x:100,y:100,radius:32,color,hit:true}));assert(fx.rows.every(r=>r.node.tint===0xffffff));}
});
