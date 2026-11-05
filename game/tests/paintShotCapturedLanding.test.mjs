import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {STAGE1_PAINT_IMPACT_REACH,STAGE1_PAINT_WORLD_WIDTH,STAGE1_PAINT_WORLD_HEIGHT} from '../src/utils/stage1PaintRound.mjs';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';

const require=createRequire(import.meta.url);
const GetNearestPoint=require('phaser/src/geom/line/GetNearestPoint.js');
const Phaser={Scene:class{},Geom:{Line:{GetNearestPoint}},Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}};
const BattleScene=loadBattleScene({Phaser});
const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
const start=source.indexOf('    this.playerBullets.children.iterate(b => {',source.indexOf('const dt = delta / 1000;'));
const end=source.indexOf('    this.enemyBullets.children.iterate(b => {',start);
assert(start>0&&end>start);
const step=Function('Phaser','STAGE1_PAINT_IMPACT_REACH','STAGE1_PAINT_WORLD_WIDTH','STAGE1_PAINT_WORLD_HEIGHT',
  `return function(dt){const time=100;${source.slice(start,end)}}`)(Phaser,STAGE1_PAINT_IMPACT_REACH,STAGE1_PAINT_WORLD_WIDTH,STAGE1_PAINT_WORLD_HEIGHT);

function fixture({from={x:100,y:600},aim={x:150,y:600},vx=500,vy=0,wall=Infinity,paintShot=true,publicRound=true}={}){
 const events=[],bullet={...from,active:true,moveVx:vx,moveVy:vy,paintShot,paintTargetX:aim.x,paintTargetY:aim.y,color:'blue',
  body:{reset(x,y){events.push(['body',x,y]);},updateFromGameObject(){events.push(['sync']);}},gfx:{setPosition(){}}};
 const scene={playerBullets:{children:{iterate:fn=>fn(bullet)}},enemies:{children:{iterate(){}}},
  _isPublicStage1Round:()=>publicRound,oldStreet:{clearLine:(a,b)=>Math.max(a.x,b.x)<wall},textures:{exists:()=>false},
  paintZone:{paintAttackTrail:(a,b)=>events.push(['trail',a.x,a.y,b.x,b.y]),hitTest:()=>null},
  _hitPublicStage1PaintTarget:()=>null,_detonatePaintBullet(b){events.push(['detonate',b.x,b.y]);b.active=false;},
  _disposePlayerProjectile(b,reason){events.push(['dispose',reason]);b.active=false;}};
 if(BattleScene.prototype._resolvePaintShotLanding)scene._resolvePaintShotLanding=BattleScene.prototype._resolvePaintShotLanding;
 return {scene,bullet,events,run:dt=>step.call(scene,dt)};
}

test('200ms public paint shot lands at crossed captured point, not beyond it',()=>{
 const f=fixture();f.run(.2);assert.deepEqual(f.events.filter(e=>e[0]==='detonate'),[['detonate',150,600]]);
 assert.deepEqual(f.events.find(e=>e[0]==='trail'),['trail',100,600,150,600]);
 assert.deepEqual(f.events.find(e=>e[0]==='body'),['body',150,600]);
});
test('same captured landing is not skipped by 250ms diagonal or reversed travel',()=>{
 for(const [from,aim,vx,vy,expected]of [
  [{x:100,y:500},{x:150,y:550},400,400,[150,550]],
  [{x:200,y:600},{x:150,y:600},-500,0,[150,600]],
 ]){const f=fixture({from,aim,vx,vy});f.run(.25);assert.deepEqual(f.events.find(e=>e[0]==='detonate'),['detonate',...expected]);}
});
test('normal frame already in landing radius preserves its exact endpoint',()=>{
 const f=fixture({from:{x:125,y:600}});f.run(1/60);
 assert.equal(f.bullet.x,125+500/60);assert.deepEqual(f.events.find(e=>e[0]==='detonate'),['detonate',f.bullet.x,600]);
});
test('near miss outside existing30 radius and infinite-line projections do not home',()=>{
 for(const aim of [{x:150,y:631},{x:50,y:600},{x:250,y:600}]){
  const f=fixture({aim});f.run(.2);assert.equal(f.bullet.x,200);assert(!f.events.some(e=>e[0]==='detonate'));
 }
});
test('wall before entire captured landing range still consumes projectile, never fabricates impact',()=>{
 const f=fixture({wall:115});f.run(.2);assert.deepEqual(f.events.filter(e=>e[0]==='dispose'),[['dispose','street-cover']]);
 assert(!f.events.some(e=>e[0]==='detonate'));
});
test('landing before later wall is resolved before whole-frame cover disposal',()=>{
 const f=fixture({wall:180});f.run(.2);assert.deepEqual(f.events.filter(e=>e[0]==='detonate'),[['detonate',150,600]]);
 assert(!f.events.some(e=>e[0]==='dispose'));
});
test('nonpublic and nonpaint projectiles keep original step without landing recovery',()=>{
 for(const options of [{paintShot:false},{publicRound:false}]){const f=fixture(options);f.run(.2);assert.equal(f.bullet.x,200);assert(!f.events.some(e=>e[0]==='detonate'));}
});
test('invalid captured point and stationary travel remain finite, without invented hits',()=>{
 for(const options of [{aim:{x:NaN,y:600}},{vx:0,aim:{x:150,y:600}}]){
  const f=fixture(options);f.run(.2);assert(Number.isFinite(f.bullet.x+f.bullet.y));assert(!f.events.some(e=>e[0]==='detonate'));
 }
});
test('near wall within original landing circle does not swallow a valid pre-wall impact',()=>{
 const f=fixture({aim:{x:150,y:625},wall:148});f.run(.2);
 const impact=f.events.find(e=>e[0]==='detonate');assert(impact);
 assert(impact[1]<148&&Math.hypot(impact[1]-150,impact[2]-625)<=STAGE1_PAINT_IMPACT_REACH);
 assert(!f.events.some(e=>e[0]==='dispose'));
});
test('wall entirely before landing circle still blocks and tangency retains original inclusive reach',()=>{
 const blocked=fixture({aim:{x:150,y:625},wall:120});blocked.run(.2);
 assert(!blocked.events.some(e=>e[0]==='detonate'));assert.equal(blocked.events.at(-1)[1],'street-cover');
 const tangent=fixture({aim:{x:150,y:630}});tangent.run(.2);
 assert.deepEqual(tangent.events.find(e=>e[0]==='detonate'),['detonate',150,600]);
});
test('real street geometry retains2px clearance and cannot change map interaction state',()=>{
 const street=new OldStreetState([{id:'test-wall',footprint:{x:150,y:550,width:20,height:120}}]);
 const f=fixture({aim:{x:150,y:625}});f.scene.oldStreet=street;
 f.run(.2);const impact=f.events.find(e=>e[0]==='detonate');assert(impact);
 assert(impact[1]<148);assert(street.clearLine({x:100,y:600},{x:impact[1],y:impact[2]},2));
 assert.equal(street.opened.size,0);assert.equal(street.restored.size,0);
});
test('starting inside a real padded blocker cannot escape it to invent an impact',()=>{
 const street=new OldStreetState([{id:'test-wall',footprint:{x:128,y:550,width:12,height:120}}]);
 const f=fixture({from:{x:130,y:600},aim:{x:150,y:625}});f.scene.oldStreet=street;f.run(.2);
 assert(!f.events.some(e=>e[0]==='detonate'));assert.equal(f.events.at(-1)[1],'street-cover');
});
test('diagonal cover clipping interpolates both axes on the original traveled line',()=>{
 const f=fixture({from:{x:100,y:600},aim:{x:150,y:650},vx:400,vy:400,wall:148});f.run(.25);
 const impact=f.events.find(e=>e[0]==='detonate');assert(impact);assert(impact[1]<148&&impact[2]<648);
 assert.equal(impact[2]-600,impact[1]-100);assert(Math.hypot(impact[1]-150,impact[2]-650)<=STAGE1_PAINT_IMPACT_REACH);
});
test('opened real street blocker no longer clips a captured landing',()=>{
 const street=new OldStreetState([{id:'test-wall',footprint:{x:128,y:550,width:12,height:120}}]);street.opened.add('test-wall');
 const f=fixture({aim:{x:150,y:625}});f.scene.oldStreet=street;f.run(.2);
 assert.deepEqual(f.events.find(e=>e[0]==='detonate'),['detonate',150,600]);assert.deepEqual([...street.opened],['test-wall']);
});
