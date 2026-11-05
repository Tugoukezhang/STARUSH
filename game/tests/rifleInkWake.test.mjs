import test from 'node:test';
import assert from 'node:assert/strict';
import {RifleInkWake} from '../src/systems/RifleInkWake.mjs';

function fixture(){
  const draws=[],nodes=[];
  const scene={oldStreet:{clearLine:()=>true},add:{graphics(){const g={active:true,draws:[],destroyed:0,
    setDepth(d){this.depth=d;return this;},clear(){this.draws=[];return this;},
    fillStyle(color,alpha){this.color=color;this.alpha=alpha;return this;},
    fillTriangle(...xy){const r={color:this.color,alpha:this.alpha,xy};this.draws.push(r);draws.push(r);return this;},
    destroy(){this.destroyed++;this.active=false;}};nodes.push(g);return g;}}};
  return {scene,nodes,draws,wake:new RifleInkWake(scene)};
}
test('only real displacement draws a bounded colored path behind the projectile',()=>{
  const {wake,nodes}=fixture(),n={x:100,y:100,active:true};wake.add(n,0xff69b4,500);
  wake.update(500);assert.equal(nodes.length,0,'stationary birth allocates no Graphics');
  n.x=112;wake.update(530);assert.equal(nodes.length,1);assert(nodes[0].draws.length>0);
  assert(nodes[0].draws.some(d=>d.color===0xff69b4));
  assert(nodes[0].draws.every(d=>d.xy.every(Number.isFinite)));
  assert(nodes[0].draws.every(d=>d.xy.filter((_,i)=>i%2===0).every(x=>x>=100&&x<=112)));
  assert.equal(nodes[0].depth,5.99);assert.deepEqual(n,{x:112,y:100,active:true});
});
test('all four directions remain inside the observed segment and local width',()=>{
  for(const [vx,vy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const {wake,nodes}=fixture(),n={x:100,y:100,active:true};wake.add(n,0x00ced1,0);
    n.x+=vx*30;n.y+=vy*30;wake.update(50);
    for(const d of nodes[0].draws)for(let i=0;i<6;i+=2){const x=d.xy[i]-100,y=d.xy[i+1]-100;
      assert(x*vx+y*vy>=0&&x*vx+y*vy<=30);assert(Math.abs(-x*vy+y*vx)<=8);}
  }
});
test('stopped and consumed projectiles shed only existing short-lived residue',()=>{
  const {wake,nodes}=fixture(),n={x:100,y:100,active:true};wake.add(n,0xff69b4,0);
  n.x=125;wake.update(40);assert(nodes[0].draws.length);const count=wake.rows[0].points.length;
  wake.update(80);assert.equal(wake.rows[0].points.length,count);
  n.active=false;n.x=999;wake.update(100);assert(nodes[0].draws.length);assert(wake.rows[0].points.every(p=>p.x<=125));
  wake.update(281);assert.equal(wake.rows.length,0);assert.equal(nodes[0].draws.length,0);
});
test('cover, non-finite coordinates and discontinuities break rather than invent trails',()=>{
  const {wake,nodes,scene}=fixture(),n={x:100,y:100,active:true};wake.add(n,0xff69b4,0);
  n.x=112;scene.oldStreet.clearLine=()=>false;wake.update(20);assert.equal(nodes.length,0);
  scene.oldStreet.clearLine=()=>true;n.x=500;wake.update(40);assert.equal(nodes.length,0);
  n.x=NaN;wake.update(60);assert.equal(nodes.length,0);n.x=512;wake.update(80);assert.equal(nodes.length,0,'invalid gap cannot bridge');
  n.x=524;wake.update(100);assert(nodes[0].draws.length);
  assert(nodes[0].draws.every(d=>d.xy.filter((_,i)=>i%2===0).every(x=>x>=512)));
});
test('capacity, run-clock rollback and cleanup stay bounded and never destroy bullet nodes',()=>{
  const {wake,nodes}=fixture(),shots=[];for(let i=0;i<30;i++){const n={x:100,y:100+i,active:true};shots.push(n);wake.add(n,0xff69b4,0);}
  assert.equal(wake.rows.length,24);for(const n of shots)n.x=112;wake.update(20);
  for(let t=40;t<500;t+=20){for(const n of shots)n.x+=8;wake.update(t);assert(wake.rows.every(r=>r.points.length<=16&&r.points.at(-1).x-r.points[0].x<=96));}
  wake.update(10);assert.equal(wake.rows.length,0);assert.equal(nodes[0].draws.length,0);
  wake.clear();wake.clear();assert.equal(nodes[0].destroyed,1);assert(shots.every(n=>n.active));
});
test('the same surviving fleck keeps its identity when older tail samples expire',()=>{
  const {wake,nodes}=fixture(),n={x:100,y:100,active:true};wake.add(n,0xff69b4,0);
  for(let i=1;i<=4;i++){n.x+=12;wake.update(i*20);}
  const lastColor=nodes[0].draws.at(-1).color;wake.update(241);
  assert.equal(nodes[0].draws.at(-1).color,lastColor,'age trimming must not flip an existing ink fleck into a white stripe');
});
test('fast render sampling retains a real wake beyond the existing 52.5px projectile tail',()=>{
  const {wake}=fixture(),n={x:100,y:100,active:true};wake.add(n,0xff69b4,0);
  for(let i=1;i<=200;i++){n.x=100+i*.8;wake.update(i*2);}
  const points=wake.rows[0].points,span=points.at(-1).x-points[0].x;
  assert(span>=78&&span<=96,'distance-spaced samples must not collapse into an invisible 20px path at high fps');assert(points.length<=16);
});
