import test from 'node:test';
import assert from 'node:assert/strict';
import {UserWeaponFx,RIFLE_COMIC_PROJECTILE,USER_WEAPON_FX} from '../src/systems/UserWeaponFx.mjs';

// Fake nodes only record native crop calls; actual WebGL clipping is verified by the real browser run.
function fixture(id='sakura',{crop=true,missing=[]}={}){
  let time=500;const nodes=[];
  const scene={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},publicPerformerRun:{now:()=>time},
    oldStreet:{clearLine:()=>true},textures:{exists:key=>!missing.includes(key)},
    time:{delayedCall(){throw new Error('FX must not own timers');}},tweens:{add(){throw new Error('FX must not own tweens');}},
    add:{image(x,y,key,frame){
      const n={x,y,texture:{key},frame:{name:frame??0},active:true,destroyed:0,moved:0,crops:[],
        setOrigin(ox,oy=ox){this.origin=[ox,oy];return this;},setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},
        setTint(v){this.tint=v;return this;},setAlpha(v){this.alpha=v;return this;},setDepth(v){this.depth=v;return this;},
        setRotation(v){this.rotation=v;return this;},setFrame(v){this.frame.name=v;return this;},
        setPosition(px,py){this.moved++;this.x=px;this.y=py;return this;},destroy(){this.destroyed++;this.active=false;}};
      if(crop)n.setCrop=function(...a){this.crops.push(a);this.crop=a.length?a:null;return this;};
      nodes.push(n);return n;
    }}};
  const fx=new UserWeaponFx(scene,id),view={depth:12,disposed:false};
  return {scene,fx,nodes,view,step:t=>{time=t;fx.update(t,view);}};
}
const BIRTH=[168,0,88,128];

test('birth crop keeps the leading head and the whole measured white core at the exact physics point',()=>{
  const {fx}=fixture(),v=fx.projectileVisual(120,90,'pink',0),n=v.node,{frameWidth,frameHeight,origin}=RIFLE_COMIC_PROJECTILE;
  assert.deepEqual(n.crops,[BIRTH]);
  const [left,top,width,height]=n.crop;
  assert(left<=173&&left+width===frameWidth&&top===0&&height===frameHeight,'opaque white begins at 173/174 in all four cels');
  assert(left<origin[0]*frameWidth,'the 192,64 core stays inside the revealed head');
  assert.deepEqual({key:n.texture.key,frame:n.frame.name,origin:n.origin,w:n.displayWidth,h:n.displayHeight,x:n.x,y:n.y,offsetX:v.offsetX,offsetY:v.offsetY},
    {key:RIFLE_COMIC_PROJECTILE.key,frame:0,origin:[.75,.5],w:80,h:40,x:120,y:90,offsetX:0,offsetY:0});
  assert.deepEqual(fx.projectiles.map(({spawnX,spawnY,travel})=>({spawnX,spawnY,travel})),[{spawnX:120,spawnY:90,travel:0}]);
});

test('the tail reveals with real node displacement at the 256/80 texel ratio, never with elapsed time',()=>{
  const {fx,step}=fixture(),n=fx.projectileVisual(120,90,'pink',0).node;
  for(const t of [520,700,2000,60000])step(t);
  assert.deepEqual(n.crop,BIRTH,'run time alone reveals nothing');
  n.x=123;n.y=94;step(60010);assert.deepEqual(n.crop,[152,0,104,128]);
  n.x=130;n.y=90;step(60020);assert.deepEqual(n.crop,[136,0,120,128]);
  n.x=172.4;step(60030);assert.deepEqual(n.crop,[1,0,255,128]);
  assert(Math.abs(fx.projectiles[0].travel-52.4)<1e-9);
});

test('all four shot directions crop the same frame-local tail while rotation stays on the real velocity',()=>{
  for(const [vx,vy] of [[1,0],[0,1],[-1,0],[0,-1]]){
    const {fx,step}=fixture(),n=fx.projectileVisual(200,200,'pink',0).node;
    assert.equal(fx.shot({active:true,paintShot:true,x:200,y:200,moveVx:vx*400,moveVy:vy*400,gfx:n},500),true);
    n.x=200+vx*10;n.y=200+vy*10;step(520);
    assert.equal(n.rotation,Math.atan2(vy,vx));
    assert.deepEqual({crop:n.crop,origin:n.origin,w:n.displayWidth,h:n.displayHeight,x:n.x,y:n.y,moved:n.moved},
      {crop:[136,0,120,128],origin:[.75,.5],w:80,h:40,x:200+vx*10,y:200+vy*10,moved:0});
  }
});

test('the reveal is the monotonic maximum displacement, so backtracking never re-hides the tail',()=>{
  const {fx,step}=fixture(),n=fx.projectileVisual(120,90,'pink',0).node;
  n.x=140;step(520);assert.deepEqual(n.crop,[104,0,152,128]);
  n.x=125;step(540);assert.deepEqual(n.crop,[104,0,152,128]);
  n.x=120;step(560);assert.deepEqual(n.crop,[104,0,152,128]);
  n.x=135;n.y=110;step(580);assert.deepEqual(n.crop,[88,0,168,128]);
  assert.equal(fx.projectiles[0].travel,25);
});

test('at 52.5 world pixels the native full tail returns through setCrop() and stays full',()=>{
  const {step,fx}=fixture(),n=fx.projectileVisual(120,90,'pink',0).node;
  n.x=172.5;step(520);assert.deepEqual(n.crops.at(-1),[]);assert.equal(n.crop,null);
  for(const [x,t] of [[400,540],[120,560],[121,580]]){n.x=x;step(t);assert.deepEqual(n.crops.at(-1),[]);}
  assert(n.crops.slice(n.crops.findIndex(a=>a.length===0)).every(a=>a.length===0),'never cropped again after reset');
});

test('the four 40ms cels, key, size, origin and owner coordinates are unchanged while flying',()=>{
  const {fx,step}=fixture(),n=fx.projectileVisual(120,90,'pink',0).node,frames=[],xs=[];
  for(const [i,t] of [500,539,540,579,580,620,659,660,700].entries()){n.x=120+i*7;step(t);frames.push(n.frame.name);xs.push(n.x);}
  assert.deepEqual(frames,[0,0,1,1,2,3,3,0,1]);assert.deepEqual(xs,[0,1,2,3,4,5,6,7,8].map(i=>120+i*7));
  assert.deepEqual({key:n.texture.key,origin:n.origin,w:n.displayWidth,h:n.displayHeight,y:n.y,moved:n.moved,tint:n.tint,alpha:n.alpha,depth:n.depth},
    {key:RIFLE_COMIC_PROJECTILE.key,origin:[.75,.5],w:80,h:40,y:90,moved:0,tint:0xffffff,alpha:.92,depth:6});
});

test('pause, dialog and run-clock jumps never accumulate a reveal',()=>{
  const {scene:s,fx,step}=fixture(),n=fx.projectileVisual(120,90,'pink',0).node;
  n.x=130;step(520);const before=n.crops.length;
  s._battlePaused=true;step(5000);s._battlePaused=false;
  s._publicBattleDialog={};step(9000);s._publicBattleDialog=null;
  assert.equal(n.crops.length,before,'frozen states touch no crop');
  step(9010);step(1e9);assert.deepEqual(n.crop,[136,0,120,128]);
});

test('cleanup only drops references: owner destroy, end, view dispose and FX destroy',()=>{
  const {scene:s,fx,view,step}=fixture();
  const a=fx.projectileVisual(100,100,'pink',0).node,b=fx.projectileVisual(110,100,'pink',0).node;
  a.destroy();a.x=200;b.x=120;step(520);
  assert.deepEqual(a.crops,[BIRTH],'a destroyed node is never cropped again');assert.deepEqual(b.crop,[136,0,120,128]);
  s._battleEnded=true;const count=b.crops.length;b.x=300;step(540);
  assert.equal(fx.projectiles.length,0);assert.equal(b.crops.length,count);assert.equal(b.destroyed,0);assert.equal(b.active,true);
  s._battleEnded=false;const c=fx.projectileVisual(120,100,'pink',0).node;
  fx.update(560,{...view,disposed:true});assert.equal(fx.projectiles.length,0);assert.equal(c.destroyed,0);
  const d=fx.projectileVisual(130,100,'pink',0).node;fx.destroy();d.x=400;fx.update(580,view);
  assert.deepEqual(d.crops,[BIRTH]);assert.equal(d.destroyed,0);
});

test('non-finite node positions keep the last true reveal and never write NaN',()=>{
  const {fx,step}=fixture(),n=fx.projectileVisual(120,90,'pink',0).node;
  n.x=NaN;step(520);n.x=Infinity;n.y=90;step(540);
  assert.deepEqual(n.crop,BIRTH);assert.equal(fx.projectiles[0].travel,0);
  n.x=130;n.y=90;step(560);assert.deepEqual(n.crop,[136,0,120,128]);
  assert(n.crops.every(a=>a.every(Number.isFinite)));
});

test('nodes without setCrop keep the old full visual and cel cycle',()=>{
  const {fx,step}=fixture('sakura',{crop:false}),v=fx.projectileVisual(120,90,'pink',0),n=v.node;
  const frames=[500,540,580,620,660].map((t,i)=>{n.x=120+i*20;step(t);return n.frame.name;});
  assert.deepEqual(frames,[0,1,2,3,0]);assert.equal(fx.projectiles.length,1);
  assert.deepEqual([n.x,n.y,n.moved,v.offsetX,v.offsetY],[200,90,0,0,0]);
});

test('Kai, Enjo and a missing Sakura bank keep exact uncropped native visuals',()=>{
  for(const [id,missing] of [['kai',['user-kai-projectile-20261024']],['enjo',[]],['sakura',[RIFLE_COMIC_PROJECTILE.key]]]){
    const {fx,step,nodes}=fixture(id,{missing}),n=fx.projectileVisual(120,90,'pink',0).node;
    n.x=200;step(520);
    assert.equal(n.texture.key,USER_WEAPON_FX[{kai:'sweep',enjo:'burst',sakura:'spray'}[id]].key,id);
    assert.equal(fx.projectiles.length,0,id);assert(nodes.every(m=>m.crops.length===0),id);
  }
});

test('the authoritative bullet and its body are never mutated by the reveal',()=>{
  const {fx,step}=fixture(),n=fx.projectileVisual(120,90,'pink',0).node;
  const b={active:true,paintShot:true,x:120,y:90,moveVx:0,moveVy:-400,gfx:n,body:{untouched:true}};
  fx.shot(b,500);b.y=80;n.y=80;step(520);
  assert.deepEqual([b.x,b.y,b.moveVx,b.moveVy,b.active,b.paintShot],[120,80,0,-400,true,true]);assert.deepEqual(b.body,{untouched:true});
  assert.deepEqual([n.x,n.y,n.moved],[120,80,0]);assert.deepEqual(n.crop,[136,0,120,128]);
});

test('the 24-reference cap restores evicted visuals without taking their owner or freezing a partial tail',()=>{
  const {fx,nodes,step}=fixture();for(let i=0;i<30;i++)fx.projectileVisual(100+i,100,'pink',0);
  assert.equal(nodes.length,30);assert.equal(fx.projectiles.length,24);
  assert(nodes.every(n=>n.destroyed===0&&n.crops[0].join()===BIRTH.join()));
  assert(nodes.slice(0,6).every(n=>n.crop===null&&n.crops.length===2),'evicted nodes return to the native full frame');
  assert(nodes.slice(6).every(n=>n.crops.length===1));
  for(const n of nodes)n.y=110;step(520);
  assert(nodes.slice(0,6).every(n=>n.crop===null&&n.crops.length===2));assert(nodes.slice(6).every(n=>n.crop.join()==='136,0,120,128'));
});
