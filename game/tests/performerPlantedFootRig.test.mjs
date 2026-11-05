import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const root=fileURLToPath(new URL('../',import.meta.url));
const target=new URL('../src/systems/PerformerFootRig.mjs',import.meta.url);
const rig=existsSync(target)?await import(target):{};
test('generated leg attachments have an actual planted-foot presenter',()=>assert.equal(typeof rig.PerformerFootRig,'function'));

function node(){return {active:true,alpha:1,visible:true,destroyCount:0,
  setFrame(v){this.frame=v;return this;},setOrigin(x,y){this.origin=[x,y];return this;},
  setPosition(x,y){this.x=x;this.y=y;return this;},setScale(v){this.scale=v;return this;},
  setRotation(v){this.rotation=v;return this;},setDepth(v){this.depth=v;return this;},
  setAlpha(v){this.alpha=v;return this;},setTint(v){this.tint=v;return this;},
  setDisplaySize(){return this;},setScrollFactor(){return this;},setAngle(){return this;},
  setCrop(...v){this.crop=v;return this;},setVisible(v){this.visible=v;return this;},
  fillStyle(){return this;},fillCircle(){return this;},lineStyle(){return this;},strokeCircle(){return this;},
  destroy(){this.destroyCount++;this.active=false;}};}
function fixture(id='kai'){
  const images=[],scene={player:{x:100,y:100,active:true,hp:5,body:{velocity:{x:0,y:0},halfWidth:4}},
    add:{image(){const image=node();images.push(image);return image;}},playerGfx:node()};
  const view=new rig.PerformerFootRig(scene,id);return {scene,view,images};
}

for(const id of ['kai','venus','genya','enjo']){
  test(`${id}: two feet plant at different phases and remain fixed during stance`,()=>{
    const {scene,view,images}=fixture(id);view.update(0,0,0,'right',false);
    let previous=null,lockedSamples=0;const owners=new Set();
    for(let i=1;i<=240;i++){
      scene.player.x+=1;
      const host=JSON.stringify(scene.player);view.update(i*4,1,0,'right',false);
      assert.equal(JSON.stringify(scene.player),host);
      view.state.feet.forEach((foot,side)=>{
        if(foot.contact){owners.add(side);assert.equal(foot.lift,0);}
        if(previous&&foot.contact&&previous[side].contact&&foot.plantId===previous[side].plantId){
          assert.equal(foot.x,previous[side].x);assert.equal(foot.y,previous[side].y);lockedSamples++;
        }
      });
      for(const leg of view.geometry)assert.ok(leg.error<0.02,'a planted foot cannot be silently clamped away from its contact');
      previous=structuredClone(view.state.feet);
    }
    assert.deepEqual([...owners].sort(),[0,1]);assert.ok(lockedSamples>8);
    assert.equal(images.length,6);view.destroy();view.destroy();
    assert.ok(images.every(n=>n.destroyCount===1));
  });
}

test('stop settles both feet; frozen time and position consume no pose',()=>{
  const {scene,view}=fixture();view.update(0,0,0,'down',false);
  for(let i=1;i<=12;i++){scene.player.y+=2;view.update(i*16,0,2,'down',false);}
  const saved=JSON.stringify(view.state);view.update(9000,0,0,'left',true);
  assert.equal(JSON.stringify(view.state),saved);
  for(let i=1;i<=20;i++)view.update(9000+i*16,0,0,'down',false);
  assert.equal(view.state.mode,'idle');assert.ok(view.state.feet.every(f=>f.contact&&Math.abs(f.lift)<1e-9));
  view.destroy();
});

test('four orientations and reversals preserve bounded solved endpoints',()=>{
  const {scene,view}=fixture();let now=0;
  for(const [facing,dx,dy] of [['down',0,2],['left',-2,0],['right',2,0],['up',0,-2]]){
    for(let i=0;i<40;i++){scene.player.x+=dx;scene.player.y+=dy;now+=8;view.update(now,dx,dy,facing,false);
      assert.ok(view.geometry.every(g=>g.error<0.02));
    }
  }
  view.destroy();
});

test('real ActorPresentation uses rig for idle, moving action and hurt; old lower cel stays hidden',async()=>{
  const program=process.env.STARUSH_PROGRAM_ROOT||'D:/STARUSH/03-\u7a0b\u5e8f';
  const native=createRequire(path.join(program,'package.json')),cache=new Map();
  const {transformSync}=native('esbuild');
  const load=file=>{
    const staged=path.join(root,'src/systems',path.basename(file));
    if(existsSync(staged))file=staged;
    else if(!existsSync(file))file=path.join(program,'src',path.relative(path.join(root,'src'),file));
    if(cache.has(file))return cache.get(file).exports;
    const module={exports:{}};cache.set(file,module);
    const require=id=>id.startsWith('.')?load(path.resolve(path.dirname(file),id)):native(id);
    const code=transformSync(readFileSync(file,'utf8'),{loader:'js',format:'cjs'}).code;
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename:file})(require,module,module.exports);
    return module.exports;
  };
  const {ActorPresentation,preloadActorPresentation}=load(path.join(program,'src/systems/ActorPresentation.mjs'));
  for(const id of ['kai','venus','genya','enjo']){
    const calls=[];preloadActorPresentation({load:{spritesheet:(...a)=>calls.push(a),image(){}}},{performerId:id,stageId:1});
    assert.ok(calls.some(c=>c[0]===`performer-${id}-footrig`));
    const scene={player:{x:100,y:100,active:true,hp:5},playerGfx:node(),battleData:{stageId:1,performerId:id},
      publicPerformerRun:{actions:0,member:{id}},textures:{exists:()=>true},add:{image:node,rectangle:node}};
    const actor=new ActorPresentation(scene);actor.drawPlayer(0,false,0xffffff);
    assert.ok(actor.footRig);assert.deepEqual(actor.playerImage.crop,[0,0,128,88]);
    for(let i=1;i<=4;i++){
      scene.player.x+=20;actor.drawPlayer(i*16,true,0xffffff);
      const visualRow={down:0,left:1,right:2,up:3}[actor.footRig.state.footDirection];
      assert.equal(actor.direction,'right','turning must not delay declared movement direction');
      assert.equal(actor.playerImage.frame,visualRow*4+Math.floor(actor.footRig.state.phase*4),'arm cel and solved legs must share one gait phase through a turn');
    }
    scene.publicPerformerRun.actions++;scene.player.x+=2;actor.drawPlayer(100,true,0xffffff);
    const travel=actor.footRig.state.travel;
    assert.equal(actor.state,'action');assert.equal(actor.playerLegs.visible,false);
    scene.player.x+=2;actor.drawPlayer(116,true,0xffffff);
    assert.ok(actor.footRig.state.travel>travel,'action must not freeze stride');
    scene.player.hp--;scene.player.x+=2;actor.drawPlayer(132,true,0xffffff);
    assert.equal(actor.state,'hurt');assert.ok(actor.footRig.nodes.every(n=>n.tint===0xffb4c1));
    const nodes=[...actor.footRig.nodes];actor.destroy();actor.destroy();assert.ok(nodes.every(n=>n.destroyCount===1));
  }
});
