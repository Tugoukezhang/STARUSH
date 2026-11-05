import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EventEmitter} from 'node:events';
import {beginSceneLoading} from '../src/systems/GameLoadRecovery.mjs';
import {UserWeaponFx,USER_WEAPON_FX,preloadUserWeaponFx} from '../src/systems/UserWeaponFx.mjs';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {attackPaintPolygon} from '../src/systems/StreetRestorationSurface.mjs';
const url=new URL('../src/systems/GraffitiPaintBrush.mjs',import.meta.url),brushModule=fs.existsSync(url)?await import(url):{};
const alpha=(r,x,y)=>r.pixels[(Math.floor(y/2)*r.pixelWidth+Math.floor(x/2))*4+3];
const brush={sample:(u,v,ink=false)=>ink?0:u<.5&&v>.1&&v<.9?1:0};
test('ground consumes authored alpha holes instead of the former smooth radial function',()=>{
 const r=new StreetPigmentRaster(256,128,null,.9,brush);assert(r.stamp(128,64,50,0x00ced1));assert(alpha(r,110,64)>0);assert.equal(alpha(r,145,64),0);const before=r.pixels.slice();r.consumeDirty();assert.equal(r.stamp(128,64,50,0x00ced1),false);assert.deepEqual(r.pixels,before);assert.equal(r.consumeDirty(),null);
});
test('authored ground retains actual radius growth and clips both buildings and hidden rays',()=>{
 const paint=radius=>{const r=new StreetPigmentRaster(256,128,null,.9,brush);r.stamp(128,64,radius,0x00ced1);return r;};
 const small=paint(24),wide=paint(64),count=r=>r.pixels.filter((v,i)=>i%4===3&&v>0).length;assert(count(wide)>count(small)*2);
 const r=new StreetPigmentRaster(256,128,null,.9,brush),blockers=[{footprint:{x:105,y:40,width:8,height:48}}];r.stamp(128,64,60,0x00ced1,blockers);assert.equal(alpha(r,108,64),0);assert.equal(alpha(r,90,64),0);assert(alpha(r,120,64)>0);assert.equal(alpha(r,55,64),0);
});
test('fan samples the authored brush while preserving the original clipped attack polygon',()=>{
 const b={sample:(u,v,ink=false)=>ink?0:u>.65&&Math.abs(v-.5)<.4?1:0},r=new StreetPigmentRaster(256,128,null,.9,b),fan={x:40,y:64,angle:0,halfAngle:Math.PI/6,radius:128},points=attackPaintPolygon(fan),before=structuredClone(points);
 r.fan(fan,points,0xff69b4);assert.equal(alpha(r,65,64),0);assert(alpha(r,145,64)>0);assert.equal(alpha(r,100,115),0);assert.deepEqual(points,before);
});
test('bitmap sampler retains transparent gaps and source dark ink, never inventing an opaque brush',()=>{
 assert.equal(typeof brushModule.createGraffitiBrush,'function');const data=new Uint8ClampedArray(32*8*4);for(let y=0;y<8;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4;data.set([255,220,0,255],i);}data[(4*32+4)*4+3]=0;data.set([10,10,20,255],(2*32+2)*4);
 const b=brushModule.createGraffitiBrush({data,width:32,height:8},'sakura');assert.equal(b.sample(.55,.55),0);assert.equal(b.sample(.3,.3),1);assert(b.sample(.3,.3,true)>.5);assert.equal(b.sample(2,.3),0);
});
test('three graffiti families have six stages and default Sakura queues legacy plus compact bitmap ground',()=>{
 for(const kind of ['spray','sweep','burst','impact']){const a=USER_WEAPON_FX[kind];assert(a.path.startsWith('art/graffiti-combat-20261018/'));assert.equal(a.frames,6);assert(Array.isArray(a.origin));assert(a.extent>0&&a.extent<1);}
 const sheets=[],images=[];preloadUserWeaponFx({load:{spritesheet:(...a)=>sheets.push(a),image:(...a)=>images.push(a)}});assert.equal(sheets.length,4);assert.deepEqual(images,[['graffiti-ground','art/comic-ground-ribbons-20261022/ground-v2.png'],['compact-pool-ground','art/rounded-ink-footprint-20261029/pool.png'],['three-cast-comic-material','art/comic-ink-planes-20261029/body.png']]);
});
test('neutral same-pigment hammer release is one bounded burst, not six duplicated jets',()=>{
 const nodes=[],s={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},publicPerformerRun:{now:()=>500},oldStreet:{clearLine:()=>true},textures:{exists:()=>true},add:{image(x,y,key){const n={x,y,key,setOrigin(){return this;},setDisplaySize(){return this;},setTint(v){this.tint=v;return this;},setAlpha(){return this;},setRotation(){return this;},setDepth(){return this;},destroy(){}};nodes.push(n);return n;}}},fx=new UserWeaponFx(s,'enjo');
 assert(fx.release({x:100,y:100,radius:190,start:500,color:'orange'}));assert.equal(nodes.length,1);assert.equal(nodes[0].tint,0xffffff);assert.equal(fx.rows[0].frameOffset,24);assert.equal(fx.rows[0].sourceRadius,190);fx.destroy();
});

test('repeating one overlapping same-color brush batch does not rewrite ink or dirty the texture',()=>{
 const b={sample:(u,v,ink=false)=>ink?(u<.5?1:0):1},r=new StreetPigmentRaster(256,128,null,.9,b);
 const batch=()=>{r.stamp(120,64,35,0x00ced1);r.stamp(132,64,35,0x00ced1);r.stamp(126,72,35,0x00ced1);};batch();r.consumeDirty();const before=r.pixels.slice();batch();assert.deepEqual(r.pixels,before);assert.equal(r.consumeDirty(),null);
 r.stamp(120,64,35,0xff69b4);assert(r.consumeDirty(),'a genuinely new pigment color must still repaint');r.destroy();assert.equal(r.paintColors,null);
});

test('decoded but malformed ground atlas enters existing load recovery, not an old-circle fallback',()=>{
 const load=new EventEmitter(),events=new EventEmitter();let present=false,removed=false;load.spritesheet=()=>{};load.image=()=>{};
 const s={load,events,textures:{exists:()=>present,get:()=>({getSourceImage:()=>({width:256,height:256})}),remove(){removed=true;present=false;}}};
 const state=beginSceneLoading(s,{start(){},fail(){}});preloadUserWeaponFx(s);present=true;load.emit('filecomplete-image-graffiti-ground');assert.equal(state.failed,true);assert(removed);events.emit('shutdown');
});
