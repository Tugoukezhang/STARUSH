import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceFeet, makeFeet, restFoot} from '../src/systems/SakuraFootMotion.mjs';
import {PerformerFootRig} from '../src/systems/PerformerFootRig.mjs';
import {SakuraLayeredPresentation} from '../src/systems/SakuraLayeredPresentation.mjs';

const p={x:100,y:100};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const fresh=()=>({travel:0,phase:0,mode:'run',footDirection:'down',stopTime:0,feet:makeFeet(p,'down')});

test('already resting feet do not take a fake extra step',()=>{
  const s=fresh(),before=structuredClone(s.feet);
  for(let t=0;t<300;t+=10){advanceFeet(s,p,0,0,10,'down');assert.deepEqual(s.feet,before);}
  assert.equal(s.mode,'idle');
});
for(const support of [0,1])test(`support ${support} stays planted until the other foot lands`,()=>{
  const s=fresh(),swing=1-support;
  s.feet[support].x-=2;s.feet[swing].x+=4;s.feet[swing].lift=3;s.feet[swing].contact=false;
  const anchor={...s.feet[support]};let landed=false;
  for(let t=0;t<220;t+=5){
    advanceFeet(s,p,0,0,5,'down');
    if(!landed){assert.ok(s.feet[swing].lift<=3,'landing cannot add an upward hop');}
    if(!s.feet[swing].contact){
      assert.equal(s.feet[support].contact,true,'support lifted before the swing foot landed');
      near(s.feet[support].x,anchor.x);near(s.feet[support].y,anchor.y);near(s.feet[support].lift,0);
    }else landed=true;
    assert.ok(s.feet.some(f=>f.contact),'stopping a supported pose must never introduce flight');
  }
  assert.equal(s.mode,'idle');assert.ok(landed);
  s.feet.forEach((f,i)=>{near(f.x,restFoot(p,'down',i).x);near(f.y,126);near(f.lift,0);assert.equal(f.plantId,1);});
});

test('an airborne stop lands monotonically, then never loses both contacts again',()=>{
  const s=fresh();s.feet.forEach((f,i)=>{f.contact=false;f.lift=i?4:1;f.x+=i?3:-3;});
  let supported=false,first=null,previous=1;
  for(let t=0;t<=220;t+=5){
    advanceFeet(s,p,0,0,5,'down');
    if(!s.feet[0].contact){assert.ok(s.feet[0].lift<=previous);previous=s.feet[0].lift;}
    if(first===null&&s.feet.some(f=>f.contact))first=s.feet.findIndex(f=>f.contact);
    if(supported)assert.ok(s.feet.some(f=>f.contact));
    supported ||= s.feet.some(f=>f.contact);
  }
  assert.equal(first,0);assert.equal(s.mode,'idle');
});

test('skipped settle frames still record exactly one new contact per replant',()=>{
  const s=fresh();s.feet.forEach(f=>f.x+=3);
  advanceFeet(s,p,0,0,240,'down');
  assert.equal(s.mode,'idle');assert.deepEqual(s.feet.map(f=>f.plantId),[1,1]);
  advanceFeet(s,p,0,0,240,'down');assert.deepEqual(s.feet.map(f=>f.plantId),[1,1]);
});

test('Sakura pause migration shifts settle targets together with saved foot anchors',()=>{
  const {scene,view,update}=presenter('sakura');update(0,0,0);
  scene.player.y+=4;update(16,0,4);update(32,0,0);
  scene.player.x+=120;update(5000,120,0,true);
  for(let n=1;n<=20;n++)update(5000+n*16,0,0);
  view.state.feet.forEach((f,i)=>near(f.x,restFoot(scene.player,'down',i).x));view.destroy();
});

function node(){const n={active:true,alpha:1};
  for(const [m,keys]of Object.entries({setPosition:['x','y'],setScale:['scaleX','scaleY'],setRotation:['rotation'],setFrame:['frame'],setOrigin:['originX','originY'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint']}))n[m]=function(...v){keys.forEach((k,i)=>this[k]=v[i]);return this;};
  n.setDisplaySize=()=>n;n.setTexture=()=>n;n.destroy=()=>{n.active=false;};return n;
}
function presenter(id){const scene={player:{x:100,y:100},playerGfx:{alpha:1},textures:{exists:()=>true},add:{image:node}};
  const view=id==='sakura'?new SakuraLayeredPresentation(scene):new PerformerFootRig(scene,id);
  const update=(now,dx,dy,frozen=false)=>id==='sakura'?view.update(now,dx,dy,null,frozen):view.update(now,dx,dy,'down',frozen);
  return {scene,view,update};
}
for(const id of ['sakura','venus','genya','kai','enjo'])test(`${id}: actual presenter preserves contact across stop phases and frozen frames`,()=>{
  for(const distance of [1,4,12,22,34,39,49,60])for(const fps of [30,60,120]){
    const {scene,view,update}=presenter(id),dt=1000/fps;let now=0;
    update(now,0,0);
    for(let d=0;d<distance;d++){scene.player.y++;now+=4;update(now,0,1);}
    let supported=view.state.feet.some(f=>f.contact),firstSupported=supported;
    for(let n=0;n<Math.ceil(240/dt);n++){
      now+=dt;update(now,0,0);
      if(supported)assert.ok(view.state.feet.some(f=>f.contact),`${id}/${distance}/${fps} loses support`);
      supported ||= view.state.feet.some(f=>f.contact);
      if(n===2){const frozen=JSON.stringify(view.state);update(now+1000,0,0,true);assert.equal(JSON.stringify(view.state),frozen);now+=1000;}
    }
    assert.ok(supported,`${id} never landed; initially supported=${firstSupported}`);
    assert.equal(view.state.mode,'idle');view.destroy();
  }
});

test('a turn or renewed movement cancels stale settle positions without moving the physics root',()=>{
  const s=fresh(),player={...p};s.feet[1].contact=false;s.feet[1].lift=2;
  advanceFeet(s,player,0,0,30,'down');advanceFeet(s,player,0,0,30,'right');
  const original={...player};advanceFeet(s,player,2,0,16,'right');assert.deepEqual(player,original);assert.equal(s.mode,'run');
  for(let n=0;n<25;n++)advanceFeet(s,player,0,0,10,'right');
  assert.equal(s.mode,'idle');s.feet.forEach((f,i)=>near(f.x,restFoot(player,'right',i).x));
});
