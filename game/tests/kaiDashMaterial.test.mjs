import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import{UserWeaponFx,KAI_DASH_FX,KAI_COMIC_CONTACT,USER_WEAPON_FX,preloadUserWeaponFx}from'../src/systems/UserWeaponFx.mjs';
import{RUNTIME_PAYLOAD}from'../scripts/runtime-payload.mjs';
const path='art/kai-dash-contrast-20261021/dash.png',old='art/kai-dash-20261021/dash.png';
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
test('contrast candidate keeps the original key, anchor, conservative radius and six-beat timing',()=>{
 assert.equal(KAI_DASH_FX.path,path);assert.equal(KAI_DASH_FX.key,'user-fx-kai-dash-20261021');assert.deepEqual(KAI_DASH_FX.origin,[.5,.5]);assert.equal(KAI_DASH_FX.extent,.532);assert.equal(USER_WEAPON_FX.sweep.frames,6);assert.equal(USER_WEAPON_FX.sweep.duration,240);
});
test('exported candidate is the reviewed RGBA six-frame strip with bounded decode cost',()=>{
 const b=fs.readFileSync(new URL('../public/'+path,import.meta.url));assert.equal(b.readUInt32BE(16),1536);assert.equal(b.readUInt32BE(20),256);assert.equal(b[25],6);assert.equal(b.length,153951);assert.equal(digest(b),'3fcd753b2da9c82c1bd95609ee425556fb6b740e77c120c8bf37d1d94bfffc47');assert.equal(1536*256*4,1572864);
});
test('previous dash material remains byte-identical and available for historical references',()=>{
 const b=fs.readFileSync(new URL('../public/'+old,import.meta.url));assert.equal(digest(b),'7e7504fd6911d94d4e31f14cdd273afcf651e5295e2d2b0293cb84cf936e9902');
});
test('runtime payload adds the versioned candidate without deleting the original material',()=>{
 assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===path).length,1);assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===old).length,1);
});
test('selected Kai retains exact dash and separate contact preloads; other cast banks stay explicit',()=>{
 const rifle=['user-rifle-projectile-20261021','user-rifle-contact-20261021'];
 for(const[id,count]of[['kai',9],['sakura',8],['enjo',10],[undefined,4]]){const calls=[];preloadUserWeaponFx({load:{spritesheet:(...args)=>calls.push(args),image(){}}},id);assert.equal(calls.length,count);assert.equal(calls.filter(r=>r[1]===path).length,id==='kai'?1:0);assert.equal(calls.filter(r=>r[1]===old).length,0);
  assert.equal(calls.filter(r=>r[0]==='user-hammer-contact-20261022').length,id==='enjo'?1:0);
  assert.deepEqual(calls.filter(r=>rifle.includes(r[0])).map(r=>r[0]),id==='sakura'?rifle:[],String(id));}
});
// B48 intentionally edited the shared class for Sakura rifle art, so a whole-class digest can no longer isolate Kai.
// Kai behaviour is pinned here; wall, size, ordinary, 240ms clock, pause/dialog and budget guards live in kaiDashFx.test.mjs.
function kai(){
 let time=100;const nodes=[];
 const scene={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},publicPerformerRun:{now:()=>time},oldStreet:{clearLine:()=>true},textures:{exists:()=>true},add:{image(x,y,key,frame=0){
  const n={x,y,key,frame,active:true,dead:0,setOrigin(...v){this.origin=v;return this;},setDisplaySize(w,h){this.width=w;this.height=h;return this;},setTint(v){this.tint=v;return this;},setAlpha(v){this.alpha=v;return this;},setDepth(v){this.depth=v;return this;},setRotation(v){this.angle=v;return this;},setFrame(v){this.frame=v;return this;},destroy(){this.active=false;this.dead++;}};nodes.push(n);return n;}}};
 return {scene,nodes,fx:new UserWeaponFx(scene,'kai'),at(t){time=t;this.fx.update(t,{depth:12,disposed:false});}};
}
test('Kai runtime metadata stays exact: no alpha, depth, wall, clock or rifle-art workaround reaches the sword',()=>{
 assert.deepEqual({...KAI_DASH_FX},{key:'user-fx-kai-dash-20261021',path,origin:[.5,.5],extent:.532});assert(Object.isFrozen(KAI_DASH_FX)&&Object.isFrozen(KAI_DASH_FX.origin));
 assert.deepEqual({...USER_WEAPON_FX.sweep},{key:'user-fx-sweep',path:'art/graffiti-combat-20261018/sweep.webp',frames:6,duration:240,origin:[.5,.5],extent:.401});
 const f=kai();assert(f.fx.release({x:100,y:100,radius:72,start:100,angle:.3,contacts:[]}));
 const [r]=f.fx.rows,n=f.nodes[0];assert.equal(f.nodes.length,1);
 assert.deepEqual([r.kind,r.artKind,r.release,r.ground,r.sourceRadius,r.alpha,r.angle],['sweep','dash',true,true,72,.78,.3]);
 assert.deepEqual([n.key,n.frame,n.origin,n.tint,n.alpha,n.angle,n.depth],[KAI_DASH_FX.key,0,[.5,.5],0xffffff,.78,.3,.52]);
 assert(Math.abs(n.width-72/.532)<1e-9&&n.width===n.height);
 f.at(100);assert.deepEqual([n.frame,n.alpha,n.depth],[0,.78,.52]);
 f.at(220);assert.equal(n.frame,3);assert(Math.abs(n.alpha-.78*.5/.52)<1e-12);assert.equal(n.depth,.52);
 assert.equal(f.fx.push('impact',{x:100,y:100,size:44,artKind:'contact'}),false);
 f.scene.textures.exists=k=>k!=='user-kai-projectile-20261024';
 const v=f.fx.projectileVisual(100,100),p=v.node;assert.deepEqual([p.key,p.frame,p.origin,p.width,p.height,p.alpha,p.depth,v.offsetX,v.offsetY],[USER_WEAPON_FX.sweep.key,2,[.5],28,22,.92,6,0,0]);
 assert.equal(f.fx.projectiles.length,0);f.at(230);assert.equal(p.frame,2,'Kai projectile cel is never advanced by the rifle clock');
 assert(f.fx.impact({x:120,y:100,hit:true,angle:.4}));const h=f.nodes.at(-1),hr=f.fx.rows.at(-1);
 assert.deepEqual([hr.kind,hr.artKind,h.key,h.origin,h.alpha,h.angle,h.depth,h.width],['impact','kai-contact',KAI_COMIC_CONTACT.key,[.5,.5],.88,.4,9.80002,58*4/3]);
 assert(f.fx.impact({x:150,y:100,hit:false,angle:.4}));const m=f.fx.rows.at(-1);
 assert.deepEqual([m.kind,m.artKind,m.ground,m.alpha,m.angle,f.nodes.at(-1).key],['burst','burst',true,.38,0,USER_WEAPON_FX.burst.key]);
 assert.equal(f.fx.rows.some(row=>row.node.key.startsWith('user-rifle-')),false);
});
