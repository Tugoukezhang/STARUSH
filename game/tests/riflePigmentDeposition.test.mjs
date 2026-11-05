import test from 'node:test';
import assert from 'node:assert/strict';
import * as weapon from '../src/systems/UserWeaponFx.mjs';
import {COLOR_HEX} from '../src/utils/config.js';

const {UserWeaponFx,USER_WEAPON_FX,preloadUserWeaponFx}=weapon;
const DEPOSITION=weapon.RIFLE_PIGMENT_DEPOSITION??{};
const KEY='user-rifle-deposition-20261023',CONTACT='user-rifle-contact-20261021';

function fixture(id='sakura',missing=[]){
  let time=500;const nodes=[];
  const scene={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},publicPerformerRun:{now:()=>time},
    oldStreet:{clearLine:()=>true},textures:{exists:key=>!missing.includes(key)},
    time:{delayedCall(){throw new Error('FX must not own timers');}},tweens:{add(){throw new Error('FX must not own tweens');}},
    add:{image(x,y,key,frame){
      const n={x,y,texture:{key},frame:{name:frame??0},active:true,destroyed:0,
        setOrigin(ox,oy=ox){this.origin=[ox,oy];return this;},setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},
        setTint(v){this.tint=v;return this;},setAlpha(v){this.alpha=v;return this;},setDepth(v){this.depth=v;return this;},
        setRotation(v){this.rotation=v;return this;},setFrame(v){this.frame.name=v;return this;},
        setPosition(px,py){this.x=px;this.y=py;return this;},destroy(){this.destroyed++;this.active=false;}};
      nodes.push(n);return n;
    }}};
  return {scene,fx:new UserWeaponFx(scene,id),nodes,setTime:v=>time=v,view:{depth:12,disposed:false}};
}
const snap=n=>({key:n.texture.key,x:n.x,y:n.y,origin:n.origin,w:n.displayWidth,h:n.displayHeight,tint:n.tint,alpha:n.alpha,rotation:n.rotation,depth:n.depth,frame:n.frame.name});
const run=(id,args,missing=[])=>{const f=fixture(id,missing);const ok=f.fx.impact(args);return {ok,nodes:f.nodes.map(snap),stats:{...f.fx.stats},rows:f.fx.rows.map(r=>r.artKind)};};
const MISS={x:150,y:110,color:'pink',radius:108,angle:.3,hit:false};

test('deposition descriptor is the exact frozen B75 contract',()=>{
  assert(Object.isFrozen(DEPOSITION)&&Object.isFrozen(DEPOSITION.origin)&&Object.isFrozen(DEPOSITION.ends));
  assert.deepEqual({...DEPOSITION,origin:[...DEPOSITION.origin],ends:[...DEPOSITION.ends]},
    {key:KEY,path:'art/rifle-pigment-deposition-20261023/deposition.png',frames:48,directions:8,phases:6,frameWidth:256,frameHeight:256,
      origin:[.5,.5],extent:.43,duration:300,ends:[.08,.22,.48,.67,.84,1]});
});

test('the three casts preload the shared deposition strip once; Sakura keeps it appended after the contact bank',()=>{
  const load=id=>{const calls=[];preloadUserWeaponFx({load:{spritesheet:(...a)=>calls.push(a),image(){}}},id);return calls;};
  const sakura=load('sakura');
  assert.deepEqual(sakura.slice(-2),[[CONTACT,'art/rifle-ink-chain-20261022/contact.png',{frameWidth:256,frameHeight:256}],
    [KEY,'art/rifle-pigment-deposition-20261023/deposition.png',{frameWidth:256,frameHeight:256}]]);
  for(const id of ['kai','enjo'])assert.deepEqual(load(id).filter(c=>c[0]===KEY),[[KEY,'art/rifle-pigment-deposition-20261023/deposition.png',{frameWidth:256,frameHeight:256}]],id);
  assert.equal(load(undefined).filter(c=>c[0]===KEY).length,0);
});

test('without the explicit landing flag every impact keeps the exact original path',()=>{
  for(const args of [MISS,{...MISS,hit:true},{...MISS,hit:true,contacts:[{x:160,y:100}]},{...MISS,hit:true,contacts:[]}]){
    const plain=run('sakura',args),gone=run('sakura',args,[KEY]);
    assert.deepEqual(plain,gone);assert(!plain.nodes.some(n=>n.key===KEY));
  }
  const miss=run('sakura',MISS);assert.equal(miss.nodes.length,1);assert.equal(miss.nodes[0].key,USER_WEAPON_FX.burst.key);
});

test('skill release never lands a deposition, even though it calls impact with hit=true',()=>{
  const {fx,nodes}=fixture();
  assert.equal(fx.release({x:150,y:100,radius:60,start:500,color:'blue',angle:0,contacts:[]}),true);
  assert(!nodes.some(n=>n.texture.key===KEY));assert(!fx.rows.some(r=>r.artKind==='rifle-deposition'));
});

test('flagged Kai and Enjo landings add only the shared ground spread; their own contacts stay identical',()=>{
  for(const id of ['kai','enjo'])for(const args of [{...MISS,hit:true},{...MISS,hit:true,contacts:[]},{...MISS,hit:true,contacts:[{x:160,y:100}]}]){
    const flagged=run(id,{...args,deposition:true}),plain=run(id,args);
    assert.equal(flagged.nodes.filter(n=>n.key===KEY).length,1,id);
    assert.deepEqual(flagged.nodes.filter(n=>n.key!==KEY),plain.nodes,id);
  }
  for(const id of ['kai','enjo'])assert.deepEqual(run(id,{...MISS,deposition:true}).nodes.map(n=>n.key),[KEY],id);
});

test('a flagged Sakura miss draws one flat tinted deposition at the real landing and no upright burst',()=>{
  const r=run('sakura',{...MISS,deposition:true});
  assert.equal(r.ok,true);assert.equal(r.nodes.length,1);
  const n=r.nodes[0],size=Math.min(144,108*1.2);
  assert.deepEqual(n,{key:KEY,x:150,y:110,origin:[.5,.5],w:size*4/3,h:size*4/3,tint:COLOR_HEX.pink,alpha:n.alpha,rotation:0,depth:.52,frame:0});
  assert(n.alpha>0&&n.alpha<=1);assert.deepEqual(r.rows,['rifle-deposition']);
  assert.deepEqual([r.stats.impacts,r.stats.ground],[0,1],'a miss still counts as ground only');
});

test('flagged hits keep accepted contact sparks and add one ground spread; empty contacts draw no spark',()=>{
  const r=run('sakura',{...MISS,hit:true,deposition:true,radial:true,contacts:[{x:160,y:100},{x:100,y:140,direct:true},{x:130,y:100}]});
  assert.equal(r.ok,true);
  const sparks=r.nodes.filter(n=>n.key===CONTACT),ground=r.nodes.filter(n=>n.key===KEY);
  assert.deepEqual(sparks.map(n=>[n.x,n.y]),[[100,140],[160,100]],'direct first, then nearest to the real landing');assert(sparks.every(n=>n.depth>9));
  assert.equal(ground.length,1);assert.deepEqual([ground[0].x,ground[0].y,ground[0].depth],[150,110,.52]);
  assert.equal(r.nodes.length,3);assert.deepEqual([r.stats.impacts,r.stats.ground],[2,0]);
  const empty=run('sakura',{...MISS,hit:true,deposition:true,contacts:[]});
  assert.equal(empty.ok,true);assert.deepEqual(empty.nodes.map(n=>n.key),[KEY]);
  assert.deepEqual([empty.stats.impacts,empty.stats.ground],[0,0],'no fake hit and no fake miss');
});

test('tint is the official COLOR_HEX pigment; unknown colours keep the original path',()=>{
  for(const color of ['pink','blue','yellow'])assert.equal(run('sakura',{...MISS,color,deposition:true}).nodes[0].tint,COLOR_HEX[color],color);
  assert.deepEqual(run('sakura',{...MISS,color:'rainbow',deposition:true}),run('sakura',{...MISS,color:'rainbow'}));
});

test('missing art or invalid landing input falls back to the original path',()=>{
  for(const args of [MISS,{...MISS,hit:true,contacts:[{x:160,y:100}]},{...MISS,hit:true,contacts:[]}])
    assert.deepEqual(run('sakura',{...args,deposition:true},[KEY]),run('sakura',args,[KEY]));
  for(const bad of [{radius:0},{radius:-5},{radius:NaN},{radius:Infinity},{x:NaN},{y:Infinity},{angle:NaN}]){
    const r=run('sakura',{...MISS,...bad,deposition:true});
    assert(!r.nodes.some(n=>n.key===KEY),JSON.stringify(bad));
    assert.deepEqual(r,run('sakura',{...MISS,...bad}),JSON.stringify(bad));
  }
});

test('footprint stays inside the real source radius and existing cover probes',()=>{
  for(const radius of [6,20,40,108,400]){
    const n=run('sakura',{...MISS,radius,deposition:true}).nodes.find(n=>n.key===KEY);
    if(n)assert(n.w*DEPOSITION.extent<=radius+1e-9,String(radius));
  }
  const f=fixture();f.scene.oldStreet.clearLine=(c,p)=>Math.hypot(p.x-c.x,p.y-c.y)<=32;
  f.fx.impact({...MISS,deposition:true});const n=f.nodes[0];
  assert.equal(n.texture.key,KEY);assert(n.displayWidth*DEPOSITION.extent<=32+1e-9);
  const blocked=fixture();blocked.scene.oldStreet.clearLine=()=>false;
  assert.equal(blocked.fx.impact({...MISS,deposition:true}),false);assert.equal(blocked.nodes.length,0);
});

test('deposition uses its private 300ms timeline; alpha never grows after the settled footprint; burst timeline is unchanged',()=>{
  const {fx,nodes,setTime,view}=fixture();
  fx.impact({...MISS,deposition:true});fx.impact({x:300,y:110,color:'pink',radius:108,hit:false});
  const [dep,burst]=nodes;assert.equal(dep.texture.key,KEY);assert.equal(burst.texture.key,USER_WEAPON_FX.burst.key);
  const samples=[0,23,25,65,67,143,145,200,202,251,253,299],frames=[],alphas=[];
  for(const t of samples){setTime(500+t);fx.update(500+t,view);frames.push(dep.frame.name);alphas.push(dep.alpha);}
  assert.deepEqual(frames,[0,0,1,1,2,2,3,3,4,4,5,5]);
  for(let i=1;i<alphas.length;i++)assert(alphas[i]<=alphas[i-1]+1e-12,String(samples[i]));
  assert.equal(alphas[0],alphas[5],'held while the footprint settles');assert(alphas.at(-1)<alphas[0]);
  assert.equal(dep.depth,.52);
  setTime(800);fx.update(800,view);assert.equal(dep.destroyed,1);assert.equal(burst.destroyed,0,'burst keeps its 360ms clock');
  assert.equal(burst.frame.name,5,'300 of 360ms is the sixth shared burst cel (.833 past the .83 end)');
  setTime(860);fx.update(860,view);assert.equal(burst.destroyed,1);assert.equal(fx.rows.length,0);
});

test('pause freezes, battle end clears, the 24-row budget holds and destroy is idempotent without timers',()=>{
  const {scene:s,fx,nodes,setTime,view}=fixture();
  fx.impact({...MISS,deposition:true});const n=nodes[0];
  setTime(560);fx.update(560,view);const frame=n.frame.name;
  s._battlePaused=true;setTime(5000);fx.update(5000,view);assert.equal(n.frame.name,frame);assert.equal(n.destroyed,0);
  assert.equal(fx.impact({...MISS,deposition:true}),false,'no landing while paused');s._battlePaused=false;
  setTime(560);
  for(let i=0;i<30;i++)fx.impact({...MISS,x:100+i,deposition:true});
  assert.equal(fx.rows.length,24);assert.equal(nodes.filter(n=>n.active).length,24);
  s._battleEnded=true;fx.update(570,view);assert.equal(fx.rows.length,0);assert(nodes.every(n=>n.destroyed===1));
  s._battleEnded=false;fx.impact({...MISS,deposition:true});fx.destroy();fx.destroy();
  assert(nodes.every(n=>n.destroyed===1));assert.equal(fx.impact({...MISS,deposition:true}),false);
});
