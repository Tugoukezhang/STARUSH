import assert from 'node:assert/strict';
import test from 'node:test';
import {SakuraLayeredPresentation,SAKURA_LAYER_HANDS,sakuraUpperFrame} from '../src/systems/SakuraLayeredPresentation.mjs';
import {sakuraFanRoot} from '../src/systems/SakuraCombat.mjs';
import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';

function image(x=0,y=0,key='',frame=0){
 const n={x,y,frame,texture:{key},active:true,alpha:1};
 for(const [m,keys]of Object.entries({setDisplaySize:['displayWidth','displayHeight'],setPosition:['x','y'],setOrigin:['originX','originY'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint'],setAngle:['angle'],setRotation:['rotation'],setScale:['scaleX','scaleY'],setFrame:['frame'],setVisible:['visible'],setScrollFactor:['scrollFactor']}))n[m]=function(...v){keys.forEach((k,i)=>this[k]=v[i]??v[0]);return this;};
 n.setTexture=function(k,f=0){this.texture.key=k;this.frame=f;return this;};n.destroy=function(){this.active=false;};
 for(const m of ['fillStyle','fillCircle','lineStyle','strokeCircle'])n[m]=()=>n;return n;
}
function fixture(){
 const scene={player:{x:300,y:500,active:true,hp:5,body:{}},playerGfx:image(),add:{image,rectangle:image},textures:{exists:()=>true},battleData:{stageId:1,performerId:'sakura'},publicPerformerRun:{member:{id:'sakura'},actions:0,sakuraCombat:{snapshot:()=>null}}};
 return {scene,view:new SakuraLayeredPresentation(scene)};
}
test('each direction has anticipation, extension and return drawings, not four held attack cels',()=>{
 assert.equal(SAKURA_LAYER_HANDS.length,32);
 for(const [row,direction] of ['down','left','right','up'].entries()){
  const seq=[['windup',0,0],['windup',.35,1],['windup',.75,2],['release',0,3],['release',.4,4],['release',.9,5],['recovery',.35,6],['recovery',.85,7]];
  for(const [phase,progress,pose]of seq)assert.equal(sakuraUpperFrame({direction,phase,progress}),row*8+pose);
 }
});
test('visual source replacement never changes the existing sixteen committed combat sockets',()=>{
 const old=[[92.34,146.69],[85.3,140.1],[62.97,140.1],[110.31,179.66],[92.94,144.93],[65.97,127.4],[54.39,129.59],[103.71,175.61],[162.46,161.27],[174.52,136.17],[181.47,131.79],[171.64,159.08],[157.87,162.89],[174.75,151.9],[165.75,149.7],[146.87,173.88]];
 for(const [frame,[x,y]]of old.entries())assert.deepEqual(sakuraFanRoot({x:240,y:380},frame),{x:240+(x-128)*88/256,y:380+(y-245)*88/256+26});
});
test('idle damage plays actual reaction drawings then returns, without moving physics or feet',()=>{
 const {scene,view}=fixture();view.update(0,0,0,null,false);const player={...scene.player},feet=structuredClone(view.state.feet);
 view.update(16,0,0,null,false,true,1);assert.match(view.state.upperTexture,/reaction/);const first=view.state.upperFrame;
 view.update(66,0,0,null,false,false,1);view.update(96,0,0,null,false,false,1);assert.notEqual(view.state.upperFrame,first);
 for(let t=116;t<=236;t+=20)view.update(t,0,0,null,false,false,1);
 assert.match(view.state.upperTexture,/idle/);assert.deepEqual(scene.player,player);assert.deepEqual(view.state.feet,feet);
});
test('attack always owns the fan cel even during damage; reaction does not extend attack state',()=>{
 const {view}=fixture(),a={id:1,direction:'left',phase:'release',progress:.4};view.update(0,0,0,a,false);
 view.update(16,0,0,a,false,true,1);assert.equal(view.state.upperFrame,sakuraUpperFrame(a));assert.match(view.state.upperTexture,/attack/);assert.equal(view.state.hurt,true);
 for(let t=36;t<=236;t+=20)view.update(t,0,0,a,false,false,1);
 assert.equal(view.state.hurt,false);assert.equal(view.state.upperFrame,sakuraUpperFrame(a));
});
test('damage presentation clock freezes and a new hit restarts once, not on every held hurt flag',()=>{
 const {view}=fixture();view.update(0,0,0,null,false);view.update(16,0,0,null,false,true,1);
 const remaining=view.state.reactionUntil-view.state.clock;assert.equal(remaining,180);
 view.update(2016,0,0,null,true,true,1);view.update(2032,0,0,null,false,true,1);
 assert.equal(view.state.reactionUntil-view.state.clock,remaining-16);
 for(let t=2052;t<=2252;t+=20)view.update(t,0,0,null,false,true,1);
 assert.equal(view.state.hurt,false,'held flag cannot continually reset reaction');
 view.update(2272,0,0,null,false,true,2);assert.equal(view.state.reactionUntil-view.state.clock,180);
});
test('actual HP losses create distinct reaction events but pause/resume never invents one',()=>{
 const {scene}=fixture(),actor=new ActorPresentation(scene),events=[];
 const update=actor.sakuraView.update.bind(actor.sakuraView);actor.sakuraView.update=(...args)=>{events.push(args[6]);return update(...args);};
 actor.drawPlayer(0,false,0xffffff);scene.player.hp=4;actor.drawPlayer(16,false,0xffffff);actor.drawPlayer(32,false,0xffffff);
 scene.player.hp=3;actor.drawPlayer(48,false,0xffffff);scene._battlePaused=true;actor.drawPlayer(2048,false,0xffffff);scene._battlePaused=false;actor.drawPlayer(2064,false,0xffffff);
 assert.deepEqual(events,[0,1,1,2,2,2]);actor.destroy();
});
