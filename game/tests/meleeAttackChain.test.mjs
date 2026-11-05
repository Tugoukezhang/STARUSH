import test from 'node:test';import assert from 'node:assert/strict';
import {UserWeaponFx,USER_WEAPON_FX} from '../src/systems/UserWeaponFx.mjs';
import {PerformerMeleeCombat} from '../src/systems/PerformerMeleeCombat.mjs';
function fixture(id='kai'){
 let time=1000;const nodes=[],enemies=[],paint=[];
 const node=(x,y,key,frame)=>{const n={x,y,texture:{key},frame:{name:frame??0},active:true,visible:true,destroyed:0};
  for(const [m,fields]of Object.entries({setPosition:['x','y'],setOrigin:['ox','oy'],setDisplaySize:['displayWidth','displayHeight'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint'],setVisible:['visible'],setRotation:['rotation']}))n[m]=(...a)=>(fields.forEach((k,i)=>n[k]=a[i]),n);
  n.setTexture=(key,frame)=>(n.texture={key},n.frame.name=frame,n);n.setFrame=frame=>(n.frame.name=frame,n);n.destroy=()=>{if(n.active){n.active=false;n.destroyed++;}};nodes.push(n);return n;};
 const scene={_userCastPresentation:true,_battlePerformerContract:{publicActionOwnerId:id},player:{x:100,y:100,hp:5,active:true},battleRecord:{playerHitCount:0},currentColor:'blue',time:{now:time},
  oldStreet:{clearLine:()=>true},textures:{exists:k=>k!=='melee-authored-20261026-process'},enemies:{getChildren:()=>enemies},add:{image:node,graphics(){const g=node(0,0,'graphics');for(const m of ['clear','fillStyle','fillTriangle','lineStyle','lineBetween'])g[m]=()=>g;return g;}},
  paintZone:{devices:[],currentZone:0,canReceivePaint:()=>true,getNearestPaintable:()=>null},_stampGroundSplat(){},
  _paintPublicStage1TargetsAt(x,y,amount,r,color,t,observe){t.hp-=amount;paint.push(t);observe({x,y,kind:'enemy'},t);},
  _getPublicStage1ProtectedBossTarget:()=>enemies.find(e=>e.publicStage1EnemyRole==='finale-boss'&&e.publicStage1EnemyState==='windup')||null};
 const run={member:{id},actions:0,choiceOpen:false,now:()=>time,alive:()=>scene.player.hp>0&&!scene._battleEnded,onImpact(){}};scene.publicPerformerRun=run;
 const fx=new UserWeaponFx(scene,id),view={art:{id},depth:9.8,state:'attack',weaponFx:fx};scene.actorPresentation={notifyBasicShot:()=>true,userCastView:view};
 const combat=new PerformerMeleeCombat(scene,run);run.meleeCombat=combat;
 const add=(role='unlit-chaser')=>{const e={active:true,hp:80,drawRadius:12,x:160,y:100,publicStage1EnemyRole:role,publicStage1EnemyState:role==='finale-boss'?'windup':'approach'};enemies.push(e);return e;};
 const tick=t=>{time=t;scene.time.now=t;combat.update(t);fx.update(t,view);};
 return{scene,run,fx,view,combat,nodes,enemies,paint,add,tick};
}
test('real sword and hammer attacks show anticipation, actual contact peak and residual recovery in one reusable trace',()=>{
 for(const id of ['kai','enjo']){const f=fixture(id),e=f.add();assert(f.combat.beginBasic(e,1000));const cycle=f.combat.attack.cycle;f.tick(1000);const trace=f.fx.meleeTrace?.node;
  assert(trace?.visible,'Ordinary windup has no rendering owner');assert.equal(trace.frame.name,0);assert(trace.alpha<.45);assert(trace.depth>f.view.depth);
  f.tick(1000+f.combat.kit.windup);assert.equal(trace.frame.name,2);assert(trace.alpha>.6);assert.equal(f.paint.length,1);assert.equal(e.hp,66);
  assert.equal(f.fx.rows.filter(r=>r.kind===({kai:'sweep',enjo:'burst'}[id])&&!r.release).length,0,'Old independent ground swing peak must not duplicate the chain');
  f.tick(1000+f.combat.kit.windup+f.combat.kit.active+20);assert(trace.frame.name>=3);const n=f.nodes.length;
  f.tick(1000+cycle+1);assert.equal(trace.visible,false);assert(f.combat.beginBasic(e,2000));f.tick(2000);assert.strictEqual(f.fx.meleeTrace.node,trace);assert.equal(f.nodes.length,n);assert.equal(f.paint.length,1);
 }
});
test('captured bearing follows the actual moving player locally and the entire visible stroke stays within real reach',()=>{
 const f=fixture(),e=f.add();assert(f.combat.beginBasic(e,1000));f.tick(1000);f.scene.player.x=105;f.tick(1078);const a=f.fx.lastFrame.find(r=>r.kind==='melee-stroke');assert(a);
 assert.equal(a.angle,0);assert(a.x>105&&a.x<105+f.combat.kit.reach);assert(Math.hypot(a.x-105,a.y-100)+a.size*4/3*USER_WEAPON_FX.sweep.extent<=f.combat.kit.reach+.001);
 assert.equal(f.fx.projectiles.length,0);assert.equal(f.fx.stats.shots,0);
});
test('hammer guard-only contact has a weapon stroke but no false burst, pigment or impact owner',()=>{
 const f=fixture('enjo'),e=f.add('finale-boss');assert(f.combat.beginBasic(e,1000));f.tick(1128);assert.equal(e.hp,80);assert.equal(f.paint.length,0);assert.equal(f.combat.stats.blocked,1);
 assert(f.fx.meleeTrace?.node.visible);assert(f.fx.rows.some(r=>r.kind==='blocked'));assert(f.fx.rows.every(r=>r.kind==='blocked'));assert(f.fx.lastFrame.every(r=>r.kind==='melee-stroke'||r.kind==='blocked'));
});
test('pause freezes the same trace and hurt/action/choice/null/end clear current visuals without replaying a strike',()=>{
 const f=fixture(),e=f.add();f.combat.beginBasic(e,1000);f.tick(1020);const n=f.fx.meleeTrace?.node;assert(n);const before=[n.x,n.y,n.alpha,n.frame.name];f.scene._battlePaused=true;f.fx.update(9000,f.view);assert.deepEqual([n.x,n.y,n.alpha,n.frame.name],before);
 f.scene._battlePaused=false;f.view.state='hurt';f.fx.update(1020,f.view);assert.equal(n.visible,false);f.view.state='action';f.fx.update(1020,f.view);assert.equal(n.visible,false);
 f.view.state='attack';f.run.choiceOpen=true;f.fx.update(1020,f.view);assert.equal(n.visible,false);f.run.choiceOpen=false;f.combat.clear();f.fx.update(1020,f.view);assert.equal(n.visible,false);
 f.fx.clear();f.fx.clear();assert.equal(n.destroyed,1);assert.equal(f.fx.meleeTrace,null);assert.equal(f.paint.length,0);
});
test('cover hides an invalid local stroke and a northward stroke remains behind the character instead of painting over the face',()=>{
 const f=fixture(),e=f.add();f.combat.beginBasic(e,1000);f.tick(1000);assert(f.fx.meleeTrace);f.scene.oldStreet.clearLine=()=>false;f.fx.update(1000,f.view);assert.equal(f.fx.meleeTrace.node.visible,false);
 const g=fixture(),t=g.add();t.x=100;t.y=40;g.combat.beginBasic(t,1000);g.tick(1000);assert(g.fx.meleeTrace.node.depth<g.view.depth);assert.equal(g.fx.projectiles.length,0);
});
test('missing shared stroke texture uses the existing hammer release fallback, and rifle never creates a melee owner',()=>{
 const f=fixture('enjo');f.scene.textures.exists=k=>k!==USER_WEAPON_FX.sweep.key&&k!=='melee-authored-20261026-process';const e=f.add();f.combat.beginBasic(e,1000);f.tick(1128);assert(!f.fx.meleeTrace?.node.visible);assert(f.fx.rows.some(r=>r.kind==='burst'));
 const g=fixture('sakura');g.fx.update(1000,g.view);assert(!g.fx.meleeTrace);assert.equal(g.nodes.length,0);
});
