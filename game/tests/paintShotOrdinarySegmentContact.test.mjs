import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {STAGE1_PAINT_IMPACT_REACH,STAGE1_UNLIT_HIT_RADIUS,STAGE1_PAINT_WORLD_WIDTH,STAGE1_PAINT_WORLD_HEIGHT} from '../src/utils/stage1PaintRound.mjs';
import {PUBLIC_STAGE1_ENEMY_ROLES as ROLES,PUBLIC_STAGE1_ENEMY_STATES as STATES} from '../src/systems/PublicStage1EnemyRoles.mjs';

// Real installed Phaser 3 CJS geometry; only the counter is added around the sweep.
const require=createRequire(import.meta.url);
const GetNearestPoint=require('phaser/src/geom/line/GetNearestPoint.js');
const GetLineToCircle=require('phaser/src/geom/intersects/GetLineToCircle.js');
const Between=require('phaser/src/math/distance/DistanceBetween.js');
const Circle=require('phaser/src/geom/circle/Circle.js');
let sweeps=0;
const Phaser={Scene:class{},Geom:{Circle,Line:{GetNearestPoint},Intersects:{GetLineToCircle:(...a)=>{sweeps++;return GetLineToCircle(...a);}}},Math:{Distance:{Between}}};
const {BattleScene,PaintZoneSystem}=loadBattleScene({Phaser,includeOwners:true});
const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
const start=source.indexOf('    this.playerBullets.children.iterate(b => {',source.indexOf('const dt = delta / 1000;'));
const end=source.indexOf('    this.enemyBullets.children.iterate(b => {',start);
assert(start>0&&end>start);
const loop=source.slice(start,end);
const step=Function('Phaser','STAGE1_PAINT_IMPACT_REACH','STAGE1_PAINT_WORLD_WIDTH','STAGE1_PAINT_WORLD_HEIGHT',
 'return function(dt){const time=100;'+loop+'}')(Phaser,STAGE1_PAINT_IMPACT_REACH,STAGE1_PAINT_WORLD_WIDTH,STAGE1_PAINT_WORLD_HEIGHT);

const enemy=(x,y,extra={})=>({x,y,active:true,publicStage1EnemyRole:ROLES.UNLIT_CHASER,...extra});
const device=(x,y,extra={})=>({x,y,zone:0,complete:false,...extra});
function fixture({from={x:100,y:600},vx=1000,vy=0,aim={x:900,y:600},enemies=[],devices=[],wall=Infinity,cast=true,finale=false,
 chapterObjectives=null,paintShot=true}={}){
 const events=[],bullet={...from,active:true,paintShot,moveVx:vx,moveVy:vy,paintTargetX:aim.x,paintTargetY:aim.y,color:'blue',
  body:{reset(x,y){events.push(['body',x,y]);},updateFromGameObject(){}},gfx:{setPosition(){}}};
 const paintZone=Object.assign(Object.create(PaintZoneSystem.prototype),{devices,currentZone:0,finaleMode:finale,chapterObjectives,
  paintAttackTrail:(a,b)=>events.push(['trail',a.x,a.y,b.x,b.y])});
 const scene=Object.assign(Object.create(BattleScene.prototype),{_userCastPresentation:cast,paintZone,
  playerBullets:{children:{iterate:fn=>fn(bullet)}},enemies:{children:{iterate:fn=>enemies.forEach(fn)}},
  oldStreet:{clearLine:(a,b)=>Math.max(a.x,b.x)<wall},textures:{exists:()=>false},_isPublicStage1Round:()=>true,
  _onBulletHitEnemy:(b,e)=>events.push(['legacy-hit',e]),
  _detonatePaintBullet(b,blob){events.push(['detonate',b.x,b.y,blob]);b.active=false;},
  _disposePlayerProjectile(b,reason){events.push(['dispose',reason]);b.active=false;}});
 return {scene,bullet,events,run:(dt=.1)=>step.call(scene,dt),hits:()=>events.filter(e=>e[0]==='detonate')};
}
const near=(hit,target,radius)=>{const d=Math.hypot(hit[1]-target.x,hit[2]-target.y);return d<radius&&d>radius-.05;};
function assertMissed(f,x=200){assert.equal(f.hits().length,0);assert.equal(f.bullet.x,x);}
function ran(options){const f=fixture(options);f.run(.1);return f;}

test('hypothesis: 100ms segment passing an ordinary enemy contacts it once just inside the strict radius',()=>{
 const e=enemy(150,600),f=fixture({enemies:[e]}),before=sweeps;f.run(.1);
 const hits=f.hits();assert.equal(hits.length,1);assert.equal(hits[0][3],e);assert(near(hits[0],e,STAGE1_UNLIT_HIT_RADIUS));
 assert(hits[0][1]<150);assert(sweeps>before,'installed Phaser GetLineToCircle owns the sweep');
 assert.deepEqual(f.events.find(x=>x[0]==='trail'),['trail',100,600,hits[0][1],600]);
 assert.deepEqual(f.events.find(x=>x[0]==='body'),['body',hits[0][1],600]);
 f.run(.1);assert.equal(f.hits().length,1,'endpoint owner resolves exactly once');
});
test('hypothesis: 100ms segment passing an eligible facility contacts it via the existing hitTest owner',()=>{
 const d=device(150,610),f=ran({devices:[d]});
 const hits=f.hits();assert.equal(hits.length,1);assert.equal(hits[0][3],null);assert(near(hits[0],d,STAGE1_PAINT_IMPACT_REACH));
});
test('earliest eligible contact wins regardless of iteration order and across enemy/facility',()=>{
 const a=enemy(170,600),b=enemy(140,600),f=ran({enemies:[a,b]});
 assert.equal(f.hits().length,1);assert.equal(f.hits()[0][3],b);assert(near(f.hits()[0],b,STAGE1_UNLIT_HIT_RADIUS));
 const d=device(130,610),g=ran({enemies:[enemy(170,600)],devices:[d]});
 assert.equal(g.hits().length,1);assert.equal(g.hits()[0][3],null);assert(near(g.hits()[0],d,STAGE1_PAINT_IMPACT_REACH));
});
test('reversed and diagonal segments contact on the entry side',()=>{
 const r=enemy(250,600),f=ran({from:{x:300,y:600},vx:-1000,enemies:[r]});
 assert.equal(f.hits().length,1);assert(f.hits()[0][1]>250);assert(near(f.hits()[0],r,STAGE1_UNLIT_HIT_RADIUS));
 const d=enemy(135,535),g=ran({from:{x:100,y:500},vx:700,vy:700,enemies:[d]});
 const hit=g.hits()[0];assert(hit);assert(hit[1]<135&&hit[2]<535);assert(Math.abs((hit[1]-100)-(hit[2]-500))<1e-9);
 assert(near(hit,d,STAGE1_UNLIT_HIT_RADIUS));
});
test('start inside an eligible circle contacts at the previous point without moving away',()=>{
 const e=enemy(110,600),f=ran({enemies:[e]});
 assert.deepEqual(f.hits(),[['detonate',100,600,e]]);
});
test('strict boundary: exact tangency at current radii is not a hit, slightly inside is',()=>{
 assertMissed(ran({enemies:[enemy(150,600+STAGE1_UNLIT_HIT_RADIUS)]}));
 assertMissed(ran({devices:[device(150,600+STAGE1_PAINT_IMPACT_REACH)]}));
 const e=enemy(150,600+STAGE1_UNLIT_HIT_RADIUS-.1);assert.equal(ran({enemies:[e]}).hits()[0]?.[3],e);
 assert.equal(ran({devices:[device(150,600+STAGE1_PAINT_IMPACT_REACH-.1)]}).hits().length,1);
});
test('no backward, beyond-segment or infinite-line contacts',()=>{
 assertMissed(ran({enemies:[enemy(60,600),enemy(235,600),enemy(400,600)],devices:[device(55,600),device(240,600)]}));
});
test('complete, future-zone, chapter-blocked and suppressed fixtures match hitTest eligibility',()=>{
 for(const options of [{devices:[device(150,600,{complete:true})]},{devices:[device(150,600,{zone:1})]},
  {devices:[device(150,600)],chapterObjectives:{canReceive:()=>false}},
  {devices:[device(150,600,{publicStage1Suppressed:true})],chapterObjectives:{canReceive:()=>true}}])assertMissed(ran(options));
 assert.equal(ran({devices:[device(150,600)],chapterObjectives:{canReceive:()=>true}}).hits().length,1);
 const later=device(170,600),g=ran({devices:[device(130,600,{complete:true}),later]});
 assert.equal(g.hits().length,1);assert(near(g.hits()[0],later,STAGE1_PAINT_IMPACT_REACH));
});
test('dead, destroyed, ineligible-state and invalid enemies never invent contact',()=>{
 const f=ran({enemies:[enemy(130,600,{active:false}),enemy(140,600,{destroyed:true}),
  enemy(150,600,{publicStage1EnemyRole:ROLES.OBJECTIVE_DISRUPTOR,publicStage1EnemyState:'idle'}),
  enemy(160,600,{publicStage1EnemyRole:ROLES.SPOTLIGHT_CAPTAIN,publicStage1EnemyState:STATES.WINDUP}),
  enemy(NaN,600),enemy(170,600,{publicStage1EnemyRole:'unknown'})]});
 assertMissed(f);assert(Number.isFinite(f.bullet.x+f.bullet.y));
 const w=enemy(150,600,{publicStage1EnemyRole:ROLES.OBJECTIVE_DISRUPTOR,publicStage1EnemyState:STATES.WINDUP});
 assert.equal(ran({enemies:[w]}).hits()[0]?.[3],w);
});
test('wall before candidate still consumes the shot; wall after candidate no longer erases the hit',()=>{
 const f=ran({enemies:[enemy(150,600)],wall:110});
 assert.equal(f.hits().length,0);assert.deepEqual(f.events.filter(e=>e[0]==='dispose'),[['dispose','street-cover']]);
 const e=enemy(150,600),g=ran({enemies:[e],wall:180});
 assert.equal(g.hits().length,1);assert.equal(g.hits()[0][3],e);assert(!g.events.some(x=>x[0]==='dispose'));
});
test('finale, legacy cast and nonpaint projectiles keep their original step',()=>{
 const weak=enemy(150,600,{publicStage1EnemyRole:ROLES.FINALE_WEAK_POINT});
 assertMissed(ran({finale:true,enemies:[weak],devices:[device(150,600)]}));
 assertMissed(ran({cast:false,enemies:[enemy(150,600)],devices:[device(150,600)]}));
 const n=ran({paintShot:false,enemies:[enemy(150,600)]});assert.equal(n.bullet.x,200);
 assert(!n.events.some(e=>e[0]==='legacy-hit'||e[0]==='detonate'));
});
test('captured landing bounds the sweep first; enemies past the landing point are not reached',()=>{
 assert.deepEqual(ran({aim:{x:150,y:600},enemies:[enemy(190,600)]}).hits(),[['detonate',150,600,null]]);
});
test('zero travel and invalid inputs return the unchanged endpoint object',()=>{
 assertMissed(ran({vx:0,enemies:[enemy(200,600)]}),100);
 const m=BattleScene.prototype._resolvePaintShotOrdinaryContact;assert.equal(typeof m,'function');
 const g=fixture({enemies:[enemy(150,600)]}),to={x:200,y:600};
 for(const [from,bullet] of [[{x:NaN,y:600},g.bullet],[{x:100,y:600},{...g.bullet,active:false}],
  [{x:100,y:600},{...g.bullet,paintShot:false}],[{x:100,y:600},null]])assert.equal(m.call(g.scene,from,to,bullet),to);
});
test('source order: landing, ordinary contact, move/body, trail, cover, endpoint owner',()=>{
 const at=s=>{const i=loop.indexOf(s);assert(i>0,s);return i;};
 const order=['_resolvePaintShotLanding(previous','_resolvePaintShotOrdinaryContact(previous','b.x = next.x',
  'paintAttackTrail','street-cover','this.paintZone?.hitTest(b.x, b.y)','this._detonatePaintBullet(b, blob)'].map(at);
 assert.deepEqual([...order].sort((a,b)=>a-b),order);
 assert.equal(loop.split('_detonatePaintBullet(').length,2);
 const method=source.slice(source.indexOf('  _resolvePaintShotOrdinaryContact('),source.indexOf('  _detonatePaintBullet(bullet'));
 for(const s of ['Phaser.Geom.Intersects.GetLineToCircle','STAGE1_UNLIT_HIT_RADIUS','STAGE1_PAINT_IMPACT_REACH','finaleMode','_userCastPresentation'])
  assert(method.includes(s),s);
});
