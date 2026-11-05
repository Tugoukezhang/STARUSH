import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {ActorPresentation,preloadActorPresentation,getPerformerRosterVisual} from '../src/systems/ActorPresentation.mjs';
import {SakuraDefeatPresentation,captureSakuraDefeat} from '../src/systems/SakuraDefeatPresentation.mjs';
import {ENJO_ART} from '../src/systems/EnjoLayeredPresentation.mjs';
const nodes=[],timers=[],loads=[];
const node=()=>{const n={active:true,alpha:1,visible:true,destroyCount:0};for(const method of ['setFrame','setOrigin','setDisplaySize','setPosition','setAngle','setAlpha','setTint','setDepth','setScrollFactor','setVisible']){
  n[method]=(...a)=>{if(method==='setPosition'){n.x=a[0];n.y=a[1];}if(method==='setAlpha')n.alpha=a[0];if(method==='setFrame')n.frame=a[0];return n;};}
  n.destroy=()=>{n.destroyCount++;n.active=false;};nodes.push(n);return n;};
const gfx={alpha:1,clear(){},fillStyle(){},fillCircle(){},lineStyle(){},strokeCircle(){}};
const scene={battleData:{stageId:1,performerId:'enjo'},player:{x:100,y:100,hp:5,active:true},
  publicPerformerRun:{member:{id:'enjo'},actions:0},battleRecord:{playerHitCount:0},playerGfx:gfx,events:new EventEmitter(),
  load:{atlas:(...a)=>loads.push(['atlas',...a]),json:(...a)=>loads.push(['json',...a]),image:(...a)=>loads.push(['image',...a]),spritesheet:(...a)=>loads.push(['sheet',...a])},
  textures:{exists:key=>key===ENJO_ART.key},cache:{json:{get:()=>({rig:{identity:'enjo'}})}},
  add:{image:node,ellipse:node,rectangle:node},time:{now:0,delayedCall:(delay,fn)=>{const t={delay,fn,removed:false,remove(){this.removed=true;}};timers.push(t);return t;}}};
preloadActorPresentation(scene,scene.battleData);
const actor=new ActorPresentation(scene);
assert.ok(actor.enjoView,'real layered capability must select Enjo, not legacy cel');
assert.ok(!loads.some(r=>r[0]==='sheet'&&r[1].includes('enjo')));
assert.equal(getPerformerRosterVisual('enjo').kind,'portrait');
assert.equal(actor.notifyBasicShot(20,1,0,200),true);
actor.drawPlayer(30,true,0xFFFFFF);scene.player.x=103;scene.events.emit('postupdate');
assert.equal(actor.enjoView.pose.root.x,103);assert.equal(actor.enjoView.pose.state,'attack');
assert.equal(scene.player.x,103);
scene.battleRecord.playerHitCount++;scene.player.hp--;actor.drawPlayer(40,false,0xFFFFFF);scene.events.emit('postupdate');
assert.equal(actor.enjoView.pose.state,'hurt');assert.equal(actor.notifyBasicShot(41,1,0,200),false);
const snapshot=JSON.stringify(actor.enjoView.pose);scene._battlePaused=true;
actor.drawPlayer(1000,false,0xFFFFFF);scene.events.emit('postupdate');
assert.equal(JSON.stringify(actor.enjoView.pose),snapshot);scene._battlePaused=false;
assert.equal(captureSakuraDefeat(actor,'victory'),null);
scene.player.hp=0;const pose=captureSakuraDefeat(actor,'player-defeat');assert.ok(pose?.enjo);
let completed=0;const transition=new SakuraDefeatPresentation(scene,pose,()=>completed++);
assert.equal(transition.started,true);assert.ok(transition.enjo);
actor.destroy();actor.destroy();assert.equal(scene.events.listenerCount('postupdate'),0);
scene.events.emit('update',0,100);
assert.equal(transition.enjo.view.pose.state,'defeat');
assert.equal(timers.length,1);assert.equal(timers[0].delay,560);timers[0].fn();
assert.equal(completed,1);assert.equal(scene.events.listenerCount('update'),0);
transition.destroy();assert.ok(nodes.every(n=>n.destroyCount===1));
const interrupted=new SakuraDefeatPresentation(scene,pose,()=>completed++);
interrupted.destroy();assert.equal(scene.events.listenerCount('update'),0);timers[1].fn();assert.equal(completed,1);
console.log('Enjo actual loader/actor/result owner and idempotent cleanup passed');
