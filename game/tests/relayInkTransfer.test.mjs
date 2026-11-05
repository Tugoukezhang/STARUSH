import test from 'node:test';import assert from 'node:assert/strict';
import {RelayInkTransfer,RELAY_TRANSFER_ART} from '../src/systems/RelayInkTransfer.mjs';
function fixture(){const images=[];let now=1000;const s={_userCastPresentation:true,player:{active:true,hp:5},publicPerformerRun:{now:()=>now},oldStreet:{clearLine:()=>true},textures:{exists:()=>true},add:{image(x,y,key,frame){const n={x,y,key,frame,active:true,setOrigin(x,y){this.origin=[x,y];return this;},setDisplaySize(w,h){this.width=w;this.height=h;return this;},setRotation(v){this.rotation=v;return this;},setAlpha(v){this.alpha=v;return this;},setDepth(v){this.depth=v;return this;},setFrame(v){this.frame=v;return this;},destroy(){this.active=false;}};images.push(n);return n;}}};return{s,images,fx:new RelayInkTransfer(s),setTime:v=>now=v};}
const receipt=(color='pink')=>({from:{x:500,y:600},x:600,y:630,color});
test('accepted trace uses authored palette frames and immutable endpoints without tint or target tracking',()=>{
 for(const [bank,color]of RELAY_TRANSFER_ART.palettes.entries()){const f=fixture(),p=receipt(color);assert(f.fx.add(p));const row=f.fx.rows[0],n=row.node;assert.equal(n.frame,bank*4);assert.equal(n.key,RELAY_TRANSFER_ART.key);assert.equal(n.x,550);assert.equal(n.y,615);assert.equal(n.width,Math.hypot(100,30)*512/480);assert(n.height<=34);p.x=900;p.from.x=300;f.setTime(1080);f.fx.update();assert.equal(n.x,550);assert.equal(row.from.x,500);assert.equal(row.x,600);assert.equal(n.frame,bank*4+1);assert.equal(n.alpha,.9);assert.equal(n.depth,6);}
});
test('short, reversed, invalid pigment, over-range, covered or missing-art traces cannot fabricate transfer',()=>{
 const f=fixture();for(const p of[{...receipt(),x:500,y:600},{...receipt(),x:700},{...receipt(),x:NaN},receipt('red'),{x:600,y:630,color:'pink'}])assert.equal(f.fx.add(p),false);assert.equal(f.images.length,0);
 f.s.oldStreet.clearLine=()=>false;assert.equal(f.fx.add(receipt()),false);f.s.oldStreet.clearLine=()=>true;f.s.textures.exists=()=>false;assert.equal(f.fx.add(receipt()),false);assert.equal(f.images.length,0);
 f.s.textures.exists=()=>true;assert(f.fx.add({from:{x:600,y:630},x:500,y:600,color:'pink'}));assert(f.images[0].rotation<0);
});
test('four-trace cap, phase progression, pause, expiry and death cleanup do not own gameplay or timers',()=>{
 const f=fixture();for(let i=0;i<100;i++)assert(f.fx.add(receipt()));assert.equal(f.fx.rows.length,4);assert.equal(f.images.filter(n=>n.active).length,4);
 const n=f.fx.rows[0].node;f.s._battlePaused=true;f.setTime(1180);f.fx.update();assert.equal(n.frame,0);f.s._battlePaused=false;f.setTime(1180);f.fx.update();assert.equal(n.frame,2);
 f.setTime(1300);f.fx.update();assert.equal(f.fx.rows.length,0);assert(f.images.every(n=>!n.active));assert(f.fx.add(receipt()));f.s.player.hp=0;f.fx.update();assert.equal(f.fx.rows.length,0);assert.equal(f.fx.add(receipt()),false);f.fx.clear();f.fx.clear();
});
