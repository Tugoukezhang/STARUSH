import test from 'node:test';
import assert from 'node:assert/strict';
import {RifleInkWake} from '../src/systems/RifleInkWake.mjs';
import {UserWeaponFx} from '../src/systems/UserWeaponFx.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {disposeCombatObject} from '../src/systems/CombatObjectLifecycle.mjs';

function fixture(id='sakura'){
 let time=0;const nodes=[];
 const scene={_userCastPresentation:true,player:{active:true,hp:5},publicPerformerRun:{now:()=>time},oldStreet:{clearLine:()=>true},
  add:{graphics(){const g={active:true,draws:[],setDepth(d){this.depth=d;return this;},clear(){this.draws=[];return this;},
   fillStyle(color,alpha){this.color=color;this.alpha=alpha;return this;},fillTriangle(...xy){this.draws.push({color:this.color,alpha:this.alpha,xy});return this;},destroy(){this.active=false;}};nodes.push(g);return g;}}};
 const fx=new UserWeaponFx(scene,id),wake=fx.inkWake||new RifleInkWake(scene),node={x:100,y:100,active:true,destroy(){this.active=false;}};
 wake.add(node,0xff69b4,0);
 const bullet={active:true,paintShot:true,x:100,y:100,gfx:node,body:{untouched:true},destroy(){this.active=false;}};
 return{scene,fx,wake,node,bullet,nodes,time:v=>time=v};
}
test('terminal flight includes the real last sub-sample before the owner destroys the image',()=>{
 const {wake,node,bullet}=fixture();node.x=112;wake.update(20);bullet.x=116;
 assert.equal(wake.finish(node,bullet,25),true);node.destroy();wake.update(25);
 assert.equal(wake.rows[0].points.at(-1).x,116);
 assert(wake.graphics.draws.some(d=>d.xy.filter((_,i)=>i%2===0).some(x=>x===116)));
 assert(wake.graphics.draws.every(d=>d.xy.filter((_,i)=>i%2===0).every(x=>x<=116)));
});
test('one-frame short shots retain the actual launch-to-contact leg without inventing flight',()=>{
 const {wake,node,bullet}=fixture();bullet.x=111;bullet.y=104;
 assert.equal(wake.finish(node,bullet,16),true);node.destroy();wake.update(16);
 assert.equal(wake.rows[0].points.length,2);
 assert.deepEqual(wake.rows[0].points.map(p=>[p.x,p.y]),[[100,100],[111,104]]);
 assert(wake.graphics.draws.length>0);assert.equal(node.x,100);
});
test('final endpoint works in four bearings and never draws beyond the measured segment',()=>{
 for(const [dx,dy]of [[15,0],[-15,0],[0,15],[0,-15]]){
  const {wake,node}=fixture();assert(wake.finish(node,{x:100+dx,y:100+dy},20));node.destroy();wake.update(20);
  const p=wake.rows[0].points.at(-1);assert.deepEqual([p.x,p.y],[100+dx,100+dy]);
  for(const d of wake.graphics.draws)for(let i=0;i<6;i+=2){const t=((d.xy[i]-100)*dx+(d.xy[i+1]-100)*dy)/(dx*dx+dy*dy);assert(t>=-1e-9&&t<=1+1e-9);}
 }
});
test('cover, impossible jump, expired gap and invalid coordinates cannot create a terminal bridge',()=>{
 for(const kind of ['cover','jump','expired','invalid','reverse']){
  const {scene,wake,node}=fixture();if(kind==='cover')scene.oldStreet.clearLine=()=>false;
  const p={x:kind==='jump'?300:kind==='invalid'?NaN:115,y:100},now=kind==='expired'?260:kind==='reverse'?-1:20;
  assert.equal(wake.finish(node,p,now),false,kind);assert.equal(wake.rows[0].points.length,1,kind);
 }
});
test('finished rows never resample a recycled or moved visual and expire on the run clock',()=>{
 const {wake,node}=fixture();assert(wake.finish(node,{x:118,y:100},20));
 assert.equal(wake.finish(node,{x:140,y:100},30),false);
 node.x=999;wake.update(30);assert.equal(wake.rows[0].points.at(-1).x,118);
 node.active=false;wake.update(261);assert.equal(wake.rows.length,0);assert.equal(wake.graphics.draws.length,0);
 wake.clear();assert.equal(wake.graphics,null);
});
test('terminal capture keeps the original 24 paths,16 points and96px bounds',()=>{
 const {wake,node}=fixture();for(let i=1;i<=20;i++){node.x+=6;wake.update(i*5);}
 assert(wake.finish(node,{x:node.x+4,y:100},102));
 assert(wake.rows[0].points.length<=16);assert(wake.rows[0].points.at(-1).x-wake.rows[0].points[0].x<=96);
 assert.equal(wake.finish({}, {x:100,y:100},103),false);
});
test('FX dispatch only captures a real rifle contact, not cover, cleanup, other casts or paused/end states',()=>{
 const accepted=['paint-detonated','hit','boss-protected'];
 for(const reason of [...accepted,'street-cover','scene-clear','paint-out-of-bounds','timeout','disposed']){
  const {fx,bullet,time,wake}=fixture();bullet.x=118;time(20);
  assert.equal(fx.finishProjectile(bullet,reason),accepted.includes(reason),reason);
  assert.equal(wake.rows[0].points.length,accepted.includes(reason)?2:1);
  assert(bullet.active&&bullet.gfx.active);assert.deepEqual(bullet.body,{untouched:true});
 }
 for(const id of ['kai','enjo']){const {fx,bullet}=fixture(id);assert.equal(fx.finishProjectile(bullet,'hit'),false);}
 for(const state of ['paused','dialog','ended','disposed','notPaint','inactive','alreadyDisposed']){
  const {scene,fx,bullet}=fixture();bullet.x=118;
  if(state==='paused')scene._battlePaused=true;if(state==='dialog')scene._publicBattleDialog={};if(state==='ended')scene._battleEnded=true;
  if(state==='disposed')fx.disposed=true;if(state==='notPaint')bullet.paintShot=false;if(state==='inactive')bullet.active=false;if(state==='alreadyDisposed')bullet.p16Disposed=true;
  assert.equal(fx.finishProjectile(bullet,'paint-detonated'),false,state);
 }
});
test('actual Scene disposal records before visual destruction once, leaving gameplay disposal intact',()=>{
 const BattleScene=loadBattleScene({Phaser:{Scene:class{}}}),s=Object.create(BattleScene.prototype);
 const f=fixture();f.bullet.x=119;f.time(20);s.actorPresentation={userCastView:{weaponFx:f.fx}};
 let released=0;s._disposeTrackedCombatObject=(b,reason)=>disposeCombatObject(b,{reason,onRelease:()=>released++});
 assert.equal(s._disposePlayerProjectile(f.bullet,'paint-detonated'),true);
 assert.equal(f.wake.rows[0].points.at(-1).x,119);
 assert.equal(f.node.active,false);assert.equal(f.bullet.gfx,null);assert.equal(f.bullet.active,false);assert.equal(released,1);
 assert.equal(s._disposePlayerProjectile(f.bullet,'paint-detonated'),false);
 assert.equal(f.wake.rows[0].points.length,2);assert.equal(released,1);
});
