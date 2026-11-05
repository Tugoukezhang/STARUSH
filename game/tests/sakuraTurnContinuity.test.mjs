import assert from 'node:assert/strict';
import test from 'node:test';
import {SakuraLayeredPresentation} from '../src/systems/SakuraLayeredPresentation.mjs';
import {advanceSakuraTurn} from '../src/systems/SakuraTurnMotion.mjs';

function image(x,y,key,frame){
 const n={x,y,frame,texture:{key},active:true,alpha:1};
 for(const [m,keys] of Object.entries({setDisplaySize:['displayWidth','displayHeight'],setPosition:['x','y'],setOrigin:['originX','originY'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint'],setRotation:['rotation'],setScale:['scaleX','scaleY'],setFrame:['frame']}))n[m]=function(...v){keys.forEach((k,i)=>this[k]=v[i]??v[0]);return this;};
 n.setTexture=function(k,f){this.texture.key=k;this.frame=f;return this;};n.destroy=function(){this.active=false;};return n;
}
function fixture(available=true){
 const player={x:100,y:200,body:{halfWidth:4,velocity:{x:0,y:0}}};
 const scene={player,playerGfx:{alpha:1},textures:{exists:()=>available},add:{image}};
 const view=new SakuraLayeredPresentation(scene);view.update(0,0,0,null,false);
 return {view,scene,move(t,dx,dy,attack=null,frozen=false,hurt=false,id=0){player.x+=dx;player.y+=dy;view.update(t,dx,dy,attack,frozen,hurt,id);}};
}
test('a locomotion quarter-turn displays a registered diagonal instead of snapping 90 degrees',()=>{
 const f=fixture();f.move(16,-1,0);f.move(32,-1,0);
 assert.match(f.view.upper.texture.key,/turn-upper/,'missing intermediate upper-body drawing');
 assert.equal(f.view.upper.frame,0);assert.equal(f.view.upper.alpha,1);assert.equal(f.view.upperBlend.alpha,0);
 for(let t=48;t<=128;t+=16)f.move(t,-1,0);
 assert.match(f.view.upper.texture.key,/idle/);assert.equal(Math.floor(f.view.upper.frame/4),1);
});
test('half-turn takes a visible side view and both diagonals; it never queues old directions',()=>{
 const f=fixture(),frames=[];for(let t=16;t<=192;t+=16){f.move(t,0,-1);frames.push([f.view.upper.texture.key,f.view.upper.frame]);}
 assert.ok(frames.some(([k,n])=>/turn-upper/.test(k)&&n===0));
 assert.ok(frames.some(([k,n])=>/idle/.test(k)&&Math.floor(n/4)===1));
 assert.ok(frames.some(([k,n])=>/turn-upper/.test(k)&&n===2));
 assert.equal(Math.floor(f.view.upper.frame/4),3);
 f.move(208,1,0);f.move(224,0,-1);for(let t=240;t<=400;t+=16)f.move(t,0,-1);
 assert.equal(Math.floor(f.view.upper.frame/4),3);assert.match(f.view.upper.texture.key,/idle/);
});
test('attack and damage preempt a pending turn; attack hand and frame respond immediately',()=>{
 const f=fixture();f.move(16,-1,0);f.move(32,-1,0);
 const attack={direction:'right',phase:'release',progress:.4};f.move(48,0,0,attack);
 assert.match(f.view.upper.texture.key,/attack/);assert.equal(f.view.upper.frame,20);
 const hand=f.view.handWorld(attack);assert.ok(Number.isFinite(hand.x)&&Number.isFinite(hand.y));
 f.move(64,0,0);assert.match(f.view.upper.texture.key,/idle/);assert.equal(Math.floor(f.view.upper.frame/4),2);
 f.move(80,0,-1);f.move(96,0,-1,null,false,true,1);assert.match(f.view.upper.texture.key,/reaction/);
 for(let t=112;t<=320;t+=16)f.move(t,0,0);
 assert.match(f.view.upper.texture.key,/idle/);assert.equal(Math.floor(f.view.upper.frame/4),3);
});
test('pause freezes an in-flight turn and disposal remains idempotent',()=>{
 const f=fixture();f.move(16,-1,0);f.move(32,-1,0);const saved=structuredClone(f.view.state);
 f.move(8032,0,0,null,true);assert.deepEqual(f.view.state,saved);
 f.move(8048,0,0);assert.match(f.view.upper.texture.key,/turn-upper/);
 const nodes=[...f.view.legs,f.view.upper,f.view.upperBlend];f.view.destroy();f.view.destroy();assert.ok(nodes.every(n=>!n.active));
});
test('missing optional turn art falls back to cardinal cels without changing player physics',()=>{
 const f=fixture(false),body=structuredClone(f.scene.player.body);f.move(16,-1,0);f.move(32,-1,0);
 assert.match(f.view.upper.texture.key,/idle/);assert.equal(Math.floor(f.view.upper.frame/4),1);
 assert.deepEqual(f.scene.player.body,body);
});
test('all twelve cardinal transitions finish in at most 160ms at 30/60/120Hz',()=>{
 const dirs=['down','left','up','right'];
 for(const rate of [30,60,120])for(const from of dirs)for(const to of dirs){
  if(from===to)continue;
  const s={};advanceSakuraTurn(s,from,0,true);const seen=[];let elapsed=0,result;
  do{elapsed+=1000/rate;result=advanceSakuraTurn(s,to,1000/rate);seen.push(result.frame);}while(result.turning&&elapsed<200);
  assert.equal(result.direction,to,`${from}->${to}`);assert.equal(result.frame,null);
  assert.ok(elapsed<=160+1000/rate+.01);assert.ok(seen.some(f=>f!==null));
 }
});
