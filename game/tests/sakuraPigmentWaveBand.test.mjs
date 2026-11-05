import test from 'node:test';
import assert from 'node:assert/strict';
import {SakuraCombat} from '../src/systems/SakuraCombat.mjs';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';

function fixture(kind='basic'){
 const fills=[],lines=[],paint=[],hits=[];let created=0,now=0;
 const gfx={active:true,depth:0,clear(){fills.length=0;lines.length=0;return this;},setDepth(d){this.depth=d;return this;},
  fillStyle(color,alpha){this.fill={color,alpha};return this;},fillPoints(points,closed){fills.push({points:structuredClone(points),closed,...this.fill});return this;},
  lineStyle(){return this;},lineBetween(...points){lines.push(points);return this;},destroy(){this.active=false;this.destroyCount=(this.destroyCount||0)+1;}};
 const view={state:{native:true,attackId:1,attackPhase:'windup'},handWorld:()=>({x:320,y:470})};
 const target={x:500,y:500,active:true,drawRadius:8,publicStage1EnemyRole:'unlit-chaser'};
 const scene={player:{x:300,y:500,active:true},currentColor:'pink',_specialCharge:100,_battlePerformerContract:{publicActionOwnerId:'sakura'},
  actorPresentation:{sakuraView:view},add:{graphics(){created++;return gfx;}},oldStreet:{clearLine:()=>true},
  paintZone:{devices:[],paintAttackFan:a=>paint.push({...a}),stampPaint(){}},enemies:{getChildren:()=>[target]},
  _paintPublicStage1TargetsAt(...args){hits.push(args);return true;},_getPublicStage1PaintTargetRange:()=>280};
 const run={member:{id:'sakura'},alive:()=>!scene._battleEnded,now:()=>now,effects:()=>({paintRadiusBonus:0}),onImpact(){}};
 const combat=new SakuraCombat(scene,run);
 assert(kind==='special'?combat.beginSpecial(target):kind==='encore'?combat.beginEncore(()=>{}):combat.beginBasic(target,0,400));
 const at=(t,draw=true)=>{now=t;combat.update(t);const pose=combat.snapshot(t);if(pose){view.state.attackId=pose.id;view.state.attackPhase=pose.phase;if(draw)combat.draw(t);}return pose;};
 return {scene,combat,gfx,fills,lines,paint,hits,at,get created(){return created;}};
}

test('actual release draws twenty bounded low-alpha pigment cells in one existing graphics node',()=>{
 const f=fixture(),pose=f.at(220),a=f.combat.attack,r=a.radius*pose.progress;
 assert.equal(f.fills.length,20,'A released attack needs a pigment surface, not only three thin lines');
 assert.equal(f.created,1);assert.equal(f.lines.length,60);
 for(const cell of f.fills){
  assert.equal(cell.closed,true);assert.equal(cell.points.length,4);assert.equal(cell.color,0xFF69B4);
  assert(cell.alpha>0&&cell.alpha<=.2);
  for(const p of cell.points){const d=Math.hypot(p.x-a.x,p.y-a.y);assert(d<=r+1e-8&&d>=r-18-1e-8);}
 }
 const before=structuredClone(f.combat.attack);f.combat.draw(220);assert.deepEqual(f.combat.attack,before);
 assert.equal(f.created,1);
});

test('windup and zero-progress release have no invented filled area; late recovery fades then clears',()=>{
 const f=fixture();f.at(80);assert.equal(f.fills.length,0);f.at(100);assert.equal(f.fills.length,0);
 f.at(200);assert(f.fills.length>0);const peak=f.fills[0].alpha;
 f.at(350);assert(f.fills.length>0);assert(f.fills.every(c=>c.alpha<peak));
 f.at(400);assert.equal(f.fills.length,0);assert.equal(f.combat.attack,null);
});

test('special stays within its wider committed sector with a 28px thickness cap, Encore never gains a band',()=>{
 const f=fixture('special'),pose=f.at(340),a=f.combat.attack,r=a.radius*pose.progress;
 assert.equal(f.fills.length,20);
 for(const {points}of f.fills)for(const p of points){const d=Math.hypot(p.x-a.x,p.y-a.y);assert(d<=r+1e-8&&d>=r-28-1e-8);}
 const encore=fixture('encore');encore.at(300);assert.equal(encore.fills.length,0);
});

test('filled cells cannot cross existing blocked rectangle footprints, including a small enclosed blocker',()=>{
 for(const footprint of [{x:385,y:445,width:8,height:80},{x:498,y:502,width:1,height:1}]){
  const f=fixture();f.at(220,false);const state=new OldStreetState([{id:'wall',footprint}]);
  f.scene.oldStreet={state,clearLine:state.clearLine.bind(state)};f.combat.draw(220);
  assert(f.fills.length>0,'Safe sectors should remain visible');
  for(const c of f.fills){const xs=c.points.map(p=>p.x),ys=c.points.map(p=>p.y);
   const overlap=Math.max(...xs)>=footprint.x&&Math.min(...xs)<=footprint.x+footprint.width
    &&Math.max(...ys)>=footprint.y&&Math.min(...ys)<=footprint.y+footprint.height;
   assert.equal(overlap,false,'Even an enclosed footprint must suppress that cell');
  }
 }
});

test('ray-only owners reject blocked adjacent edges, not just the vertices of the filled cell',()=>{
 const f=fixture();f.at(220,false);f.scene.oldStreet={clearLine:(from,to)=>Math.hypot(to.x-from.x,to.y-from.y)>40};
 f.combat.draw(220);assert.equal(f.fills.length,0);
});

test('pause freezes commands; clear, end and repeated destroy leave no filled residue or new objects',()=>{
 const f=fixture();f.at(220);assert(f.fills.length);const before=structuredClone(f.fills);
 f.scene._battlePaused=true;f.combat.draw(260);assert.deepEqual(f.fills,before);
 f.scene._battlePaused=false;f.scene._battleEnded=true;f.at(240);assert.equal(f.fills.length,0);
 f.combat.destroy();f.combat.destroy();assert.equal(f.gfx.destroyCount,1);assert.equal(f.created,1);
});

test('drawing does not change target hits, paint, color or committed geometry for either attack kind',()=>{
 for(const kind of ['basic','special']){
  const withDraw=fixture(kind),without=fixture(kind);
  for(let t=0;t<=600;t+=20){withDraw.at(t);without.at(t,false);}
  assert.deepEqual(withDraw.hits,without.hits);assert.deepEqual(withDraw.paint,without.paint);
  assert.deepEqual(withDraw.combat.lastAttack,without.combat.lastAttack);assert.equal(withDraw.hits.length,1);
 }
});
