import test from 'node:test';
import assert from 'node:assert/strict';
import {HarborReturnPulse} from '../src/utils/harborReturnPulse.mjs';
import {HOMECOMING_CIRCUIT_ROUTES,circuitPathLength,sampleCircuitPath} from '../src/utils/homecomingCircuit.mjs';

const clear=()=>true;
const point=(x,y)=>({x,y});
const straight=[point(0,0),point(720,0)];
const corner=[point(0,0),point(180,0),point(180,180)];
const pulse=(points=straight,start=0)=>new HarborReturnPulse({points,start});
const near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-9,actual+' != '+expected);
const segment=(from,to)=>({from,to});

test('fixed neutral paint contract and readable field state',()=>{
  const p=pulse();
  assert.equal(p.speed,360);assert.equal(p.radius,28);assert.equal(p.damage,18);assert.equal(p.color,null);
  assert.deepEqual(p.points,straight);assert.equal(p.length,720);assert.equal(p.distance,0);
  p.advance(500,[],clear);assert.equal(p.distance,180);
});

test('sample uses elapsed milliseconds and constant arc speed without consuming the sweep',()=>{
  const p=pulse(corner,1000);
  assert.deepEqual(p.sample(999),{x:0,y:0,angle:0,distance:0,done:false});
  assert.deepEqual(p.sample(1250),{x:90,y:0,angle:0,distance:90,done:false});
  assert.deepEqual(p.sample(1500),{x:180,y:0,angle:0,distance:180,done:false});
  assert.deepEqual(p.sample(1750),{x:180,y:90,angle:Math.PI/2,distance:270,done:false});
  assert.deepEqual(p.sample(2000),{x:180,y:180,angle:Math.PI/2,distance:360,done:true});
  assert.deepEqual(p.sample(9000),p.sample(2000));
  assert.equal(p.distance,0);
  assert.deepEqual(p.advance(1500,[],clear).segments,[segment(point(0,0),point(180,0))]);
});

test('zero elapsed, repeated time and a backward clock produce no sweep or contacts',()=>{
  const p=pulse(straight,1000),origin=point(0,0);
  const reject=()=>assert.fail('zero advance must not query walls');
  for(const now of [900,1000,1000]){
    assert.deepEqual(p.advance(now,[origin],reject),{segments:[],hits:[],head:{x:0,y:0,angle:0},done:false});
  }
  const first=p.advance(1500,[origin],clear);assert.equal(first.hits[0],origin);
  for(const now of [1500,1400]){
    const r=p.advance(now,[point(180,0)],reject);
    assert.deepEqual(r.segments,[]);assert.deepEqual(r.hits,[]);assert.deepEqual(r.head,first.head);
    assert.equal(p.distance,180);
  }
  assert.deepEqual(p.advance(1750,[],clear).segments,[segment(point(180,0),point(270,0))]);
});

test('a sweep crossing a corner follows both legs and never the diagonal shortcut',()=>{
  const p=pulse(corner),first=point(90,0),second=point(180,90),diagonal=point(90,90);
  const r=p.advance(1000,[first,second,diagonal],clear);
  assert.deepEqual(r.segments,[segment(corner[0],corner[1]),segment(corner[1],corner[2])]);
  assert.deepEqual(r.hits,[first,second]);assert.equal(r.done,true);
  assert.deepEqual(r.head,{x:180,y:180,angle:Math.PI/2});
});

test('partial advances clip both ends and preserve every bend',()=>{
  const points=[point(0,0),point(180,0),point(180,180),point(360,180)],p=pulse(points);
  p.advance(250,[],clear);
  const r=p.advance(1250,[],clear);
  assert.deepEqual(r.segments,[segment(point(90,0),point(180,0)),segment(point(180,0),point(180,180)),segment(point(180,180),point(270,180))]);
  assert.deepEqual(r.head,{x:270,y:180,angle:0});assert.equal(r.done,false);assert.equal(p.distance,450);
});

test('exact radius and traveled endpoint cap are included, distant and future targets are not',()=>{
  const p=pulse(),side=point(90,28),outside=point(90,28.001),cap=point(208,0),future=point(208.001,0),distant=point(700,0),behind=point(-28.001,0);
  const r=p.advance(500,[side,outside,cap,future,distant,behind],clear);
  assert.deepEqual(r.hits,[side,cap]);
  assert.deepEqual(r.segments,[segment(point(0,0),point(180,0))]);
  assert.deepEqual(p.advance(1000,[future,distant],clear).hits,[future]);
});

test('diagonal legs use perpendicular nearest points, not an axis-aligned box',()=>{
  const p=pulse([point(0,0),point(216,288)]),inside=point(108-27*.8,144+27*.6),outside=point(108-29*.8,144+29*.6);
  const r=p.advance(1000,[inside,outside],(from,target)=>{
    assert.equal(target,inside);near(from.x,108);near(from.y,144);return true;
  });
  assert.deepEqual(r.hits,[inside]);assert.equal(r.done,true);near(r.head.angle,Math.atan2(288,216));
});

test('walls are checked from the nearest point of the clipped sweep to the original target',()=>{
  const p=pulse(),blocked=point(90,20),allowed=point(200,18),outside=point(90,40),calls=[];
  const r=p.advance(500,[blocked,allowed,outside],(from,target)=>{calls.push({from,target});return target!==blocked;});
  assert.deepEqual(calls,[{from:point(90,0),target:blocked},{from:point(180,0),target:allowed}]);
  assert.deepEqual(r.hits,[allowed]);assert.equal(r.hits[0],allowed);
  assert.deepEqual(p.advance(1000,[blocked],clear).hits,[],'past blocked space is not rescanned');
});

test('one blocked leg does not veto a clear contact on another swept leg',()=>{
  const p=pulse(corner),target=point(170,10),origins=[];
  const r=p.advance(1000,[target],from=>{origins.push(from);return from.x===180;});
  assert.deepEqual(origins,[point(170,0),point(180,10)]);assert.equal(r.hits[0],target);
});

test('object identity is hit once per pulse across duplicate inputs and overlapping legs',()=>{
  const points=[point(0,0),point(180,0),point(0,0)],p=pulse(points),a={id:'same',x:90,y:0},b={...a};
  const r=p.advance(500,[a,a,b],clear);
  assert.equal(r.hits.length,2);assert.equal(r.hits[0],a);assert.equal(r.hits[1],b);
  assert.deepEqual(p.advance(1000,[a,b],clear).hits,[]);
  assert.deepEqual(pulse(points).advance(1000,[a,a],clear).hits,[a]);
});

test('low FPS final step includes the endpoint before reporting done, then stays exhausted',()=>{
  const p=pulse(corner),end=point(180,180),cap=point(180,208),beyond=point(180,208.001);
  p.advance(250,[],clear);
  const r=p.advance(10000,[end,cap,beyond],clear);
  assert.deepEqual(r.segments,[segment(point(90,0),point(180,0)),segment(point(180,0),point(180,180))]);
  assert.deepEqual(r.hits,[end,cap]);assert.equal(r.done,true);assert.equal(p.distance,p.length);
  const later=p.advance(20000,[point(180,180)],()=>assert.fail('completed pulse must not query walls'));
  assert.deepEqual(later,{segments:[],hits:[],head:r.head,done:true});
});

test('late first advance sweeps the full path instead of discarding an expired pulse',()=>{
  const p=pulse(corner,500),target=point(180,180),r=p.advance(10000,[target],clear);
  assert.equal(r.segments.length,2);assert.equal(r.hits[0],target);assert.equal(r.done,true);
});

test('the model snapshots supplied travel order and never mutates targets',()=>{
  const points=[point(180,0),point(0,0)],p=pulse(points),target=Object.freeze({x:90,y:0,hp:100});
  points[0].x=900;points.reverse();
  assert.deepEqual(p.points,[point(180,0),point(0,0)]);
  const r=p.advance(500,[target],clear);
  assert.deepEqual(r.head,{x:0,y:0,angle:Math.PI});assert.equal(r.hits[0],target);assert.equal(target.hp,100);
});

test('every real reversed circuit reaches its exact endpoint at constant speed',()=>{
  for(const route of HOMECOMING_CIRCUIT_ROUTES){
    const points=[...route.points].reverse(),p=pulse(points,1000),length=circuitPathLength(points);
    assert.equal(p.length,length);
    const half=p.sample(1000+length/360*500),expected=sampleCircuitPath(points,length/2);
    near(half.distance,length/2);near(half.x,expected.x);near(half.y,expected.y);near(half.angle,expected.angle);
    const r=p.advance(1000+length/360*1000,[points.at(-1)],clear);
    assert.equal(r.done,true,route.id);assert.equal(p.distance,length);
    near(r.head.x,points.at(-1).x);near(r.head.y,points.at(-1).y);
    assert.equal(r.hits[0],points.at(-1));
    near(r.segments.reduce((sum,s)=>sum+Math.hypot(s.to.x-s.from.x,s.to.y-s.from.y),0),length);
  }
});
