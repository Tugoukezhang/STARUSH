import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import * as FX from '../src/systems/UserWeaponFx.mjs';
const {USER_WEAPON_FX,HEAVY_WEAPON_FX,preloadUserWeaponFx}=FX;
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const path='art/hammer-comic-contact-20261022/burst.png';
test('ordinary confirmed hammer contact gets its own six-cel source without replacing shared burst, impact or heavy release',()=>{
 assert.equal(FX.HAMMER_COMIC_CONTACT?.path,path);assert.equal(USER_WEAPON_FX.burst.path,'art/graffiti-combat-20261018/burst.webp');assert.equal(USER_WEAPON_FX.burst.frames,6);assert.equal(USER_WEAPON_FX.burst.duration,360);assert.equal(USER_WEAPON_FX.impact.duration,220);
 assert.deepEqual(USER_WEAPON_FX.burst.origin,[.5,.625]);assert.equal(USER_WEAPON_FX.burst.extent,.469);
 assert.equal(USER_WEAPON_FX.impact.path,'art/graffiti-combat-20261018/burst.webp');assert.equal(HEAVY_WEAPON_FX.path,'art/heavy-palette-impact-20261029/impact.png');
});
test('only exact ordinary source is admitted in payload',()=>{assert.equal(RUNTIME_PAYLOAD.filter(x=>x.file===path&&x.group==='owner-weapon-fx').length,1);assert.ok(RUNTIME_PAYLOAD.some(x=>x.file==='art/graffiti-combat-20261018/burst.webp'));});
test('ordinary source has real alpha, safe contact radius and distinct evolving cels',async()=>{
 const file=new URL('../public/'+path,import.meta.url);assert.ok(fs.existsSync(file));
 const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
 const {data,info}=await sharp(fileURLToPath(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height],[1536,256]);
 const sizes=[],hashes=[];for(let f=0;f<6;f++){let n=0;const bytes=[];for(let y=0;y<256;y++)for(let x=0;x<256;x++){const p=(y*1536+f*256+x)*4;bytes.push(...data.subarray(p,p+4));if(data[p+3]){n++;assert.ok(Math.hypot(x-128,y-160)<=256*.469);assert.ok(x>0&&x<255&&y>0&&y<255);}}sizes.push(n);hashes.push(crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex'));}
 assert.equal(new Set(hashes).size,6);assert.ok(sizes[0]<sizes[1]&&sizes[1]<sizes[2]&&sizes[3]>sizes[4]&&sizes[4]>sizes[5]);assert.ok(sizes[5]<sizes[2]*.15);
});
test('contact bank loads only for Enjo and preserves all common banks',()=>{for(const id of ['sakura','kai','enjo',undefined]){const calls=[];preloadUserWeaponFx({load:{spritesheet:(...a)=>calls.push(a),image(){}}},id);assert.equal(calls.filter(x=>x[1]===path).length,id==='enjo'?1:0);assert.equal(calls.find(x=>x[0]===USER_WEAPON_FX.burst.key)?.[1],USER_WEAPON_FX.burst.path);}});
function fixture(id='enjo',missing=false){let time=500;const nodes=[];const scene={_userCastPresentation:true,player:{x:100,y:100,hp:6,active:true},publicPerformerRun:{now:()=>time},oldStreet:{clearLine:()=>true},textures:{exists:k=>!missing||k!=='user-hammer-contact-20261022'},add:{image(x,y,key,frame=0){const n={x,y,key,frame,dead:0,setOrigin(x,y=x){this.origin=[x,y];return this;},setDisplaySize(w,h){this.width=w;this.height=h;return this;},setTint(){return this;},setAlpha(a){this.alpha=a;return this;},setDepth(d){this.depth=d;return this;},setRotation(a){this.angle=a;return this;},setFrame(f){this.frame=f;return this;},destroy(){this.dead++;}};nodes.push(n);return n;}}};return {fx:new FX.UserWeaponFx(scene,id),nodes,at(t){time=t;this.fx.update(t,{depth:9.8});}};}
test('only accepted ordinary Enjo hits select new contact, with old 220ms lifetime and existing cap',()=>{const f=fixture();assert(f.fx.impact({x:120,y:130,hit:true}));assert.equal(f.nodes[0].key,'user-hammer-contact-20261022');assert.deepEqual(f.nodes[0].origin,[.5,.625]);f.at(550);assert.equal(f.nodes[0].frame,2);f.at(720);assert.equal(f.nodes[0].dead,1);f.fx.destroy();assert.equal(f.nodes[0].dead,1);});
test('projectile, emission, missed ground, heavy, missing source and other actors remain on original banks',()=>{for(const id of ['enjo','kai','sakura']){const f=fixture(id);assert.notEqual(f.fx.projectileVisual(100,100).node.key,'user-hammer-contact-20261022');f.fx.shot({active:true,paintShot:true,x:100,y:100,moveVx:1,moveVy:0},500);f.fx.impact({x:100,y:100,hit:false});f.fx.release({x:100,y:100,radius:100,start:500,contacts:[{x:110,y:100}]});assert(f.nodes.every(n=>n.key!=='user-hammer-contact-20261022'));}const f=fixture('enjo',true);f.fx.impact({x:100,y:100,hit:true});assert.equal(f.nodes[0].key,USER_WEAPON_FX.burst.key);});
import {fileURLToPath} from 'node:url';
