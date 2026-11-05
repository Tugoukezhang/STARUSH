import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicTargetFocus} from '../src/systems/PublicTargetFocus.mjs';
import {createDocument} from './helpers/publicShellHarness.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
// Pointer doubles follow Phaser 3.90: the mouse is one shared Pointer id 0 whose .button records the last down/up transition,
// and InputPlugin emits pointerup/pointerupoutside for every button. Legacy touch fixtures carry no button at all.
const pointer=(id,x,y,button)=>button===undefined?{id,x,y}:{id,x,y,button};
const mouse=(x,y,button=0)=>pointer(0,x,y,button);
function fixture(){
 const doc=createDocument(),listeners=new Map(),notices=[],input={on(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},off(type,fn){listeners.get(type)?.delete(fn);}};
 const device={id:'fixture',x:160,y:260,label:'Window',zone:0,complete:false,paint:3},enemy={x:220,y:260,active:true,hp:4,publicStage1EnemyRole:'unlit-chaser'};
 const scene={_userCastPresentation:true,_isPublicStage1Round:()=>true,battleData:{stageId:1,performerId:'sakura'},input,
  player:{x:180,y:360,hp:5,active:true,charge:2,velocity:{x:0,y:0}},paintZone:{devices:[device],currentZone:0,canReceivePaint:d=>!d.complete},
  enemies:{getChildren:()=>[enemy]},cameras:{main:{width:375,height:667,scrollX:0,scrollY:0,matrix:{transformPoint:(x,y,o)=>Object.assign(o,{x,y})},getWorldPoint:(x,y)=>({x,y})}},
  _getPublicStage1PaintTargetRange:()=>340,_getPublicStage1PaintShotOrigin:()=>({x:180,y:360}),oldStreet:{clearLine:()=>true},_isMobileControlPointer:()=>false,_pointerHudXY:p=>p,_showPublicBattleNotice:text=>notices.push(text)};
 let now=0;const focus=new PublicTargetFocus(scene,{doc,clock:()=>now});scene.publicTargetFocus=focus;
 const emit=(type,p)=>{for(const fn of listeners.get(type)||[])fn(p);},wait=ms=>{now+=ms;};
 const noise=(x,y,buttons=[2,1])=>{for(const b of buttons){emit('pointerdown',mouse(x,y,b));wait(10);emit('pointerup',mouse(x,y,b));wait(10);}};
 const noisyTap=(x,y)=>{emit('pointerdown',mouse(x,y,0));wait(10);noise(x,y);emit('pointerup',mouse(x,y,0));};
 const cue=()=>doc.getElementById('public-target-focus');
 const snapshot=()=>JSON.stringify({player:scene.player,device,enemy,zone:scene.paintZone.currentZone,camera:[scene.cameras.main.scrollX,scene.cameras.main.scrollY]});
 return {scene,device,enemy,focus,doc,listeners,notices,emit,wait,noise,noisyTap,cue,snapshot};
}
test('short left tap after interleaved middle/right down+up on the shared mouse id still focuses, switches and toggles once each',()=>{
 const f=fixture(),before=f.snapshot(),focused='\u96c6\u706b \u00b7 ';
 f.noisyTap(160,260);assert.equal(f.focus.getTarget(),f.device);
 f.noisyTap(220,260);assert.equal(f.focus.getTarget(),f.enemy);
 f.noisyTap(220,260);assert.equal(f.focus.getTarget(),null);
 assert.deepEqual(f.notices,[focused+'Window',focused+f.focus.label(f.enemy),'\u6062\u590d\u81ea\u52a8\u9009\u53d6'],'one notice per real selection change, no spam');
 assert.equal(f.snapshot(),before,'focus never moves player, spends charge, paints or damages');f.focus.destroy();
});
test('right/middle-only presses cannot focus, and noise never replaces an existing selection',()=>{
 const f=fixture();for(const b of [1,2]){f.emit('pointerdown',mouse(160,260,b));f.wait(20);f.emit('pointerup',mouse(160,260,b));}
 f.emit('pointerdown',mouse(160,260,0));f.wait(20);f.emit('pointerup',mouse(160,260,2));assert.equal(f.focus.getTarget(),null,'left down with right release is not a left tap');
 assert.deepEqual(f.notices,[]);
 f.emit('pointerupoutside',mouse(160,260,0));f.noisyTap(160,260);assert.equal(f.focus.getTarget(),f.device);f.notices.length=0;
 f.noise(220,260);assert.equal(f.focus.getTarget(),f.device,'original target retained');assert.deepEqual(f.notices,[]);f.focus.destroy();
});
test('non-primary release outside the canvas cannot clear a valid left pending, primary outside still cancels',()=>{
 const f=fixture();f.emit('pointerdown',mouse(160,260,0));f.wait(10);f.emit('pointerdown',mouse(160,260,2));f.emit('pointerupoutside',mouse(160,260,2));f.wait(10);
 f.emit('pointerupoutside',mouse(160,260,1));f.emit('pointerup',mouse(160,260,0));assert.equal(f.focus.getTarget(),f.device);
 f.emit('pointerdown',mouse(220,260,0));f.wait(10);f.emit('pointerupoutside',mouse(220,260,0));f.emit('pointerup',mouse(220,260,0));assert.equal(f.focus.getTarget(),f.device,'left released outside cancels its tap');
 f.emit('pointerdown',pointer(3,220,260));f.emit('pointerupoutside',pointer(3,220,260));f.emit('pointerup',pointer(3,220,260));assert.equal(f.focus.getTarget(),f.device,'legacy touch outside still cancels');
 assert.equal(f.notices.length,1);f.focus.destroy();
});
test('another finger releasing or leaving does not clear the owning finger, undefined-button touch unchanged',()=>{
 const f=fixture();f.emit('pointerdown',pointer(1,160,260));f.emit('pointerdown',pointer(2,300,300));f.wait(20);f.emit('pointerupoutside',pointer(2,300,300));
 f.emit('pointerdown',pointer(4,300,300));f.emit('pointerup',pointer(4,300,300));f.emit('pointerup',pointer(1,160,260));assert.equal(f.focus.getTarget(),f.device);
 f.emit('pointerdown',pointer(1,220,260));f.wait(40);f.emit('pointerup',pointer(1,220,260));assert.equal(f.focus.getTarget(),f.enemy);f.focus.destroy();
});
test('drag beyond 8px and holds beyond 350ms stay rejected even with button noise in between',()=>{
 const f=fixture();f.emit('pointerdown',mouse(160,260,0));f.noise(160,260);f.emit('pointermove',mouse(175,260,0));f.emit('pointerup',mouse(160,260,0));assert.equal(f.focus.getTarget(),null);
 f.emit('pointerdown',mouse(160,260,0));f.noise(160,260);f.wait(340);f.emit('pointerup',mouse(160,260,0));assert.equal(f.focus.getTarget(),null);
 f.emit('pointerdown',mouse(160,260,0));f.wait(5);f.noise(169,260,[2]);f.emit('pointerup',mouse(169,260,0));assert.equal(f.focus.getTarget(),null,'release moved 9px');
 assert.deepEqual(f.notices,[]);f.focus.destroy();
});
test('pause and battle end suspend pending left taps with no stale selection after noise',()=>{
 for(const block of ['pause','ended']){const f=fixture();f.emit('pointerdown',mouse(160,260,0));f.noise(160,260);
  if(block==='pause')f.scene._battlePaused=true;else f.scene._battleEnded=true;f.focus.update();
  f.emit('pointerup',mouse(160,260,0));assert.equal(f.focus.getTarget(),null);assert.equal(f.cue().hidden,true);
  f.scene._battlePaused=false;f.scene._battleEnded=false;f.emit('pointerup',mouse(160,260,0));assert.equal(f.focus.getTarget(),null,'no stale pending after resume');assert.deepEqual(f.notices,[]);f.focus.destroy();}
});
test('destroy clears owned listeners and later noisy taps are inert',()=>{
 const f=fixture();f.noisyTap(160,260);f.focus.update();assert(f.cue());f.emit('pointerdown',mouse(220,260,0));f.focus.destroy();
 assert([...f.listeners.values()].every(s=>s.size===0));assert.equal(f.cue(),null);f.noisyTap(220,260);assert.equal(f.focus.getTarget(),null);assert.equal(f.notices.length,1);
});
test('actual Scene auto-aim keeps the original fallback until a valid noisy left tap selects',()=>{
 const f=fixture(),Battle=loadBattleScene({Phaser:{Scene:class{},Math:{Distance:{Between:(x,y,a,b)=>Math.hypot(x-a,y-b)}}}}),scene=new Battle(),automatic={x:180,y:330};
 Object.assign(scene,{_isPublicStage1Round:()=>true,publicTargetFocus:f.focus,player:f.scene.player,paintZone:{getNearestPaintable:()=>automatic},enemies:{children:{iterate(){}}}});
 f.noise(160,260);assert.equal(scene._selectAutoAimTarget(),automatic);f.noisyTap(160,260);assert.equal(scene._selectAutoAimTarget(),f.device);f.focus.destroy();
});
