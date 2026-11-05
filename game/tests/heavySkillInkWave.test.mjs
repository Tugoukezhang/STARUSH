import test from'node:test';import assert from'node:assert/strict';import{UserWeaponFx,HEAVY_WEAPON_FX,HEAVY_COMIC_LANDING,DUO_COMIC_CONTACT}from'../src/systems/UserWeaponFx.mjs';import{COLOR_HEX}from'../src/utils/config.js';
function fixture(bank=true,id='enjo'){let clock=500;const nodes=[],scene={_userCastPresentation:true,player:{active:true,hp:5,x:100,y:100},publicPerformerRun:{now:()=>clock},oldStreet:{clearLine:()=>true},textures:{exists:k=>bank||k!==HEAVY_WEAPON_FX.key,getFrame:(_k,f)=>({name:f,width:256,height:256})},add:{image(x,y,key,frame){const n={x,y,key,frame,active:true,dead:0};for(const m of['setOrigin','setDisplaySize','setRotation','setDepth','setPosition','setVisible'])n[m]=(...a)=>{n[m]=n[m];n[m+'Value']=a;return n;};n.setAlpha=a=>{n.alpha=a;return n;};n.setTint=v=>{n.tint=v;return n;};n.setFrame=v=>{n.frame=v;return n;};n.destroy=()=>{if(n.active){n.active=false;n.dead++;}};nodes.push(n);return n;}}};return{fx:new UserWeaponFx(scene,id),scene,nodes,at:t=>{clock=t;},view:{depth:12}};}
const packet=color=>({x:100,y:100,radius:190,color,start:500,contacts:[{x:120,y:100},{x:120,y:100},{x:140,y:100}],angle:-Math.PI/2});
test('heavy skill primary and accepted target residuals use the actual pigment row with neutral tint',()=>{
 for(const[color]of Object.entries(COLOR_HEX)){const offset=HEAVY_WEAPON_FX.palettes.indexOf(color)*6,f=fixture();assert(f.fx.release(packet(color)));assert.equal(f.fx.rows.length,3);assert(f.nodes.every(n=>n.key===HEAVY_WEAPON_FX.key&&n.tint===0xffffff),color);assert.equal(f.nodes[0].frame,offset);assert(f.nodes.slice(1).every(n=>n.frame===offset+4));assert.equal(f.fx.rows.filter(r=>r.release).length,1);assert.equal(f.fx.rows.filter(r=>r.releaseContact).length,2);assert.deepEqual(f.fx.rows.slice(1).map(r=>[r.x,r.y]),[[120,100],[140,100]]);}
});
test('new skill path is explicit; ordinary heavy contact still uses its own eight-cell bank',()=>{
 assert.equal(HEAVY_WEAPON_FX.path,'art/heavy-palette-impact-20261029/impact.png');const f=fixture();f.fx.impact({x:100,y:100,color:'orange',hit:true,deposition:true,radius:32});assert(f.nodes.every(n=>n.key===HEAVY_COMIC_LANDING.key));
});
test('missing heavy bank retains duo fallback; other roles and unknown colors stay isolated',()=>{
 const f=fixture(false);assert(f.fx.release(packet('orange')));assert(f.nodes.every(n=>n.key!==HEAVY_WEAPON_FX.key));assert(f.nodes.some(n=>n.key===DUO_COMIC_CONTACT.key));
 for(const id of['kai','sakura']){const other=fixture(true,id);assert(other.fx.release(packet('orange')));assert(other.nodes.every(n=>n.key!==HEAVY_WEAPON_FX.key));}
 for(const color of['constructor','__proto__',undefined]){const unknown=fixture();assert(unknown.fx.release(packet(color)));assert(unknown.nodes.every(n=>n.tint===0xffffff));}
});
test('360ms primary and delayed220ms residual lifecycle retain their existing clock and teardown',()=>{
 const f=fixture();f.fx.release(packet('orange'));f.at(565);f.fx.update(565,f.view);assert.equal(f.nodes[0].frame,26);assert(f.fx.rows.filter(r=>r.releaseContact).every(r=>r.node.frame===28&&r.node.alpha>0));f.at(720);f.fx.update(720,f.view);assert.equal(f.fx.rows.length,1);f.at(860);f.fx.update(860,f.view);assert.equal(f.fx.rows.length,0);assert(f.nodes.every(n=>n.dead===1));
});
test('malformed color objects cannot throw after allocation or leave an untracked image',()=>{
 for(const color of[Object.create(null),{toString:null,valueOf:null},Symbol('bad')]){const f=fixture();assert.doesNotThrow(()=>f.fx.release(packet(color)));assert(f.nodes.every(n=>n.tint===0xffffff));assert.equal(f.nodes.length,f.fx.rows.length);f.fx.destroy();assert(f.nodes.every(n=>!n.active&&n.dead===1));}
});
test('empty real contact list allows one primary only, never a fabricated target residual',()=>{
 for(const id of['enjo','kai','sakura']){const f=fixture(true,id);assert(f.fx.release({...packet('orange'),contacts:[]}));assert.equal(f.fx.rows.length,1);assert(f.fx.rows.every(r=>!r.releaseContact&&!r.skillContact));}
});
