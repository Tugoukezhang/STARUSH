import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';
import {OLD_STREET_PROPS} from '../src/utils/oldStreetMap.mjs';
import {NEON_STREET_PROPS} from '../src/utils/neonStreetMap.mjs';
import {HARBOR_STAGE_PROPS} from '../src/utils/harborStageMap.mjs';

class Node extends EventEmitter {
 constructor(){super();this.active=true;this.body={enable:true};}
 setOrigin(){return this;}setDisplaySize(){return this;}setDepth(){return this;}setVisible(){return this;}
 setInteractive(){return this;}setPosition(){return this;}setText(){return this;}destroy(){}
}
function fixture(prop=OLD_STREET_PROPS.find(p=>p.id==='acoustic-panel'),caption=false){
 const scene={player:{x:prop.x,y:prop.y+60},paintZone:{},_isPublicStage1Round:()=>true,
  _isMobileControlPointer:()=>false,_pointerHudXY:p=>p,
  add:{image:()=>new Node(),text:()=>new Node(),zone:()=>new Node()},
  physics:{add:{staticGroup:()=>({add(){}}),existing(){},collider:()=>({})}},input:{keyboard:{addKey:()=>new Node()}},
  _touchMovePointerId:null,_touchMoveActive:false,_endTouchMovement(p){if(this._touchMovePointerId===p.id){this._touchMovePointerId=null;this._touchMoveActive=false;}}};
 const street=new OldStreetScene(scene,{props:[prop],terrain:[]}),item=street.items.get(prop.id),node=caption?item.label:item.image;
 const send=(type,fields={})=>{
  const p={id:1,x:180,y:350,button:0,downTime:100,upTime:180,...fields};let stopped=false;
  node.emit(type,p,0,0,{stopPropagation(){stopped=true;}});
  if(!stopped){if(type==='pointerdown'&&!scene._touchMoveActive){scene._touchMoveActive=true;scene._touchMovePointerId=p.id;}if(type==='pointerup')scene._endTouchMovement(p);}
  return {stopped,p};
 };
 return {scene,street,item,send,open:()=>street.state.isOpen(prop.id)};
}

test('pressing a nearby prop preserves movement and collision until a deliberate release',()=>{
 for(const caption of [false,true]){const f=fixture(undefined,caption);const down=f.send('pointerdown');
  assert.equal(f.open(),false,'press is not an interaction commit');assert.equal(down.stopped,false);assert.equal(f.scene._touchMoveActive,true);
  const up=f.send('pointerup');assert.equal(f.open(),true);assert.equal(f.item.host.body.enable,false);assert.equal(up.stopped,true);
  assert.equal(f.scene._touchMoveActive,false,'consumed release must still release movement');}
});

test('failed distance and control-zone presses do not eat movement or change collision',()=>{
 for(const mode of ['far','hud','lower']){const f=fixture();if(mode==='far')f.scene.player.x+=500;
  if(mode==='hud')f.scene._isMobileControlPointer=()=>true;
  const fields=mode==='lower'?{y:571}:{};assert.equal(f.send('pointerdown',fields).stopped,false);assert.equal(f.send('pointerup',fields).stopped,false);
  assert.equal(f.open(),false);assert.equal(f.scene._touchMoveActive,false);assert.equal(f.item.host.body.enable,true);}
});

test('drag, out-and-back, long hold, cancelled and inherited releases never open a prop',()=>{
 for(const sequence of [
  [['pointerdown'],['pointermove',{x:200}],['pointerup',{x:200}]],
  [['pointerdown'],['pointermove',{x:200}],['pointermove'],['pointerup']],
  [['pointerdown'],['pointerout'],['pointerup']],
  [['pointerdown'],['pointerup',{upTime:500}]],
  [['pointerdown'],['pointerup',{wasCanceled:true}]],
  [['pointerdown'],['pointerup',{downTime:0}]],
  [['pointerup']],
  [['pointerdown',{button:2}],['pointerup',{button:2}]],
 ]){const f=fixture();for(const [type,fields]of sequence)f.send(type,fields);assert.equal(f.open(),false,JSON.stringify(sequence));assert.equal(f.scene._touchMoveActive,false);}
});

test('a second interaction finger cannot release the first movement finger',()=>{
 const f=fixture();f.scene._touchMoveActive=true;f.scene._touchMovePointerId=7;
 f.send('pointerdown',{id:2});f.send('pointerup',{id:3});assert.equal(f.open(),false);
 f.send('pointerup',{id:2});assert.equal(f.open(),true);assert.equal(f.scene._touchMovePointerId,7);assert.equal(f.scene._touchMoveActive,true);
});

test('pause, countdown, ended and session dialogs retain the existing interaction veto',()=>{
 for(const mode of ['pause','countdown','end','dialog']){const f=fixture();f.send('pointerdown');
  if(mode==='pause')f.scene._battlePaused=true;if(mode==='countdown')f.scene.paintZone=null;
  if(mode==='end')f.scene._battleEnded=true;if(mode==='dialog')f.scene._sessionExperience={isBlocking:()=>true};
  assert.equal(f.send('pointerup').stopped,false);assert.equal(f.open(),false);}
});

test('the same short-tap contract applies to every authored three-chapter interaction',()=>{
 for(const prop of [...OLD_STREET_PROPS,...NEON_STREET_PROPS,...HARBOR_STAGE_PROPS].filter(p=>p.interaction)){
  const f=fixture(prop);f.send('pointerdown');assert.equal(f.open(),false,prop.id);f.send('pointerup');assert.equal(f.open(),true,prop.id);
  assert.equal(f.street.interact(prop.id),false,'existing idempotency is preserved');}
});
