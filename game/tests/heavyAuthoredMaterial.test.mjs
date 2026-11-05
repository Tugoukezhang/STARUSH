import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import * as FX from '../src/systems/UserWeaponFx.mjs';
import {RUNTIME_PAYLOAD}from'../scripts/runtime-payload.mjs';
const key='user-fx-heavy-20261021',path='art/heavy-palette-impact-20261029/impact.png';
function fixture(id='enjo',available=true){let time=500;const nodes=[];
 const scene={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},publicPerformerRun:{now:()=>time},oldStreet:{clearLine:()=>true},textures:{exists:k=>k!==FX.DUO_COMIC_CONTACT.key&&(k!==key||available)},add:{image(x,y,k,frame=0){const n={x,y,key:k,frame,active:true,dead:0,setOrigin(x,y=x){this.origin=[x,y];return this;},setDisplaySize(w,h){this.width=w;this.height=h;return this;},setTint(v){this.tint=v;return this;},setAlpha(v){this.alpha=v;return this;},setDepth(v){this.depth=v;return this;},setRotation(v){this.angle=v;return this;},setFrame(v){this.frame=v;return this;},destroy(){assert(this.active);this.active=false;this.dead++;}};nodes.push(n);return n;}}};
 return {scene,fx:new FX.UserWeaponFx(scene,id),nodes,view:{depth:10,disposed:false},at(t){time=500+t;this.fx.update(time,this.view);}};
}
const packet=()=>({x:100,y:100,radius:130,start:500,angle:1,color:'orange',contacts:[{x:120,y:110},{x:140,y:100}]});
test('new heavy material is a separate explicit bank loaded only for selected Enjo',()=>{
 assert.equal(FX.HEAVY_WEAPON_FX?.key,key);assert.equal(FX.HEAVY_WEAPON_FX.path,path);
 assert.deepEqual(FX.HEAVY_WEAPON_FX.origin,[.5,.625]);assert.equal(FX.HEAVY_WEAPON_FX.extent,.469);
 // Four shared banks for every cast; heavy is Enjo-only, the known fifth Kai bank is its dash contrast sheet,
 // and selected Sakura adds exactly the B48 rifle projectile (256x128 cels) and contact sheets.
 const shared=Object.values(FX.USER_WEAPON_FX).map(a=>[a.key,a.path]),dash=[FX.KAI_DASH_FX.key,FX.KAI_DASH_FX.path];
 assert.deepEqual(shared.map(a=>a[0]),['user-fx-spray','user-fx-sweep','user-fx-burst','user-fx-impact']);
 assert.deepEqual(dash,['user-fx-kai-dash-20261021','art/kai-dash-contrast-20261021/dash.png']);
 const rifle=[['user-rifle-muzzle-20261022','art/rifle-compact-muzzle-20261022/muzzle.png'],['user-rifle-projectile-20261021','art/rifle-ink-chain-20261022/projectile.png'],['user-rifle-contact-20261021','art/rifle-ink-chain-20261022/contact.png']];
 const landing=[FX.RIFLE_PIGMENT_DEPOSITION.key,FX.RIFLE_PIGMENT_DEPOSITION.path];
 const duo=[FX.DUO_COMIC_CONTACT.key,FX.DUO_COMIC_CONTACT.path];
 const banks={enjo:[...shared,landing,[key,path],[FX.HAMMER_COMIC_CONTACT.key,FX.HAMMER_COMIC_CONTACT.path],[FX.HEAVY_COMIC_CHAIN.key,FX.HEAVY_COMIC_CHAIN.path],[FX.HEAVY_COMIC_LANDING.key,FX.HEAVY_COMIC_LANDING.path],duo],kai:[...shared,landing,dash,[FX.KAI_COMIC_PROJECTILE.key,FX.KAI_COMIC_PROJECTILE.path],[FX.KAI_COMIC_CONTACT.key,FX.KAI_COMIC_CONTACT.path],duo],sakura:[...shared,...rifle,landing],undefined:shared};
 for(const id of['enjo','kai','sakura',undefined]){const calls=[];FX.preloadUserWeaponFx({load:{image(){},spritesheet:(...a)=>calls.push(a)}},id);assert.equal(calls.filter(a=>a[0]===key).length,id==='enjo'?1:0);
  assert.deepEqual(calls.map(a=>[a[0],a[1]]),banks[id],String(id));assert(calls.every(a=>a[2].frameWidth===256&&a[2].frameHeight===([FX.RIFLE_COMIC_PROJECTILE.key,FX.KAI_COMIC_PROJECTILE.key].includes(a[0])?128:256)));}
});
test('heavy main and confirmed secondary use new material, not ordinary shot, contact or miss',()=>{
 const f=fixture(),p=packet(),before=structuredClone(p);assert(f.fx.release(p));assert.equal(f.fx.rows.length,3);
 assert(f.fx.rows.every(r=>r.artKind==='heavy'&&r.node.key===key));assert.equal(f.fx.rows[0].kind,'burst');assert(f.fx.rows.slice(1).every(r=>r.releaseContact));assert.deepEqual(p,before);
 assert.equal(f.fx.projectileVisual(100,100,'orange').node.key,FX.USER_WEAPON_FX.burst.key);
 f.fx.impact({x:100,y:100,hit:true});assert.equal(f.fx.rows.at(-1).artKind,'burst');
 f.fx.impact({x:100,y:100,hit:false});assert.equal(f.fx.rows.at(-1).artKind,'burst');
 f.fx.shot({active:true,paintShot:true,x:100,y:100,moveVx:1,moveVy:0},500);assert.equal(f.fx.rows.at(-1).artKind,'burst');
 for(const id of['sakura','kai']){const a=fixture(id);a.fx.release(packet());assert(a.fx.rows.every(r=>r.artKind!=='heavy'&&r.node.key!==key));}
});
test('new main preserves 360ms while secondary remains delayed breakup4/5 for 220ms',()=>{
 const f=fixture();f.fx.release(packet());assert.equal(f.nodes[0].key,key);
 for(const age of[0,20,64]){f.at(age);assert(f.fx.rows.filter(r=>r.releaseContact).every(r=>r.node.alpha===0));}
 f.at(65);assert.equal(f.nodes[0].frame,26);assert(f.fx.rows.filter(r=>r.releaseContact).every(r=>r.node.frame===28&&r.node.alpha>0));
 f.at(180);assert(f.fx.rows.filter(r=>r.releaseContact).every(r=>r.node.frame===29));
 f.at(220);assert.equal(f.fx.rows.length,1);assert(f.nodes.slice(1).every(n=>n.dead===1));f.at(360);assert.equal(f.fx.rows.length,0);assert(f.nodes.every(n=>n.dead===1));
});
test('missing optional heavy texture falls back to original bank without inventing other ownership',()=>{
 const f=fixture('enjo',false);assert(f.fx.release(packet()));assert(f.fx.rows.every(r=>r.node.key===FX.USER_WEAPON_FX.burst.key&&r.artKind==='burst'));
});
test('ordinary burst callers cannot opt into the restricted heavy material',()=>{
 const f=fixture();assert.equal(f.fx.push('burst',{x:100,y:100,size:80,artKind:'heavy'}),false);assert.equal(f.nodes.length,0);
 assert.equal(f.fx.push('impact',{x:100,y:100,size:80,artKind:'heavy'}),false);assert.equal(f.nodes.length,0);
 const other=fixture('kai');assert.equal(other.fx.push('burst',{x:100,y:100,size:80,artKind:'heavy',release:true}),false);
});
test('new material retains original radius/cover cap and never emits beyond an opaque wall',()=>{
 const f=fixture();assert(f.fx.release(packet()));const n=f.nodes[0];assert.equal(n.key,key);assert(n.width*.469<=130);assert.deepEqual(n.origin,[.5,.5]);assert(f.nodes.slice(1).every(n=>n.origin[1]===.625));assert.equal(n.angle,0);assert.equal(n.depth,.52);assert.equal(n.tint,0xffffff);
 const blocked=fixture();blocked.scene.oldStreet.clearLine=()=>false;assert.equal(blocked.fx.release(packet()),false);assert.equal(blocked.nodes.length,0);
});
test('paused material holds pixels and uses existing 24-node budget and exact teardown',()=>{
 const f=fixture();f.fx.release(packet());assert.equal(f.nodes[0].key,key);f.at(65);const before=f.nodes.map(n=>({frame:n.frame,alpha:n.alpha}));f.scene._battlePaused=true;f.fx.update(99999,f.view);assert.deepEqual(f.nodes.map(n=>({frame:n.frame,alpha:n.alpha})),before);
 f.scene._battlePaused=false;for(let n=0;n<50;n++)f.fx.release(packet());assert.equal(f.fx.rows.length,24);assert.equal(f.nodes.filter(n=>n.active).length,24);f.fx.destroy();f.fx.destroy();assert(f.nodes.every(n=>n.dead===1));
});
test('only one reviewed six-drawing palette PNG enters the runtime heavy group, legacy burst remains explicit',()=>{
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.group==='owner-heavy-material').map(r=>r.file),[path]);
 const png=fs.readFileSync(new URL('../public/'+path,import.meta.url));assert.equal(png.readUInt32BE(16),1536);assert.equal(png.readUInt32BE(20),1536);assert(png.length<800000);
 assert(RUNTIME_PAYLOAD.some(r=>r.file==='art/graffiti-combat-20261018/burst.webp'));
});
