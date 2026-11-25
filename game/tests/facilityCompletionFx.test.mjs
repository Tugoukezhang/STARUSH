import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';

const require=createRequire(import.meta.url);
const Events=require('phaser/src/events/EventEmitter.js');
// App boot enables the user cast before any battle preload, as main.js does.
const runtime=loadScenes();runtime.loadRuntime('utils/userCast.mjs').configureUserCast(true);
const {BattleScene}=runtime.loadRuntime('scenes/BattleScene.js'),{PaintZoneSystem}=runtime.loadRuntime('systems/PaintZoneSystem.js');
const KEY='facility-restoration-pop-20261022',PATH='art/facility-ink-seal-20261029/pop.png';
const REDUCED='(prefers-reduced-motion: reduce)';
const ORDINARY={stageId:1,performerId:'sakura',campaignChapterId:'opening'};

function stubScene(data,onLoadError=()=>{}){
  const calls=[],events=new Events();
  const load=new Proxy({},{get:(_,name)=>name==='on'?(type,fn)=>{if(type==='loaderror')onLoadError(fn);return load;}
    :name==='once'||name==='off'?()=>load:(...args)=>{calls.push([name,...args]);return load;}});
  const scene=Object.assign(Object.create(BattleScene.prototype),{initialBattleData:data,load,events,
    sys:{events},textures:{exists:()=>false},cache:{json:{exists:()=>false},audio:{exists:()=>false}},add:{}});
  BattleScene.prototype.preload.call(scene);
  return {scene,calls,events};
}
// One live battle: actual BattleScene preload installs the owner, actual PaintZoneSystem completes devices.
function world({reduced=false,texture=true,data=ORDINARY}={}){
  const {scene,events,calls}=stubScene(data),nodes=[],circles=[],tweens=[],log=[];
  let now=1000;
  Object.assign(scene,{
    _isPublicStage1Round:()=>true,battleData:{...data},_battlePaused:false,_battleEnded:false,
    publicPerformerRun:{now:()=>now},
    textures:{exists:key=>texture&&key===KEY},
    game:{canvas:{ownerDocument:{defaultView:{matchMedia:q=>({matches:reduced&&q===REDUCED})}}}},
    add:{
      image(x,y,key,frame){const n={x,y,key,frame,alpha:1,destroyed:false,frames:[frame],
        setOrigin(a,b){n.origin=[a,b];return n;},setDisplaySize(w,h){n.display=[w,h];return n;},setDepth(d){n.depth=d;return n;},
        setFrame(f){n.frame=f;n.frames.push(f);return n;},setAlpha(a){n.alpha=a;return n;},setTint(c){n.tint=c;return n;},destroy(){n.destroyed=true;}};
        nodes.push(n);log.push('fx');return n;},
      circle(...args){const n={args,setDepth(){return n;},destroy(){}};circles.push(n);log.push('circle');return n;},
    },
    tweens:{add(config){tweens.push(config);}},
  });
  Object.defineProperty(scene,'time',{get(){throw Error('wall timer used');}});
  const zone=Object.assign(Object.create(PaintZoneSystem.prototype),{scene,devices:[],chapterObjectives:null,
    onDeviceComplete:d=>log.push('callback:'+d.id),_redrawDevice:d=>log.push('redraw:'+d.id),
    _maybeAdvanceZone(){log.push('gate');},_emitProgress(){log.push('progress');}});
  const device=id=>({id,x:100+id,y:200,kind:'light',zone:0,paint:3,paintMax:10,complete:false,required:true});
  return {scene,events,calls,zone,nodes,circles,tweens,log,device,
    frame(ms){now=1000+ms;events.emit('postupdate',now,16);}};
}
const live=nodes=>nodes.filter(n=>!n.destroyed);

test('actual preload loads the pop sheet only for ordinary public user-cast Stage 1',()=>{
  const loaded=data=>JSON.parse(JSON.stringify(stubScene(data).calls.filter(c=>c[1]===KEY)));
  assert.deepEqual(loaded(ORDINARY),[['spritesheet',KEY,PATH,{frameWidth:256,frameHeight:256}]]);
  for(const data of [{...ORDINARY,practiceMode:true},{...ORDINARY,defenseMode:true},{...ORDINARY,publicFinaleTrial:{id:'x'}},{...ORDINARY,stageId:2}])
    assert.deepEqual(loaded(data),[],JSON.stringify(data));
  assert.ok(RUNTIME_PAYLOAD.some(row=>row.file===PATH));
});

test('actual _completeDevice keeps callback, redraw, gate and progress order and replaces only the circle',()=>{
  const w=world(),d=w.device(1);
  w.zone._completeDevice(d);
  assert.deepEqual(w.log,['callback:1','redraw:1','fx','gate','progress']);
  assert.equal(w.circles.length,0);assert.equal(w.tweens.length,0);
  const [n]=w.nodes;
  assert.equal(n.key,KEY);assert.equal(n.frame,0);assert.deepEqual(n.origin,[.5,.65]);
  assert.deepEqual(n.display,[112,112]);assert.equal(n.depth,9.79);assert.equal(n.alpha,1);
  w.zone._completeDevice(d);
  assert.deepEqual(w.log,['callback:1','redraw:1','fx','gate','progress']);
  d.complete=false;w.zone._completeDevice(d);
  assert.equal(w.nodes.length,1,'same device never replays');
  assert.equal(w.circles.length,0);
});

test('six held keyframes over 420ms on the pausable run clock, then removal',()=>{
  const w=world();w.zone._completeDevice(w.device(1));const [n]=w.nodes;
  for(const [ms,frame] of [[0,0],[35,0],[36,1],[139,1],[140,2],[229,2],[230,3],[309,3],[310,4],[369,4],[370,5],[419,5]]){
    w.frame(ms);assert.equal(n.frame,frame,'at '+ms);assert.equal(n.destroyed,false);assert.equal(n.alpha,1);
  }
  w.frame(420);assert.equal(n.destroyed,true);
  const v=world();v.zone._completeDevice(v.device(2));v.frame(0);v.frame(60000);
  assert.equal(v.nodes[0].destroyed,true,'long elapsed removes without replay');
  assert.deepEqual(v.nodes[0].frames,[0],'long elapsed skips intermediate frames');
  assert.equal(v.events.listenerCount('postupdate'),1);
});

test('at most four pops are alive and the oldest is removed first',()=>{
  const w=world();
  for(let i=1;i<=5;i++)w.zone._completeDevice(w.device(i));
  assert.equal(live(w.nodes).length,4);assert.equal(w.nodes[0].destroyed,true);assert.equal(w.circles.length,0);
});

test('real camera and ink extents keep edge pops inside the viewport and below the HUD',()=>{
 const w=world();w.scene.cameras={main:{zoom:1,worldView:{x:312,y:1260,width:375,height:667}}};
 const d=w.device(1);Object.assign(d,{x:350,y:1460});w.zone._completeDevice(d);
 const n=w.nodes[0],size=n.display[0];assert(size<=112,'compact facility accent, not a full attack');
 const ink={left:n.x-.36*size,right:n.x+.344*size,top:n.y-.444*size,bottom:n.y+.25*size};
 assert(ink.left>=318&&ink.right<=681&&ink.top>=1386&&ink.bottom<=1921);
 const tiny=world();tiny.scene.cameras=w.scene.cameras;const edge=tiny.device(2);Object.assign(edge,{x:313,y:1400});tiny.zone._completeDevice(edge);
 assert.equal(tiny.nodes.length,0,'no unreadable or clipped pop when there is no safe visible space');assert.equal(tiny.circles.length,0);
});

test('paused frames do not progress and ended frames clear every pop',()=>{
  const w=world();w.zone._completeDevice(w.device(1));const [n]=w.nodes;
  w.frame(100);assert.equal(n.frame,1);
  w.scene._battlePaused=true;w.frame(300);assert.equal(n.frame,1);
  w.scene._battlePaused=false;w.frame(310);assert.equal(n.frame,4);
  w.scene._battleEnded=true;w.frame(320);assert.equal(n.destroyed,true);
  w.zone._completeDevice(w.device(2));
  assert.equal(live(w.nodes).length,0,'ended battle adds no pop');assert.equal(w.circles.length,0);
});

test('reduced motion suppresses the animation without a substitute visual',()=>{
  const w=world({reduced:true});w.zone._completeDevice(w.device(1));
  assert.deepEqual(w.log,['callback:1','redraw:1','gate','progress']);
  assert.equal(w.nodes.length,0);assert.equal(w.circles.length,0);assert.equal(w.tweens.length,0);
});

test('restoration replay and paused completion do not create a new celebration or fallback circle',()=>{
 for(const field of ['_restoringPublicBattleCheckpoint','_battlePaused']){
  const w=world();w.scene[field]=true;w.zone._completeDevice(w.device(1));
  assert.equal(w.nodes.length,0);assert.equal(w.circles.length,0);
  assert.deepEqual(w.log,['callback:1','redraw:1','gate','progress']);
 }
});

test('turning reduced motion on clears a live pop; missing texture does not bypass reduced motion',()=>{
 const w=world();w.zone._completeDevice(w.device(1));
 w.scene.game.canvas.ownerDocument.defaultView.matchMedia=()=>({matches:true});w.frame(50);
 assert.equal(w.nodes[0].destroyed,true);
 const absent=world({reduced:true,texture:false});absent.zone._completeDevice(absent.device(1));
 assert.equal(absent.nodes.length,0);assert.equal(absent.circles.length,0);
});

test('missing texture and ineligible routes keep the original circle',()=>{
  for(const w of [world({texture:false}),world({data:{...ORDINARY,practiceMode:true}}),world({data:{...ORDINARY,defenseMode:true}})]){
    w.zone._completeDevice(w.device(1));
    assert.deepEqual(w.log,['callback:1','redraw:1','circle','gate','progress']);
    assert.equal(w.nodes.length,0);assert.equal(w.tweens.length,1);
  }
});

test('a failed pop download is optional and does not fail the battle load',()=>{
  const handlers=[],{scene,calls}=stubScene(ORDINARY,fn=>handlers.push(fn));
  assert.ok(calls.some(c=>c[1]===KEY));
  for(const fn of handlers)fn({key:KEY,url:PATH,type:'spritesheet'});
  assert.equal(scene._loadRecovery.failed,false);
});

for(const signal of ['shutdown','destroy'])test(signal+' removes listeners and pops and the owner cannot restart',()=>{
  const w=world();w.zone._completeDevice(w.device(1));
  assert.equal(w.events.listenerCount('postupdate'),1);
  w.events.emit(signal);
  assert.equal(w.events.listenerCount('postupdate'),0);assert.equal(w.nodes[0].destroyed,true);
  w.zone._completeDevice(w.device(2));
  assert.equal(w.nodes.length,1);assert.equal(w.events.listenerCount('postupdate'),0);
  assert.deepEqual(w.log.slice(-3),['circle','gate','progress'],'disposed owner falls back to the original circle');
});

test('a crowded completion mounts the small stamp on the open shoulder, away from nearby faces',()=>{
 const w=world(),device=w.device(1);
 w.scene.player={x:device.x-24,y:device.y-9,active:true};w.scene.enemies={getChildren:()=>[]};
 w.scene._facilityCompletionFx.play(device);
 assert.equal(w.nodes.length,1);assert(w.nodes[0].x>device.x);assert(w.nodes[0].y<device.y);
 assert.deepEqual(w.nodes[0].display,[54,54]);
 const both=w.device(2);w.scene.enemies.getChildren=()=>[{x:both.x+27,y:both.y-13,active:true}];
 w.scene._facilityCompletionFx.play(both);assert.equal(w.nodes.length,1);
});
