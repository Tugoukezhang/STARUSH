import test from 'node:test';
import assert from 'node:assert/strict';
import * as weapon from '../src/systems/UserWeaponFx.mjs';
import {COLOR_HEX} from '../src/utils/config.js';

const {UserWeaponFx,USER_WEAPON_FX,RIFLE_PIGMENT_DEPOSITION:DEPOSITION,preloadUserWeaponFx}=weapon;
const KEY='user-rifle-deposition-20261023',CASTS=['sakura','kai','enjo'];
const SAKURA_ONLY=['user-rifle-muzzle-20261022','user-rifle-projectile-20261021','user-rifle-contact-20261021'];
const GAMEPLAY=()=>{throw new Error('landing FX must not write gameplay');};

function fixture(id,missing=[]){
  let time=500;const nodes=[];
  const scene={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true,heat:3,charge:.4},
    publicPerformerRun:{now:()=>time,onImpact:GAMEPLAY,addCharge:GAMEPLAY},
    paintZone:{applyPaintAt:GAMEPLAY,stampPaint:GAMEPLAY},score:120,heat:7,
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
const MISS={x:150,y:110,color:'blue',radius:108,angle:.3,hit:false};
const CONTACTS=[{x:160,y:100},{x:100,y:140,direct:true},{x:130,y:100}];

test('the neutral deposition bank preloads exactly once for each of the three casts; rifle muzzle/projectile/contact stay Sakura-only',()=>{
  const load=id=>{const calls=[];preloadUserWeaponFx({load:{spritesheet:(...a)=>calls.push(a),image(){}}},id);return calls;};
  for(const id of CASTS){
    const calls=load(id);
    assert.deepEqual(calls.filter(c=>c[0]===KEY),[[KEY,DEPOSITION.path,{frameWidth:256,frameHeight:256}]],id);
    for(const key of SAKURA_ONLY)assert.equal(calls.filter(c=>c[0]===key).length,id==='sakura'?1:0,id+' '+key);
  }
  for(const id of [undefined,'boss','rival'])assert.equal(load(id).filter(c=>c[0]===KEY).length,0,String(id));
});

test('an ordinary flagged miss lands one flat tinted spread for every cast and never an upright burst',()=>{
  for(const id of CASTS)for(const color of ['pink','blue','yellow']){
    const r=run(id,{...MISS,color,deposition:true});
    assert.equal(r.ok,true,id);assert.equal(r.nodes.length,1,id);
    const n=r.nodes[0],size=Math.min(144,108*1.2);
    assert.deepEqual(n,{key:KEY,x:150,y:110,origin:[.5,.5],w:size*4/3,h:size*4/3,tint:COLOR_HEX[color],alpha:.82,rotation:0,depth:.52,frame:0},id);
    assert(!r.nodes.some(n=>n.key===USER_WEAPON_FX.burst.key),id);
    assert.deepEqual(r.rows,['rifle-deposition'],id);assert.deepEqual([r.stats.impacts,r.stats.ground],[0,1],id);
  }
});

test('the authored direction bank follows the real landing angle for all casts',()=>{
  for(const id of CASTS)for(const [angle,bank] of [[0,0],[Math.PI/2,2],[Math.PI,4],[-Math.PI/4,7]])
    assert.equal(run(id,{...MISS,angle,deposition:true}).nodes[0].frame,bank*6,id+' '+angle);
});

test('accepted hits keep the role contact on at most two real contact points and add one ground spread at the landing',()=>{
  for(const id of CASTS){
    const args={...MISS,hit:true,radial:true,contacts:CONTACTS};
    const flagged=run(id,{...args,deposition:true}),plain=run(id,args);
    const ground=flagged.nodes.filter(n=>n.key===KEY),sparks=flagged.nodes.filter(n=>n.key!==KEY);
    assert.equal(ground.length,1,id);assert.deepEqual([ground[0].x,ground[0].y,ground[0].depth,ground[0].rotation],[150,110,.52,0],id);
    assert.deepEqual(sparks,plain.nodes,id+' role contact identity and placement are unchanged');
    assert.deepEqual(sparks.map(n=>[n.x,n.y]),[[100,140],[160,100]],id);
    assert(sparks.every(n=>n.depth>9),id);
    assert.deepEqual([flagged.stats.impacts,flagged.stats.ground],[2,0],id+' no fake miss count');
    const empty=run(id,{...MISS,hit:true,deposition:true,contacts:[]});
    assert.deepEqual(empty.nodes.map(n=>n.key),[KEY],id+' no ghost contact without an accepted contact');
    assert.deepEqual([empty.stats.impacts,empty.stats.ground],[0,0],id);
  }
});

test('skill release and release contacts never receive the shared landing',()=>{
  for(const id of CASTS){
    const {fx,nodes}=fixture(id);
    assert.equal(fx.release({x:150,y:100,radius:60,start:500,color:'blue',angle:0,contacts:[{x:160,y:100}]}),true,id);
    assert(!nodes.some(n=>n.texture.key===KEY),id);assert(!fx.rows.some(r=>r.artKind==='rifle-deposition'),id);
    assert(!run(id,{...MISS,hit:true,releaseContact:true,deposition:true,contacts:[{x:160,y:100}]}).nodes.some(n=>n.key===KEY),id);
    const push=fixture(id);const base={x:150,y:110,size:100,color:'blue',artKind:'rifle-deposition',tint:COLOR_HEX.blue};
    assert.equal(push.fx.push('deposition',{...base,ground:true,release:true}),false,id);
    assert.equal(push.fx.push('deposition',{...base,ground:false}),false,id);
    assert.equal(push.fx.push('burst',{...base,ground:true}),false,id);
    assert.equal(push.fx.push('deposition',{...base,ground:true}),true,id);
  }
  for(const id of ['boss',undefined])assert.equal(fixture(id).fx.push('deposition',{x:150,y:110,size:100,artKind:'rifle-deposition',ground:true}),false,String(id));
});

test('protected or shield-like contacts (hit=false, deposition=false) keep the exact old path',()=>{
  for(const id of CASTS){
    const r=run(id,{...MISS});
    assert(!r.nodes.some(n=>n.key===KEY),id);assert.deepEqual(r.nodes.map(n=>n.key),[USER_WEAPON_FX.burst.key],id);
    assert.deepEqual(r,run(id,{...MISS},[KEY]),id);
    const hit=run(id,{...MISS,hit:true,contacts:CONTACTS});
    assert(!hit.nodes.some(n=>n.key===KEY),id);assert.deepEqual(hit,run(id,{...MISS,hit:true,contacts:CONTACTS},[KEY]),id);
    for(const deposition of ['true',1,{}])assert.deepEqual(run(id,{...MISS,deposition}),r,id+' only literal true opts in');
  }
});

test('illegal colour or non-finite landing input keeps the old path for all casts',()=>{
  for(const id of CASTS)for(const bad of [{color:'rainbow'},{color:undefined},{radius:0},{radius:-5},{radius:NaN},{radius:Infinity},{x:NaN},{y:Infinity},{angle:NaN}]){
    const r=run(id,{...MISS,...bad,deposition:true});
    assert(!r.nodes.some(n=>n.key===KEY),id+JSON.stringify(bad));assert.deepEqual(r,run(id,{...MISS,...bad}),id+JSON.stringify(bad));
  }
});

test('missing deposition texture falls back to the exact old path for all casts',()=>{
  for(const id of CASTS)for(const args of [MISS,{...MISS,hit:true,contacts:CONTACTS},{...MISS,hit:true,contacts:[]}]){
    const gone=run(id,{...args,deposition:true},[KEY]);
    assert.deepEqual(gone,run(id,args,[KEY]),id);assert(!gone.nodes.some(n=>n.key===KEY),id);
  }
  for(const id of CASTS)assert.deepEqual(run(id,{...MISS,deposition:true},[KEY]).nodes.map(n=>n.key),[USER_WEAPON_FX.burst.key],id);
});

test('sourceRadius and cover clamps hold for Kai and Enjo landings',()=>{
  for(const id of ['kai','enjo']){
    for(const radius of [6,20,40,108,400]){
      const n=run(id,{...MISS,radius,deposition:true}).nodes.find(n=>n.key===KEY);
      if(n)assert(n.w*DEPOSITION.extent<=radius+1e-9,id+radius);
    }
    const f=fixture(id);f.scene.oldStreet.clearLine=(c,p)=>Math.hypot(p.x-c.x,p.y-c.y)<=32;
    f.fx.impact({...MISS,deposition:true});assert.equal(f.nodes[0].texture.key,KEY);assert(f.nodes[0].displayWidth*DEPOSITION.extent<=32+1e-9,id);
    const blocked=fixture(id);blocked.scene.oldStreet.clearLine=()=>false;
    assert.equal(blocked.fx.impact({...MISS,deposition:true}),false,id);assert.equal(blocked.nodes.length,0,id);
  }
});

test('pause, dialog, battle end, player death and disposal reject landings for every cast',()=>{
  for(const id of CASTS)for(const [name,mutate] of [['paused',s=>s._battlePaused=true],['dialog',s=>s._publicBattleDialog={}],
    ['ended',s=>s._battleEnded=true],['dead',s=>s.player.hp=0],['inactive',s=>s.player.active=false],['presentation',s=>s._userCastPresentation=false]]){
    const f=fixture(id);mutate(f.scene);
    assert.equal(f.fx.impact({...MISS,deposition:true}),false,id+' '+name);assert.equal(f.nodes.length,0,id+' '+name);
  }
  for(const id of CASTS){const f=fixture(id);f.fx.destroy();assert.equal(f.fx.impact({...MISS,deposition:true}),false,id);assert.equal(f.nodes.length,0,id);}
});

test('Kai and Enjo landings use the private pausable 300ms clock, 24-row budget and cleanup',()=>{
  for(const id of ['kai','enjo']){
    const {scene:s,fx,nodes,setTime,view}=fixture(id);
    fx.impact({...MISS,angle:Math.PI/2,deposition:true});const n=nodes[0];
    const frames=[];for(const t of [0,25,67,145,202,253]){setTime(500+t);fx.update(500+t,view);frames.push(n.frame.name);}
    assert.deepEqual(frames,[12,13,14,15,16,17],id);
    s._battlePaused=true;setTime(5000);fx.update(5000,view);assert.equal(n.frame.name,17,id);assert.equal(n.destroyed,0,id);s._battlePaused=false;
    setTime(800);fx.update(800,view);assert.equal(n.destroyed,1,id);assert.equal(fx.rows.length,0,id);
    for(let i=0;i<30;i++)fx.impact({...MISS,x:100+i,deposition:true});
    assert.equal(fx.rows.length,24,id);assert.equal(nodes.filter(n=>n.active).length,24,id);
    s.player.hp=0;fx.update(810,view);assert.equal(fx.rows.length,0,id);assert(nodes.every(n=>n.destroyed===1),id);
  }
});

test('landings write no gameplay state: hp, heat, charge, score and paint owners are untouched',()=>{
  for(const id of CASTS){
    const f=fixture(id);const s=f.scene,before=JSON.stringify({player:s.player,score:s.score,heat:s.heat});
    f.fx.impact({...MISS,deposition:true});f.fx.impact({...MISS,hit:true,deposition:true,contacts:CONTACTS});
    f.setTime(600);f.fx.update(600,f.view);f.fx.clear();
    assert.equal(JSON.stringify({player:s.player,score:s.score,heat:s.heat}),before,id);
  }
});
