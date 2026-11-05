import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicStage1PerformerRun} from '../src/systems/PublicStage1PerformerRun.mjs';
import {PublicTargetFocus} from '../src/systems/PublicTargetFocus.mjs';
import {createDocument} from './helpers/publicShellHarness.mjs';

const enemy=(x,y,extra={})=>({x,y,active:true,publicStage1EnemyRole:'unlit-chaser',...extra});
const device=(x,y,extra={})=>({id:'d'+x+'-'+y,x,y,zone:0,complete:false,label:'橱窗',...extra});
// Old Sakura fan: three beats, three offsets, captured origin and angle.
const fan=(angle,origin={x:300,y:400})=>[0,1,2].flatMap(beat=>[-.3,0,.3].map(offset=>{
 const a=angle+offset,r=95+beat*70;return [origin.x+Math.cos(a)*r,origin.y+Math.sin(a)*r,a,beat];}));
function harness(t,{performerId='sakura',data={},cast=true}={}){
 const doc=createDocument(),listeners=new Map(),timers=[],stamps=[],areas=[],enemyPaint=[],enemies=[],devices=[],blocked=new Set(),queries=[];
 const input={on(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},off(type,fn){listeners.get(type)?.delete(fn);}};
 const s={battleData:{stageId:1,performerId,...data},_userCastPresentation:cast,_isPublicStage1Round:()=>true,input,
  time:{now:0,delayedCall(delay,fn){const timer={delay,fn,removed:false,remove(){this.removed=true;}};timers.push(timer);return timer;}},
  player:{x:300,y:400,hp:5,active:true,body:{velocity:{x:0,y:0}}},actorPresentation:{direction:'left'},
  _battlePerformerContract:{publicActionOwnerId:performerId},_specialCharge:100,
  paintZone:{devices,currentZone:0,canReceivePaint:d=>!d.complete,applyPaintAt:(...a)=>{areas.push(a);return true;},applyPaint:()=>true},
  enemies:{getChildren:()=>enemies},oldStreet:{clearLine:(_a,b)=>!blocked.has(b)},
  cameras:{main:{width:800,height:667,scrollX:0,scrollY:0,matrix:{transformPoint:(x,y,o)=>Object.assign(o,{x,y})}}},
  _getPublicStage1PaintTargetRange:()=>340,_getPublicStage1PaintShotOrigin:()=>({x:300,y:400}),_isMobileControlPointer:()=>false,
  _stampGroundSplat:(...a)=>stamps.push(a),_paintPublicStage1TargetsAt:(...a)=>{enemyPaint.push(a);return false;},
  _selectPublicSakuraLeadCueTarget:()=>null,_triggerPublicSakuraLeadCue:()=>true,_showRoundBanner(){},_updateHUD(){},_showPublicBattleNotice(){}};
 let now=0;const focus=new PublicTargetFocus(s,{doc,clock:()=>now});s.publicTargetFocus=focus;
 const getTarget=focus.getTarget.bind(focus);focus.getTarget=()=>{const row=getTarget();queries.push(row);return row;};
 const run=new PublicStage1PerformerRun(s);s.publicPerformerRun=run;
 const emit=(type,p)=>{for(const fn of listeners.get(type)||[])fn(p);};
 const tap=target=>{emit('pointerdown',{id:1,x:target.x,y:target.y});now+=40;emit('pointerup',{id:1,x:target.x,y:target.y});now+=400;};
 const trigger=()=>{queries.length=0;return run.triggerAction();};
 const fire=()=>{for(const timer of timers.splice(0))if(!timer.removed)timer.fn();};
 const geometry=()=>stamps.map(row=>[row[0],row[1],row[5]?.angle]);
 t.after(()=>{run.destroy();focus.destroy();});
 return {s,run,focus,timers,stamps,areas,enemyPaint,enemies,devices,blocked,queries,tap,trigger,fire,geometry};
}
const expectFan=(f,angle)=>{
 assert.deepEqual(f.geometry(),fan(angle).map(row=>row.slice(0,3)));
 const {actionPower,paintRadiusBonus}=f.run.effects();
 assert.equal(f.areas.length,9);assert(f.areas.every(row=>row[2]===24*actionPower&&row[3]===(60+paintRadiusBonus)*Math.sqrt(actionPower)));
 assert(f.enemyPaint.every(row=>row[5]===null),'barrage stays area paint, never an exact target teleport');
};

test('focused travelling nozzle keeps captured aim while each beat follows actual player origin with build bonuses',t=>{
 const f=harness(t,{data:{publicPreparation:{version:1,performerId:'sakura',trainingLevel:3,equipmentId:'travelling_nozzle'}}});
 assert.equal(f.run.buildContext.modification.id,'travelling_nozzle');
 assert(f.run.growth.choose('wide_brush'));assert(f.run.growth.choose('overdrive'));
 const far=enemy(460,400);f.enemies.push(enemy(260,400),far);f.tap(far);assert(f.trigger());
 const originals=[{x:300,y:400},{x:320,y:420},{x:340,y:440}],timers=[...f.timers];
 for(let beat=0;beat<3;beat++){Object.assign(f.s.player,originals[beat]);far.x=100;far.y=200;timers[beat].fn();}
 assert.deepEqual(f.geometry(),originals.flatMap((origin,beat)=>fan(0,origin).slice(beat*3,beat*3+3).map(row=>row.slice(0,3))));
 const fx=f.run.effects();assert(fx.actionPower>1&&fx.paintRadiusBonus>0);
 assert(f.areas.every(row=>row[2]===24*fx.actionPower&&row[3]===(60+fx.paintRadiusBonus)*Math.sqrt(fx.actionPower)));
 assert.equal(f.run.modificationReleases,3);assert.equal(f.run.actions,1);assert.equal(f.queries.length,1);
});

test('without travelling nozzle focus keeps original cast origin despite movement and build bonuses',t=>{
 const f=harness(t,{data:{publicPreparation:{version:1,performerId:'sakura',trainingLevel:3,equipmentId:null}}});
 assert(f.run.growth.choose('wide_brush'));assert(f.run.growth.choose('overdrive'));
 const far=enemy(460,400);f.enemies.push(enemy(260,400),far);f.tap(far);assert(f.trigger());
 Object.assign(f.s.player,{x:320,y:420});f.fire();expectFan(f,0);
 assert.equal(f.run.modificationReleases,0);assert.equal(f.queries.length,1);
});

test('modern two-sided body follows diagonal target side and preserves its side for vertical aim',t=>{
 for(const [point,previous,expected]of [[enemy(200,250),'right','left'],[enemy(200,550),'right','left'],
  [enemy(450,250),'left','right'],[enemy(300,250),'left','left'],[enemy(300,550),'right','right']]){
  const f=harness(t);f.s.actorPresentation.direction=previous;f.enemies.push(enemy(320,400),point);f.tap(point);
  assert(f.trigger());assert.equal(f.run.actionPresentation.direction,expected,'two-sided actor cannot consume up/down facing');
  f.fire();expectFan(f,Math.atan2(point.y-400,point.x-300));
 }
});

test('manual enemy focus beats a nearer distractor; one query, captured angle and direction across all nine paints',t=>{
 const f=harness(t),near=enemy(260,400),far=enemy(460,400),other=enemy(300,250);f.enemies.push(near,far,other);
 f.tap(far);assert.equal(f.focus.getTarget(),far);
 assert.equal(f.trigger(),true);assert.deepEqual(f.queries,[far],'focus is read exactly once after canAct');
 assert.equal(f.s._specialCharge,0);assert.equal(f.run.actions,1);assert.deepEqual(f.timers.map(row=>row.delay),[0,100,200]);
 assert.equal(f.run.timers.size,3);assert.deepEqual(f.run.actionPresentation,{sequence:1,direction:'right'});
 far.x=100;far.y=650;f.tap(other);assert.equal(f.focus.getTarget(),other);far.active=false;
 const afterSwitch=f.queries.length;f.fire();
 assert.equal(f.queries.length,afterSwitch,'beats never re-query focus');
 expectFan(f,0);assert.deepEqual(f.run.actionPresentation,{sequence:1,direction:'right'});
});
test('manual fixture focus beats a nearer enemy and keeps the area fan',t=>{
 const f=harness(t),near=enemy(260,400),d=device(450,300);f.enemies.push(near);f.devices.push(d);
 f.tap(d);assert.equal(f.focus.getTarget(),d);assert.equal(f.trigger(),true);assert.deepEqual(f.queries,[d]);
 f.fire();expectFan(f,Math.atan2(-100,150));assert.equal(f.run.actionPresentation.direction,'right');
});
test('no focus preserves exact old nearest enemy then fixture order, direction follows the captured vector',t=>{
 const a=harness(t);a.enemies.push(enemy(460,400),enemy(260,400));a.devices.push(device(290,390));
 a.trigger();a.fire();expectFan(a,Math.atan2(0,-40));assert.equal(a.run.actionPresentation.direction,'left');assert.deepEqual(a.queries,[null]);
 const b=harness(t);b.devices.push(device(450,300),device(200,300),device(310,400,{zone:1}));
 b.s.actorPresentation.direction='down';b.trigger();b.fire();expectFan(b,Math.atan2(-100,-100));assert.equal(b.run.actionPresentation.direction,'left');
 const c=harness(t);c.trigger();c.fire();expectFan(c,-Math.PI/2);assert.equal(c.run.actionPresentation.direction,'left');
});
test('stale, blocked, role, protected, removed, zone, range, complete and unknown focus fall back to the old order',t=>{
 const cases={
  wall:(f,far)=>f.blocked.add(far),
  role:(_f,far)=>Object.assign(far,{publicStage1EnemyRole:'stage-cue-emitter',publicStage1EnemyState:'windup'}),
  protected:(_f,far)=>Object.assign(far,{publicStage1EnemyState:'telegraph'}),
  removed:(f,far)=>f.enemies.splice(f.enemies.indexOf(far),1),
  dead:(_f,far)=>{far.active=false;},
  range:(_f,far)=>{far.x=660;},
  zone:(_f,_far,d)=>{d.zone=1;},
  complete:(_f,_far,d)=>{d.complete=true;},
  suppressed:(_f,_far,d)=>{d.publicStage1Suppressed=true;},
  unknown:(f,far)=>{f.focus.target={...far};},
 };
 for(const [name,invalidate]of Object.entries(cases)){
  const f=harness(t),near=enemy(260,400),d=device(450,300);
  const far=enemy(460,400,name==='protected'?{publicStage1EnemyRole:'spotlight-captain',publicStage1EnemyState:'recovery'}:{});
  f.enemies.push(far,near);f.devices.push(d);f.s._getPublicStage1PaintTargetRange=()=>600;
  const selected=['zone','complete','suppressed'].includes(name)?d:far;f.tap(selected);assert.equal(f.focus.target,selected,name);invalidate(f,far,d);
  assert.equal(f.trigger(),true,name);assert.equal(f.queries.length,1,name);f.fire();expectFan(f,Math.PI);
  assert.equal(f.run.actionPresentation.direction,'left',name);
 }
 const f=harness(t),stale=device(450,300),next=device(200,300);f.devices.push(stale,next);f.tap(stale);stale.zone=1;
 assert.equal(f.focus.getTarget(),stale,'controller alone still offers a future-zone fixture');
 f.trigger();f.fire();expectFan(f,Math.atan2(-100,-100));
 const g=harness(t),clone=enemy(460,400);g.enemies.push(enemy(260,400),enemy(460,400));g.s.publicTargetFocus={getTarget:()=>clone};
 g.trigger();g.fire();expectFan(g,Math.PI);
});
test('rejected actions keep charge, actions, timers and presentation and never query focus',t=>{
 const gates={charge:f=>{f.s._specialCharge=99;},paused:f=>{f.s._battlePaused=true;},choice:f=>{f.run.choiceOpen=true;},
  owner:f=>{f.s._battlePerformerContract.publicActionOwnerId='kai';},ended:f=>{f.s._battleEnded=true;},dead:f=>{f.s.player.hp=0;}};
 for(const [name,block]of Object.entries(gates)){
  const f=harness(t),far=enemy(460,400);f.enemies.push(enemy(260,400),far);f.tap(far);block(f);const charge=f.s._specialCharge;
  assert.equal(f.trigger(),false,name);assert.deepEqual(f.queries,[],name);assert.equal(f.s._specialCharge,charge,name);
  assert.equal(f.run.actions,0,name);assert.equal(f.timers.length,0,name);assert.equal(f.run.actionPresentation,null,name);assert.equal(f.stamps.length,0,name);
 }
});
test('private pause clock, beat timers and destroy cancellation stay owned by the run',t=>{
 const f=harness(t),far=enemy(460,400);f.enemies.push(enemy(260,400),far);f.tap(far);f.s.time.now=1000;
 f.trigger();assert.deepEqual(f.timers.map(row=>row.delay),[0,100,200]);f.timers.shift().fn();
 f.run.pauseClock();f.s._battlePaused=true;f.s.time.now=6000;assert.equal(f.run.now(),1000);
 f.run.resumeClock();f.s._battlePaused=false;f.s.time.now=6100;assert.equal(f.run.now(),1100);f.timers.shift().fn();
 assert.deepEqual(f.geometry(),fan(0).slice(0,6).map(row=>row.slice(0,3)));
 f.run.destroy();assert(f.timers.every(row=>row.removed));assert.equal(f.run.timers.size,0);for(const row of f.timers)row.fn();
 assert.equal(f.stamps.length,6,'cancelled final beat never paints');
});
test('moving Kai dash and Enjo self-centered hammer ignore focus and match unfocused results exactly',t=>{
 for(const performerId of ['kai','enjo']){
  const rows=[];
  for(const focused of [false,true]){
   const f=harness(t,{performerId}),far=enemy(460,400);f.enemies.push(enemy(260,400),far);
   if(performerId==='kai')f.s.player.body.velocity={x:120,y:0};
   if(focused){f.tap(far);assert.equal(f.focus.getTarget(),far);}
   assert.equal(f.trigger(),true);assert.deepEqual(f.queries,[],performerId);f.fire();
   rows.push({stamps:f.stamps.map(row=>row.slice(0,4)),areas:f.areas.map(row=>row.slice(0,4)),direction:f.run.actionPresentation.direction,
    timers:f.timers.length,dash:f.run.dash&&{x:f.run.dash.x,y:f.run.dash.y}});
  }
  assert.deepEqual(rows[1],rows[0],performerId);assert.deepEqual(rows[0].stamps.map(row=>row.slice(0,2)),[[300,400]]);
  assert.equal(rows[0].areas[0][2],performerId==='kai'?20:52);assert.equal(rows[0].direction,performerId==='kai'?'right':'left');
 }
});

test('stationary Kai honors one manually tapped legal enemy rather than a nearer distractor',t=>{
 for(const [dx,dy]of [[160,0],[-140,0],[0,150],[120,-90]]){
  const f=harness(t,{performerId:'kai'}),target=enemy(300+dx,400+dy);
  f.enemies.push(enemy(310,400),target);f.tap(target);assert.equal(f.focus.getTarget(),target);
  assert(f.trigger());assert.deepEqual(f.queries,[target]);
  const n=Math.hypot(dx,dy);assert.equal(f.run.dash.x,dx/n);assert.equal(f.run.dash.y,dy/n);
  assert.equal(f.run.dash.endsAt,160);assert.equal(f.s._specialCharge,0);assert.equal(f.run.actions,1);
  assert.deepEqual(f.stamps[0].slice(0,4),[300,400,'blue',72]);
  assert.equal(f.areas[0][2],20);assert.equal(f.timers.length,0);
  assert.deepEqual(f.run.movement(0,0),{vx:dx/n*700,vy:dy/n*700});
 }
});

test('stationary fixture focus retains original build power and captured return-edge release',t=>{
 const f=harness(t,{performerId:'kai',data:{publicPreparation:{version:1,performerId:'kai',trainingLevel:3,equipmentId:'return_edge'}}});
 const d=device(450,300);f.devices.push(d);f.enemies.push(enemy(310,400));f.tap(d);
 assert.equal(f.run.buildContext.modification.id,'return_edge');assert(f.trigger());assert.deepEqual(f.queries,[d]);
 const n=Math.hypot(150,-100),fx=f.run.effects();assert.equal(f.run.dash.x,150/n);assert.equal(f.run.dash.y,-100/n);
 assert.equal(f.areas[0][2],20*fx.actionPower);assert.equal(f.areas[0][3],(72+fx.paintRadiusBonus)*Math.sqrt(fx.actionPower));
 assert.deepEqual(f.timers.map(row=>row.delay),[160]);d.x=100;d.y=500;f.s.player.x=350;f.s.player.y=450;f.fire();
 assert.deepEqual(f.stamps[1].slice(0,2),[300,400]);assert.equal(f.stamps[1][5].angle,Math.atan2(100/n,-150/n));
 assert.equal(f.run.modificationReleases,1);assert.equal(f.run.actions,1);assert.equal(f.queries.length,1);
});

test('stationary no-focus and coincident focus preserve upward default without automatic steering',t=>{
 const a=harness(t,{performerId:'kai'});a.enemies.push(enemy(460,400));assert(a.trigger());
 assert.deepEqual(a.queries,[null]);assert.deepEqual({x:a.run.dash.x,y:a.run.dash.y},{x:0,y:-1});
 const b=harness(t,{performerId:'kai'}),same=enemy(300,400);b.enemies.push(same);b.tap(same);assert(b.trigger());
 assert.deepEqual(b.queries,[same]);assert.deepEqual({x:b.run.dash.x,y:b.run.dash.y},{x:0,y:-1});
 assert.equal(b.run.actionPresentation.direction,'up');
});

test('stationary Kai rejects stale, covered, protected, future-zone and non-owner focus',t=>{
 const cases={wall:(f,e)=>f.blocked.add(e),dead:(_f,e)=>{e.active=false;},removed:(f,e)=>f.enemies.splice(f.enemies.indexOf(e),1),
  range:(_f,e)=>{e.x=700;},protected:(_f,e)=>Object.assign(e,{publicStage1EnemyRole:'spotlight-captain',publicStage1EnemyState:'windup'}),
  future:(_f,_e,d)=>{d.zone=1;},complete:(_f,_e,d)=>{d.complete=true;},unknown:(f,e)=>{f.focus.target={...e};}};
 for(const [name,invalidate]of Object.entries(cases)){
  const f=harness(t,{performerId:'kai'}),e=enemy(460,400),d=device(450,300);f.enemies.push(e);f.devices.push(d);
  f.tap(['future','complete'].includes(name)?d:e);invalidate(f,e,d);assert(f.trigger(),name);
  assert.deepEqual({x:f.run.dash.x,y:f.run.dash.y},{x:0,y:-1},name);assert.equal(f.queries.length,1,name);
 }
});

test('focused stationary dash captures direction once, preserves paint spacing and private pause clock',t=>{
 const f=harness(t,{performerId:'kai'}),right=enemy(460,400),left=enemy(180,400);f.enemies.push(right,left);f.tap(right);
 assert(f.trigger());assert.deepEqual(f.queries,[right]);f.s.time.now=50;f.s.player.x+=35;
 assert.deepEqual(f.run.movement(0,0),{vx:700,vy:0});assert.equal(f.stamps.length,1);
 f.s.player.x++;f.run.movement(0,0);assert.equal(f.stamps.length,2);assert.deepEqual(f.stamps[1].slice(0,2),[336,400]);
 f.tap(left);right.active=false;const queries=f.queries.length;f.run.pauseClock();f.s._battlePaused=true;f.s.time.now=5000;
 assert.equal(f.run.now(),50);f.run.resumeClock();f.s._battlePaused=false;f.s.time.now=5050;
 assert.deepEqual(f.run.movement(0,0),{vx:700,vy:0});assert.equal(f.queries.length,queries,'never home onto a later focus');
 f.s.time.now=5110;assert.deepEqual(f.run.movement(25,10),{vx:25,vy:10});assert.equal(f.run.dash,null);
});

test('rejected stationary Kai actions never consult focus or consume charge',t=>{
 for(const gate of ['charge','paused','choice','owner','ended','dead']){
  const f=harness(t,{performerId:'kai'}),e=enemy(460,400);f.enemies.push(e);f.tap(e);
  if(gate==='charge')f.s._specialCharge=99;if(gate==='paused')f.s._battlePaused=true;if(gate==='choice')f.run.choiceOpen=true;
  if(gate==='owner')f.s._battlePerformerContract.publicActionOwnerId='enjo';if(gate==='ended')f.s._battleEnded=true;if(gate==='dead')f.s.player.hp=0;
  const charge=f.s._specialCharge;assert.equal(f.trigger(),false,gate);assert.deepEqual(f.queries,[],gate);
  assert.equal(f.s._specialCharge,charge);assert.equal(f.run.actions,0);assert.equal(f.run.dash,null);assert.equal(f.stamps.length,0);
 }
});

test('every nonzero moving Kai input wins over focus without querying it',t=>{
 for(const v of [{x:120,y:0},{x:0,y:100},{x:-80,y:60},{x:0,y:1e-9}]){
  const f=harness(t,{performerId:'kai'}),e=enemy(460,400);f.enemies.push(e);f.tap(e);f.s.player.body.velocity=v;
  assert(f.trigger());assert.deepEqual(f.queries,[]);const n=Math.hypot(v.x,v.y);
  assert.equal(f.run.dash.x,v.x/n);assert.equal(f.run.dash.y,v.y/n);
 }
});

test('stationary legacy, practice, trial and hidden experiment Kai routes never read focus',t=>{
 for(const config of [{cast:false},{data:{practiceMode:true}},{data:{defenseMode:true}},{data:{publicFinaleTrial:{}}},
  {data:{p15SetlistCueExperiment:true}},{data:{p15ManualFocusExperiment:true}},{data:{stageId:2}},{data:{p15KaiPrototypeExperiment:true}}]){
  const f=harness(t,{performerId:'kai',...config}),e=enemy(460,400);f.enemies.push(e);
  let calls=0;f.s.publicTargetFocus={getTarget:()=>{calls++;return e;}};assert(f.trigger());assert.equal(calls,0);
  assert.deepEqual({x:f.run.dash.x,y:f.run.dash.y},{x:0,y:-1});
 }
});
test('Venus, Genya, legacy Sakura and excluded public routes never consult focus',t=>{
 for(const performerId of ['venus','genya']){
  const f=harness(t,{performerId}),far=enemy(460,400);let calls=0;f.enemies.push(enemy(260,400),far);
  f.s.publicTargetFocus={getTarget:()=>{calls++;return far;}};f.s._selectPublicSakuraLeadCueTarget=()=>f.enemies[0];
  assert.equal(f.trigger(),true);f.fire();assert.equal(calls,0,performerId);assert.deepEqual(f.stamps[0].slice(0,2),[260,400],performerId);
 }
 for(const data of [{practiceMode:true},{defenseMode:true},{publicFinaleTrial:{}},{p15ManualFocusExperiment:true},{p15SetlistCueExperiment:true},{round:false}]){
  const f=harness(t,{data}),far=enemy(460,400);let calls=0;f.enemies.push(enemy(260,400),far);
  if(data.round===false)f.s._isPublicStage1Round=()=>false;f.s.publicTargetFocus={getTarget:()=>{calls++;return far;}};
  assert.equal(f.trigger(),true);f.fire();assert.equal(calls,0,JSON.stringify(data));expectFan(f,Math.PI);
 }
 const legacy=harness(t,{cast:false}),far=enemy(460,400);let calls=0,cues=0;legacy.enemies.push(enemy(260,400),far);
 legacy.s.publicTargetFocus={getTarget:()=>{calls++;return far;}};legacy.s._triggerPublicSakuraLeadCue=()=>{cues++;return true;};
 assert.equal(legacy.trigger(),true);assert.equal(calls,0);assert.equal(cues,1);assert.equal(legacy.stamps.length,0);assert.equal(legacy.run.actionPresentation,null);
});
