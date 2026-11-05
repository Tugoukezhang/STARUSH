import test from 'node:test';import assert from 'node:assert/strict';
const {PerformerMeleeCombat:Combat}=await import('../src/systems/PerformerMeleeCombat.mjs').catch(()=>({}));
function fixture(id='kai'){
 assert.equal(typeof Combat,'function','local melee owner must exist');let time=1000;const enemies=[],devices=[],paint=[],receipts=[],fx=[],poses=[];
 const scene={_userCastPresentation:true,_battlePerformerContract:{publicActionOwnerId:id},player:{x:100,y:100,hp:5,active:true},battleRecord:{playerHitCount:0},
  currentColor:'blue',enemies:{getChildren:()=>enemies},oldStreet:{clearLine:()=>true},time:{now:time},
  paintZone:{devices,currentZone:0,canReceivePaint:t=>!t.complete&&!t.suppressed,applyPaint(t,amount){paint.push({t,amount});return true;},getNearestPaintable:(x,y,f)=>devices.find(f)||null},
  actorPresentation:{notifyBasicShot:(...a)=>{poses.push(a);return true;},userCastView:{state:'idle',weaponFx:{meleeSwing:a=>fx.push({swing:a}),impact:a=>fx.push({impact:a}),blocked:a=>fx.push({blocked:a})}}},
  _stampGroundSplat:(...a)=>fx.push({ground:a}),_paintPublicStage1TargetsAt:(x,y,amount,r,c,t,observe)=>{paint.push({t,amount});t.hp-=amount;observe?.({x,y,kind:'enemy'},t);return true;},
  _getPublicStage1ProtectedBossTarget:()=>enemies.find(t=>t.publicStage1EnemyRole==='finale-boss'&&t.publicStage1EnemyState==='windup')||null};
 const run={member:{id},actions:0,choiceOpen:false,now:()=>time,alive:()=>!run.destroyed&&!scene._battleEnded&&scene.player.hp>0,effects:()=>({paintRadiusBonus:0}),onImpact:(...a)=>receipts.push(a)};
 const strokes=[];scene.paintZone.paintAttackFan=fan=>strokes.push({...fan});
 const combat=new Combat(scene,run);run.meleeCombat=combat;scene.publicPerformerRun=run;
 const add=(x=160,y=100,role='unlit-chaser')=>{const t={x,y,hp:80,active:true,drawRadius:18,publicStage1EnemyRole:role,publicStage1EnemyState:'recovery'};enemies.push(t);return t;};
 return {scene,run,combat,enemies,devices,paint,receipts,fx,poses,strokes,add,tick:n=>{time=n;scene.time.now=n;combat.update();}};
}

test('sword active phase deposits four bounded annular steps on the existing owner clock',()=>{
 const f=fixture(),t=f.add();assert(f.combat.beginBasic(t,1000));f.tick(1077);assert.equal(f.strokes.length,0);
 for(const time of [1078,1099,1120,1140])f.tick(time);
 assert.deepEqual(f.strokes.map(a=>a.sweep),[.25,.5,.75,1]);
 for(const a of f.strokes){assert.equal(a.radius,84);assert.equal(a.innerRadius,84*.42);assert.equal(a.angle,0);assert.equal(a.halfAngle,Math.PI/3);assert.equal(a.color,'blue');}
 assert.equal(f.paint.length,1);assert.equal(f.receipts.length,1);f.tick(1200);assert.equal(f.strokes.length,4);
});
test('sword stroke locks its release origin and bearing, and never follows target/player drift',()=>{
 const f=fixture(),t=f.add();assert(f.combat.beginBasic(t,1000));f.tick(1078);t.y=180;f.scene.player.x=150;f.tick(1120);
 assert.equal(f.strokes.length,2);for(const a of f.strokes){assert.equal(a.x,100);assert.equal(a.y,100);assert.equal(a.angle,0);}
});
test('sword stroke shares cancellation, pause, armor and slow-frame semantics without replaying missed steps',()=>{
 const slow=fixture(),t=slow.add();assert(slow.combat.beginBasic(t,1000));slow.tick(2800);assert.deepEqual(slow.strokes.map(a=>a.sweep),[1]);assert.equal(slow.paint.length,1);
 for(const change of [f=>f.run.actions++,f=>f.scene._publicBattleDialog={},f=>f.run.choiceOpen=true,f=>f.scene.player.hp=0,f=>f.combat.destroy()]){
  const f=fixture(),t=f.add();assert(f.combat.beginBasic(t,1000));f.tick(1078);change(f);f.tick(1120);assert.equal(f.strokes.length,1);
 }
 const p=fixture(),a=p.add();assert(p.combat.beginBasic(a,1000));p.tick(1078);p.scene._battlePaused=true;p.tick(9000);assert.equal(p.strokes.length,1);
 const b=fixture(),boss=b.add(160,100,'finale-boss');boss.publicStage1EnemyState='windup';assert(b.combat.beginBasic(boss,1000));b.tick(1200);assert.equal(b.strokes.length,0);
 const h=fixture('enjo'),ht=h.add();assert(h.combat.beginBasic(ht,1000));h.tick(1200);assert.equal(h.strokes.length,0);
});
test('both melee owners acquire only finite living reachable owned targets, never distant focus starvation',()=>{
 for(const id of ['kai','enjo']){const f=fixture(id),near=f.add(),far=f.add(400);f.scene.publicTargetFocus={getTarget:()=>far};assert.equal(f.combat.selectTarget(),near);assert(!f.combat.canAimAt(far));
  far.x=145;assert.equal(f.combat.selectTarget(),far);far.active=false;assert.equal(f.combat.selectTarget(),near);f.enemies.splice(0,1);assert.equal(f.combat.selectTarget(),null);}
});
test('fixtures obey current zone, receive permission, suppression and finale gates',()=>{
 const f=fixture(),d={x:160,y:100,zone:0,complete:false};f.devices.push(d);assert.equal(f.combat.selectTarget(),d);
 for(const patch of [{complete:true},{zone:2},{suppressed:true},{publicStage1Suppressed:true}]){Object.assign(d,{complete:false,zone:0,suppressed:false,publicStage1Suppressed:false},patch);assert.equal(f.combat.selectTarget(),null);}
 Object.assign(d,{complete:false,zone:0,suppressed:false,publicStage1Suppressed:false});f.scene.paintZone.finaleMode=true;assert(!f.combat.canAimAt(d));
});
test('closed local sector hits only once, never behind the player or through cover, with one impact receipt',()=>{
 for(const id of ['kai','enjo']){const f=fixture(id),a=f.add(),b=f.add(170,115),back=f.add(45),far=f.add(350),covered=f.add(165,95);f.scene.oldStreet.clearLine=(p,t)=>t!==covered;
  assert(f.combat.beginBasic(a,1000,333));assert.equal(f.paint.length,0);assert.equal(f.poses.length,1);const snap=f.combat.snapshot();f.tick(1000+snap.windup-1);assert.equal(f.paint.length,0);
  f.tick(1000+snap.windup);assert.deepEqual(f.paint.map(p=>p.t),[a,b]);assert.equal(f.receipts.length,1);assert.equal(f.fx.filter(x=>x.swing).length,1);assert.equal(back.hp,80);assert.equal(far.hp,80);assert.equal(covered.hp,80);
  f.tick(1000+snap.windup+20);f.tick(1000+snap.cycle+1);assert.equal(f.paint.length,2);assert.equal(f.combat.attack,null);}
});
test('a slow frame resolves contact once, without spawning a remote attack or replaying missed cycles',()=>{
 const f=fixture(),a=f.add();assert(f.combat.beginBasic(a,1000,333));f.tick(2800);assert.equal(f.paint.length,1);assert.equal(f.combat.stats.swings,1);assert.equal(f.receipts.length,1);f.tick(2900);assert.equal(f.paint.length,1);
});
test('locked bearing does not chase a target behind the player during anticipation',()=>{
 const f=fixture(),a=f.add();assert(f.combat.beginBasic(a,1000));a.x=50;f.tick(1200);assert.equal(f.paint.length,0);assert.equal(f.receipts.length,0);
});
test('moving player releases locally; a target left out of reach is a whiff not remote damage',()=>{
 const f=fixture(),a=f.add();assert(f.combat.beginBasic(a,1000));f.scene.player.x=0;f.tick(1200);assert.equal(f.paint.length,0);assert.equal(f.receipts.length,0);assert(f.fx.find(x=>x.swing).swing.x<100);
});
test('target removal/completion or cover appearing during windup cannot grant paint or charge',()=>{
 for(const change of [f=>f.enemies.splice(0),f=>f.enemies[0].active=false,f=>f.enemies[0].hp=0,f=>f.scene.oldStreet.clearLine=()=>false]){const f=fixture(),a=f.add();assert(f.combat.beginBasic(a,1000));change(f);f.tick(1200);assert.equal(f.paint.length,0);assert.equal(f.receipts.length,0);}
});
test('protected Boss feedback cannot paint or grant impact, while a real recovery contact can',()=>{
 const f=fixture(),boss=f.add(160,100,'finale-boss');boss.publicStage1EnemyState='windup';assert.equal(f.combat.selectTarget(),boss);assert(f.combat.beginBasic(boss,1000));f.tick(1200);assert.equal(boss.hp,80);assert.equal(f.receipts.length,0);assert.equal(f.combat.stats.blocked,1);assert.equal(f.fx.filter(x=>x.ground).length,0,'blocked armour must not award ground heat');assert.equal(f.fx.filter(x=>x.impact).length,0,'pure armor contact is not an empty-ground paint burst');assert.equal(f.fx.filter(x=>x.blocked).length,1);assert.equal(f.fx.find(x=>x.blocked).blocked.x,142);
 f.tick(1400);boss.publicStage1EnemyState='recovery';assert(f.combat.beginBasic(boss,1400));f.tick(1600);assert(boss.hp<80);assert.equal(f.receipts.length,1);
});
test('Boss vulnerable-to-protected transition revalidates at the actual contact, without weak-point leakage',()=>{
 const f=fixture(),boss=f.add(165,100,'finale-boss'),weak=f.add(170,110,'finale-weak-point');assert.equal(f.combat.selectTarget(),weak);assert(f.combat.beginBasic(boss,1000));boss.publicStage1EnemyState='windup';f.tick(1200);assert.equal(boss.hp,80);assert(weak.hp<80);assert.equal(f.receipts.length,1);assert.equal(f.combat.stats.blocked,1);
});
test('one accepted fixture plus two enemies resolves exact owners once and one onImpact receipt',()=>{
 const f=fixture(),a=f.add(),b=f.add(165,110),d={x:150,y:100,zone:0,complete:false};f.devices.push(d);assert(f.combat.beginBasic(a,1000));f.tick(1200);assert.deepEqual(f.paint.map(p=>p.t),[d,a,b]);assert.equal(f.receipts.length,1);assert.equal(f.combat.stats.contacts,3);
});
test('pause freezes the same run clock; choice/dialog, hurt, skill, death and destroy cancel safely',()=>{
 const paused=fixture(),a=paused.add();assert(paused.combat.beginBasic(a,1000));paused.scene._battlePaused=true;paused.tick(9000);assert.equal(paused.paint.length,0);paused.scene._battlePaused=false;paused.tick(1050);assert.equal(paused.paint.length,0);paused.tick(1200);assert.equal(paused.paint.length,1);
 for(const change of [f=>f.scene._publicBattleDialog={},f=>f.run.choiceOpen=true,f=>f.scene.battleRecord.playerHitCount++,f=>f.run.actions++,f=>f.scene.player.hp=0,f=>f.combat.destroy(),f=>f.scene._battleEnded=true]){const f=fixture(),t=f.add();assert(f.combat.beginBasic(t,1000));change(f);f.tick(1200);assert.equal(f.paint.length,0);assert.equal(f.combat.attack,null);}
});
test('hammer holds a longer anticipation and cooldown; no attack replacement or frame-rate duplicate',()=>{
 const sword=fixture('kai'),hammer=fixture('enjo');for(const f of [sword,hammer]){const t=f.add();assert(f.combat.beginBasic(t,1000,100));assert(!f.combat.beginBasic(t,1001,100));}
 assert(hammer.combat.snapshot().windup>sword.combat.snapshot().windup);assert(hammer.combat.snapshot().cycle>sword.combat.snapshot().cycle);
});
test('presentation snapshots are compact values and never expose live Phaser target graphs',()=>{
 const f=fixture(),t=f.add();t.self=t;assert(f.combat.beginBasic(t,1000));const pose=f.combat.snapshot();assert.equal(Object.hasOwn(pose,'target'),false);assert.doesNotThrow(()=>JSON.stringify(pose));
});
test('cancelled callbacks cannot paint after a synchronous run finish or target-array mutation',()=>{
 const f=fixture(),a=f.add(),b=f.add(165,110);const paint=f.scene._paintPublicStage1TargetsAt;f.scene._paintPublicStage1TargetsAt=(...args)=>{const result=paint(...args);f.run.destroyed=true;f.enemies.splice(0);return result;};assert(f.combat.beginBasic(a,1000));f.tick(1200);assert.equal(f.paint.length,1);assert.equal(b.hp,80);assert.equal(f.receipts.length,0);assert.equal(f.combat.attack,null);
});
