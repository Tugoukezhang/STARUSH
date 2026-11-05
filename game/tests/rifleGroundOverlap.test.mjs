import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {createGraffitiBrush} from '../src/systems/GraffitiPaintBrush.mjs';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const decode=async()=>{const {data,info}=await sharp(fs.readFileSync(new URL('../public/art/comic-ground-clean-20261022/ground.png',import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data,width:info.width,height:info.height};};
function fixture(enabled=true){let alpha=255,tone=0;const brush={mergeOpaque:enabled,sample:(_u,_v,ink)=>ink?0:alpha/255,tone:()=>tone},r=new StreetPigmentRaster(40,40,null,.9,brush);return {r,set:(a,t)=>{alpha=a;tone=t;},pixel:()=>Array.from(r.pixels.slice((10*20+10)*4,(10*20+10)*4+4))};}

test('opaque merging is explicit and rifle-only; historical/default and other members keep old policy',async()=>{
 const img=await decode();assert.equal(createGraffitiBrush(img,'sakura').mergeOpaque,false);assert.equal(createGraffitiBrush(img,'sakura',true).mergeOpaque,true);
 for(const id of ['kai','enjo','venus'])assert.equal(createGraffitiBrush(img,id,true).mergeOpaque,false);
});
test('same-color near-opaque light body can cover old dark rim at alpha254 vs255 without changing max coverage or owner',()=>{
 const f=fixture();f.r.stamp(20,20,12,0xff69b4);const dark=f.pixel(),owners=f.r.paintColors.slice(),alpha=f.r.pixels.filter((_,i)=>i%4===3);f.r.consumeDirty();
 f.set(254,1);assert(f.r.stamp(20,20,12,0xff69b4));assert(f.pixel()[0]>dark[0]+50);assert.equal(f.pixel()[3],255);
 assert.deepEqual(f.r.pixels.filter((_,i)=>i%4===3),alpha);assert.deepEqual(f.r.paintColors,owners);assert(f.r.consumeDirty());
 f.set(255,0);assert.equal(f.r.stamp(20,20,12,0xff69b4),false,'new rim must not dirty an already light body');assert.equal(f.r.consumeDirty(),null);
});
test('different color still takes ownership and writes its own material',()=>{
 const f=fixture();f.set(255,1);f.r.stamp(20,20,12,0xff69b4);const pink=f.pixel();f.set(254,0);assert(f.r.stamp(20,20,12,0x00ced1));
 assert.notDeepEqual(f.pixel().slice(0,3),pink.slice(0,3));assert.equal(f.r.paintColors[210],0x00ced1);assert.equal(f.pixel()[3],255,'coverage max survives the new color');
});
test('partial edges below240 and disabled brushes preserve the exact original keep-first rule',()=>{
 for(const enabled of [false,true]){const f=fixture(enabled);f.set(239,0);f.r.stamp(20,20,12,0xff69b4);const a=f.r.pixels.slice();f.set(239,1);assert.equal(f.r.stamp(20,20,12,0xff69b4),false);assert.deepEqual(f.r.pixels,a);}
 const f=fixture(false);f.r.stamp(20,20,12,0xff69b4);const a=f.r.pixels.slice();f.set(254,1);assert.equal(f.r.stamp(20,20,12,0xff69b4),false);assert.deepEqual(f.r.pixels,a);
});
test('same240 threshold is inclusive, retains coverage maxima and is idempotent',()=>{
 const f=fixture();f.set(240,0);f.r.stamp(20,20,12,0xff69b4);f.set(240,1);assert(f.r.stamp(20,20,12,0xff69b4));assert.equal(f.pixel()[3],240);const a=f.r.pixels.slice();f.r.consumeDirty();assert.equal(f.r.stamp(20,20,12,0xff69b4),false);assert.deepEqual(f.r.pixels,a);assert.equal(f.r.consumeDirty(),null);
});
test('real authored108-stamp trail removes trapped ink while legacy alpha/paint owners remain byte-identical',async()=>{
 const img=await decode(),make=enabled=>new StreetPigmentRaster(300,180,null,.9,createGraffitiBrush(img,'sakura',enabled)),a=make(false),b=make(true),saved=img.data.slice();
 for(let x=45;x<=255;x+=6)for(const y of [70,90,110])for(const r of [a,b])r.stamp(x,y,42,0xff69b4);
 assert.deepEqual(b.pixels.filter((_,i)=>i%4===3),a.pixels.filter((_,i)=>i%4===3));assert.deepEqual(b.paintColors,a.paintColors);
 let repaired=0;for(let i=0;i<b.pixels.length;i+=4)if(b.pixels[i+3]>=128&&b.pixels[i]-a.pixels[i]>50)repaired++;assert(repaired>1000,'actual dark rim pixels repaired: '+repaired);
 const once=b.pixels.slice();b.consumeDirty();for(let x=45;x<=255;x+=6)for(const y of [70,90,110])b.stamp(x,y,42,0xff69b4);assert.deepEqual(b.pixels,once);assert.equal(b.consumeDirty(),null);assert.deepEqual(img.data,saved);
});
