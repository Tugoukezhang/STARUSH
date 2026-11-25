import test from 'node:test';
import assert from 'node:assert/strict';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {PublicStage1PerformerRun} from '../src/systems/PublicStage1PerformerRun.mjs';
import {PerformerActionFeedback} from '../src/systems/PerformerActionFeedback.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
const {BattleScene,PaintZoneSystem}=loadBattleScene({Phaser:{Scene:class{},Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}},includeOwners:true});
const alpha=(r,x,y)=>r.pixels[(Math.floor(y/2)*r.pixelWidth+Math.floor(x/2))*4+3];
const ink=r=>{let n=0;for(let i=3;i<r.pixels.length;i+=4)n+=r.pixels[i]/255;return n;};

test('active-only brush reduces radial wash, preserves bounded pigment and leaves legacy stamps identical',()=>{
 const legacy=new StreetPigmentRaster(600,600),brush=new StreetPigmentRaster(600,600),same=new StreetPigmentRaster(600,600);
 legacy.stamp(300,300,190,0xF4A77A);same.stamp(300,300,190,0xF4A77A,[],null);
 assert.deepEqual(same.pixels,legacy.pixels);
 brush.stamp(300,300,190,0xF4A77A,[],{performer:'enjo',angle:0});
 assert(ink(brush)<ink(legacy)*.6,'Active brush still covers most of the circular range');
 assert(alpha(brush,300,300)>150,'Actual landing must retain visible pigment');
 assert.equal(alpha(brush,300,490),0,'Cannot paint beyond issued radius');
 assert(alpha(brush,400,300)>alpha(brush,300,400),'Brush must follow issued direction');
 const snapshot=brush.pixels.slice();brush.consumeDirty();
 for(let i=0;i<20;i++)brush.stamp(300,300,190,0xF4A77A,[],{performer:'enjo',angle:0});
 assert.deepEqual(brush.pixels,snapshot);assert.equal(brush.consumeDirty(),null);
});

test('brush rotates with cast, clips buildings, rejects unknown styles and releases storage',()=>{
 const a=new StreetPigmentRaster(600,600),b=new StreetPigmentRaster(600,600),c=new StreetPigmentRaster(600,600);
 a.stamp(300,300,120,0xA997E8,[],{performer:'genya',angle:0});
 b.stamp(300,300,120,0xA997E8,[],{performer:'genya',angle:Math.PI/2});
 assert(alpha(a,370,300)>alpha(a,300,370));assert(alpha(b,300,370)>alpha(b,370,300));
 const blocks=[{footprint:{x:330,y:270,width:50,height:60}}];
 c.stamp(300,300,120,0xA997E8,blocks,{performer:'genya',angle:0});assert.equal(alpha(c,350,300),0);
 const legacy=new StreetPigmentRaster(600,600),unknown=new StreetPigmentRaster(600,600);
 legacy.stamp(300,300,120,0xA997E8);unknown.stamp(300,300,120,0xA997E8,[],{performer:'unknown',angle:0});
 assert.deepEqual(unknown.pixels,legacy.pixels);c.destroy();assert.equal(c.pixels,null);
});

test('real ground seam keeps all tile/heat calls and scopes imprint only to explicit releases',()=>{
 const s=new BattleScene(),calls=[];s.paintZone={stampPaint:(...a)=>calls.push(a)};
 s.add={circle:()=>({setDepth(){return this;}})};s.tweens={add(){}};
 s._stampGroundSplat(100,200,'purple',120,false,{performer:'genya',angle:1});
 assert.equal(calls.length,3);assert.deepEqual(calls.map(a=>a.slice(0,6)),[[100,200,120,'purple',230,false],[118,210,66,'purple',160,false],[84,208,57.599999999999994,'purple',140,false]]);
 assert(calls.every(a=>a[6]?.performer==='genya'));
 calls.length=0;s._stampGroundSplat(100,200,'purple',120,false);assert(calls.every(a=>a[6]==null));
});

test('actual fixture acceptance reports only accepted contacts before completion mutation',()=>{
 const zone=new PaintZoneSystem({battleData:{stageId:1},oldStreet:{clearLine:()=>true}}),contacts=[];
 const accepted={x:100,y:200,zone:0,paint:0,paintMax:100,paintPolicy:'performer',complete:false,sequenceIndex:0};
 const rejected={...accepted,x:120,publicStage1Suppressed:true},outside={...accepted,x:200};
 zone.devices=[accepted,rejected,outside];zone._redrawDevice=zone._emitProgress=()=>{};
 zone._completeDevice=d=>{d.complete=true;};
 assert.equal(zone.applyPaintAt(100,200,100,36,'purple',c=>contacts.push({...c})),true);
 assert.deepEqual(contacts,[{x:100,y:200,kind:'fixture'}]);assert(accepted.complete);assert.equal(rejected.paint,0);
 assert.equal(zone.applyPaintAt(100,200,100,36,'purple',c=>contacts.push(c)),false);assert.equal(contacts.length,1);
});

test('actual enemy settlement reports exact damaged enemies without changing damage or return type',()=>{
 const s=new BattleScene(),contacts=[],enemy={x:100,y:200,active:true,hp:100,maxHp:100,publicStage1EnemyRole:'unlit-chaser'};
 s.enemies={children:{iterate:fn=>[enemy,{...enemy,x:300}].forEach(fn)}};s.oldStreet={clearLine:()=>true};
 s._resolvePublicStage1TargetColorReaction=(_e,_c,n)=>({totalPaint:n});s._drawUnlitBlobGfx=s._spawnImpactNoteFx=()=>{};
 s.time={now:0};
 assert.equal(s._paintPublicStage1TargetsAt(100,200,22,36,'purple',enemy,c=>contacts.push({...c})),true);
 assert.equal(enemy.hp,78);assert.deepEqual(contacts,[{x:100,y:200,kind:'enemy'}]);
 contacts.length=0;s._paintPublicStage1TargetsAt(100,200,0,36,'purple',enemy,c=>contacts.push({...c}));
 assert.equal(contacts.length,0,'No accepted HP change may create a damage accent');
 contacts.length=0;enemy.active=false;assert.equal(s._paintPublicStage1TargetsAt(100,200,22,36,'purple',enemy,c=>contacts.push(c)),false);assert.equal(contacts.length,0);
});

test('skill kill pigment keeps issued brush while legacy kills retain original heat/progress calls',()=>{
 const s=new BattleScene(),calls=[];s.time={now:0};s.enemies={children:{iterate:fn=>fn(enemy)}};s.oldStreet={clearLine:()=>true};
 const enemy={x:100,y:200,active:true,hp:1,maxHp:1,publicStage1EnemyRole:'unlit-chaser'};
 s._resolvePublicStage1TargetColorReaction=(_e,_c,n)=>({totalPaint:n});s._drawUnlitBlobGfx=s._spawnImpactNoteFx=()=>{};
 s._onUnlitBlobKilled=(e,imprint)=>calls.push(imprint);
 s._paintPublicStage1TargetsAt(100,200,42,36,'yellow',enemy,()=>{},{performer:'venus',angle:1});
 assert.equal(calls[0]?.performer,'venus','Kill stamp erased the active brush');
 const killed=new BattleScene();killed.currentColor='yellow';killed._awardPublicSakuraActionCharge=()=>{};killed.score=0;
 killed._stampGroundSplat=(...a)=>calls.push(a);killed.paintZone={applyPaintAt(){}};
 const target={x:100,y:200,active:true,destroy(){this.active=false;}};
 killed._onUnlitBlobKilled(target,{performer:'venus',angle:1});
 assert.deepEqual(calls[1].slice(0,5),[100,200,'yellow',86,true]);assert.equal(calls[1][5]?.performer,'venus');
});

test('Run captures immutable accepted contacts and preserves legacy paint arity',()=>{
 const calls=[],enemy={x:110,y:200,active:true,publicStage1EnemyRole:'unlit-chaser'};
 const s={battleData:{stageId:1,performerId:'venus'},player:{x:100,y:200,hp:5},time:{now:0},_specialCharge:100,
 _battlePerformerContract:{publicActionOwnerId:'venus'},oldStreet:{clearLine:()=>true},enemies:{getChildren:()=>[enemy]},
 _stampGroundSplat:(...a)=>calls.push(a),paintZone:{applyPaintAt(...a){calls.push(a);a[5]?.({x:110,y:205,kind:'fixture'});return true;}},
 _paintPublicStage1TargetsAt(...a){a[6]?.({x:110,y:200,kind:'enemy'});return true;},_showRoundBanner(){},_updateHUD(){},add:{graphics(){}}};
 const r=new PublicStage1PerformerRun(s);r.triggerAction();const row=r.actionFeedback.lastRelease;
 assert.deepEqual(row.contacts,[{x:110,y:205,kind:'fixture'},{x:110,y:200,kind:'enemy'}]);assert(Object.isFrozen(row.contacts));assert(Object.isFrozen(row.contacts[0]));
 calls.length=0;r.paint(1,2,3,4,'yellow');assert.equal(calls[0].length,5);assert.equal(calls[1].length,5);
});

test('contact accents require actual immutable contacts and cannot survive expiry/hurt/destroy',()=>{
 const commands=[],node={clear(){commands.length=0;},setDepth(){},lineStyle(){},lineBetween(...p){commands.push(p);},destroy(){this.dead=true;}};
 const s={player:{hp:5,active:true},oldStreet:{clearLine:()=>true},add:{graphics:()=>node}},fx=new PerformerActionFeedback(s,'venus'),view={depth:2,pose:{state:'action'}};
 const contacts=[{x:55,y:66,kind:'enemy'}];fx.queue({x:50,y:60,radius:36,start:0,sequence:1,contacts});contacts[0].x=999;
 fx.update(25,view);assert.deepEqual(fx.lastFrame[0].contacts,[{x:55,y:66,kind:'enemy'}]);
 fx.update(180,view);assert.deepEqual(fx.lastFrame[0].contacts,[]);
 view.pose.state='hurt';fx.update(181,view);assert.equal(fx.rows.length,0);assert.equal(commands.length,0);
 fx.destroy();fx.destroy();assert(node.dead);
});

test('enemy splashes advance visible chapter facilities using the issued pigment',()=>{
 const scene=new BattleScene();
 const target={x:100,y:200,active:true,hp:10,maxHp:10,unlitBlob:true,publicStage1EnemyRole:'unlit-chaser',
   destroy(){this.active=false;}};
 Object.assign(scene,{time:{now:100},currentColor:'blue',score:0,_userCastPresentation:true,
   battleData:{stageId:1,campaignChapterId:'opening'},oldStreet:{clearLine:(_from,to)=>to.x<135},
   enemies:{children:{iterate:fn=>fn(target)}}});
 const ground=[];
 scene._stampGroundSplat=(x,y,color)=>ground.push(color);
 scene._awardPublicSakuraActionCharge=scene._spawnImpactNoteFx=scene._drawUnlitBlobGfx=()=>{};
 scene._resolvePublicStage1TargetColorReaction=(_enemy,_color,amount)=>({totalPaint:amount});
 const zone=scene.paintZone=new PaintZoneSystem(scene);
 zone._redrawDevice=zone._emitProgress=()=>{};
 const lamp={id:'lamp',x:115,y:200,required:true,paintPolicy:'performer',paint:0,paintMax:52,zone:0};
 const blocked={...lamp,id:'wall',x:140},suppressed={...lamp,id:'jammed',publicStage1Suppressed:true};
 zone.devices=[lamp,blocked,suppressed];
 scene._paintPublicStage1TargetsAt(100,200,1,10,'orange',target);
 assert.equal(lamp.paint,7,'orange contact spreads to a nearby legal facility');
 scene._paintPublicStage1TargetsAt(100,200,20,10,'pink',target);
 assert.equal(lamp.paint,17,'defeating a chaser contributes its ten units once');
 assert.equal(lamp.paintColor,'pink');assert.deepEqual(ground,['pink']);
 assert.equal(blocked.paint,0);assert.equal(suppressed.paint,0);
 scene._onUnlitBlobKilled(target);
 assert.equal(lamp.paint,17);
});
