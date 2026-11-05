import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceFeet,makeFeet} from '../src/systems/SakuraFootMotion.mjs';
import {PerformerFootRig} from '../src/systems/PerformerFootRig.mjs';
import {SakuraLayeredPresentation} from '../src/systems/SakuraLayeredPresentation.mjs';
import {fixture as actorFixture,target} from './motionStageFixture.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function fixture(){
  const p={x:100,y:100};
  return {p,s:{mode:'idle',travel:0,phase:0,stopTime:0,footDirection:'down',feet:makeFeet(p,'down')}};
}
function move(f,dx,dy,direction='down'){
  f.p.x+=dx;f.p.y+=dy;advanceFeet(f.s,f.p,dx,dy,Math.hypot(dx,dy)*4,direction);
}
const displacement=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.lift-b.lift);
test('first 0.1px movement retains the standing support and has no mid-air pose jump',()=>{
  const f=fixture(),before=structuredClone(f.s.feet);move(f,0,.1);
  near(f.s.feet[0].x,before[0].x);near(f.s.feet[0].y,before[0].y);
  assert.ok(displacement(f.s.feet[1],before[1])<.3,'first swing snaps to its cyclic mid-air pose');
  near(f.s.travel,.1);
});
test('micro-steps through lift-off never teleport a planted foot',()=>{
  const f=fixture();let previous=structuredClone(f.s.feet),contacts=0;
  for(let n=0;n<1400;n++){
    move(f,0,.1);
    f.s.feet.forEach((foot,i)=>{
      assert.ok(displacement(foot,previous[i])<.5,`foot ${i} jumps at ${f.s.travel}`);
      if(foot.contact&&previous[i].contact&&foot.plantId===previous[i].plantId){near(foot.x,previous[i].x);near(foot.y,previous[i].y);contacts++;}
    });previous=structuredClone(f.s.feet);
  }
  assert.ok(contacts>100);
});
test('a resumed stride starts from its settled feet at arbitrary phase',()=>{
  for(const distance of [4,18,32,39,56,67]){
    const f=fixture();for(let n=0;n<distance;n++)move(f,0,1);
    for(let n=0;n<30;n++)advanceFeet(f.s,f.p,0,0,10,'down');
    const previous=structuredClone(f.s.feet);move(f,.1,0,'right');
    f.s.feet.forEach((foot,i)=>assert.ok(displacement(foot,previous[i])<.5,`restart ${distance} foot ${i} jumped`));
    near(f.s.travel,distance+.1);
  }
});
test('a sharp moving reversal retargets swing continuously, without sliding support',()=>{
  const f=fixture();for(let n=0;n<220;n++)move(f,.1,0,'right');
  const previous=structuredClone(f.s.feet);move(f,-.1,0,'left');
  f.s.feet.forEach((foot,i)=>assert.ok(displacement(foot,previous[i])<.5,`turn foot ${i} jumps`));
});

function node(){const n={active:true,alpha:1};
  for(const [m,keys]of Object.entries({setPosition:['x','y'],setScale:['scaleX','scaleY'],setRotation:['rotation'],setFrame:['frame'],setOrigin:['originX','originY'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint']}))n[m]=function(...v){keys.forEach((k,i)=>this[k]=v[i]);return this;};
  n.setTexture=()=>n;n.setDisplaySize=()=>n;n.destroy=()=>{n.active=false;};return n;
}
for(const id of ['sakura','venus','genya','kai','enjo'])test(`${id}: actual presenter starts continuously and stays within leg reach`,()=>{
  const scene={player:{x:100,y:100},playerGfx:{alpha:1},textures:{exists:()=>true},add:{image:node}};
  const view=id==='sakura'?new SakuraLayeredPresentation(scene):new PerformerFootRig(scene,id);
  const update=(now,dx,dy,facing='down',frozen=false)=>id==='sakura'
    ?view.update(now,dx,dy,null,frozen):view.update(now,dx,dy,facing,frozen);
  update(0,0,0);const before=structuredClone(view.state.feet);
  scene.player.y+=.1;update(.4,0,.1);
  view.state.feet.forEach((f,i)=>assert.ok(displacement(f,before[i])<.5,`${id} entry foot ${i} jumps`));
  let now=.4;
  for(const [dx,dy,facing]of [[0,1,'down'],[1,0,'right'],[-1,0,'left'],[0,-1,'up']]){
    for(let n=0;n<100;n++){
      scene.player.x+=dx;scene.player.y+=dy;now+=4;const root={...scene.player};update(now,dx,dy,facing);
      assert.deepEqual(scene.player,root);
      const legs=id==='sakura'?view.state.legGeometry:view.geometry;
      assert.ok(legs.every(g=>g.error<.02),`${id} leg cannot reach foot`);
    }
  }
  const frozen=JSON.stringify(view.state);update(now+5000,0,0,'up',true);assert.equal(JSON.stringify(view.state),frozen);
  now+=5000;for(let n=0;n<30;n++){now+=10;update(now,0,0,'up');}
  assert.equal(view.state.mode,'idle');assert.ok(view.state.feet.every(f=>f.contact&&f.lift===0));view.destroy();
});

test('five production actors keep run/attack/turn contacts finite at 15/30/60/120fps',()=>{
  for(const id of ['sakura','venus','genya','kai','enjo'])for(const fps of [15,30,60,120]){
    const f=actorFixture(id),dt=1000/fps;f.draw(0);let now=0,previous=null,locked=0;
    for(let n=1;n<=Math.ceil(fps*2);n++){
      now+=dt;
      const direction=n<fps/2?1:n<fps?-1:n<fps*1.5?1:-1;
      const dx=direction*150*dt/1000;
      if(n%Math.max(1,Math.round(fps/4))===0){
        if(id==='sakura')f.run.sakuraCombat.beginBasic(target(f.s.player.x+100,f.s.player.y),now,300);
        else f.actor.notifyBasicShot(now,100,0,300);
      }
      f.draw(now,dx,0);
      const state=f.actor.sakuraView?.state??f.actor.footRig.state;
      const geometry=f.actor.sakuraView?.state.legGeometry??f.actor.footRig.geometry;
      assert.ok(geometry.every(g=>Number.isFinite(g.error)&&g.error<.02),`${id}/${fps} reach`);
      state.feet.forEach((foot,i)=>{
        assert.ok(Number.isFinite(foot.x)&&Number.isFinite(foot.y)&&Number.isFinite(foot.lift));
        if(previous&&foot.contact&&previous[i].contact&&foot.plantId===previous[i].plantId){near(foot.x,previous[i].x);near(foot.y,previous[i].y);locked++;}
      });previous=structuredClone(state.feet);
    }
    // 15fps may sample over the short stance; no claim that every contact was rendered.
    if(fps>=60)assert.ok(locked>0);
    f.actor.destroy();
  }
});
