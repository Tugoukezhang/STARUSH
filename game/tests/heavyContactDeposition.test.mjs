import test from 'node:test';
import assert from 'node:assert/strict';
import {PerformerMeleeCombat} from '../src/systems/PerformerMeleeCombat.mjs';
function fixture(id='enjo'){
 let now=1000;const enemies=[],devices=[],ground=[],impacts=[],receipts=[],paint=[];
 const s={_userCastPresentation:true,_battlePerformerContract:{publicActionOwnerId:id},player:{x:200,y:200,hp:5,active:true},currentColor:'blue',battleRecord:{playerHitCount:0},time:{now},
  enemies:{getChildren:()=>enemies},oldStreet:{clearLine:(_p,t)=>!t.covered},
  paintZone:{devices,currentZone:0,canReceivePaint:t=>!t.reject,applyPaint(t,amount){if(t.reject)return false;paint.push({t,amount});return true;}},
  actorPresentation:{notifyBasicShot:()=>true,userCastView:{state:'idle',weaponFx:{meleeSwing(){},blocked(){},impact:p=>impacts.push(p)}}},
  _stampGroundSplat:(...a)=>ground.push(a),
  _paintPublicStage1TargetsAt(x,y,amount,_radius,_color,t,observe){if(t.reject)return false;t.hp-=amount;paint.push({t,amount});observe({x,y,kind:'enemy'},t);return true;},
  _getPublicStage1ProtectedBossTarget:()=>enemies.find(t=>t.publicStage1EnemyRole==='finale-boss'&&t.publicStage1EnemyState==='windup')};
 const run={member:{id},actions:0,choiceOpen:false,now:()=>now,alive:()=>true,onImpact:(...a)=>receipts.push(a)};
 const m=new PerformerMeleeCombat(s,run);s.publicPerformerRun=run;
 const add=(angle=0,distance=64,kind='enemy',extra={})=>{const t={x:200+Math.cos(angle)*distance,y:200+Math.sin(angle)*distance,active:true,hp:100,drawRadius:12,publicStage1EnemyRole:'unlit-chaser',zone:0,complete:false,...extra};(kind==='fixture'?devices:enemies).push(t);return t;};
 return{s,m,run,enemies,devices,ground,impacts,receipts,paint,add,begin:t=>assert(m.beginBasic(t,1000)),tick:t=>{now=t;s.time.now=t;m.update(t);},release(){now=1000+m.kit.windup;m.update(now);}};
}
for(const kind of ['enemy','fixture'])for(let direction=0;direction<8;direction++)test(`heavy ${kind} ${direction}: same accepted contact owns the one ground stroke and landing FX`,()=>{
 const f=fixture(),t=f.add(direction*Math.PI/4,64,kind);f.begin(t);f.release();assert.equal(f.ground.length,1);assert.equal(f.impacts.length,1);
 assert.deepEqual(f.ground[0].slice(0,5),[t.x,t.y,'blue',32,true]);assert.deepEqual(f.ground[0][5],{performer:'enjo',angle:Math.atan2(t.y-200,t.x-200)});
 assert.equal(f.impacts[0].x,t.x);assert.equal(f.impacts[0].y,t.y);assert.equal(f.impacts[0].radius,32);assert.equal(f.impacts[0].contacts.length,1);assert.equal(f.paint.length,1);
});
test('primary enemy wins over earlier facility iteration without adding another stamp or changing growth receipt',()=>{
 const f=fixture(),d=f.add(0,45,'fixture'),t=f.add(0,70);f.begin(t);f.release();assert.equal(f.paint.length,2);assert.equal(f.ground.length,1);assert.equal(f.ground[0][0],t.x);assert.notEqual(f.ground[0][0],d.x);
 assert.equal(f.receipts.length,1);assert.equal(f.receipts[0][0],200+76*.48);assert.equal(f.receipts[0][1],200);
});
test('vanished primary falls back only to a genuinely accepted secondary, not a stale target',()=>{
 const f=fixture(),a=f.add(0,64),b=f.add(.1,68);f.begin(a);a.active=false;f.release();assert.equal(f.ground.length,1);assert.equal(f.ground[0][0],b.x);assert.equal(f.ground[0][1],b.y);
});
test('rejected and covered contacts cannot become the ground origin',()=>{
 const f=fixture(),a=f.add(0,64),b=f.add(.1,68),c=f.add(-.1,66,'fixture',{reject:true});f.begin(a);a.covered=true;f.release();assert.equal(f.paint.length,1);assert.equal(f.ground[0][0],b.x);assert.notEqual(f.ground[0][0],c.x);
});
test('a real whiff retains the original local release stroke, never paints the out-of-range target',()=>{
 const f=fixture(),a=f.add();f.begin(a);f.s.player.x=0;f.release();assert.equal(f.paint.length,0);assert.equal(f.ground.length,1);assert.equal(f.ground[0][0],76*.48);assert.equal(f.ground[0][1],200);assert.equal(f.impacts[0].hit,false);
});
test('pure protected armor never creates pigment; mixed armor and valid secondary uses only the valid contact',()=>{
 for(const mixed of [false,true]){const f=fixture(),boss=f.add(0,64,'enemy',{publicStage1EnemyRole:'finale-boss',publicStage1EnemyState:'windup'}),other=mixed?f.add(.1,68):null;f.begin(boss);f.release();assert.equal(f.m.stats.blocked,1);assert.equal(f.ground.length,mixed?1:0);if(mixed){assert.equal(f.ground[0][0],other.x);assert.equal(f.ground[0][1],other.y);}else assert.equal(f.impacts.length,0);}
});
test('one slow resolve and repeated updates do not duplicate ground strokes',()=>{
 const f=fixture(),t=f.add();f.begin(t);f.tick(2800);f.tick(2900);assert.equal(f.ground.length,1);assert.equal(f.impacts.length,1);assert.equal(f.m.stats.contacts,1);
});
test('sword keeps its existing release/deposition anchor and timing',()=>{
 const f=fixture('kai'),t=f.add();f.begin(t);f.release();assert.equal(f.ground[0][0],200+84*.48);assert.equal(f.ground[0][1],200);assert.equal(f.impacts[0].x,200+84*.48);assert.equal(f.m.kit.windup,78);
});
