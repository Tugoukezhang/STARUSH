import assert from 'node:assert/strict';
import test from 'node:test';
import {SakuraLayeredPresentation} from '../src/systems/SakuraLayeredPresentation.mjs';
import {SAKURA_RIG_ATTACHMENTS} from '../src/systems/SakuraRigAttachments.mjs';

function image(x,y,key,frame){
 const n={x,y,texture:{key},frame,active:true,alpha:1,destroyCount:0};
 for(const [m,keys] of Object.entries({setDisplaySize:['displayWidth','displayHeight'],setPosition:['x','y'],setOrigin:['originX','originY'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint'],setRotation:['rotation'],setScale:['scaleX','scaleY'],setFrame:['frame']}))n[m]=function(...v){keys.forEach((k,i)=>this[k]=v[i]??v[0]);return this;};
 n.setTexture=function(k,f){this.texture.key=k;this.frame=f;return this;};
 n.destroy=function(){this.active=false;this.destroyCount++;};return n;
}
function fixture(){
 const nodes=[],player={x:300,y:500,hp:5,body:{halfWidth:4,velocity:{x:0,y:0}}};
 const scene={player,playerGfx:{alpha:1},textures:{exists:()=>true},add:{image:(...args)=>{const n=image(...args);nodes.push(n);return n;}}};
 const view=new SakuraLayeredPresentation(scene);let now=0;view.update(now,0,0,null,false);
 return {view,player,nodes,step(dx=0,dy=0,attack=null,dt=1000/60,frozen=false){now+=dt;player.x+=dx;player.y+=dy;view.update(now,dx,dy,attack,frozen);return view.state;}};
}
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);
const attack=direction=>({direction,phase:'release',progress:.3});
function axial(g){
 const dx=g.ankle.x-g.hip.x,dy=g.ankle.y-g.hip.y,d=Math.hypot(dx,dy);
 const along=((g.knee.x-g.hip.x)*dx+(g.knee.y-g.hip.y)*dy)/d;
 return {side:((g.knee.x-g.hip.x)*dy-(g.knee.y-g.hip.y)*dx)/d,along,d};
}
function endpoint(n,point){
 const x=(point[0]-n.originX*128)*n.scaleX,y=(point[1]-n.originY*128)*n.scaleY;
 return {x:n.x+x*Math.cos(n.rotation)-y*Math.sin(n.rotation),y:n.y+x*Math.sin(n.rotation)+y*Math.cos(n.rotation)};
}

for(const direction of ['down','up'])test(`${direction}: unequal-length knees bend into depth without lateral bowing`,()=>{
 const f=fixture();let maxDepth=0;
 for(let i=0;i<120;i++){
  const s=f.step(0,direction==='down'?250/60:-250/60,attack(direction));
  for(const g of s.legGeometry){
   const a=axial(g);assert.ok(Math.abs(a.side)<.25,`${direction} knee sideways deviation ${a.side}`);
   near(a.along,(9.5**2-10.5**2+a.d**2)/(2*a.d),'unequal-bone projection, not midpoint');
   near(Math.hypot(g.knee.x-g.hip.x,g.knee.y-g.hip.y,g.knee.z??0),9.5,'upper physical length');
   near(Math.hypot(g.ankle.x-g.knee.x,g.ankle.y-g.knee.y,g.knee.z??0),10.5,'lower physical length');
   maxDepth=Math.max(maxDepth,g.knee.z??0);
  }
 }
 assert.ok(maxDepth>2,'depth flexion must not be replaced by a straight rigid leg');
});

test('real leg texture endpoints and oblique shoe soles stay registered across directions and frame rates',()=>{
 for(const fps of [60,30,15])for(const direction of ['down','left','right','up'])for(const vector of [[1,0],[0,1],[-Math.SQRT1_2,-Math.SQRT1_2]]){
  const f=fixture(),body=structuredClone(f.player.body),a=attack(direction);
  for(let i=0;i<45;i++){
   const s=f.step(vector[0]*250/fps,vector[1]*250/fps,a,1000/fps);
   s.legGeometry.forEach((g,side)=>{
    assert.ok(g.error<.02,'unchanged solver still reaches the ankle');
    for(let part=0;part<3;part++){
     const n=f.view.legs[side*3+part],m=SAKURA_RIG_ATTACHMENTS[n.frame];
     const head=endpoint(n,m.head),tail=endpoint(n,m.tail);
     const expectedHead=[g.hip,g.knee,g.ankle][part];
     const expectedTail=[g.knee,g.ankle,{x:s.feet[side].x,y:s.feet[side].y-s.feet[side].lift}][part];
     near(head.x,expectedHead.x,'head x');near(head.y,expectedHead.y,'head y');
     near(tail.x,expectedTail.x,'tail x');near(tail.y,expectedTail.y,'tail y');
     assert.ok(n.scaleX>0&&n.scaleY>0);
    }
   });
  }
  assert.deepEqual(f.player.body,body);assert.equal(f.player.hp,5);
 }
});

test('side-view knees retain forward flexion on both legs',()=>{
 for(const direction of ['left','right']){
  const f=fixture();let maxSide=0;
  for(let i=0;i<60;i++){
   const s=f.step(direction==='left'?-3:3,0,attack(direction));
   for(const g of s.legGeometry){const side=axial(g).side;assert.ok(direction==='left'?side<0:side>0);maxSide=Math.max(maxSide,Math.abs(side));near(g.knee.z??0,0,'side depth');}
  }
  assert.ok(maxSide>1);
 }
});

test('the knee projection follows the current turn yaw including intermediate views and interruption',()=>{
 const f=fixture();
 for(let i=0;i<20;i++){
  const s=f.step(-2,0);
  for(const g of s.legGeometry){const bend=axial(g).side,h=Math.hypot(bend,g.knee.z??0);if(h>.01)near(-bend/h,Math.sin(s.turnYaw*Math.PI/4),'shared yaw');}
 }
 const s=f.step(0,2,attack('up'));
 assert.equal(s.turnYaw,4);assert.match(f.view.upper.texture.key,/attack/);
 for(const g of s.legGeometry)near(axial(g).side,0,'attack immediately redirects the bend plane');
});

test('a 240ms frame finishes the whole turn instead of retaining the foot integration cap',()=>{
 const f=fixture();for(let i=0;i<20;i++)f.step(-2,0);
 f.step(2,0);const s=f.step(2,0,null,240);
 assert.equal(s.visualDirection,'right','upper and legs must finish the turn in the elapsed time');
 assert.match(f.view.upper.texture.key,/idle/);assert.equal(s.turnYaw,6);
 for(const g of s.legGeometry){assert.ok(axial(g).side>0);near(g.knee.z??0,0,'completed side depth');}
});

test('pause, settling and destruction keep existing contracts without extra nodes',()=>{
 const f=fixture();for(let i=0;i<15;i++)f.step(0,3);
 const before=structuredClone(f.view.state),geometry=structuredClone(f.view.state.legGeometry);
 f.step(0,0,null,5000,true);assert.deepEqual(f.view.state,before);
 f.step(0,0,null,0);near(f.view.state.clock,before.clock,'no paused-time catchup');
 for(let i=0;i<30;i++)f.step();
 assert.equal(f.view.state.mode,'idle');assert.ok(f.view.state.feet.every(x=>x.contact&&Math.abs(x.lift)<1e-9));
 assert.ok(geometry.length===2);assert.equal(f.nodes.length,10);
 f.view.destroy();f.view.destroy();assert.ok(f.nodes.every(x=>x.destroyCount===1));
});
