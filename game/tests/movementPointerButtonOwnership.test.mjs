import test from 'node:test';import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const env=loadScenes(),{BattleScene}=env.loadRuntime('scenes/BattleScene.js'),{GAME_WIDTH:W,GAME_HEIGHT:H}=env.loadRuntime('utils/config.js');
// Pointer doubles follow Phaser 3.90 Pointer.js: mouse down/up copy event.button/buttons and set wasTouch=false;
// touchstart sets buttons=1 without touching button (stays 0), touchend sets buttons=0 and wasTouch=true.
function leftButtonDown(){return (this.buttons&1)?true:false;}
const zone={x:200,y:Math.round(H*0.8)};
const mouse=(button,buttons,extra={})=>({id:0,...zone,button,buttons,wasTouch:false,leftButtonDown,...extra});
const touch=(id,buttons,extra={})=>({id,...zone,button:0,buttons,wasTouch:true,isPrimary:id===1,leftButtonDown,...extra});
function owned(id=0){
 const s=Object.create(BattleScene.prototype),feedback={destroyed:false,count:0,destroy(){this.count++;this.destroyed=true;}};
 Object.assign(s,{_touchMoveActive:true,_touchMovePointerId:id,_touchTarget:{x:242,y:zone.y},_touchStick:{x:42,y:0},_joystickRest:{x:150,y:zone.y},_touchDirectionFeedback:feedback});
 return {s,feedback};
}
const state=s=>plain({active:s._touchMoveActive,id:s._touchMovePointerId,stick:s._touchStick,target:s._touchTarget});// vm-realm objects
const kept=(s,id=0)=>assert.deepEqual(state(s),{active:true,id,stick:{x:42,y:0},target:{x:242,y:zone.y}});
const cleared=s=>assert.deepEqual(state(s),{active:false,id:null,stick:{x:0,y:0},target:null});
test('right, middle, pen barrel and eraser buttons cannot start movement inside the move zone',()=>{
 const s=Object.create(BattleScene.prototype);
 for(const [button,buttons] of [[2,2],[1,4],[3,8],[4,16]])assert.equal(s._isMobileMovePointer(mouse(button,buttons)),false,'mouse button '+button);
 for(const [button,buttons] of [[2,2],[5,32]])assert.equal(s._isMobileMovePointer(mouse(button,buttons,{pointerType:'pen'})),false,'pen button '+button);
});
test('left mouse, undefined-button legacy pointers and a second touch finger may start movement',()=>{
 const s=Object.create(BattleScene.prototype);
 assert.equal(s._isMobileMovePointer(mouse(0,1)),true);
 assert.equal(s._isMobileMovePointer({...zone}),true);
 assert.equal(s._isMobileMovePointer({id:0,...zone,button:undefined,buttons:undefined}),true);
 assert.equal(s._isMobileMovePointer(touch(1,1)),true);
 assert.equal(s._isMobileMovePointer(touch(2,1,{isPrimary:false})),true);
});
test('zone, lower-right control zone and HUD hotspot exclusions still reject even a primary press',()=>{
 const s=Object.create(BattleScene.prototype);
 assert.equal(s._isMobileMovePointer(mouse(0,1,{x:200,y:Math.round(H*0.2)})),false,'above move zone');
 assert.equal(s._isMobileMovePointer(mouse(0,1,{x:Math.round(W*0.8),y:zone.y})),false,'right of move zone');
 assert.equal(s._isMobileMovePointer(touch(1,1,{x:W-40,y:H-40})),false,'lower-right control zone');
 s._isMobileControlPointer=()=>true;// real hotspot check needs Phaser.Math, absent from the harness Phaser stub
 assert.equal(s._isMobileMovePointer(mouse(0,1)),false,'HUD hotspot');assert.equal(s._isMobileMovePointer(touch(2,1)),false,'HUD hotspot touch');
});
test('secondary release on the owning mouse id while left is still down keeps owner, stick and feedback',()=>{
 const {s,feedback}=owned();
 s._endTouchMovement(mouse(2,1));kept(s);
 s._endTouchMovement(mouse(1,1));kept(s);
 s._endTouchMovement(mouse(2,1,{pointerType:'pen'}));kept(s);assert.equal(feedback.count,0);
 s._endTouchMovement(mouse(0,0));cleared(s);assert.equal(feedback.count,1);
});
test('left release while only right remains down clears movement',()=>{
 const {s}=owned();s._endTouchMovement(mouse(0,2));cleared(s);
});
test('upoutside after the left button is released still clears, legacy pointers without leftButtonDown clear',()=>{
 const a=owned().s;a._endTouchMovement(mouse(0,0));cleared(a);
 const b=owned().s;b._endTouchMovement({id:0,...zone});cleared(b);
 const c=owned().s;c._endTouchMovement({id:0,...zone,button:2,buttons:1});cleared(c);
});
test('release from another finger or pointer id does not change the owner',()=>{
 const {s,feedback}=owned(1);
 s._endTouchMovement(touch(2,0));kept(s,1);
 s._endTouchMovement(mouse(0,0));kept(s,1);assert.equal(feedback.count,0);
 s._endTouchMovement(touch(1,0));cleared(s);
});
test('touch release cancels even if the pointer double still reports a left button bit',()=>{
 const {s}=owned(2);s._endTouchMovement(touch(2,1,{isPrimary:false}));cleared(s);
});
test('repeated cancel and clear are safe and destroy direction feedback once',()=>{
 const {s,feedback}=owned();
 s._endTouchMovement(mouse(0,0));s._endTouchMovement(mouse(0,0));s._endTouchMovement(mouse(2,1));
 s._clearTouchMovementState();cleared(s);assert.equal(feedback.count,1);assert.equal(s._touchDirectionFeedback,null);
});
