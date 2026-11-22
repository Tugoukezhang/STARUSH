import test from 'node:test';import assert from 'node:assert/strict';
import {PrismOpening,PRISM_GARDEN as MAP,prismWalkable,prismClearLine} from '../src/utils/prismOpening.mjs';
const tick=(r,ms,input={x:0,y:0})=>{for(let t=0;t<ms;t+=20)r.update(Math.min(20,ms-t),input);};
const walk=(r,x,y)=>{for(let i=0;i<600&&Math.hypot(r.player.x-x,r.player.y-y)>4;i++)r.update(20,{x:x-r.player.x,y:y-r.player.y});assert(Math.hypot(r.player.x-x,r.player.y-y)<5,'walk reached target');};
test('all three owners can finish through public movement/rotation/attack methods without state injection',()=>{
 for(const member of ['sakura','kai','enjo']){const r=new PrismOpening(member);assert.equal(r.rotate(),false);r.start();assert.equal(r.rotate(),false);walk(r,88,480);walk(r,88,425);assert(r.rotate());walk(r,88,344);walk(r,188,344);r.action();tick(r,1600);assert(r.kills>=1);walk(r,285,280);r.rotate();r.rotate();tick(r,2500);assert(r.gateOpen);assert.equal(r.phase,'playing');for(let i=0;i<300&&r.phase==='playing';i++)r.update(20,{x:188-r.player.x,y:185-r.player.y});assert.equal(r.phase,'complete');assert.equal(r.turns,3);assert(r.player.hp>0);const s=r.snapshot();tick(r,1000,{x:1,y:1});assert.deepEqual(r.snapshot(),s);assert.equal(r.action(),false);}
});
test('wrong angles, obstruction, range and broken light cannot produce a gate; exit alone is insufficient',()=>{
 const r=new PrismOpening();r.start();r.player={x:188,y:185,hp:3};tick(r,4000);assert.equal(r.phase,'playing');assert.equal(r.gateOpen,false);assert.equal(r.rotate(),false);
 r.player={x:88,y:425,hp:3};r.rotate();r.player={x:285,y:280,hp:3};r.rotate();tick(r,100);assert.equal(r.lightMs,0);r.rotate();r.update(20);assert.equal(r.lightMs,0);assert(r.enemy.hp>0);
 r.enemy.hp=0;r.enemy.awake=true;r.enemy.reviveAt=r.time+6500;tick(r,900);assert(r.lightMs>0);r.rotate();assert.equal(r.lightMs,0);tick(r,3000);assert.equal(r.gateOpen,false);
});
test('pause freezes optical, hazard and skill clocks; resume does not discard locked hazard',()=>{
 const r=new PrismOpening('kai');r.start();r.player={x:88,y:425,hp:3};r.rotate();tick(r,1000);assert.equal(r.hazard().state,'warning');r.action({x:0,y:-1});r.pause();const before=r.snapshot();tick(r,12000,{x:1,y:0});assert.equal(r.rotate(),false);assert.equal(r.action(),false);assert.deepEqual(r.snapshot(),before);r.resume();r.update(20);assert.equal(r.time,before.time+20);
});
test('warning is harmless, each attack damages once, natural inactivity fails, failure is terminal',()=>{
 const r=new PrismOpening('enjo');r.start();walk(r,88,480);walk(r,88,425);r.rotate();tick(r,1800);assert.equal(r.hits,0);tick(r,700);assert.equal(r.hits,1);tick(r,8500);assert.equal(r.phase,'failed');assert.equal(r.hits,3);const before=r.snapshot();tick(r,5000);assert.deepEqual(r.snapshot(),before);assert.equal(r.start(),false);assert.equal(r.resume(),false);
});
test('wall blocks walking/dash and line of fire; malformed delta/input cannot teleport',()=>{
 assert(!prismWalkable({x:188,y:402}));assert(!prismClearLine({x:188,y:500},{x:188,y:344}));const r=new PrismOpening('kai');r.start();r.player={x:188,y:450,hp:3};r.move(0,-1,400);assert(r.player.y>=434);r.action({x:0,y:-1});tick(r,300);assert(r.player.y>=434);const p={...r.player};r.update(NaN,{x:1,y:1});r.update(Infinity,{x:1,y:1});r.update(20,{x:NaN,y:Infinity});assert.deepEqual(r.player,p);
});
test('new attempt resets all transient state and invalid role falls back; no shared mutable mirrors',()=>{
 const a=new PrismOpening('unsupported'),b=new PrismOpening('enjo');assert.equal(a.memberId,'sakura');a.mirrors[0].angle=2;a.player.hp=0;assert.equal(b.mirrors[0].angle,0);assert.equal(b.player.hp,3);assert.equal(MAP.mirrors[0].correct,1);assert.equal(b.phase,'ready');
});
