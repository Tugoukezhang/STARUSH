import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicStage1PerformerRun} from '../src/systems/PublicStage1PerformerRun.mjs';
import {GenyaMotion} from '../src/systems/GenyaLayeredPresentation.mjs';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
import {fixture as actorFixture} from './motionStageFixture.mjs';
let api={};
try{api=await import('../src/systems/PerformerActionFeedback.mjs');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const enemy=(x,y)=>({x,y,active:true,publicStage1EnemyRole:'unlit-chaser'});
function gfx(){return {commands:[],active:true,destroyCount:0,clear(){this.commands=[];return this;},setDepth(d){this.depth=d;return this;},
 lineStyle(...a){this.commands.push(['style',...a]);return this;},lineBetween(...a){this.commands.push(['line',...a]);return this;},destroy(){this.active=false;this.destroyCount++;}};}
function fixture(id){
 const paints=[],timers=[],nodes=[],enemies=[enemy(260,300),enemy(300,350),enemy(350,400),enemy(400,450)];
 const s={battleData:{stageId:1,performerId:id},player:{x:250,y:400,hp:5,active:true,body:{velocity:{x:250,y:0}}},
 time:{now:0,delayedCall(delay,fn){const t={delay,fn,remove(){this.removed=true;}};timers.push(t);return t;}},
 _battlePerformerContract:{publicActionOwnerId:id},_specialCharge:100,oldStreet:{clearLine:()=>true},
 paintZone:{applyPaintAt(){return false;}},enemies:{getChildren:()=>enemies},
 _paintPublicStage1TargetsAt(...args){paints.push(args);return true;},_stampGroundSplat(){},
 _selectPublicSakuraLeadCueTarget:()=>enemies[0],_showRoundBanner(){},_updateHUD(){},
 add:{graphics(){const g=gfx();nodes.push(g);return g;}},actorPresentation:{direction:'down'}};
 const run=s.publicPerformerRun=new PublicStage1PerformerRun(s);
 const n={active:true,visible:true,width:20,height:40,displayOriginX:10,displayOriginY:4,frame:{name:'down/forearmR'},texture:{key:id+'-parts'},
 getWorldTransformMatrix:()=>({transformPoint:()=>({x:250,y:380})})};
 const view={scene:s,depth:9.3,pose:{state:'action'},nodes:new Map([['forearmR',n]])};
 return {s,run,paints,timers,nodes,enemies,view};
}

for(const id of ['venus','genya','kai','enjo'])test(id+': only actual accepted action paints queue release geometry, preserving targets and values',()=>{
 const f=fixture(id);assert(f.run.triggerAction());
 assert.equal(f.run.actionFeedback?.rows.length,id==='venus'?3:1,'Missing actual active-action release');
 const expected=id==='venus'?{amount:42,radius:36}:id==='genya'?{amount:22,radius:120}:id==='kai'?{amount:20,radius:72}:{amount:52,radius:190};
 for(const row of f.run.actionFeedback.rows){assert.equal(row.radius,expected.radius);assert.equal(row.sequence,1);assert.equal(row.start,0);assert.equal(row.successfulPaint,true);}
 assert(f.paints.every(p=>p[2]===expected.amount&&p[3]===expected.radius));
 if(id==='venus')assert.deepEqual(f.paints.map(p=>p[5]),[f.enemies[1],f.enemies[2],f.enemies[0]]);
 assert.equal(f.run.actions,1);assert.equal(f.s._specialCharge,0);
 f.run.actionFeedback.update(30,f.view);assert(f.run.actionFeedback.lastFrame.length>0);assert.equal(f.nodes.length,1);
 f.run.actionFeedback.setWorldDepth(9.28);assert(Math.abs(f.nodes[0].depth-9.28002)<1e-12);
 const count=f.run.actionFeedback.rows.length;f.run.paint(250,300,14,80);assert.equal(f.run.actionFeedback.rows.length,count,'Ordinary echo must not masquerade as skill');
 f.run.destroy();assert.equal(f.nodes[0].destroyCount,1);assert(f.timers.every(t=>t.removed));
});

test('Genya has three real releases at the original fixed point, not one invented persistent attack',()=>{
 const f=fixture('genya');f.run.triggerAction();assert.equal(f.run.actionFeedback?.rows.length,1);
 assert.deepEqual(f.timers.map(t=>t.delay),[350,700]);f.enemies[0].x=900;
 for(const [i,t]of f.timers.entries()){f.s.time.now=t.delay;t.fn();assert.equal(f.run.actionFeedback.lastRelease.start,t.delay);assert.equal(f.run.actionFeedback.lastRelease.beat,i+1);}
 assert.deepEqual(f.paints.map(p=>p.slice(0,5)),Array(3).fill([260,300,22,120,'purple']));
 assert.deepEqual(f.run.actionFeedback.rows.map(r=>r.start),[0,350,700]);
});

test('a fresh Genya release restarts only the upper gesture; locomotion and frozen/hurt priority survive',()=>{
 const root={x:250,y:400},m=new GenyaMotion(root),control=new GenyaMotion(root);m.sample({now:0,player:root});control.sample({now:0,player:root});
 assert.equal(typeof m.beginActionRelease,'function');
 for(let now=16;now<=800;now+=16){const p={x:250+now*.05,y:400};if(now===16||now===352||now===704)m.beginActionRelease();
  const a=m.sample({now,player:p,dx:.8,action:true}),b=control.sample({now,player:p,dx:.8,action:true});assert.deepEqual(a.feet,b.feet);
  if(now===352||now===704)assert(a.actionProgress<.1,'Secondary release did not restart the gesture');}
 const before=structuredClone(m.pose);assert.deepEqual(m.sample({now:10000,player:root,frozen:true}),before);
 assert.equal(m.sample({now:10016,player:root,hurt:true,action:true}).state,'hurt');
});

test('Kai tail is issued only after the existing 36px trail spacing and never changes dash values',()=>{
 const f=fixture('kai');f.run.triggerAction();assert.equal(f.run.actionFeedback?.rows.length,1);
 f.s.time.now=50;f.s.player.x+=35;assert.deepEqual(f.run.movement(0,0),{vx:700,vy:0});assert.equal(f.run.actionFeedback.rows.length,1);
 f.s.player.x++;f.run.movement(0,0);assert.equal(f.run.actionFeedback.rows.length,2);assert.equal(f.run.actionFeedback.lastRelease.x,286);
 f.s.time.now=160;assert.deepEqual(f.run.movement(25,0),{vx:25,vy:0});assert.equal(f.paints.length,2);
});

test('targetless, blocked, non-hit and rejected actions cannot fake hit or release',()=>{
 const f=fixture('venus');f.enemies.length=0;f.s._paintPublicStage1TargetsAt=(...a)=>{f.paints.push(a);return false;};
 f.run.triggerAction();assert.equal(f.run.actionFeedback?.rows.length,1);assert.equal(f.run.actionFeedback.lastRelease.successfulPaint,false);
 assert.deepEqual(f.paints[0].slice(0,5),[250,300,42,110,'yellow']);const prior=f.run.actionFeedback.lastRelease;
 assert.equal(f.run.triggerAction(),false);assert.equal(f.run.actionFeedback.lastRelease,prior);
 const blocked=fixture('genya');blocked.s.oldStreet.clearLine=()=>false;blocked.run.triggerAction();assert.equal(blocked.paints.length,0);assert.equal(blocked.run.actionFeedback?.rows.length??0,0);
 const sakura=fixture('sakura');sakura.s._triggerPublicSakuraLeadCue=()=>true;sakura.run.triggerAction();assert.equal(sakura.run.actionFeedback,null,'Sakura must keep one combat-owned fan');
});

test('bounded render-only queue freezes, clips every stroke and clears on hurt/end/destroy',()=>{
 assert.equal(typeof api.PerformerActionFeedback,'function');const f=fixture('enjo'),a=new api.PerformerActionFeedback(f.s,'enjo');
 for(let i=0;i<20;i++)assert(a.queue({x:250,y:400,radius:190,sequence:1,beat:i,start:i,successfulPaint:false}));assert.equal(a.rows.length,8);
 a.update(30,f.view);const original=structuredClone(a.lastFrame),commands=structuredClone(f.nodes[0].commands);
 f.s._battlePaused=true;a.update(10000,f.view);assert.deepEqual(a.lastFrame,original);assert.deepEqual(f.nodes[0].commands,commands);
 f.s._battlePaused=false;f.view.pose.state='hurt';a.update(31,f.view);assert.equal(a.rows.length,0);assert.equal(f.nodes[0].commands.length,0);
 f.view.pose.state='action';a.queue({x:250,y:400,radius:190,sequence:1,beat:0,start:32,successfulPaint:true});
 const street=new OldStreetState([{id:'local-wall',footprint:{x:270,y:380,width:8,height:40}}]);f.s.oldStreet.clearLine=(p,q,r)=>street.clearLine(p,q,r);
 a.update(80,f.view);assert(a.lastFrame.length>0);for(const row of a.lastFrame)for(const line of row.segments){assert(street.clearLine(row.center,line.from,line.width/2));assert(street.clearLine(row.center,line.to,line.width/2));assert(street.clearLine(line.from,line.to,line.width/2));}
 a.update(1000,f.view);assert.equal(a.rows.length,0);a.queue({x:250,y:400,radius:190,sequence:1,beat:0,start:1000});
 f.s._battleEnded=true;f.s._battlePaused=true;a.update(1001,f.view);assert.equal(a.rows.length,0);a.destroy();a.destroy();assert.equal(f.nodes[0].destroyCount,1);
});

test('a synchronous final paint cannot resurrect the destroyed presentation owner',()=>{
 const f=fixture('enjo');f.s.paintZone.applyPaintAt=()=>{f.s._battleEnded=true;f.run.destroy();return true;};
 f.run.triggerAction();assert.equal(f.run.actionFeedback,null);
});

test('actual Actor restarts the layered Genya gesture on each real callback and respects final world sort',()=>{
 const f=actorFixture('genya');f.s.add.graphics=gfx;let releases=0;
 const view={depth:9.3,pose:{state:'idle'},beginActionRelease(){releases++;},
  update(now,dx,dy,o){this.pose={state:o.hurt?'hurt':o.action?'action':'idle'};},setWorldDepth(d){this.depth=d;}};
 f.actor.genyaView=view;f.draw(0);f.run.triggerAction();f.draw(1);assert.equal(releases,1);
 for(const t of f.timers){f.s.time.now=t.delay;t.fn();f.draw(t.delay);assert.equal(view.pose.state,'action');}
 assert.equal(releases,3);f.actor.setWorldDepth(9.28);assert(Math.abs(f.run.actionFeedback.gfx.depth-9.28002)<1e-12);
 f.draw(1000);assert.equal(view.pose.state,'idle');
});
