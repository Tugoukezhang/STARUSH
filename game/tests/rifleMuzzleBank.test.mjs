import test from 'node:test';
import assert from 'node:assert/strict';
import * as weapon from '../src/systems/UserWeaponFx.mjs';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';
const {UserWeaponFx,USER_WEAPON_FX,RIFLE_COMIC_PROJECTILE,RIFLE_COMIC_CONTACT,preloadUserWeaponFx}=weapon;
const MUZZLE=weapon.RIFLE_COMIC_MUZZLE??{},KEY='user-rifle-muzzle-20261022',SPRAY=USER_WEAPON_FX.spray.key;

// Fake Phaser nodes only: this proves runtime routing, never rendered art acceptance.
function fixture(id='sakura',missing=[]){
 let time=0;const nodes=[];
 const node=(x=0,y=0,key='',frame=0)=>{const n={x,y,active:true,alpha:1,frame:{name:frame},texture:{key},dead:0,
  setOrigin(x,y=x){this.origin=[x,y];return this;},setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},setDepth(d){this.depth=d;return this;},
  setTint(t){this.tint=t;return this;},setAlpha(a){this.alpha=a;return this;},setAngle(){return this;},setRotation(r){this.rotation=r;return this;},setFlipX(f){this.flipX=f;return this;},
  setPosition(x,y){this.x=x;this.y=y;return this;},setTexture(key,f){this.texture={key};this.frame.name=f;return this;},setFrame(f){this.frame.name=f;return this;},destroy(){this.active=false;this.dead++;}};nodes.push(n);return n;};
 const scene={_userCastPresentation:true,game:{loop:{frame:0}},player:{x:500,y:1000,hp:5,active:true},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},
  publicPerformerRun:{actions:0,now:()=>time},oldStreet:{clearLine:()=>true},textures:{exists:key=>!missing.includes(key)},
  time:{delayedCall(){throw new Error('FX must not own timers');}},tweens:{add(){throw new Error('FX must not own tweens');}},add:{ellipse:node,image:node}};
 const view=new UserCastPresentation(scene,id),fx=view.weaponFx;view.update(0,false);
 const bullet=()=>({active:true,paintShot:true,x:516,y:988,moveVx:300,moveVy:-100,color:'pink',damage:1,life:900,body:{untouched:true},gfx:{setRotation(r){this.rotation=r;}}});
 const fxNodes=()=>nodes.filter(n=>n.texture.key===KEY||Object.values(USER_WEAPON_FX).some(a=>a.key===n.texture.key));
 return {scene,view,fx,nodes,fxNodes,bullet,setTime:t=>time=t};
}
const queued=(f,b=f.bullet())=>{f.view.beginShot(0,1,0,400);assert.equal(f.fx.shot(b,0,f.view),true);f.view.update(0,false);return b;};

test('dedicated ordinary muzzle descriptor is exact, frozen and preloaded only for Sakura beside every common bank',()=>{
 assert.deepEqual([MUZZLE.key,MUZZLE.path,MUZZLE.frames,MUZZLE.frameWidth,MUZZLE.frameHeight,MUZZLE.origin&&[...MUZZLE.origin],MUZZLE.extent],
  [KEY,'art/rifle-compact-muzzle-20261022/muzzle.png',6,256,256,[.25,.5],.625]);
 assert(Object.isFrozen(MUZZLE)&&Object.isFrozen(MUZZLE.origin));
 const load=id=>{const calls=[];preloadUserWeaponFx({load:{spritesheet:(...a)=>calls.push(a),image(){}}},id);return calls;};
 const sakura=load('sakura');
 assert.deepEqual(sakura.filter(c=>c[0]===KEY),[[KEY,'art/rifle-compact-muzzle-20261022/muzzle.png',{frameWidth:256,frameHeight:256}]]);
 for(const id of ['sakura','kai','enjo',undefined]){
  const calls=load(id);
  for(const art of Object.values(USER_WEAPON_FX))assert.deepEqual(calls.filter(c=>c[0]===art.key),[[art.key,art.path,{frameWidth:256,frameHeight:256}]],String(id));
  if(id!=='sakura')assert.equal(calls.some(c=>c[0]===KEY),false,String(id));
 }
 assert.deepEqual(sakura.filter(c=>c[0]===RIFLE_COMIC_PROJECTILE.key||c[0]===RIFLE_COMIC_CONTACT.key).map(c=>c[1]),[RIFLE_COMIC_PROJECTILE.path,RIFLE_COMIC_CONTACT.path]);
});

test('actual post-physics Sakura muzzle uses the new bank once at the sampled barrel point and angle',()=>{
 const f=fixture(),before=f.nodes.length,b=queued(f);
 assert.equal(f.fx.rows.length,1);assert.equal(f.nodes.length,before+1,'exactly one muzzle node');
 const row=f.fx.rows[0],n=row.node;
 assert.equal(n.texture.key,KEY);assert.equal(row.kind,'spray');assert.equal(row.artKind,'muzzle');
 assert.deepEqual([row.x,row.y],[554,970]);assert.deepEqual(f.view.muzzleWorld(),{x:554,y:970});
 assert.equal(n.rotation,Math.atan2(-100,300));assert.deepEqual(n.origin,[.25,.5]);
 assert.equal(row.size,32);assert.equal(n.displayWidth,32*4/3);assert.equal(n.displayHeight,32*4/3);
 assert.equal(n.tint,0xffffff);assert.equal(row.alpha,.78);assert.equal(n.frame.name,0);assert.equal(n.depth,f.view.depth+.00002);
 assert.equal(f.fx.pendingShots.length,0);f.view.update(0,false);assert.equal(f.fx.rows.length,1,'no replay on a later update');
 assert.equal(b.gfx.rotation,Math.atan2(-100,300));
});

test('direct shot without the matching cast view draws the new bank at the physical origin',()=>{
 for(const view of [undefined,{art:{id:'kai'}}]){
  const f=fixture(),before=f.nodes.length,b=f.bullet();
  assert.equal(f.fx.shot(b,0,view),true);assert.equal(f.fx.pendingShots.length,0);
  assert.equal(f.fx.rows.length,1);assert.equal(f.nodes.length,before+1);
  const row=f.fx.rows[0];assert.equal(row.node.texture.key,KEY);assert.equal(row.artKind,'muzzle');
  assert.deepEqual([row.x,row.y,row.size,row.angle],[516,988,32,Math.atan2(-100,300)]);assert.deepEqual(row.node.origin,[.25,.5]);
  f.fx.update(0,f.view);assert.equal(f.fx.rows.length,1,'direct row is never duplicated by the queue');
 }
});

test('skill release and accepted contacts keep their own banks even when the muzzle bank is loaded',()=>{
 const f=fixture();assert.equal(f.fx.release({x:600,y:900,radius:72,start:0,angle:.3,color:'pink',contacts:[]}),true);
 const release=f.fx.rows.find(r=>r.release);assert.equal(release.node.texture.key,SPRAY);assert.equal(release.artKind,'spray');
 assert.equal(f.fx.rows.some(r=>r.node.texture.key===KEY),false);
 assert.equal(f.fx.impact({x:620,y:900,hit:true,color:'pink'}),true);assert.equal(f.fx.rows.at(-1).node.texture.key,RIFLE_COMIC_CONTACT.key);
 const g=fixture('sakura',[RIFLE_COMIC_CONTACT.key]);assert.equal(g.fx.impact({x:620,y:900,hit:true,color:'pink'}),true);
 assert.equal(g.fx.rows[0].node.texture.key,SPRAY,'missing contact keeps old spray contact, never the muzzle');
});

test('missing muzzle bank falls back to the exact original spray muzzle on both paths',()=>{
 const loaded=fixture(),missing=fixture('sakura',[KEY]);queued(loaded);queued(missing);
 const a=loaded.fx.rows[0],b=missing.fx.rows[0];assert.equal(missing.fx.rows.length,1);
 assert.equal(b.node.texture.key,SPRAY);assert.equal(b.artKind,'spray');
 for(const p of ['kind','x','y','size','angle','alpha','start','ground','release'])assert.equal(b[p],a[p],p);
 for(const p of ['displayWidth','displayHeight','rotation','depth','tint','alpha'])assert.equal(b.node[p],a.node[p],p);
 assert.deepEqual(b.node.origin,USER_WEAPON_FX.spray.origin.slice());
 const d=fixture('sakura',[KEY]);assert.equal(d.fx.shot(d.bullet(),0),true);assert.equal(d.fx.rows.length,1);
 assert.equal(d.fx.rows[0].node.texture.key,SPRAY);assert.equal(d.fx.rows[0].artKind,'spray');
 const e=fixture('sakura',[KEY,SPRAY]);assert.equal(e.fx.shot(e.bullet(),0),true);assert.equal(e.fx.rows.length,0,'no texture, no invisible node');
});

test('muzzle artKind is rejected outside Sakura ordinary spray',()=>{
 for(const [id,kind,extra] of [['kai','sweep',{}],['enjo','burst',{}],['kai','spray',{}],['sakura','impact',{}],['sakura','burst',{}],
  ['sakura','sweep',{}],['sakura','spray',{release:true}],['sakura','spray',{release:true,ground:true}]]){
  const f=fixture(id),before=f.nodes.length;
  assert.equal(f.fx.push(kind,{x:600,y:900,size:32,artKind:'muzzle',...extra}),false,id+kind);
  assert.equal(f.nodes.length,before);assert.equal(f.fx.rows.length,0);
 }
 const f=fixture();assert.equal(f.fx.push('spray',{x:600,y:900,size:32,artKind:'bogus'}),false);
 assert.equal(f.fx.push('spray',{x:600,y:900,size:32,artKind:'muzzle'}),true);assert.equal(f.fx.rows[0].node.texture.key,KEY);
});

test('new muzzle plays six finite phases on the original 140ms spray clock with no extra nodes',()=>{
 const f=fixture();queued(f);const n=f.fx.rows[0].node,count=f.nodes.length,seq=[];assert.equal(n.texture.key,KEY);
 for(const [t,frame] of [[0,0],[8,0],[9,1],[19,1],[20,2],[92,2],[93,3],[110,3],[111,4],[125,4],[126,5],[139,5]]){
  f.setTime(t);f.fx.update(t,f.view);assert.equal(n.frame.name,frame,'t'+t);
 }
 for(let t=0;t<140;t++){f.setTime(t);f.fx.update(t,f.view);if(seq.at(-1)!==n.frame.name)seq.push(n.frame.name);}
 assert.deepEqual(seq,[0,1,2,3,4,5]);assert.equal(f.nodes.length,count);assert(n.alpha<.78&&n.alpha>0);
 f.setTime(140);f.fx.update(140,f.view);assert.equal(f.fx.rows.length,0);assert.equal(n.dead,1);assert.equal(f.nodes.length,count);
});

test('pause freezes a live muzzle; pause, dialog and skipped frames never replay a queued one',()=>{
 const f=fixture();queued(f);const n=f.fx.rows[0].node;assert.equal(n.texture.key,KEY);f.setTime(60);f.fx.update(60,f.view);const frame=n.frame.name;
 f.scene._battlePaused=true;f.fx.update(9000,f.view);assert.equal(n.frame.name,frame);assert.equal(n.active,true);
 assert.equal(f.fx.shot(f.bullet(),60,f.view),false,'paused clock accepts no new muzzle');
 for(const flag of ['_battlePaused','_publicBattleDialog']){
  const g=fixture();g.view.beginShot(0,1,0,400);g.fx.shot(g.bullet(),0,g.view);g.scene[flag]=true;g.fx.update(0,g.view);
  assert.equal(g.fx.pendingShots.length,0);g.scene[flag]=false;g.view.update(0,false);assert.equal(g.fx.rows.length,0);
  assert.equal(g.nodes.some(x=>x.texture.key===KEY),false,flag);
 }
 const g=fixture();g.view.beginShot(0,1,0,400);g.fx.shot(g.bullet(),0,g.view);g.scene.game.loop.frame++;g.view.update(0,false);
 assert.equal(g.fx.rows.length,0);assert.equal(g.nodes.some(x=>x.texture.key===KEY),false,'skipped frame');
});

test('hurt and committed action poses never emit the new muzzle',()=>{
 for(const state of ['hurt','action']){
  const f=fixture();if(state==='hurt')f.scene.battleRecord.playerHitCount++;else f.scene.publicPerformerRun.actions++;
  queued(f);assert.equal(f.view.state,state);assert.equal(f.fx.rows.length,0);assert.equal(f.fx.pendingShots.length,0);
  assert.equal(f.nodes.some(n=>n.texture.key===KEY),false,state);
 }
});

test('end, destroy and the shared 24 budget dispose exact muzzle nodes once',()=>{
 const f=fixture();queued(f);const n=f.fx.rows[0].node;f.scene._battleEnded=true;f.fx.update(0,f.view);
 assert.equal(f.fx.rows.length,0);assert.equal(n.dead,1);
 const g=fixture();queued(g);const m=g.fx.rows[0].node;g.fx.destroy();g.fx.destroy();assert.equal(m.dead,1);assert.equal(g.fx.rows.length,0);
 const h=fixture();for(let i=0;i<30;i++)h.fx.shot(h.bullet(),0);
 const muzzles=h.nodes.filter(n=>n.texture.key===KEY);assert.equal(muzzles.length,30);assert.equal(h.fx.rows.length,24);
 assert.equal(muzzles.filter(n=>n.active).length,24);assert(muzzles.every(n=>n.dead<=1));assert.equal(h.fx.stats.culled,6);
});

test('authoritative bullet data and the projectile bank are untouched by the muzzle choice',()=>{
 const f=fixture(),b=f.bullet(),before={...b,body:{...b.body}};delete before.gfx;queued(f,b);
 const after={...b};delete after.gfx;assert.deepEqual(after,before);assert.equal(f.fx.stats.shots,1);
 const v=f.fx.projectileVisual(516,988,'pink',0xff69b4);assert.equal(v.node.texture.key,RIFLE_COMIC_PROJECTILE.key);
 assert.equal(f.fx.rows.some(r=>r.node===v.node),false);
});

test('kai and enjo ordinary shots stay identical whether or not the muzzle bank exists',()=>{
 const snap=(id,missing)=>{const f=fixture(id,missing),b=f.bullet();assert.equal(f.fx.shot(b,0,f.view),true);f.view.update(0,false);
  return {frame:f.fx.lastFrame,rows:f.fx.rows.map(r=>({kind:r.kind,artKind:r.artKind,key:r.node.texture.key,x:r.x,y:r.y,size:r.size,angle:r.angle,
   origin:r.node.origin,w:r.node.displayWidth,h:r.node.displayHeight,alpha:r.node.alpha,depth:r.node.depth,frameName:r.node.frame.name})),rot:b.gfx.rotation};};
 for(const [id,kind] of [['kai','sweep'],['enjo','burst']]){
  const a=snap(id,[]),b=snap(id,[KEY]);assert.deepEqual(a,b,id);
  assert.equal(a.rows.length,1);assert.equal(a.rows[0].key,USER_WEAPON_FX[kind].key);assert.equal(a.rows[0].artKind,kind);
  assert.deepEqual([a.rows[0].x,a.rows[0].y],[516,988]);
 }
});
