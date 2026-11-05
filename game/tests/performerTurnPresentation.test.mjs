import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const local=fileURLToPath(new URL('../',import.meta.url));
const root=existsSync(path.join(local,'package.json'))?local:'D:/STARUSH/03-\u7a0b\u5e8f';
const native=createRequire(path.join(root,'package.json')),{transformSync}=native('esbuild'),cache=new Map();
function load(file){
  const rel=path.relative(root,file),staged=path.join(local,rel);if(existsSync(staged))file=staged;
  if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const base=file.startsWith(local)?path.join(root,path.relative(local,path.dirname(file))):path.dirname(file);
  const require=id=>id.startsWith('.')?load(path.resolve(base,id)):native(id);
  vm.runInThisContext(`(function(require,module,exports){${transformSync(readFileSync(file,'utf8'),{format:'cjs',loader:'js'}).code}\n})`,{filename:file})(require,module,module.exports);
  return module.exports;
}
const {ActorPresentation,preloadActorPresentation}=load(path.join(root,'src/systems/ActorPresentation.mjs'));
function node(x=0,y=0,key='',frame=0){const n={x,y,key,frame,active:true,visible:true,alpha:1,destroyCount:0};
  for(const [method,fields]of Object.entries({setFrame:['frame'],setPosition:['x','y'],setOrigin:['originX','originY'],setDisplaySize:['width','height'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint'],setVisible:['visible'],setAngle:['angle'],setRotation:['rotation'],setScale:['scaleX','scaleY']}))n[method]=function(...a){fields.forEach((f,i)=>this[f]=a[i]);return this;};
  n.setCrop=(...a)=>{n.crop=a;return n;};for(const m of ['setScrollFactor','fillStyle','fillCircle','lineStyle','strokeCircle'])n[m]=()=>n;
  n.destroy=()=>{n.active=false;n.destroyCount++;};return n;
}
function fixture(id,missing=''){const nodes=[];
  const scene={battleData:{stageId:1,performerId:id},player:{x:200,y:400,hp:5,active:true},playerGfx:node(),
    publicPerformerRun:{actions:0,member:{id}},textures:{exists:key=>!missing||!key.endsWith(missing)},
    add:{image:(...a)=>{const n=node(...a);nodes.push(n);return n;},rectangle:node}};
  const actor=new ActorPresentation(scene);
  const draw=(now,dx=0,dy=0)=>{scene.player.x+=dx;scene.player.y+=dy;actor.drawPlayer(now,!!(dx||dy),0xffffff);};
  return {scene,actor,nodes,draw};
}
for(const id of ['venus','genya','kai','enjo']){
  test(`${id}: preload only selected turnaround; new diagonals replace, never ghost over, the body`,()=>{
    const calls=[];preloadActorPresentation({load:{spritesheet:(...a)=>calls.push(a),image(){}}},{stageId:1,performerId:id});
    assert.equal(calls.filter(c=>c[0].endsWith('-turn')).length,1,'turn atlas must be loaded');
    assert.ok(calls.some(c=>c[0]===`performer-${id}-turn`&&c[2].frameWidth===128));
    const f=fixture(id);f.draw(0);f.draw(40,-4,0);
    assert.ok(f.actor.turnImage?.visible,'front-left intermediate must be visible');
    assert.equal(f.actor.turnImage.frame,0);assert.equal(f.actor.playerImage.visible,false);
    assert.equal(f.actor.basicShotImage.visible,false);assert.equal(f.actor.reactionImage.visible,false);
    assert.deepEqual(f.actor.turnImage.crop,[0,0,128,88]);
    assert.equal(f.actor.turnImage.y,f.scene.player.y-13+f.actor.footRig.upperOffset);
    f.actor.setWorldDepth(9.22);assert.equal(f.actor.turnImage.depth,9.22);
    f.draw(80,-4);assert.equal(f.actor.turnImage.visible,false);assert.equal(f.actor.playerImage.visible,true);
    f.draw(120,0,-4);assert.equal(f.actor.turnImage.frame,2);assert.equal(f.actor.turnImage.visible,true);
    f.draw(160,0,-4);f.draw(200,4,0);assert.equal(f.actor.turnImage.frame,3);
    f.draw(240,4,0);f.draw(280,0,4);assert.equal(f.actor.turnImage.frame,1);
    const n=f.actor.turnImage;f.actor.destroy();f.actor.destroy();assert.equal(n.destroyCount,1);
  });
}
test('turning has no input/physics delay, survives retarget and settles at 60/30/15fps',()=>{
  for(const fps of [60,30,15]){
    const f=fixture('kai'),dt=1000/fps;f.draw(0);let seen=false;
    for(let n=1;n<=Math.ceil(240/dt);n++){
      f.draw(n*dt,0,-250*dt/1000);seen ||= !!f.actor.turnImage?.visible;
      assert.equal(f.actor.direction,'up');assert.equal(f.scene.player.hp,5);
    }
    assert.ok(seen,'reverse turn needs a diagonal');assert.equal(f.actor.turnImage.visible,false);
    assert.equal(f.actor.footRig.state.footDirection,'up');
    assert.ok(f.actor.footRig.state.travel>0);
    f.draw(300,-4);f.draw(320,4);f.draw(400,4);f.draw(480,4);
    assert.equal(f.actor.turnImage.visible,false);assert.equal(f.actor.footRig.state.footDirection,'right');
  }
});
test('pause freezes an intermediate; stop completes turn without an idle autoplay loop',()=>{
  const f=fixture('venus');f.draw(0);f.draw(40,-4);
  const image=f.actor.turnImage;assert.ok(image?.visible);
  f.scene._battlePaused=true;f.draw(40);f.draw(40);
  assert.equal(image.visible,true);assert.equal(image.frame,0);
  f.scene._battlePaused=false;f.draw(80);
  assert.equal(image.visible,false);f.draw(1200);assert.equal(image.visible,false);
});
test('a long rendered frame finishes an elapsed turn instead of replaying stale intermediate poses',()=>{
  for(const [dx,dy] of [[-4,0],[4,0],[0,-4]]){
    const f=fixture('kai');f.draw(0);f.draw(240,dx,dy);
    assert.equal(f.actor.turnImage?.visible,false,'expired turn must finish at the current presentation time');
    assert.equal(f.actor.footRig.state.footDirection,dx<0?'left':dx>0?'right':'up');
    assert.equal(Math.floor(f.actor.playerImage.frame/4),dx<0?1:dx>0?2:3);
  }
});
test('shot including cadence gap, hurt and action interrupt turning immediately, never replay a queued cel',()=>{
  for(const kind of ['shot','hurt','action']){
    const f=fixture('enjo');f.draw(0);f.draw(40,-4);assert.ok(f.actor.turnImage?.visible);
    if(kind==='shot')f.actor.notifyBasicShot(45,1,0,333);
    if(kind==='hurt')f.scene.player.hp--;
    if(kind==='action')f.scene.publicPerformerRun.actions++;
    f.draw(50,4);assert.equal(f.actor.turnImage.visible,false);
    assert.equal(f.actor.footRig.state.footDirection,'right');
    if(kind==='shot'){
      assert.equal(f.actor.basicShotImage.visible,true);f.draw(300,-4);
      assert.equal(f.actor.turnImage.visible,false);assert.equal(f.actor.direction,'right');
    }
  }
});
test('missing turn art or missing planted feet keeps established rendering; hidden/Sakura do not preload it',()=>{
  for(const missing of ['-turn','-footrig']){
    const f=fixture('genya',missing);f.draw(0);f.draw(40,-4);
    assert.ok(!f.actor.turnImage?.visible);assert.equal(f.actor.playerImage.visible,true);
  }
  for(const data of [{stageId:1,performerId:'sakura'},{stageId:1,practiceMode:true,performerId:'kai'}]){
    const keys=[];preloadActorPresentation({load:{spritesheet:key=>keys.push(key),image(){},json(){}}},data);
    assert.ok(!keys.some(key=>/^performer-.*-turn$/.test(key)));
  }
});
