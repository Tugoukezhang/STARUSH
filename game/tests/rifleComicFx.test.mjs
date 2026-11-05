import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as weapon from '../src/systems/UserWeaponFx.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';

const {UserWeaponFx,USER_WEAPON_FX,preloadUserWeaponFx}=weapon;
const RIFLE_COMIC_PROJECTILE=weapon.RIFLE_COMIC_PROJECTILE??{},RIFLE_COMIC_CONTACT=weapon.RIFLE_COMIC_CONTACT??{};

function fixture(id='sakura',missing=[]){
  let time=500;const nodes=[];
  const scene={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},publicPerformerRun:{now:()=>time},
    oldStreet:{clearLine:()=>true},textures:{exists:key=>!missing.includes(key)},
    time:{delayedCall(){throw new Error('FX must not own timers');}},tweens:{add(){throw new Error('FX must not own tweens');}},
    add:{image(x,y,key,frame){
      const n={x,y,texture:{key},frame:{name:frame??0},active:true,destroyed:0,
        setOrigin(ox,oy=ox){this.origin=[ox,oy];return this;},setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},
        setTint(v){this.tint=v;return this;},setAlpha(v){this.alpha=v;return this;},setDepth(v){this.depth=v;return this;},
        setRotation(v){this.rotation=v;return this;},setFrame(v){this.frame.name=v;return this;},
        setPosition(px,py){this.x=px;this.y=py;return this;},destroy(){this.destroyed++;this.active=false;}};
      nodes.push(n);return n;
    }}};
  return {scene,fx:new UserWeaponFx(scene,id),nodes,setTime:v=>time=v,view:{depth:12,disposed:false}};
}

test('rifle comic banks are frozen exact contracts that match the shipped bitmaps',()=>{
  assert(Object.isFrozen(RIFLE_COMIC_PROJECTILE)&&Object.isFrozen(RIFLE_COMIC_CONTACT));
  assert(Object.isFrozen(RIFLE_COMIC_PROJECTILE.origin)&&Object.isFrozen(RIFLE_COMIC_PROJECTILE.display)&&Object.isFrozen(RIFLE_COMIC_CONTACT.origin));
  assert.deepEqual({...RIFLE_COMIC_PROJECTILE,origin:[...RIFLE_COMIC_PROJECTILE.origin],display:[...RIFLE_COMIC_PROJECTILE.display]},
    {key:'user-rifle-projectile-20261021',path:'art/rifle-ink-chain-20261022/projectile.png',frames:4,frameWidth:256,frameHeight:128,origin:[.75,.5],display:[80,40],cycle:160});
  assert.deepEqual({...RIFLE_COMIC_CONTACT,origin:[...RIFLE_COMIC_CONTACT.origin]},
    {key:'user-rifle-contact-20261021',path:'art/rifle-ink-chain-20261022/contact.png',frames:6,frameWidth:256,frameHeight:256,origin:[.5,.5],extent:.4});
  for(const art of [RIFLE_COMIC_PROJECTILE,RIFLE_COMIC_CONTACT]){
    const png=fs.readFileSync(new URL('../public/'+art.path,import.meta.url));
    assert.equal(png.readUInt32BE(16),art.frames*art.frameWidth);assert.equal(png.readUInt32BE(20),art.frameHeight);
  }
});

test('only the selected Sakura branch preloads the rifle muzzle/projectile/contact banks; old banks stay unchanged',()=>{
  const load=id=>{const calls=[];preloadUserWeaponFx({load:{spritesheet:(...a)=>calls.push(a),image(){}}},id);return calls;};
  const old=Object.values(USER_WEAPON_FX).map(a=>[a.key,a.path,{frameWidth:256,frameHeight:256}]);
  assert.deepEqual(load('sakura'),[...old, ['user-rifle-muzzle-20261022','art/rifle-compact-muzzle-20261022/muzzle.png',{frameWidth:256,frameHeight:256}],
    ['user-rifle-projectile-20261021','art/rifle-ink-chain-20261022/projectile.png',{frameWidth:256,frameHeight:128}],
    ['user-rifle-contact-20261021','art/rifle-ink-chain-20261022/contact.png',{frameWidth:256,frameHeight:256}],
    ['user-rifle-deposition-20261023','art/rifle-pigment-deposition-20261023/deposition.png',{frameWidth:256,frameHeight:256}]]);
  // The neutral deposition strip is the shared three-cast landing bank, not a rifle weapon bank.
  for(const id of ['kai','enjo',undefined])assert(!load(id).some(c=>c[0].startsWith('user-rifle-')&&c[0]!=='user-rifle-deposition-20261023'),String(id));
  assert.deepEqual(load(undefined),old);
});

test('selected Sakura projectile uses the authored bank at its physics core; other casts and a missing bank keep the exact native visual',()=>{
  const {fx}=fixture(),v=fx.projectileVisual(120,90,'pink',0xff69b4);
  assert.deepEqual({key:v.node.texture.key,frame:v.node.frame.name,origin:v.node.origin,w:v.node.displayWidth,h:v.node.displayHeight,x:v.node.x,y:v.node.y,depth:v.node.depth,offsetX:v.offsetX,offsetY:v.offsetY},
    {key:'user-rifle-projectile-20261021',frame:0,origin:[.75,.5],w:80,h:40,x:120,y:90,depth:6,offsetX:0,offsetY:0});
  assert.equal(fx.projectiles.length,1);
  const native=(id,missing)=>{const {fx}=fixture(id,missing),v=fx.projectileVisual(120,90,'pink',0xff69b4),n=v.node;
    return {key:n.texture.key,frame:n.frame.name,origin:n.origin,w:n.displayWidth,h:n.displayHeight,tint:n.tint,alpha:n.alpha,depth:n.depth,offsetX:v.offsetX,offsetY:v.offsetY,tracked:fx.projectiles?.length??0};};
  assert.deepEqual(native('sakura',['user-rifle-projectile-20261021']),{key:USER_WEAPON_FX.spray.key,frame:2,origin:[.5,.5],w:22,h:15,tint:0xffffff,alpha:.92,depth:6,offsetX:0,offsetY:0,tracked:0});
  assert.deepEqual(native('kai',['user-kai-projectile-20261024']),{key:USER_WEAPON_FX.sweep.key,frame:2,origin:[.5,.5],w:28,h:22,tint:0xffffff,alpha:.92,depth:6,offsetX:0,offsetY:0,tracked:0});
  assert.deepEqual(native('enjo'),{key:USER_WEAPON_FX.burst.key,frame:2,origin:[.5,.5],w:22,h:22,tint:0xffffff,alpha:.92,depth:6,offsetX:0,offsetY:0,tracked:0});
});

test('BattleScene receives the authored node and shot() still rotates it to the real velocity without touching physics',()=>{
  const BattleScene=loadBattleScene({Phaser:{Scene:class{}}}),s=Object.create(BattleScene.prototype),{fx}=fixture();
  s.actorPresentation={userCastView:{weaponFx:fx}};const v=s._createPlayerBulletVisual(120,90,'pink',0xff69b4);
  assert.equal(v.node.texture.key,'user-rifle-projectile-20261021');
  const b={active:true,paintShot:true,x:120,y:90,moveVx:-300,moveVy:300,gfx:v.node,body:{untouched:true}};
  assert.equal(fx.shot(b,500),true);assert.equal(v.node.rotation,Math.atan2(300,-300));
  assert.deepEqual(b.body,{untouched:true});assert.deepEqual([b.x,b.y,b.moveVx,b.moveVy,b.active],[120,90,-300,300,true]);
});

test('projectile cels advance 40ms each on the active run clock, loop at 160ms and freeze for pause or dialog',()=>{
  const {scene:s,fx,setTime,view}=fixture(),{node}=fx.projectileVisual(120,90,'pink',0);
  const at=t=>{setTime(t);fx.update(t,view);return node.frame.name;};
  assert.deepEqual([500,539,540,579,580,620,659,660,700].map(at),[0,0,1,1,2,3,3,0,1]);
  s._battlePaused=true;assert.equal(at(5000),1);s._battlePaused=false;
  s._publicBattleDialog={};assert.equal(at(5040),1);s._publicBattleDialog=null;
  assert.equal(at(740),2,'the resumed run clock, not wall time, selects the next cel');
});

test('FX tracks but never owns the real projectile node: owner destroy, end and dispose clear references only',()=>{
  const {scene:s,fx,view}=fixture();
  const a=fx.projectileVisual(100,100,'pink',0).node,b=fx.projectileVisual(110,100,'pink',0).node;
  a.destroy();fx.update(520,view);assert.deepEqual(fx.projectiles.map(r=>r.node),[b]);assert.equal(a.destroyed,1,'owner destroy is the only destroy');
  for(let i=0;i<80;i++)fx.impact({x:100,y:100,radius:100,hit:true});
  assert.equal(b.destroyed,0,'FX budget culling never reaches the projectile');
  s._battleEnded=true;fx.update(540,view);assert.equal(fx.projectiles.length,0);assert.equal(b.destroyed,0);assert.equal(b.active,true);
  s._battleEnded=false;const c=fx.projectileVisual(120,100,'pink',0).node;
  fx.update(560,{...view,disposed:true});assert.equal(fx.projectiles.length,0);assert.equal(c.destroyed,0);
  const d=fx.projectileVisual(130,100,'pink',0).node;fx.destroy();assert.equal(fx.projectiles.length,0);assert.equal(d.destroyed,0);
  assert.equal(fx.projectileVisual(100,100,'pink',0),null,'disposed FX manufactures no projectile visual');
});

test('tracking is bounded by the real projectile budget without hidden bursts or culling the body visual',()=>{
  const {fx,nodes}=fixture();for(let i=0;i<30;i++)fx.projectileVisual(100+i,100,'pink',0);
  assert.equal(nodes.length,30,'one node per real projectile request');assert.equal(fx.projectiles.length,24);
  assert(nodes.every(n=>n.destroyed===0));assert.deepEqual(fx.projectiles.map(r=>r.node),nodes.slice(6));
});

test('an accepted Sakura hit uses six authored contact cels over the same 220ms clock',()=>{
  const {fx,nodes,setTime,view}=fixture();assert.equal(fx.impact({x:150,y:100,radius:108,hit:true,angle:.4}),true);
  const n=nodes[0];assert.equal(n.texture.key,'user-rifle-contact-20261021');assert.deepEqual(n.origin,[.5,.5]);assert.equal(n.rotation,.4);
  assert.equal(fx.rows[0].kind,'impact');assert.equal(fx.rows[0].artKind,'contact');assert.equal(fx.stats.impacts,1);
  const frames=[0,13,14,35,36,105,106,145,146,184,185,219].map(t=>{setTime(500+t);fx.update(500+t,view);return n.frame.name;});
  assert.deepEqual(frames,[0,0,1,1,2,2,3,3,4,4,5,5]);
  setTime(720);fx.update(720,view);assert.equal(fx.rows.length,0);assert.equal(n.destroyed,1);
});

test('contact extent .40 replaces the old tip anchor, while a missing bank keeps the exact old spray contact',()=>{
  const run=missing=>{const {scene:s,fx,nodes}=fixture('sakura',missing);s.oldStreet.clearLine=(c,p)=>Math.hypot(p.x-c.x,p.y-c.y)<=25;
    fx.impact({x:150,y:100,hit:true,angle:.4});return {row:fx.rows[0],node:nodes[0]};};
  const fresh=run([]);assert.equal(fresh.node.texture.key,'user-rifle-contact-20261021');assert.equal(fresh.row.size,44);
  const old=run(['user-rifle-contact-20261021']);assert.equal(old.node.texture.key,USER_WEAPON_FX.spray.key);
  assert.deepEqual(old.node.origin,[.875,.5]);assert.equal(old.row.artKind,'spray');assert(Math.abs(old.row.size-44*.4)<1e-9);
});

test('missed shots keep ground pigment and raw contact art is rejected for other members or non-impact rows',()=>{
  const {fx,nodes}=fixture();assert.equal(fx.impact({x:150,y:100,radius:108,hit:false}),true);
  assert.equal(fx.rows[0].kind,'burst');assert.equal(nodes[0].texture.key,USER_WEAPON_FX.burst.key);assert.equal(fx.stats.impacts,0);
  assert.equal(fx.impact({x:150,y:100,hit:true,contacts:[]}),false,'an accepted list without contacts draws nothing');
  for(const kind of ['spray','burst','sweep'])assert.equal(fx.push(kind,{x:100,y:100,size:44,artKind:'contact'}),false,kind);
  assert.equal(nodes.length,1);
  for(const id of ['kai','enjo']){const other=fixture(id);assert.equal(other.fx.push('impact',{x:100,y:100,size:44,artKind:'contact'}),false,id);
    other.fx.impact({x:150,y:100,hit:true});assert(other.nodes.length>0&&other.nodes.every(n=>n.texture.key!=='user-rifle-contact-20261021'),id);}
});

test('multiple accepted contacts keep the two-node budget, direct priority and radial direction',()=>{
  const {fx,nodes}=fixture();
  assert.equal(fx.impact({x:100,y:100,hit:true,radial:true,contacts:[{x:160,y:100},{x:100,y:140,direct:true},{x:130,y:100},{x:160,y:100}]}),true);
  assert.equal(nodes.length,2);assert(nodes.every(n=>n.texture.key==='user-rifle-contact-20261021'));
  assert.deepEqual(nodes.map(n=>[n.x,n.y]),[[100,140],[130,100]]);
  assert.equal(nodes[0].rotation,Math.atan2(40,0));assert.equal(nodes[1].rotation,0);assert.equal(fx.stats.impacts,2);
});

test('ordinary muzzle uses the dedicated bank while the common spray remains available',()=>{
  const {fx,nodes,view}=fixture();Object.assign(view,{art:{id:'sakura'},state:'shoot',muzzleWorld:()=>({x:118,y:86})});
  assert.equal(fx.shot({active:true,paintShot:true,x:116,y:88,moveVx:400,moveVy:0},500),true);fx.update(500,view);
  assert.equal(nodes.length,1);assert.equal(nodes[0].texture.key,weapon.RIFLE_COMIC_MUZZLE.key);
});
