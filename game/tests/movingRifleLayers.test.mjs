import test from 'node:test';
import assert from 'node:assert/strict';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';
import {getUserCastArt} from '../src/utils/userCast.mjs';
import * as data from '../src/utils/userCastMotionData.mjs';

const {RIFLE_SHOOT_ART,RIFLE_WALK_ART}=data,L=data.RIFLE_MOVE_SHOOT_LAYERS,SHOOT=RIFLE_SHOOT_ART.key,WALK=RIFLE_WALK_ART.key;
// Measured alpha>0 on the public shoot/walk sheets (right/bottom exclusive), split at native y265.
const UPPER=[[107,122,304,265],[98,122,300,265],[101,123,306,265],[107,122,304,265]];
const LOWER=[[118,265,257,307],[122,265,264,307],[126,265,265,307],[125,265,260,307]];
// Shot offsets inside each 270ms rifle cel window: release, kick, half recovery, ready.
const OFFSET=[10,90,190,250];
const FIELDS=['x','y','originX','originY','displayWidth','displayHeight','flipX','angle','alpha','tint','depth'];

function fixture(id='sakura',{missing=[],crop=true}={}){
  let time=0;const nodes=[];
  const node=(x=0,y=0,key='',frame=0)=>{
    const n={x,y,createdKey:key,alpha:1,angle:0,visible:true,tint:0xffffff,depth:0,frame:{name:frame},texture:{key},destroyed:0,
      setPosition(x,y){this.x=x;this.y=y;return this;},setOrigin(x,y=x){this.originX=x;this.originY=y;return this;},
      setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},setDepth(v){this.depth=v;return this;},
      setFlipX(v){this.flipX=v;return this;},setAngle(v){this.angle=v;return this;},setAlpha(v){this.alpha=v;return this;},
      setTint(v){this.tint=v;return this;},setVisible(v){this.visible=v;return this;},
      setTexture(key,frame=0){this.texture={key};this.frame={name:frame};return this;},
      getBounds(){const x=this.x-this.originX*this.displayWidth,y=this.y-this.originY*this.displayHeight;return {x,y,right:x+this.displayWidth,bottom:y+this.displayHeight};},
      destroy(){this.destroyed++;}};
    // Records the facing and frame the crop UVs were built against, as Phaser's Frame.setCropUVs does.
    if(crop)n.setCrop=function(...c){this.crop=c.length?c:null;this.cropFlip=this.flipX;this.cropFrame=this.frame.name;return this;};
    nodes.push(n);return n;};
  const scene={player:{x:500,y:1000,hp:5,active:true},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},game:{loop:{frame:0}},
    publicPerformerRun:{actions:0,now:()=>time},oldStreet:{clearLine:()=>true},textures:{exists:k=>!missing.includes(k)},add:{ellipse:node,image:node}};
  const view=new UserCastPresentation(scene,id);view.update(0,false);
  const step=(dx,ms=16,frozen=false)=>{scene.player.x+=dx;time+=ms;view.update(time,frozen);return view;};
  return {scene,view,nodes,step,shoot:sign=>view.beginShot(time,sign,0,400),uppers:()=>nodes.filter(n=>n.createdKey===SHOOT)};
}
// Walk the lower to cel w (22.5px each), then fire and sample upper cel s while still moving.
function pose(s,w,sign,options){
  const f=fixture('sakura',options);
  for(let d=w*22.5+3;d>0;d-=20)f.step(sign*Math.min(20,d));
  f.shoot(sign);f.step(sign*.2,OFFSET[s]);return f;
}
const snap=n=>Object.fromEntries(['createdKey',...FIELDS].map(k=>[k,n[k]]).concat([['key',n.texture.key],['frame',n.frame.name]]));

test('move-shoot layer metadata is deep-frozen at native y265 and covers every alpha>0 pixel',()=>{
  assert.ok(L,'RIFLE_MOVE_SHOOT_LAYERS must exist');
  assert(Object.isFrozen(L)&&Object.isFrozen(L.upperCrop)&&Object.isFrozen(L.lowerCrop)&&Object.isFrozen(L.upperBounds)&&Object.isFrozen(L.lowerBounds));
  for(const row of [...L.upperBounds,...L.lowerBounds])assert(Object.isFrozen(row));
  assert.deepEqual(JSON.parse(JSON.stringify(L)),{split:265,upperCrop:[0,0,384,265],lowerCrop:[0,265,384,55],upperBounds:UPPER,lowerBounds:LOWER});
  assert.deepEqual(RIFLE_SHOOT_ART.bounds[0],[109,125,301,305]);assert.deepEqual(RIFLE_WALK_ART.bounds[0],[95,124,304,305]);
});

test('all 16 shoot/walk pairs draw the original shoot upper over the walk lower on both facings',()=>{
  const m=getUserCastArt('sakura').motion;
  for(const sign of [1,-1])for(let s=0;s<4;s++)for(let w=0;w<4;w++){
    const f=pose(s,w,sign),base=f.view.image,ups=f.uppers(),up=ups[0],flip=sign<0,label=`s${s} w${w} ${flip?'left':'right'}`;
    assert.equal(f.view.state,'move-attack',label);assert.equal(ups.length,1,label);
    assert.deepEqual([base.texture.key,base.frame.name,base.crop,base.cropFlip,base.cropFrame],[WALK,w,[0,265,384,55],flip,w],label);
    assert.deepEqual([up.texture.key,up.frame.name,up.crop,up.cropFlip,up.cropFrame,up.visible],[SHOOT,s,[0,0,384,265],flip,s,true],label);
    for(const k of FIELDS.slice(0,-1))assert.equal(up[k],base[k],label+' '+k);
    assert.deepEqual([base.x,base.y,base.displayWidth,base.displayHeight,base.flipX,base.angle,base.originX,base.originY],
      [f.scene.player.x,1026,192,160,flip,0,flip?1-m.originX:m.originX,m.originY],label);
  }
});

test('upper follows shot time only and lower follows travelled distance only',()=>{
  const a=fixture(),b=fixture();a.shoot(1);b.shoot(1);
  for(let i=0;i<6;i++){a.step(2,20);b.step(7,20);}
  assert.deepEqual([a.uppers()[0]?.frame.name,b.uppers()[0]?.frame.name],[1,1]);
  assert.deepEqual([a.view.image.frame.name,b.view.image.frame.name],[0,1]);
  const c=fixture(),d=fixture();c.shoot(1);d.shoot(1);
  for(let i=0;i<2;i++){c.step(15,10);d.step(15,100);}
  assert.deepEqual([c.uppers()[0]?.frame.name,d.uppers()[0]?.frame.name],[0,2]);
  assert.deepEqual([c.view.image.frame.name,d.view.image.frame.name],[1,1]);
});

test('moving upper keeps the 270ms rifle cel timing; standing shot stays the uncropped whole-body bank',()=>{
  const f=fixture();f.shoot(1);assert.equal(f.view.shotDuration,270);
  const seen=[];for(const ms of [20,10,100,30,60,25,20]){f.step(1,ms);seen.push(f.uppers()[0]?.frame.name);}
  assert.deepEqual(seen,[0,1,1,2,2,3,3]);
  f.step(1,10);assert.equal(f.view.state,'move');assert.equal(f.uppers()[0]?.visible,false);assert.equal(f.view.image.crop,null);
  assert.deepEqual([f.view.image.texture.key,f.view.image.frame.name],[WALK,Math.floor(f.view.walkDistance/22.5)%4]);
  const g=fixture();g.shoot(1);g.step(0,60);
  assert.deepEqual([g.view.state,g.view.image.texture.key,g.view.image.frame.name,g.view.image.crop,g.uppers().length],['attack',SHOOT,1,undefined,0]);
});

test('stop, hurt, action, idle and missing banks reset the lower crop and hide the single upper',()=>{
  const m=getUserCastArt('sakura').motion;
  const exits={
    stop:f=>{f.step(0);return [SHOOT,1];},
    hurt:f=>{f.scene.battleRecord.playerHitCount=1;f.step(1);return [m.key,18];},
    action:f=>{f.scene.publicPerformerRun.actions=1;f.step(1);return [m.key,14];},
    idle:f=>{f.step(0,400);return [m.key,12];},
    missingShoot:f=>{f.scene.textures.exists=k=>k!==SHOOT;f.step(1);return [WALK,1];},
    missingWalk:f=>{f.scene.textures.exists=k=>k!==WALK;f.step(1);return [m.key,6+Math.floor(f.view.walkDistance/15)%6];},
  };
  for(const [name,exit] of Object.entries(exits)){
    const f=pose(1,1,1),expected=exit(f),base=f.view.image,ups=f.uppers();
    assert.deepEqual([base.texture.key,base.frame.name],expected,name);
    assert.equal(base.crop,null,name);assert.equal(ups.length,1,name);assert.equal(ups[0].visible,false,name);
    if(name==='hurt'||name==='action')assert.equal(f.view.muzzleWorld(),null,name);
    if(name==='hurt')assert.equal(base.tint,0xffb7bf);
  }
  const f=pose(1,1,1);f.step(0,400);f.shoot(1);f.step(2,30);
  assert.equal(f.uppers().length,1,'re-entering move-attack reuses the one upper');assert.equal(f.uppers()[0].visible,true);
});

test('freeze holds both layer poses while positions follow the player; resume skips nothing',()=>{
  const f=pose(2,1,-1),base=f.view.image,up=f.uppers()[0],distance=f.view.walkDistance;
  assert.ok(up,'layered upper exists');
  f.scene._battlePaused=true;f.step(-30,500,true);
  assert.deepEqual([f.view.state,base.texture.key,base.frame.name,base.crop,up.frame.name,up.crop,up.visible],['move-attack',WALK,1,[0,265,384,55],2,[0,0,384,265],true]);
  assert.deepEqual([base.x,up.x,base.y,up.y],[f.scene.player.x,f.scene.player.x,1026,1026]);
  f.scene._battlePaused=false;f.step(-.2,16);f.step(-.2,16);
  assert.deepEqual([base.frame.name,up.frame.name,up.visible,base.flipX,up.flipX],[1,2,true,true,true]);
  assert(f.view.walkDistance<distance+1,'hidden displacement cannot advance the lower');
});

test('missing either bank or no crop API falls back to the exact old whole-body walk without an extra node',()=>{
  const m=getUserCastArt('sakura').motion,old=pose(2,3,1,{missing:[SHOOT]});
  for(const options of [{crop:false},{missing:[SHOOT]},{missing:[SHOOT],crop:false}]){
    const f=pose(2,3,1,options);
    assert.deepEqual(snap(f.view.image),snap(old.view.image),JSON.stringify(options));
    assert.deepEqual([f.view.image.texture.key,f.view.image.frame.name,f.view.image.crop,f.uppers().length],[WALK,3,undefined,0]);
  }
  const atlas=pose(2,3,1,{missing:[WALK]});
  assert.deepEqual([atlas.view.image.texture.key,atlas.view.image.frame.name,atlas.view.image.crop,atlas.uppers().length],[m.key,6+Math.floor(atlas.view.walkDistance/15)%6,undefined,0]);
});

test('muzzle uses the upper shoot marker while layered; physical hand keeps its facing contract',()=>{
  for(const sign of [1,-1])for(let s=0;s<4;s++){
    const f=pose(s,2,sign),p=f.scene.player,[x,y]=RIFLE_SHOOT_ART.muzzles[s];
    assert.deepEqual(f.view.muzzleWorld(),{x:p.x+sign*(x-192)*.5,y:p.y+26+(y-304)*.5},`s${s} ${sign}`);
    assert.deepEqual(f.view.handWorld(),{x:p.x+sign*16,y:p.y-12});
  }
});

test('cue exclusion is the clipped upper/lower union on both facings, not the whole walk cel',()=>{
  for(const sign of [1,-1])for(let s=0;s<4;s++)for(let w=0;w<4;w++){
    const f=pose(s,w,sign),b=f.view.image.getBounds(),u=UPPER[s],l=LOWER[w];
    const r=[Math.min(u[0],l[0]),Math.min(u[1],l[1]),Math.max(u[2],l[2]),Math.max(u[3],l[3])],flip=sign<0;
    assert.deepEqual(f.view.cueExclusionBounds(),{x:b.x+(flip?384-r[2]:r[0])*.5,y:b.y+r[1]*.5,right:b.x+(flip?384-r[0]:r[2])*.5,bottom:b.y+r[3]*.5},`s${s} w${w} ${sign}`);
  }
});

test('upper sits just above the lower body and below weapon FX, matching alpha and tint',()=>{
  const f=fixture();f.view.setWorldDepth(12);f.shoot(1);f.step(3,40);
  const base=f.view.image,up=f.uppers()[0];assert.ok(up,'layered upper exists');
  assert.equal(base.depth,12);assert(up.depth>12&&up.depth<12.00002&&Math.abs(up.depth-12.000001)<1e-9,String(up.depth));
  f.scene.playerGfx.alpha=.35;f.step(1);assert.equal(up.alpha,.35);assert.equal(up.tint,base.tint);
  f.view.setWorldDepth(14);assert.equal(base.depth,14);assert(Math.abs(up.depth-14.000001)<1e-9);
});

test('destroy releases the upper exactly once and later updates create nothing',()=>{
  const f=pose(0,0,1),count=f.nodes.length;assert.equal(f.uppers().length,1);
  f.view.destroy();f.view.destroy();assert(f.nodes.every(n=>n.destroyed===1));
  f.step(5);f.view.setWorldDepth(3);assert.equal(f.nodes.length,count);
});

test('Kai and Enjo never crop or allocate an extra body node',()=>{
  for(const id of ['kai','enjo']){
    const f=fixture(id),count=f.nodes.length;f.shoot(1);
    for(let i=0;i<8;i++)f.step(6,30);
    assert.equal(f.nodes.length,count,id);assert(f.nodes.every(n=>n.crop===undefined),id);assert.equal(f.uppers().length,0,id);
  }
});
