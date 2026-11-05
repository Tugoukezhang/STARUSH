import test from 'node:test';
import assert from 'node:assert/strict';
import {UserWeaponFx,USER_WEAPON_FX,RIFLE_COMIC_CONTACT,KAI_COMIC_CONTACT,HAMMER_COMIC_CONTACT} from '../src/systems/UserWeaponFx.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
import {STAGE1_PAINT_PER_HIT,STAGE1_PAINT_SPLAT_RADIUS} from '../src/utils/stage1PaintRound.mjs';

function fixture(id='sakura',exists=()=>true){
 let time=500;const nodes=[];
 const scene={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},publicPerformerRun:{now:()=>time},
  oldStreet:{clearLine:()=>true},textures:{exists},add:{image(x,y,key){
   const n={x,y,key,dead:0,setOrigin(x,y=x){this.origin=[x,y];return this;},setDisplaySize(w,h){this.width=w;this.height=h;return this;},setTint(){return this;},
    setAlpha(v){this.alpha=v;return this;},setRotation(v){this.angle=v;return this;},setDepth(v){this.depth=v;return this;},setFrame(v){this.frame=v;return this;},destroy(){this.dead++;}};
   nodes.push(n);return n;}}};
 return {scene,fx:new UserWeaponFx(scene,id),nodes,setTime:t=>time=t};
}

test('accepted rifle, sword and hammer contacts use distinct art and real arrival orientation; rifle keeps old spray without its contact bank',()=>{
 assert.equal(RIFLE_COMIC_CONTACT.key,'user-rifle-contact-20261021');
 const noContact=k=>k!==RIFLE_COMIC_CONTACT.key;
 for(const [id,art,key,origin,exists]of [['sakura','contact',RIFLE_COMIC_CONTACT.key,[.5,.5]],['sakura','spray',USER_WEAPON_FX.spray.key,[.875,.5],noContact],
  ['kai','kai-contact',KAI_COMIC_CONTACT.key,[.5,.5]],['kai','sweep',USER_WEAPON_FX.sweep.key,[.5,.5],k=>k!==KAI_COMIC_CONTACT.key],['enjo','burst',HAMMER_COMIC_CONTACT.key,[.5,.625]]])for(const angle of [-Math.PI,-Math.PI/2,0,Math.PI/2]){
  const f=fixture(id,exists);assert.equal(f.fx.impact({x:180,y:190,hit:true,angle}),true);const row=f.fx.rows[0],n=f.nodes[0];
  assert.equal(row.kind,'impact');assert.equal(row.artKind,art);assert.equal(n.key,key);assert.deepEqual(n.origin,origin);
  assert.equal(n.angle,id==='enjo'?0:angle);assert.equal(n.x,180);assert.equal(n.y,190);
  f.setTime(560);f.fx.update(560,{depth:12});assert.equal(n.frame,2,'retain the accepted-hit contact hold, not the emission timeline');assert.equal(n.alpha,.88);
  f.setTime(720);f.fx.update(720,{depth:12});assert.equal(n.dead,1);
 }
});

test('actual accepted points replace blast-center hit markers, prioritize direct contact and cap unique nodes',()=>{
 const f=fixture();const contacts=[{x:110,y:100},{x:110,y:100},{x:125,y:100},{x:200,y:100,direct:true},{x:NaN,y:100}];
 const original=structuredClone(contacts);assert.equal(f.fx.impact({x:100,y:100,hit:true,angle:.7,contacts}),true);
 assert.deepEqual(f.nodes.map(n=>[n.x,n.y]),[[200,100],[110,100]]);assert.equal(f.fx.stats.impacts,2);assert.deepEqual(contacts,original);
 assert(f.fx.rows.every(r=>!r.ground&&r.kind==='impact'));
});

test('explicitly missing or malformed contact evidence cannot create a confirmed hit',()=>{
 for(const contacts of [[],[{x:Infinity,y:1}],[{x:'10',y:20}]]){const f=fixture();assert.equal(f.fx.impact({x:100,y:100,hit:true,contacts}),false);assert.equal(f.nodes.length,0);}
 const f=fixture();assert.equal(f.fx.impact({x:100,y:100,hit:true}),true,'existing point-only callers retain their accepted point');
});

test('empty ground remains low-priority pigment even when a stale contact list is supplied',()=>{
 const f=fixture('kai');f.fx.impact({x:100,y:100,hit:false,contacts:[{x:200,y:200}],angle:1});
 assert.equal(f.nodes.length,1);assert.equal(f.nodes[0].key,USER_WEAPON_FX.burst.key);assert.equal(f.nodes[0].depth,.52);
 assert.equal(f.fx.rows[0].kind,'burst');assert.equal(f.fx.stats.impacts,0);assert.equal(f.fx.stats.ground,1);
});

test('skill contact direction follows the issued release to the actual contact without changing its payload',()=>{
 for(const id of ['sakura','kai']){const f=fixture(id),release={x:100,y:100,radius:100,start:500,angle:-.4,contacts:[{x:100,y:160}]};
  const before=structuredClone(release);f.fx.release(release);const hit=f.fx.rows.find(r=>r.kind==='impact');
  assert.equal(hit.node.angle,Math.PI/2);assert.deepEqual(release,before);assert.equal(f.fx.stats.releases,1);}
});

test('real detonation snapshots direction before pool reset and preserves accepted-target gameplay exclusion',()=>{
 const Battle=loadBattleScene({Phaser:{Scene:class{}}}),scene=new Battle(),packets=[],impacts=[];
 const fixtureTarget={x:191,y:158},enemy={active:true,x:132,y:169};
 Object.assign(scene,{_userCastPresentation:true,_isPublicSakuraEncoreWindowActive:()=>false,
  _disposePlayerProjectile(b){b.active=false;b.moveVx=0;b.moveVy=0;},_stampGroundSplat(){},
  paintZone:{applyPaintAt(x,y,amount,radius,color,observe){assert.equal(amount,STAGE1_PAINT_PER_HIT);assert.equal(radius,STAGE1_PAINT_SPLAT_RADIUS);assert.equal(color,'pink');const p={x:191,y:158,kind:'fixture'};observe(p,fixtureTarget);p.x=999;return true;}},
  _paintPublicStage1TargetsAt(x,y,amount,radius,color,excluded,observe){observe({x:132,y:169,kind:'enemy'},enemy);return true;},
  actorPresentation:{userCastView:{weaponFx:{impact:r=>packets.push(r)}}},publicPerformerRun:{effects:()=>({paintRadiusBonus:0}),onImpact:(...args)=>impacts.push(args)}});
 const bullet={active:true,x:100,y:100,color:'pink',moveVx:0,moveVy:-450};scene._detonatePaintBullet(bullet,enemy);scene._detonatePaintBullet(bullet,enemy);
 assert.equal(packets.length,1);assert.equal(packets[0].angle,-Math.PI/2);assert.equal(packets[0].hit,true);
 assert.deepEqual(JSON.parse(JSON.stringify(packets[0].contacts)),[{x:191,y:158,kind:'fixture',direct:false},{x:132,y:169,kind:'enemy',direct:true}]);
 assert.equal(impacts.length,1);assert.equal(impacts[0][0],100);assert.equal(impacts[0][1],100);assert.equal(impacts[0][3],enemy);
 assert.equal(impacts[0][4][0],fixtureTarget);assert.equal(impacts[0][4][1],enemy);
});

test('rifle tip-origin keeps authored opaque pixels outside native cover in all four directions',()=>{
 const walls=[{x:0,y:0,width:62,height:200},{x:0,y:0,width:200,height:62},{x:138,y:0,width:62,height:200},{x:0,y:138,width:200,height:62}];
 for(const [index,angle]of [0,Math.PI/2,Math.PI,-Math.PI/2].entries()){
  const f=fixture(),street=new OldStreetState([{id:'wall',footprint:walls[index]}]);f.scene.oldStreet=street;
  assert.equal(f.fx.impact({x:100,y:100,hit:true,angle}),true);const n=f.nodes[0];
  // Existing spray cel3 pixel(49,114) has alpha208; full six-cel alpha extent is .69746 at this tip origin.
  const dx=(49/256-n.origin[0])*n.width,dy=(114/256-n.origin[1])*n.height;
  const pixel={x:n.x+dx*Math.cos(angle)-dy*Math.sin(angle),y:n.y+dx*Math.sin(angle)+dy*Math.cos(angle)};
  assert.equal(street.clearLine({x:100,y:100},pixel),true,'opaque rifle tail entered wall at '+angle);
 }
});

test('native paint rejection creates no confirmed-hit node and does not call gameplay onImpact',()=>{
 const {BattleScene:Battle,PaintZoneSystem:Paint}=loadBattleScene({Phaser:{Scene:class{},Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}},includeOwners:true});
 const f=fixture(),scene=Object.assign(new Battle(),f.scene),zone=Object.create(Paint.prototype);f.fx.scene=scene;
 let callbacks=0;Object.assign(scene,{_isPublicSakuraEncoreWindowActive:()=>false,_disposePlayerProjectile:b=>{b.active=false;},_stampGroundSplat(){},
  actorPresentation:{userCastView:{weaponFx:f.fx}},publicPerformerRun:{now:()=>500,effects:()=>({paintRadiusBonus:0}),onImpact:()=>callbacks++}});
 Object.assign(zone,{scene,currentZone:0,devices:[{x:110,y:100,zone:0,complete:true}]});scene.paintZone=zone;
 scene._detonatePaintBullet({active:true,x:100,y:100,color:'pink',moveVx:1,moveVy:0});
 assert.equal(callbacks,0);assert.equal(f.fx.stats.impacts,0);assert.equal(f.fx.rows.length,1);
 assert(f.fx.rows.every(r=>r.kind==='deposition'&&r.artKind==='rifle-deposition'&&r.ground));
});

test('native final-fixture acceptance keeps its original contact snapshot through synchronous completion',()=>{
 const {BattleScene:Battle,PaintZoneSystem:Paint}=loadBattleScene({Phaser:{Scene:class{},Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}},includeOwners:true});
 const f=fixture(),scene=Object.assign(new Battle(),f.scene),zone=Object.create(Paint.prototype);f.fx.scene=scene;
 const device={x:130,y:100,zone:0,complete:false,paint:0,paintMax:STAGE1_PAINT_PER_HIT,paintPolicy:'performer'};let packet;
 const impact=f.fx.impact;f.fx.impact=p=>{packet=p;return impact.call(f.fx,p);};
 Object.assign(scene,{_isPublicSakuraEncoreWindowActive:()=>false,_disposePlayerProjectile:b=>{b.active=false;},_stampGroundSplat(){},
  actorPresentation:{userCastView:{weaponFx:f.fx}},publicPerformerRun:{now:()=>500,effects:()=>({paintRadiusBonus:0}),onImpact(){}}});
 Object.assign(zone,{scene,currentZone:0,devices:[device],_redrawDevice(){},_emitProgress(){},_completeDevice(d){d.complete=true;d.x=900;scene._battleEnded=true;f.fx.destroy();}});scene.paintZone=zone;
 scene._detonatePaintBullet({active:true,x:100,y:100,color:'pink',moveVx:1,moveVy:0});
 assert.equal(device.complete,true);assert.equal(device.paint,STAGE1_PAINT_PER_HIT);assert.equal(packet.hit,true);assert.equal(packet.contacts[0].x,130);
 assert.equal(packet.contacts[0].y,100);assert.equal(f.fx.disposed,true);assert.equal(f.nodes.length,0,'ended run must not create a late hit node');
});
