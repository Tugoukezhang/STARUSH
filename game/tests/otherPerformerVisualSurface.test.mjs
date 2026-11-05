import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import * as actors from '../src/systems/ActorPresentation.mjs';

function node(){
 const n=Object.assign(new EventEmitter(),{active:true,alpha:1,visible:true,commands:[],destroys:0});
 for(const [method,keys]of Object.entries({setPosition:['x','y'],setFrame:['frame'],setAlpha:['alpha'],setAngle:['angle'],setTint:['tint'],setDisplaySize:['displayWidth','displayHeight'],setDepth:['depth'],setOrigin:['originX','originY'],setScrollFactor:['scrollFactor'],setVisible:['visible'],setScale:['scaleX','scaleY'],setRotation:['rotation']}))n[method]=function(...args){keys.forEach((k,i)=>this[k]=args[i]);return this;};
 n.setCrop=()=>n;n.destroy=()=>{if(n.active){n.active=false;n.destroys++;n.emit('destroy');}};
 for(const m of ['fillStyle','fillCircle','lineStyle','strokeCircle'])n[m]=(...args)=>{n.commands.push([m,...args]);return n;};return n;
}
function fixture(id){
 const scene={player:{x:100,y:100,hp:5,active:true,body:{halfWidth:4,velocity:{x:0,y:0}}},playerGfx:node(),battleData:{stageId:1,performerId:id},publicPerformerRun:{member:{id},actions:0},textures:{exists:()=>true},events:new EventEmitter(),add:{image:(x,y,key,frame)=>Object.assign(node(),{x,y,key,frame}),rectangle:node,ellipse:(x,y,width,height,color,alpha)=>Object.assign(node(),{x,y,width,height,color,alpha})}};
 return {scene,actor:new actors.ActorPresentation(scene)};
}
for(const id of ['venus','genya','kai','enjo']){
 test(id+': collision marker matches the 4px body without painting a second white core',()=>{
  const {scene,actor}=fixture(id),before=JSON.stringify(scene.player);actor.drawPlayerFrame(0,false,0xff69b4);
  assert.deepEqual(scene.playerGfx.commands.filter(c=>c[0]==='fillCircle').map(c=>c.slice(1)),[[100,100,4.5],[100,100,4]]);
  assert.equal(JSON.stringify(scene.player),before);actor.destroy();
 });
 test(id+': one grounded shadow follows final root, respects occlusion depth and disposes once',()=>{
  const {scene,actor}=fixture(id),shadow=actor.playerShadow;assert(shadow?.active,'missing grounded shadow');
  actor.drawPlayerFrame(0,false,0xffffff);assert.deepEqual([shadow.x,shadow.y],[100,126]);
  assert.equal(shadow.width,25*2/3);assert.equal(shadow.height,7*2/3);assert.equal(shadow.alpha,.16);
  actor.setWorldDepth(14);assert(shadow.depth<actor.playerImage.depth);
  scene.player.x+=8;scene.player.y-=5;scene.playerGfx.alpha=.5;actor.drawPlayerFrame(16,true,0xffffff);
  assert.deepEqual([shadow.x,shadow.y],[108,121]);assert.equal(shadow.alpha,.08);
  const original={x:shadow.x,y:shadow.y,alpha:shadow.alpha};scene._battlePaused=true;scene.player.x+=10;actor.drawPlayer(100,true,0xffffff);scene.events.emit('postupdate');
  assert.deepEqual({x:shadow.x,y:shadow.y,alpha:shadow.alpha},original);
  actor.destroy();actor.destroy();assert.equal(shadow.destroys,1);assert.equal(actor.playerShadow,null);assert.equal(scene.events.listenerCount('postupdate'),0);
 });
}
test('preload caps padded walk/foot banks and preserves exact member-only asset ownership',()=>{
 for(const id of ['venus','genya','kai','enjo']){
  const calls=[];actors.preloadActorPresentation({load:{spritesheet:(...v)=>calls.push(v),image(){}}},{stageId:1,performerId:id});
  assert.equal(calls.find(c=>c[0]===`performer-${id}-walk`)[2].endFrame,47);
  assert.equal(calls.find(c=>c[0]===`performer-${id}-footrig`)[2].endFrame,11);
  assert.equal(calls.length,5);assert(calls.every(c=>c[0].startsWith(`performer-${id}-`)));
 }
});
test('sampler is texture-local, POT-only, idempotent and leaves global renderer settings intact',()=>{
 assert.equal(typeof actors.preparePerformerSampler,'function');
 const gl={LINEAR_MIPMAP_LINEAR:9987},calls=[],wrapper={pixels:{},width:512,height:2048,flipY:false,wrapS:33071,wrapT:33071,minFilter:9729,magFilter:9729,format:6408,update(...args){calls.push(args);this.minFilter=args[6];}};
 const renderer={gl,mipmapFilter:9729},scene={game:{renderer},textures:{get:()=>({source:[{glTexture:wrapper}]})}};
 assert.equal(actors.preparePerformerSampler(scene,'own'),true);assert.equal(calls.length,1);assert.equal(renderer.mipmapFilter,9729);
 assert.equal(actors.preparePerformerSampler(scene,'own'),false);assert.equal(calls.length,1);
 wrapper.height=1536;wrapper.minFilter=9729;assert.equal(actors.preparePerformerSampler(scene,'legacy'),false);assert.equal(calls.length,1);
 assert.equal(actors.preparePerformerSampler({textures:{get:()=>null}},'none'),false);
});
