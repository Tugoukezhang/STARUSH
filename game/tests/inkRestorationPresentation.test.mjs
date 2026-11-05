import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {FacilityCompletionFx,FACILITY_RESTORATION_POP} from '../src/systems/FacilityCompletionFx.mjs';import {SHARED_COMIC_MATERIAL} from '../src/systems/GraffitiPaintBrush.mjs';import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const req=createRequire(import.meta.url),Events=req('phaser/src/events/EventEmitter.js'),sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const cue='art/facility-ink-seal-20261029/pop.png',body='art/comic-ink-planes-20261029/body.png';
function world(member='orange'){
 const nodes=[],events=new Events(),scene={_userCastPresentation:true,battleData:{stageId:1},_isPublicStage1Round:()=>true,publicPerformerRun:{now:()=>1000,member:{color:member}},events,textures:{exists:()=>true},add:{image(x,y,key,frame){const n={x,y,key,frame,setOrigin(){return n;},setDisplaySize(){return n;},setDepth(){return n;},setTint(c){n.tint=c;return n;},setFrame(){return n;},destroy(){n.destroyed=true;}};nodes.push(n);return n;}}};return{fx:new FacilityCompletionFx(scene),scene,nodes};
}
const active=()=>{assert.equal(FACILITY_RESTORATION_POP.path,cue);assert.equal(SHARED_COMIC_MATERIAL.path,body);};
test('two exact source replacements retain the current419inventory and keep previous images available',()=>{
 active();assert.equal(RUNTIME_PAYLOAD.length,419);for(const file of[cue,body])assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===file).length,1);for(const old of['art/restoration-comic-pop-20261022/pop.png','art/comic-color-body-20261029/body.png']){assert(fs.existsSync(new URL('../public/'+old,import.meta.url)));assert(!RUNTIME_PAYLOAD.some(r=>r.file===old));}
});
test('real facility completion daub takes receipt pigment rather than unrelated fixed palette',()=>{
 for(const[color,hex]of[['orange',0xff8c00],['blue',0x00ced1],['pink',0xff69b4],['purple',0x9370db],['yellow',0xffd700]]){const w=world('pink');assert(w.fx.play({x:100,y:200,paintColor:color}));assert.equal(w.nodes.length,1);assert.equal(w.nodes[0].tint,hex);w.fx.destroy();assert(w.nodes[0].destroyed);}
});
test('malformed or inherited color names fall back before node allocation without an orphan',()=>{
 for(const bad of['toString','__proto__',Object.create(null),Symbol('paint'),null,123]){const w=world('blue');assert.doesNotThrow(()=>w.fx.play({x:100,y:200,paintColor:bad}));assert.equal(w.nodes[0].tint,0x00ced1);assert.equal(w.fx.rows.length,1);w.fx.destroy();assert(w.nodes.every(n=>n.destroyed));}const w=world('unknown');w.fx.play({x:100,y:200});assert.equal(w.nodes[0].tint,0xffffff);w.fx.destroy();
});
test('malformed or missing member and run keep a neutral tracked completion cue',()=>{
 for(const member of[Object.create(null),Symbol('member'),'toString',undefined]){const w=world(member);if(member===undefined)delete w.scene.publicPerformerRun.member;assert.doesNotThrow(()=>w.fx.play({x:100,y:200}));assert.equal(w.nodes[0].tint,0xffffff);w.fx.destroy();assert(w.nodes[0].destroyed);}const w=world();delete w.scene.publicPerformerRun;assert.equal(w.fx.play({x:100,y:200}),false);assert.equal(w.nodes.length,0);w.fx.destroy();
});
test('Canvas fallback deliberately keeps neutral check instead of claiming unsupported image tint',()=>{
 const w=world('orange');w.scene.game={renderer:{type:1}};assert(w.fx.play({x:100,y:200,paintColor:'blue'}));assert.equal(w.nodes[0].tint,0xffffff);w.fx.destroy();
});
test('reviewed completion export is neutral, padded, readable peak then economical breakup',async()=>{
 active();const file=new URL('../public/'+cue,import.meta.url),bytes=fs.readFileSync(file);assert.equal(createHash('sha256').update(bytes).digest('hex'),'979272cfa940548642d964cfe5d98069f957e54c9fc2187f34f14728b1f6b815');const{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height],[1536,256]);const area=[];
 for(let f=0;f<6;f++){let n=0,dark=0,white=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*1536+f*256+x)*4,a=data[i+3];if(x<35||x>216||y<52||y>230)assert.equal(a,0);if(!a)continue;assert.equal(data[i],data[i+1]);assert.equal(data[i],data[i+2]);if(a>=128){n++;if(data[i]<64)dark++;if(data[i]>200)white++;}}assert(n>100&&n<20000);if(f===1||f===2)assert(dark/n>.15&&white/n>.35);area.push(n);}assert(area[1]>area[0]);assert(area[2]>area[0]);assert(area[5]<area[2]*.12);assert(area[4]<area[3]);
});
test('restrained material keeps opaque neutral body, sparse accents and actual broad value planes',async()=>{
 active();const bytes=fs.readFileSync(new URL('../public/'+body,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),'576ce7d147f17934c9a21f47aa106a648a3871668a346b8baa1d0709a486d7dc');const{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height],[1254,1254]);let quiet=0,accent=0,shadow=0,light=0;for(let i=0;i<data.length;i+=4){assert.equal(data[i+3],255);const hi=Math.max(data[i],data[i+1],data[i+2]),lo=Math.min(data[i],data[i+1],data[i+2]);if(hi-lo>=48)accent++;else{if(hi>=116&&hi<=142)quiet++;if(hi<112)shadow++;if(hi>148)light++;}}const n=data.length/4;assert(quiet/n>.6);assert(accent/n>.001&&accent/n<.02);assert(shadow/n>.05&&shadow/n<.25);assert(light/n>.02&&light/n<.15);
});
