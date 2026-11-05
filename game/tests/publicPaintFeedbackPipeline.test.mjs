import test from 'node:test';import assert from 'node:assert/strict';
import {PublicPaintContactReceipt} from '../src/systems/PublicPaintContactReceipt.mjs';
import {UserWeaponFx} from '../src/systems/UserWeaponFx.mjs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';import {loadBattleScene} from './helpers/loadBattleScene.mjs';
const Battle=loadBattleScene({Phaser:{Scene:class{},Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}}});
const env=()=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);return e;};

test('one frozen receipt-derived packet separates release origin and visual landing without target references',()=>{
 for(const source of ['projectile','melee','action']){const r=new PublicPaintContactReceipt({source,x:10,y:20,color:'blue'}),target={active:true,x:30,y:40};r.record({x:30,y:40,kind:'enemy',direct:true},target);assert.equal(typeof r.feedback,'function');const p=r.feedback({position:{x:30,y:40},radius:60,angle:.5,start:1000,deposition:true,sequence:2,beat:1,successfulPaint:true});assert(p);assert(Object.isFrozen(p)&&Object.isFrozen(p.receipt)&&Object.isFrozen(p.contacts));assert.equal(p.receipt.contacts,p.contacts);assert.equal(p.origin,p.receipt.origin);assert.deepEqual(p.origin,{x:10,y:20});assert.deepEqual([p.x,p.y],[30,40]);assert.equal(p.source,source);assert.equal(p.color,'blue');assert.equal(p.hit,true);assert.equal(p.sequence,2);assert.equal(p.beat,1);assert.equal(p.start,1000);assert(p.deposition&&p.successfulPaint);target.x=999;r.record({x:90,y:90});assert.equal(p.contacts.length,1);assert(!JSON.stringify(p).includes('active'));}
});

test('invalid feedback geometry never publishes, and an empty receipt cannot be upgraded by hit:true',()=>{
 const r=new PublicPaintContactReceipt({source:'action',x:0,y:0});assert.equal(typeof r.feedback,'function');for(const patch of [{radius:0},{radius:Infinity},{angle:NaN},{start:Infinity},{position:{x:NaN,y:0}},null])assert.equal(r.feedback(patch&&{radius:60,angle:0,start:100,...patch}),null);const p=r.feedback({radius:60,start:100,hit:true,successfulPaint:true});assert.equal(p.hit,false);assert.equal(p.successfulPaint,true);assert.deepEqual(p.contacts,[]);assert.equal(new PublicPaintContactReceipt({source:'fake',x:0,y:0}).feedback({radius:10,start:0}),null);
});

test('real projectile uses the same packet for monitoring and FX without changing ground, accepted callbacks or pigment',()=>{
 const sent=[],calls=[],target={active:true,x:130,y:140},r={now:()=>1000,alive:()=>true,effects:()=>({paintRadiusBonus:0}),onImpact:(...v)=>calls.push(['progress',...v])};
 const s={_userCastPresentation:true,publicPerformerRun:r,_tryBlockPublicBossProjectile:()=>false,_isPublicSakuraEncoreWindowActive:()=>false,_disposePlayerProjectile:b=>{b.active=false;calls.push(['dispose']);},_stampGroundSplat:(...v)=>calls.push(['ground',...v]),paintZone:{applyPaintAt(x,y,n,range,color,observe){calls.push(['paint',x,y,n,range,color]);observe({x:130,y:140,kind:'fixture'},target);return true;}},_paintPublicStage1TargetsAt:()=>false,actorPresentation:{userCastView:{weaponFx:{impact:p=>sent.push(p)}}}};
 const bullet={active:true,x:100,y:110,color:'pink',moveVx:1,moveVy:0};Battle.prototype._detonatePaintBullet.call(s,bullet);assert(r.lastPaintFeedback);assert.equal(sent[0],r.lastPaintFeedback);assert.equal(r.lastPaintFeedback.receipt,r.lastPaintReceipt);assert.equal(sent[0].source,'projectile');assert.equal(sent[0].color,'pink');assert(sent[0].hit&&sent[0].deposition);assert.equal(sent[0].start,1000);assert.equal(bullet.active,false);assert.deepEqual(calls.slice(0,3).map(c=>c[0]),['dispose','ground','paint']);assert.equal(calls.filter(c=>c[0]==='progress').length,1);assert.equal(calls.at(-1)[5][0],target);
});

test('real melee keeps its release origin but places heavy feedback on the accepted contact',()=>{
 const e=env(),Combat=e.loadRuntime('systems/PerformerMeleeCombat.mjs').PerformerMeleeCombat,target={x:140,y:100,zone:0,complete:false},sent=[],ground=[],growth=[];
 const s={_userCastPresentation:true,_battlePerformerContract:{publicActionOwnerId:'enjo'},player:{x:100,y:100,hp:5,active:true},oldStreet:{clearLine:()=>true},paintZone:{devices:[target],currentZone:0,canReceivePaint:()=>true,applyPaint:()=>true},enemies:{getChildren:()=>[]},actorPresentation:{userCastView:{weaponFx:{meleeSwing(){},impact:p=>sent.push(p)}}},_stampGroundSplat:(...v)=>ground.push(v)};
 const r={member:{id:'enjo'},alive:()=>true,now:()=>1000,onImpact:(...v)=>growth.push(v)};s.publicPerformerRun=r;const c=new Combat(s,r);c.resolve({id:1,target,angle:0,color:'orange'},1000);assert(r.lastPaintFeedback);assert.equal(sent[0],r.lastPaintFeedback);assert.equal(sent[0].receipt,r.lastPaintReceipt);assert.equal(sent[0].source,'melee');assert.equal(sent[0].x,140);assert.notEqual(sent[0].origin.x,140);assert.equal(sent[0].color,'orange');assert.equal(ground[0][0],140);assert.equal(c.stats.contacts,1);assert.equal(growth.length,1);
});

test('real Action publishes the same frozen feedback and original paint result, then destroys only ephemeral metadata',()=>{
 const e=env(),Run=e.loadRuntime('systems/PublicStage1PerformerRun.mjs').PublicStage1PerformerRun,sent=[],ground=[],target={x:130,y:140,hp:100};
 const s={battleData:{stageId:1,performerId:'enjo',campaignChapterId:'opening'},_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},time:{now:1000},oldStreet:{clearLine:()=>true},add:{graphics(){}},paintZone:{devices:[],applyPaintAt:()=>false},_stampGroundSplat:(...v)=>ground.push(v),_paintPublicStage1TargetsAt(x,y,n,r,color,t,observe){target.hp-=n;observe({x:130,y:140,kind:'enemy'},target);return true;}};
 const r=new Run(s);s.publicPerformerRun=r;r.actionFeedback={queue:p=>sent.push(p),destroy(){}};assert(r.paint(120,130,20,60,'blue',null,{sequence:1,beat:0,angle:0}));assert(r.lastPaintFeedback);assert.equal(sent[0],r.lastPaintFeedback);assert(Object.isFrozen(sent[0]));assert.equal(sent[0].receipt,r.lastPaintReceipt);assert.equal(sent[0].source,'action');assert(sent[0].hit&&sent[0].successfulPaint);assert.equal(sent[0].radius,60);assert.equal(target.hp,80);assert.equal(ground.length,1);assert(!JSON.stringify(r.getContext()).includes('lastPaintFeedback'));r.destroy();assert.equal(r.lastPaintFeedback,null);assert.equal(r.lastPaintReceipt,null);
});

test('explicit current miss packets retain a release drawing but never ask for a target hit; untyped legacy release stays compatible',()=>{
 for(const id of ['sakura','kai','enjo']){const fx=Object.create(UserWeaponFx.prototype),sent=[];Object.assign(fx,{id,scene:{player:{x:10,y:20},textures:{exists:()=>false},oldStreet:{clearLine:()=>true}},stats:{releases:0},ready:()=>true,push:()=>true,impact:p=>{sent.push(p);return true;}});const row={x:10,y:20,radius:60,start:100,angle:0,contacts:[],hit:false};assert.equal(fx.release(row),true);assert.equal(sent.length,0);assert.equal(fx.stats.releases,1);fx.release({...row,hit:true,contacts:[{x:20,y:20}]});assert.equal(sent.length,1);const {hit,...legacy}=row;fx.release(legacy);assert.equal(sent.length,2);}
});

test('projectile owner replacement cannot replay old feedback or progression into a new run',()=>{
 const calls=[],old={effects:()=>({paintRadiusBonus:0}),lastPaintReceipt:null,lastPaintFeedback:null},next={lastPaintReceipt:null,lastPaintFeedback:null,onImpact:()=>calls.push('new-growth')};
 const s={_userCastPresentation:true,publicPerformerRun:old,_tryBlockPublicBossProjectile:()=>false,_isPublicSakuraEncoreWindowActive:()=>false,_disposePlayerProjectile:b=>b.active=false,_stampGroundSplat(){},paintZone:{applyPaintAt:()=>false},_paintPublicStage1TargetsAt(x,y,n,r,c,t,observe){observe({x,y,kind:'enemy'});s.publicPerformerRun=next;return true;},actorPresentation:{userCastView:{weaponFx:{impact:()=>calls.push('stale-fx')}}}};
 Battle.prototype._detonatePaintBullet.call(s,{active:true,x:10,y:20,color:'pink',moveVx:1,moveVy:0});assert.deepEqual(calls,[]);assert.equal(old.lastPaintFeedback,null);assert.equal(next.lastPaintFeedback,null);
});

test('retirement during a real melee ground stamp cannot resurrect feedback after cleanup',()=>{
 const e=env(),Combat=e.loadRuntime('systems/PerformerMeleeCombat.mjs').PerformerMeleeCombat,t={x:140,y:100,zone:0,complete:false},calls=[];let alive=true;
 const r={member:{id:'enjo'},alive:()=>alive,now:()=>1000,lastPaintReceipt:null,lastPaintFeedback:null,onImpact:()=>calls.push('growth')};
 const s={_userCastPresentation:true,_battlePerformerContract:{publicActionOwnerId:'enjo'},publicPerformerRun:r,player:{x:100,y:100,hp:5,active:true},oldStreet:{clearLine:()=>true},paintZone:{devices:[t],currentZone:0,canReceivePaint:()=>true,applyPaint:()=>true},enemies:{getChildren:()=>[]},actorPresentation:{userCastView:{weaponFx:{meleeSwing(){},impact:()=>calls.push('fx')}}},_stampGroundSplat(){alive=false;r.lastPaintReceipt=null;r.lastPaintFeedback=null;}};
 new Combat(s,r).resolve({id:1,target:t,angle:0,color:'orange'},1000);assert.equal(r.lastPaintReceipt,null);assert.equal(r.lastPaintFeedback,null);assert.deepEqual(calls,[]);
});

test('retirement inside projectile feedback cannot send accepted progression into the next run',()=>{
 const calls=[],old={effects:()=>({paintRadiusBonus:0}),now:()=>1000},next={onImpact:()=>calls.push('new-growth')};
 const s={_userCastPresentation:true,publicPerformerRun:old,_tryBlockPublicBossProjectile:()=>false,_isPublicSakuraEncoreWindowActive:()=>false,_disposePlayerProjectile:b=>b.active=false,_stampGroundSplat(){},paintZone:{applyPaintAt:()=>false},_paintPublicStage1TargetsAt(x,y,n,r,c,t,observe){observe({x,y,kind:'enemy'});return true;},actorPresentation:{userCastView:{weaponFx:{impact(){s.publicPerformerRun=next;}}}}};
 Battle.prototype._detonatePaintBullet.call(s,{active:true,x:10,y:20,color:'pink',moveVx:1,moveVy:0});assert.deepEqual(calls,[]);
});

test('same-performer Run replacement inside melee ground callback revokes old feedback and growth ownership',()=>{
 const e=env(),Run=e.loadRuntime('systems/PublicStage1PerformerRun.mjs').PublicStage1PerformerRun,t={x:140,y:100,zone:0,complete:false},calls=[];let next;
 const s={battleData:{stageId:1,performerId:'enjo'},time:{now:1000},_userCastPresentation:true,_battlePerformerContract:{publicActionOwnerId:'enjo'},player:{x:100,y:100,hp:5,active:true},oldStreet:{clearLine:()=>true},paintZone:{devices:[t],currentZone:0,canReceivePaint:()=>true,applyPaint:()=>true},enemies:{getChildren:()=>[]},actorPresentation:{userCastView:{weaponFx:{meleeSwing(){},impact:()=>calls.push('fx')}}},_stampGroundSplat(){next=new Run(s);s.publicPerformerRun=next;}};
 const r=new Run(s);s.publicPerformerRun=r;r.onImpact=()=>calls.push('growth');r.meleeCombat.resolve({id:1,target:t,angle:0,color:'orange'},1000);assert(r.alive());assert.notEqual(s.publicPerformerRun,r);assert.equal(r.lastPaintFeedback,null);assert.equal(next.lastPaintFeedback,null);assert.deepEqual(calls,[]);r.destroy();next.destroy();
});

test('same-performer Run replacement inside Action paint cannot publish or queue the previous owner packet',()=>{
 const e=env(),Run=e.loadRuntime('systems/PublicStage1PerformerRun.mjs').PublicStage1PerformerRun,calls=[];let next;
 const s={battleData:{stageId:1,performerId:'enjo'},_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},time:{now:1000},oldStreet:{clearLine:()=>true},add:{graphics(){}},paintZone:{devices:[],applyPaintAt:()=>false},_stampGroundSplat(){},_paintPublicStage1TargetsAt(x,y,n,r,c,t,observe){observe({x:130,y:140,kind:'enemy'});next=new Run(s);s.publicPerformerRun=next;return true;}};
 const r=new Run(s);s.publicPerformerRun=r;r.actionFeedback={queue:()=>calls.push('stale-fx'),destroy(){}};assert(r.paint(120,130,20,60,'blue',null,{sequence:1,beat:0,angle:0}));assert(r.alive());assert.equal(r.lastPaintReceipt,null);assert.equal(r.lastPaintFeedback,null);assert.equal(next.lastPaintFeedback,null);assert.deepEqual(calls,[]);r.destroy();next.destroy();
});

test('a paint-owner summary without observed contact cannot invent a visual hit while original progression remains owned',()=>{
 const sent=[],growth=[],r={now:()=>1000,effects:()=>({paintRadiusBonus:0}),onImpact:()=>growth.push('original')};
 const s={_userCastPresentation:true,publicPerformerRun:r,_tryBlockPublicBossProjectile:()=>false,_isPublicSakuraEncoreWindowActive:()=>false,_disposePlayerProjectile:b=>b.active=false,_stampGroundSplat(){},paintZone:{applyPaintAt:()=>true},_paintPublicStage1TargetsAt:()=>false,actorPresentation:{userCastView:{weaponFx:{impact:p=>sent.push(p)}}}};
 Battle.prototype._detonatePaintBullet.call(s,{active:true,x:10,y:20,color:'pink',moveVx:1,moveVy:0});assert.equal(sent[0],r.lastPaintFeedback);assert.equal(sent[0].successfulPaint,true);assert.equal(sent[0].hit,false);assert.equal(sent[0].contacts.length,0);assert.deepEqual(growth,['original']);
});
