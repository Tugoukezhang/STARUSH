import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicFocusGesture,pickPublicFocusTarget,projectPublicFocusPoint,isPublicTargetFocusEnabled} from '../src/utils/publicTargetFocus.mjs';
import {PublicTargetFocus} from '../src/systems/PublicTargetFocus.mjs';
import {createDocument} from './helpers/publicShellHarness.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {OldStreetState,OLD_STREET_DEVICES} from '../src/utils/oldStreetMap.mjs';
const pointer=(id,x,y)=>({id,x,y});
test('short stationary taps are independent per finger, drags/long holds/outside/cancel cannot focus',()=>{
 const g=new PublicFocusGesture();g.begin(pointer(1,10,20),100);g.begin(pointer(2,80,90),110);g.move(pointer(1,30,20));assert.equal(g.end(pointer(1,10,20),200),null);assert.deepEqual(g.end(pointer(2,83,92),210),{x:83,y:92});
 g.begin(pointer(1,10,20),100);assert.equal(g.end(pointer(1,10,20),451),null);g.begin(pointer(1,10,20),100);g.cancel(1);assert.equal(g.end(pointer(1,10,20),200),null);
 g.begin(pointer(1,10,20),100);g.clear();assert.equal(g.end(pointer(1,10,20),200),null);assert.equal(g.begin(pointer(null,NaN,0),0),false);
});
test('pick uses visible projected distance and original eligibility without mutating order',()=>{
 const a={x:100,y:200},b={x:110,y:200},rows=[a,b],project=t=>t;
 assert.equal(pickPublicFocusTarget({point:{x:111,y:200},candidates:rows,project,isEligible:()=>true}),b);
 assert.equal(pickPublicFocusTarget({point:{x:110,y:200},candidates:rows,project,isEligible:t=>t===a}),a);assert.deepEqual(rows,[a,b]);
 assert.equal(pickPublicFocusTarget({point:{x:300,y:200},candidates:rows,project,isEligible:()=>true}),null);
});
test('projection uses main-camera matrix and scroll, never HUD pointer.world coordinates',()=>{
 const camera={scrollX:100,scrollY:200,matrix:{transformPoint:(x,y,out)=>Object.assign(out,{x:x*.68+12,y:y*.68+24})}};
 assert.deepEqual(projectPublicFocusPoint(camera,{x:200,y:400}),{x:80,y:160});assert.equal(projectPublicFocusPoint({}, {x:1,y:2}),null);
});
test('ordinary owner3 only, hidden experiments and special modes stay excluded',()=>{
 const base={_userCastPresentation:true,_isPublicStage1Round:()=>true,battleData:{stageId:1,performerId:'sakura',practiceMode:false,defenseMode:false}};
 assert(isPublicTargetFocusEnabled(base));for(const change of [{practiceMode:true},{defenseMode:true},{stageId:2},{performerId:'venus'},{publicFinaleTrial:{}},{p15ManualFocusExperiment:true},{p15SetlistCueExperiment:true}])assert.equal(isPublicTargetFocusEnabled({...base,battleData:{...base.battleData,...change}}),false);
 assert.equal(isPublicTargetFocusEnabled({...base,_userCastPresentation:false}),false);
});

function fixture(){
 const doc=createDocument(),listeners=new Map(),input={on(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},off(type,fn){listeners.get(type)?.delete(fn);}};
 const device={id:'fixture',x:160,y:260,label:'橱窗',zone:0,complete:false},enemy={x:220,y:260,active:true,publicStage1EnemyRole:'unlit-chaser'};
 const scene={_userCastPresentation:true,_isPublicStage1Round:()=>true,battleData:{stageId:1,performerId:'sakura'},input,
  player:{x:180,y:360,hp:5,active:true},paintZone:{devices:[device],currentZone:0,canReceivePaint:d=>!d.complete},
  enemies:{getChildren:()=>[enemy]},cameras:{main:{width:375,height:667,scrollX:0,scrollY:0,matrix:{transformPoint:(x,y,o)=>Object.assign(o,{x,y})},getWorldPoint:(x,y)=>({x,y})}},
  _getPublicStage1PaintTargetRange:()=>340,_getPublicStage1PaintShotOrigin:()=>({x:180,y:360}),oldStreet:{clearLine:()=>true},_isMobileControlPointer:()=>false,_pointerHudXY:p=>p,_showPublicBattleNotice(){}};
 let now=0;const focus=new PublicTargetFocus(scene,{doc,clock:()=>now});scene.publicTargetFocus=focus;
 const emit=(type,p)=>{for(const fn of listeners.get(type)||[])fn(p);};
 const tap=(x,y,id=1)=>{emit('pointerdown',pointer(id,x,y));now+=40;emit('pointerup',pointer(id,x,y));};return {scene,device,enemy,focus,doc,listeners,emit,tap};
}
test('real controller taps choose/toggle/switch/empty, never grants effects or needs saved settings',()=>{
 const f=fixture();f.tap(160,260);assert.equal(f.focus.getTarget(),f.device);f.tap(220,260);assert.equal(f.focus.getTarget(),f.enemy);f.tap(220,260);assert.equal(f.focus.getTarget(),null);f.tap(160,260);f.tap(300,300);assert.equal(f.focus.getTarget(),null);f.focus.destroy();
});
test('actual target legality completion, role recovery, walls/range and offscreen release to original auto',()=>{
 const f=fixture();f.tap(160,260);f.device.complete=true;assert.equal(f.focus.getTarget(),null);f.device.complete=false;f.tap(220,260);f.enemy.publicStage1EnemyRole='stage-cue-emitter';f.enemy.publicStage1EnemyState='windup';assert.equal(f.focus.getTarget(),null);
 f.enemy.publicStage1EnemyState='recovery';f.tap(220,260);assert.equal(f.focus.getTarget(),f.enemy);f.scene._getPublicStage1PaintShotOrigin=()=>null;assert.equal(f.focus.getTarget(),null);f.scene._getPublicStage1PaintShotOrigin=()=>({x:0,y:0});
 f.tap(160,260);f.scene.player.y=1000;assert.equal(f.focus.getTarget(),null);f.scene.player.y=360;f.tap(160,260);f.scene.cameras.main.scrollY=400;assert.equal(f.focus.getTarget(),null);f.focus.destroy();
});
test('drag, action hotspot and joystick-rest taps do not override focus',()=>{
 const f=fixture();f.tap(160,260);f.emit('pointerdown',pointer(2,220,260));f.emit('pointermove',pointer(2,240,260));f.emit('pointerup',pointer(2,220,260));assert.equal(f.focus.getTarget(),f.device);
 f.scene._isMobileControlPointer=()=>true;f.tap(220,260);assert.equal(f.focus.getTarget(),f.device);f.scene._isMobileControlPointer=()=>false;f.tap(68,571);assert.equal(f.focus.getTarget(),f.device);f.focus.destroy();
});
test('pause cancels unfinished tap and hides cue, resume restores still-legal target, destroy removes owned listeners/nodes',()=>{
 const f=fixture();f.tap(160,260);f.focus.update();assert(f.doc.getElementById('public-target-focus'));f.emit('pointerdown',pointer(2,220,260));f.scene._battlePaused=true;f.focus.suspend();f.emit('pointerup',pointer(2,220,260));f.focus.update();assert.equal(f.doc.getElementById('public-target-focus').hidden,true);
 f.scene._battlePaused=false;assert.equal(f.focus.getTarget(),f.device);f.focus.update();assert.equal(f.doc.getElementById('public-target-focus').hidden,false);f.focus.destroy();assert.equal(f.doc.getElementById('public-target-focus'),null);assert([...f.listeners.values()].every(s=>s.size===0));assert.equal(f.focus.getTarget(),null);
});
test('actual Scene auto-aim consumes ordinary focus only, unselected fallback remains original',()=>{
 const Battle=loadBattleScene({Phaser:{Scene:class{},Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}}}),scene=new Battle();
 const selected={x:50,y:50},automatic={x:20,y:20};Object.assign(scene,{_isPublicStage1Round:()=>true,publicTargetFocus:{getTarget:()=>selected},player:{x:0,y:0},paintZone:{getNearestPaintable:()=>automatic},enemies:{children:{iterate(){}}}});
 assert.equal(scene._selectAutoAimTarget(),selected);scene.publicTargetFocus.getTarget=()=>null;assert.equal(scene._selectAutoAimTarget(),automatic);
});
test('actual Scene input first pointer remains movement owner while second finger focuses in the left field',()=>{
 const f=fixture(),Battle=loadBattleScene({Phaser:{Scene:class{}},document:f.doc}),scene=new Battle();Object.assign(scene,f.scene);f.focus.destroy();
 const key=()=>({on(){},off(){}});scene.input.keyboard={on(){},off(){},createCursorKeys:()=>({}),addKeys:()=>({}),addKey:key};scene._isP15KaiPrototypeEnabled=()=>false;scene._setJoystickVisible=()=>{};
 scene._startTouchMovement=p=>{scene._touchMoveActive=true;scene._touchMovePointerId=p.id;};scene._clearTouchMovementState=()=>{scene._touchMoveActive=false;scene._touchMovePointerId=null;};const moves=[];scene._setTouchTarget=p=>moves.push(p.id);
 scene._setupInput();f.emit('pointerdown',pointer(1,68,571));assert.equal(scene._touchMovePointerId,1);
 f.emit('pointerdown',pointer(2,220,260));assert.equal(scene._touchMovePointerId,1,'second target finger cannot capture movement');f.emit('pointerup',pointer(2,220,260));assert.equal(scene.publicTargetFocus.getTarget(),f.enemy);assert.equal(scene._touchMovePointerId,1);
 f.emit('pointermove',pointer(1,100,571));assert.deepEqual(moves,[1]);f.emit('pointerup',pointer(1,100,571));assert.equal(scene._touchMoveActive,false);scene.publicTargetFocus.destroy();
});
test('choice/dialog/ended gates reject taps and stale pending releases without saved configuration',()=>{
 for(const block of ['choice','dialog','ended']){const f=fixture();f.tap(160,260);f.emit('pointerdown',pointer(2,220,260));
  if(block==='choice')f.scene.publicPerformerRun={choiceOpen:true};else if(block==='dialog')f.scene._sessionExperience={isBlocking:()=>true};else f.scene._battleEnded=true;
  f.focus.update();f.emit('pointerup',pointer(2,220,260));assert.equal(f.focus.getTarget(),null);assert.equal(f.doc.getElementById('public-target-focus').hidden,true);f.focus.destroy();}
});
test('empty field taps while already auto do not spam combat notices',()=>{
 const f=fixture(),notices=[];f.scene._showPublicBattleNotice=text=>notices.push(text);f.tap(300,300);assert.deepEqual(notices,[]);f.focus.destroy();
});

test('runtime device names use sourceLabel rather than its Phaser text display object',()=>{
 const f=fixture();f.device.sourceLabel='南口音箱';f.device.label={text:'已恢复'};f.tap(160,260);assert.equal(f.focus.label(f.device),'南口音箱');const cue=f.doc.getElementById('public-target-focus');assert.match(cue.textContent,/南口音箱/);assert.equal(cue.style.top,'280px','cue belongs at target body, not on the existing name above it');assert.equal(f.focus.label(f.enemy),'追击者');f.focus.destroy();
});

test('actual Scene and street geometry release focus at a grazing gun corridor and a solid wall, restoring legal auto',()=>{
 const f=fixture(),Phaser={Scene:class{},Math:{Clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}};
 const {BattleScene,PaintZoneSystem}=loadBattleScene({Phaser,includeOwners:true}),scene=new BattleScene();Object.assign(scene,f.scene);f.focus.destroy();delete scene._getPublicStage1PaintShotOrigin;delete scene._getPublicStage1PaintTargetRange;
 const garden={...OLD_STREET_DEVICES.find(d=>d.id==='oldstreet-garden'),paint:14,complete:false},other={...garden,id:'legal-fallback',x:337,y:600};
 Object.assign(scene,{player:{x:337,y:460,hp:5,active:true},oldStreet:new OldStreetState(),enemies:{getChildren:()=>[],children:{iterate(){}}},actorPresentation:{userCastView:{handWorld:()=>({x:scene.player.x+16,y:scene.player.y-12})}}});
 scene.paintZone=Object.assign(new PaintZoneSystem(scene),{currentZone:1,devices:[garden,other],complete:false});scene.publicTargetFocus=new PublicTargetFocus(scene,{doc:f.doc});
 assert.equal(scene._selectAutoAimTarget(),other);f.tap(garden.x,garden.y);assert.equal(scene._selectAutoAimTarget(),garden);
 Object.assign(scene.player,{x:337.0747670331632,y:440.1465819130113});assert(scene.oldStreet.clearLine(scene.player,garden));assert.equal(scene.oldStreet.clearLine(scene.player,garden,2),false);assert.equal(scene._getPublicStage1PaintShotOrigin(garden),null);
 assert.equal(scene.publicTargetFocus.getTarget(),null);assert.equal(scene._selectAutoAimTarget(),other);
 Object.assign(scene.player,{x:337,y:460});f.tap(garden.x,garden.y);assert.equal(scene.publicTargetFocus.getTarget(),garden);Object.assign(scene.player,{x:270,y:440});assert.equal(scene.oldStreet.clearLine(scene.player,garden),false);assert.equal(scene.publicTargetFocus.getTarget(),null);assert.notEqual(scene._selectAutoAimTarget(),garden);scene.publicTargetFocus.destroy();
});
