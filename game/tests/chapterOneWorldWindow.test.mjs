import assert from 'node:assert/strict';
import test from 'node:test';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
const BattleScene=loadBattleScene({Phaser:{Scene:class{}}});
function fixture(id='sakura',practiceMode=false){
 const scene=Object.create(BattleScene.prototype),nodes=[];
 scene.battleData={stageId:1,performerId:id,practiceMode};scene.textures={exists:()=>false};scene._pinHud=n=>n;scene._isPublicStage1Round=()=>!practiceMode;
 scene.add=Object.fromEntries(['rectangle','circle','text'].map(kind=>[kind,(...args)=>{
  const n=Object.assign(new EventEmitter(),{kind,args,active:true});for(const method of ['setDepth','setScrollFactor','setStrokeStyle','setOrigin','setVisible','setPosition'])n[method]=function(...values){this[method.slice(3)]=values;return this;};n.destroy=()=>{n.active=false;};nodes.push(n);return n;
 }]));return {scene,nodes};
}
test('all five public actors leave the lower street unobscured without creating an input surface',()=>{
 for(const id of ['sakura','venus','genya','kai','enjo']){const {scene,nodes}=fixture(id),actor=new ActorPresentation(scene);assert.equal(actor.controlBand,null);assert.equal(nodes.filter(n=>n.kind==='rectangle').length,0,'No full-width screen-fixed rectangle remains');actor.destroy();actor.destroy();assert.equal(actor.controlBand,null);}
 const hidden=fixture('sakura',true);new ActorPresentation(hidden.scene);assert.equal(hidden.nodes.length,0);
});
test('public joystick uses a local dark backing while radii, origin and diagnostic colours remain unchanged',()=>{
 const {scene}=fixture();scene._createMoveJoystick();assert.deepEqual(scene._joystickBase.args,[68,571,44,0x26383C,.14]);assert.deepEqual(scene._joystickBase.StrokeStyle,[1.5,0x26383C,.65]);assert.deepEqual(scene._joystickKnob.args,[68,571,20,0xFFFFFF,.95]);assert.deepEqual({...scene._joystickRest},{x:68,y:571});
 const hidden=fixture('sakura',true).scene;hidden._createMoveJoystick();assert.deepEqual(hidden._joystickBase.args,[68,571,58,0xFFFFFF,.18]);assert.deepEqual(hidden._joystickBase.StrokeStyle,[4,0xFFFFFF,.5]);
});
test('touch ownership, clamp, analog speed and two-touch capacity remain existing contracts',()=>{
 const source=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');const target=source.slice(source.indexOf('  _setTouchTarget(pointer)'),source.indexOf('  _createMoveJoystick()'));
 assert.match(target,/dist > JOYSTICK_RANGE/);assert.match(target,/this\._touchStick = \{ x: dx, y: dy \}/);assert.match(source,/_getPointerId\(pointer\) !== this\._touchMovePointerId/);assert.match(source,/PLAYER\.SPEED \* analog/);assert.match(readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),/activePointers:\s*2/);
});
