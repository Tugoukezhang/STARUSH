import test from 'node:test';
import assert from 'node:assert/strict';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';
import {SHOOT_CONFIG} from '../src/utils/config.js';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

const Phaser={Scene:class{},Math:{Clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}};
const BattleScene=loadBattleScene({Phaser});
const {ActorPresentation}=loadScenes().loadRuntime('systems/ActorPresentation.mjs');

// Real BattleScene methods and a real cast view sharing one player.
function rig({id='sakura',player={x:500,y:1000},street=new OldStreetState([])}={}){
 let time=0;
 const node=()=>({frame:{name:0},texture:{key:''},setOrigin(){return this;},setDisplaySize(){return this;},setDepth(){return this;},setTint(){return this;},
  setAlpha(){return this;},setAngle(){return this;},setFlipX(f){this.flipX=f;return this;},setPosition(){return this;},setTexture(k,f){this.texture={key:k};this.frame.name=f;return this;},setCrop(){return this;},setVisible(){return this;},destroy(){}});
 const s=Object.assign(Object.create(BattleScene.prototype),{_userCastPresentation:true,_isPublicStage1Round:()=>true,game:{loop:{frame:0}},
  player:{...player,hp:5,active:true},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},publicPerformerRun:{member:{id},growth:{choices:[]},actions:0,now:()=>time},
  oldStreet:street,textures:{exists:()=>true},add:{ellipse:node,image:node},enemies:{children:{iterate(){}}}});
 const v=new UserCastPresentation(s,id);s.actorPresentation={userCastView:v};v.update(0,false);
 return {s,v,setTime:t=>time=t};
}
const KEYS=['flip','handFlip','handShotClock','shotAt','shotClock','shotDuration','streakUntil','actionClock','hurtClock','idleClock','clock','lastNow','wasFrozen','walkDistance','lastX','lastY','state','upperCel','actions','hits'];
const snap=(s,v)=>JSON.stringify({view:KEYS.map(k=>v[k]),frame:v.image.frame.name,key:v.image.texture.key,flipX:v.image.flipX,player:s.player});
// The scene runs in a vm realm; compare plain coordinates.
const O=(s,t)=>{const o=s._getPublicStage1PaintShotOrigin(t);return o&&{x:o.x,y:o.y};};
const oldHand=(v,p)=>({x:p.x+((v.handFlip??v.flip)?-1:1)*(v.facesLeft?-1:1)*16,y:p.y-12});

test('stale right hand cannot launch a left target from the far side, and vice versa',()=>{
 for(const [shotDx,target,x] of [[1,{x:300,y:1000},484],[-1,{x:700,y:1000},516],[1,{x:380,y:760},484],[-1,{x:620,y:1240},516]]){
  const {s,v}=rig();v.beginShot(0,shotDx,0,400);v.update(0,false);
  assert.equal(v.handWorld().x,1000-x,'precondition: physical hand still holds the previous shot side');
  assert.deepEqual(O(s,target),{x,y:988},'target '+target.x+','+target.y);
 }
});

test('moving retreat overwrites the hand after 140ms while the body keeps the shot side',()=>{
 const {s,v,setTime}=rig();v.beginShot(0,-1,0,400);
 for(let t=20;t<=300;t+=20){setTime(t);s.player.x+=2;v.update(t,false);}
 assert.equal(v.flip,true,'body still faces the left shot streak');assert.equal(v.handFlip,false,'movement moved the physical hand right');
 assert.deepEqual(O(s,{x:200,y:1000}),{x:s.player.x-16,y:988});
 assert.deepEqual(O(s,{x:900,y:1000}),{x:s.player.x+16,y:988});
});

test('normalized .15 deadzone keeps the current side for vertical and near-vertical targets',()=>{
 for(const shotDx of [1,-1]){
  const {s,v}=rig();v.beginShot(0,shotDx,0,400);const side=v.handWorld();
  for(const [dx,dy] of [[0,-300],[0,300],[3,-20],[-3,-20],[2,-200],[-2,-200],[-3,20]])
   assert.deepEqual(O(s,{x:500+dx,y:1000+dy}),side,dx+','+dy);
  assert.deepEqual(v.handWorld(.15*shotDx),side);assert.deepEqual(v.handWorld(-.15*shotDx),side,'.15 itself is still inside the beginShot deadzone');
  assert.deepEqual(v.handWorld(-.1501*shotDx),{x:1000-side.x,y:988});
  assert.deepEqual(O(s,{x:500-4*shotDx,y:980}),{x:1000-side.x,y:988},'-4/20 is outside the deadzone');
 }
});

test('no-arg and non-finite queries stay exact for every cast; only rifle honours a direction',()=>{
 for(const id of ['sakura','kai','enjo'])for(const handFlip of [false,true,undefined]){
  const {s,v}=rig({id});v.handFlip=handFlip;v.flip=!handFlip;const before=snap(s,v),expected=oldHand(v,s.player);
  assert.deepEqual(v.handWorld(),expected,id);
  for(const bad of [undefined,null,NaN,Infinity,-Infinity,'-1','1',{},[]])assert.deepEqual(v.handWorld(bad),expected,id+' '+String(bad));
  if(id!=='sakura')for(const dx of [1,-1,.5,-.5])assert.deepEqual(v.handWorld(dx),expected,id+' ignores direction');
  assert.equal(snap(s,v),before);
 }
 const {v}=rig();assert.deepEqual(v.handWorld(-1),{x:484,y:988});assert.deepEqual(v.handWorld(1),{x:516,y:988});
 const {s}=rig();for(const target of [{x:NaN,y:900},{x:400,y:Infinity},null])assert.equal(O(s,target),null);
});

test('repeated and blocked target scans never begin a shot or move body, hand, state, clocks or walk',()=>{
 const wall=new OldStreetState([{id:'w',footprint:{x:380,y:900,width:20,height:200}}]);
 const {s,v,setTime}=rig({street:wall});v.beginShot(0,1,0,400);setTime(90);s.player.x+=3;v.update(90,false);
 const before=snap(s,v),candidates=[{x:200,y:1000},{x:300,y:960},{x:500,y:760},{x:520,y:1240},{x:800,y:1000},{x:NaN,y:1}];
 let beginShot=0;v.beginShot=()=>{beginShot++;return true;};
 s.paintZone={getNearestPaintable:(x,y,canAim)=>{let hit=null;for(let i=0;i<6;i++)for(const c of candidates)if(canAim(c)&&!hit)hit=c;return hit;}};
 for(let i=0;i<5;i++){
  for(const c of candidates)O(s,c);
  assert.equal(s._selectAutoAimTarget(),candidates[2]);
 }
 assert.equal(O(s,candidates[0]),null,'blocked candidate');
 assert.equal(beginShot,0);assert.equal(snap(s,v),before);
});

test('new rifle side can change the legal corridor; both radius-2 segments use the real cover',()=>{
 const target={x:300,y:1000};
 const left=new OldStreetState([{id:'l',footprint:{x:488,y:992,width:4,height:4}}]);
 assert(left.clearLine({x:500,y:1000},target),'direct target stays visible');
 assert.equal(left.clearLine({x:500,y:1000},{x:484,y:988},2),false);
 assert(left.clearLine({x:500,y:1000},{x:516,y:988},2)&&left.clearLine({x:516,y:988},target,2),'old far-side corridor was legal');
 let r=rig({street:left});r.v.beginShot(0,1,0,400);
 assert.deepEqual(O(r.s,target),{x:500,y:1000},'blocked new side falls back to the player, not the stale side');
 const right=new OldStreetState([{id:'r',footprint:{x:508,y:992,width:4,height:4}}]);
 assert.equal(right.clearLine({x:500,y:1000},{x:516,y:988},2),false);
 assert(right.clearLine({x:500,y:1000},{x:484,y:988},2)&&right.clearLine({x:484,y:988},target,2));
 r=rig({street:right});r.v.beginShot(0,1,0,400);
 assert.deepEqual(O(r.s,target),{x:484,y:988},'old-side cover no longer forces a centre launch');
});

test('world clamp and player-centre fallback apply to the target-resolved hand',()=>{
 let r=rig({player:{x:10,y:1000}});r.v.beginShot(0,1,0,400);
 assert.deepEqual(O(r.s,{x:0,y:1000}),{x:8,y:988});
 r=rig({player:{x:992,y:1000}});r.v.beginShot(0,-1,0,400);
 assert.deepEqual(O(r.s,{x:1000,y:1000}),{x:992,y:988});
 const calls=[];r=rig({player:{x:10,y:1000}});r.v.beginShot(0,1,0,400);
 r.s.oldStreet={clearLine:(a,b,pad)=>{calls.push([a.x,a.y,b.x,b.y,pad]);return !(b.x===8&&b.y===988);}};
 assert.deepEqual(O(r.s,{x:0,y:1000}),{x:10,y:1000});
 assert.deepEqual(calls,[[10,1000,0,1000,undefined],[10,1000,8,988,2],[10,1000,10,1000,2],[10,1000,0,1000,2]]);
});

test('actual _tryShoot spawns at the target side, then beginShot agrees with that physical hand',()=>{
 const {s,v}=rig(),target={x:300,y:1000},log=[];v.beginShot(0,1,0,400);
 const query=s._getPublicStage1PaintShotOrigin;let bullet;
 Object.assign(s,{_selectAutoAimTarget:()=>target,lastShotTime:0,currentColor:'pink',paintZone:null,support:{getCenterStageFireRateMultiplier:()=>1},
  dmgCalc:{rollCrit:()=>false},_configureCenteredArcadeCircle(){},_createPlayerBulletVisual:()=>({node:{},offsetX:0,offsetY:0}),
  _trackCombatObject:()=>true,playerBullets:{add(){}},time:{delayedCall(){}},
  _getPublicStage1PaintShotOrigin(t){log.push('origin');return query.call(this,t);},
  physics:{add:{sprite(x,y){log.push('sprite');return bullet={x,y,setAlpha(){return this;},setDepth(){return this;},body:{setCircle(){}}};}}}});
 s.actorPresentation={userCastView:v,queueBasicShotFx:()=>true,
  notifyBasicShot(...a){log.push(['notify',v.handFlip]);return ActorPresentation.prototype.notifyBasicShot.apply(this,a);}};
 s._tryShoot(1000);
 assert.deepEqual(log,['origin','sprite',['notify',false]],'origin and bullet still precede the facing update');
 assert.deepEqual([bullet.x,bullet.y,bullet.bornX],[484,988,484]);assert(bullet.moveVx<0);
 assert.equal(v.handFlip,true);assert.deepEqual(v.handWorld(),{x:bullet.x,y:bullet.y});
});

// Real _tryShoot through the real notifyBasicShot; legacy uses the non-cast presentation path.
function shoot(r,target,{track=true,legacy=false}={}){
 const {s,v}=r,log=[];let bullet=null;
 Object.assign(s,{_selectAutoAimTarget:()=>target,lastShotTime:0,currentColor:'pink',paintZone:null,support:{getCenterStageFireRateMultiplier:()=>1},
  dmgCalc:{rollCrit:()=>false},_configureCenteredArcadeCircle(){},_createPlayerBulletVisual:()=>({node:{},offsetX:0,offsetY:0}),
  _trackCombatObject:()=>track,playerBullets:{add(){}},time:{delayedCall(){}},
  physics:{add:{sprite(x,y){return bullet={x,y,setAlpha(){return this;},setDepth(){return this;},body:{setCircle(){}}};}}}});
 s.actorPresentation=legacy?{queueBasicShotFx:()=>true,notifyBasicShot(...a){log.push(a.slice(1,3));}}
  :{userCastView:v,queueBasicShotFx:()=>true,notifyBasicShot(...a){log.push(a.slice(1,3));return ActorPresentation.prototype.notifyBasicShot.apply(this,a);}};
 if(legacy)s._userCastPresentation=false;
 s._tryShoot(1000);
 return {bullet,log};
}
// The unchanged spawn-relative interception aim from _tryShoot (BULLET_SPEED 500).
function oldAim(o,t){
 let px=t.x,py=t.y;
 for(let i=0;i<2;i++){const dx=px-o.x,dy=py-o.y,time=Math.sqrt(dx*dx+dy*dy)/500;px=t.x+(t.moveVx||0)*time;py=t.y+(t.moveVy||0)*time;}
 const dx=px-o.x,dy=py-o.y,len=Math.sqrt(dx*dx+dy*dy)||1;return [dx/len,dy/len];
}

test('near-vertical +/-.16 target commits the body to the accepted hand without changing the bullet',()=>{
 for(const side of [1,-1]){
  const r=rig();r.v.beginShot(0,-side,0,400);r.v.update(0,false);
  const target={x:500+19.2*side,y:880};
  assert(Math.abs(19.2/Math.hypot(19.2,120)-.158)<.001,'target-centre query is outside .15');
  const {bullet,log}=shoot(r,target),[vx,vy]=oldAim(bullet,target);
  assert.deepEqual([bullet.x,bullet.y],[500+16*side,988],'query chose the target-side hand');
  assert(Math.abs(vx)<.15&&Math.abs(vx)>.02,'spawn-relative aim '+vx+' is inside the beginShot deadzone');
  assert.deepEqual([bullet.moveVx,bullet.moveVy],[vx*500,vy*500],'bullet velocity is the exact old aim');
  assert.deepEqual(log,[[side,vy]],'facing dx is the accepted hand side; dy is the old aim');
  assert.equal(r.v.handFlip,side<0);assert.equal(r.v.flip,side<0);
  assert.deepEqual(r.v.handWorld(),{x:bullet.x,y:bullet.y});
 }
});

test('predicted crossing keeps the old bullet velocity while the body commits to the launch hand',()=>{
 for(const side of [1,-1])for(const stale of [1,-1]){
  const r=rig();r.v.beginShot(0,stale,0,400);r.v.update(0,false);
  const target={x:500+100*side,y:1000,moveVx:-2000*side,moveVy:0};
  const {bullet,log}=shoot(r,target),[vx,vy]=oldAim(bullet,target);
  assert.deepEqual([bullet.x,bullet.y],[500+16*side,988]);
  assert(vx*side<-.15,'prediction crosses to the opposite side');
  assert.deepEqual([bullet.moveVx,bullet.moveVy],[vx*500,vy*500]);
  assert.deepEqual(log,[[side,vy]]);
  assert.equal(r.v.handFlip,side<0);assert.deepEqual(r.v.handWorld(),{x:bullet.x,y:bullet.y});
 }
});

test('centre fallback, other casts and legacy notify keep the exact old aim dx',()=>{
 const left=new OldStreetState([{id:'l',footprint:{x:488,y:992,width:4,height:4}}]),target={x:300,y:1100};
 let r=rig({street:left});r.v.beginShot(0,1,0,400);r.v.update(0,false);
 let {bullet,log}=shoot(r,target);
 assert.deepEqual([bullet.x,bullet.y],[500,1000],'blocked hand falls back to the player centre');
 assert.deepEqual(log,[oldAim(bullet,target)]);assert(log[0][0]>-1&&log[0][0]<-.15);
 for(const id of ['kai','enjo'])for(const t of [{x:519.2,y:880},{x:480.8,y:880},{x:600,y:1000,moveVx:-2000},{x:300,y:1000}]){
  r=rig({id});r.v.beginShot(0,1,0,400);r.v.update(0,false);({bullet,log}=shoot(r,t));
  assert.deepEqual(log,[oldAim(bullet,t)],id+' '+t.x);
 }
 for(const t of [{x:519.2,y:880},{x:600,y:1000,moveVx:-2000}]){
  r=rig();({bullet,log}=shoot(r,t,{legacy:true}));
  assert.deepEqual([bullet.x,bullet.y],[500,1000]);assert.deepEqual(log,[oldAim(bullet,t)],'legacy '+t.x);
 }
});

test('blocked or untracked shots never notify or mutate the cast',()=>{
 const wall=new OldStreetState([{id:'w',footprint:{x:505,y:900,width:4,height:200}}]);
 let r=rig({street:wall});r.v.beginShot(0,-1,0,400);r.v.update(0,false);let before=snap(r.s,r.v);
 let {bullet,log}=shoot(r,{x:600,y:1000});
 assert.equal(bullet,null);assert.deepEqual(log,[]);assert.equal(snap(r.s,r.v),before);
 r=rig();r.v.beginShot(0,-1,0,400);r.v.update(0,false);before=snap(r.s,r.v);
 ({bullet,log}=shoot(r,{x:519.2,y:880},{track:false}));
 assert.deepEqual([bullet.x,bullet.y],[516,988]);assert.deepEqual(log,[]);assert.equal(snap(r.s,r.v),before);
});

test('retreating near-vertical fire keeps the active body side until the existing streak expires',()=>{
 for(const side of [1,-1]){
  const r=rig();r.v.beginShot(0,side,0,400);
  for(let t=20;t<=300;t+=20){r.setTime(t);r.s.player.x-=side*2;r.v.update(t,false);}
  assert.equal(r.v.flip,side<0);assert.equal(r.v.handFlip,side>0,'movement changed the physical hand, not the firing body');
  const target={x:r.s.player.x,y:800},expected={x:r.s.player.x+16*side,y:988},before=snap(r.s,r.v);
  assert.deepEqual(O(r.s,target),expected,'vertical candidate keeps the active firing body side');
  assert.equal(snap(r.s,r.v),before,'protected query is still read-only');
  const {bullet}=shoot(r,target);
  assert.deepEqual([bullet.x,bullet.y],[expected.x,expected.y]);assert.equal(r.v.flip,side<0);assert.equal(r.v.handFlip,side<0);
  assert.equal(r.v.streakUntil,r.v.shotClock+Math.min(SHOOT_CONFIG.FIRE_RATE,500)+100,'accepted vertical fire renews the existing streak');
  r.v.clock=r.v.streakUntil+1;r.v.handFlip=side>0;
  assert.deepEqual(O(r.s,target),{x:r.s.player.x-16*side,y:988},'expired streak returns the current physical-hand fallback');
 }
});

test('committed facing signal never replaces the real bullet velocity used by weapon FX',()=>{
 for(const [vx,vy]of [[-500,125],[500,-300],[0,-500]]){
  const {s,v}=rig();let angle=null;const bullet={active:true,paintShot:true,x:516,y:988,moveVx:vx,moveVy:vy,color:'pink',gfx:{setRotation:value=>{angle=value;}}};
  const host={userCastView:v,disposed:false};
  assert.equal(ActorPresentation.prototype.notifyBasicShot.call(host,0,1,.88,400),true);
  assert.equal(ActorPresentation.prototype.queueBasicShotFx.call(host,bullet,0),true);
  const expected=Math.atan2(vy,vx);assert.equal(angle,expected);assert.equal(v.weaponFx.pendingShots[0].angle,expected);
  assert.deepEqual([bullet.moveVx,bullet.moveVy],[vx,vy]);
 }
});

test('world-inset centre fallback cannot invent a facing side outside the eight-pixel inset',()=>{
 for(const [x,side,originX]of [[4,-1,8],[996,1,992]]){
  const r=rig({player:{x,y:1000}});r.v.beginShot(0,side,0,400);r.v.update(0,false);
  r.s.oldStreet={clearLine:(a,b)=>b.y!==988};
  const target={x,y:800},{bullet,log}=shoot(r,target);
  assert.deepEqual([bullet.x,bullet.y],[originX,1000],'the player-centre fallback is clamped');
  assert.deepEqual(log,[oldAim(bullet,target)],'clamping the centre must keep the old facing signal');
  assert.equal(r.v.flip,side<0);
 }
});
