import test from 'node:test';
import assert from 'node:assert/strict';
import {drawCapturedAttackCue,resolveCapturedAttackPath,resolveAttackCueSpans,drawHostilePulse} from '../src/systems/EnemyAttackPresentation.mjs';
const INK=0x302A38;
function graphics(){
 const g={styles:[],lines:[],fills:[],style:null};
 g.lineStyle=(width,color,alpha)=>{g.style={width,color,alpha};g.styles.push(g.style);return g;};
 g.lineBetween=(x1,y1,x2,y2)=>{g.lines.push({...g.style,x1,y1,x2,y2});return g;};
 g.fillStyle=(...a)=>{g.fills.push(['style',...a]);return g;};
 g.fillTriangle=(...a)=>{g.fills.push(['triangle',...a]);return g;};
 g.fillCircle=(...a)=>{g.fills.push(['circle',...a]);return g;};
 return g;
}
const path=()=>resolveCapturedAttackPath({origin:{x:100,y:100},capture:{capturedX:900,capturedY:100},distance:900,width:1200,height:1200});
const hatches=g=>g.lines.filter(l=>l.color===INK&&l.width===1.25&&l.alpha===.68);

test('hostile corridor is shape-distinct from restored pigment without widening its real geometry',()=>{
 const p=path(),before=JSON.stringify(p),g=graphics();drawCapturedAttackCue(g,p);
 assert(hatches(g).length>0,'distinct in-corridor hazard hatches must exist');
 assert(g.styles.some(s=>s.color===INK&&s.width===3.25&&s.alpha===.82),'visible dark backing on colored ground');
 assert(g.styles.some(s=>s.color===0xD84961&&s.width===1.5&&s.alpha===.95),'retain authored hostile hue');
 assert.equal(JSON.stringify(p),before);assert.equal(p.radius,7);
 for(const l of hatches(g))for(const [x,y]of [[l.x1,l.y1],[l.x2,l.y2]]){
  assert(x>=p.origin.x&&x<=p.end.x);assert(Math.abs(y-p.origin.y)<=p.radius-2);
 }
 const lane=g.fills.find(f=>f[0]==='style'&&f[1]===INK);
 assert(lane[2]>=.30&&lane[2]<=.42,'keep the colored road visible through the shaded path');
});
test('every diagonal stroke stays in an existing body-excluded span, including angled lanes',()=>{
 for(const capture of [{capturedX:900,capturedY:100},{capturedX:900,capturedY:900},{capturedX:100,capturedY:900}]){
  const p=resolveCapturedAttackPath({origin:{x:100,y:100},capture,distance:900,width:1200,height:1200});
  const box={x:280,y:280,right:340,bottom:340},g=graphics(),spans=resolveAttackCueSpans(p,box);
  drawCapturedAttackCue(g,p,null,box);assert(hatches(g).length>0);
  for(const l of hatches(g)){
   const ts=[[l.x1,l.y1],[l.x2,l.y2]].map(([x,y])=>(x-p.origin.x)*p.unit.x+(y-p.origin.y)*p.unit.y);
   assert(spans.some(([a,b])=>Math.min(...ts)>=a-1e-8&&Math.max(...ts)<=b+1e-8));
   assert(!(Math.min(l.x1,l.x2)<box.right&&Math.max(l.x1,l.x2)>box.x&&Math.min(l.y1,l.y2)<box.bottom&&Math.max(l.y1,l.y2)>box.y));
  }
 }
});
test('pattern is bounded, world-anchored and absent on fully excluded or short paths',()=>{
 const p=path(),a=graphics(),b=graphics();drawCapturedAttackCue(a,p);drawCapturedAttackCue(b,p,{x:400,y:80,width:375,height:667});
 assert.deepEqual(hatches(a),hatches(b));
 const long={...p,length:4000,end:{x:4100,y:100}},c=graphics();drawCapturedAttackCue(c,long);assert.equal(hatches(c).length,32);
 const blocked=graphics();drawCapturedAttackCue(blocked,p,null,{x:90,y:80,right:1100,bottom:120});assert.equal(hatches(blocked).length,0);
 const short=graphics();drawCapturedAttackCue(short,{...p,length:8,end:{x:108,y:100}});assert.equal(hatches(short).length,0);
 const absent=graphics();drawCapturedAttackCue(absent,null);assert.equal(absent.lines.length,0);
});
test('projectile silhouette remains the original 7px owner, not a new warning object',()=>{
 const g=graphics();drawHostilePulse(g);assert.deepEqual(g.fills.filter(f=>f[0]==='circle').map(f=>f[3]),[7,5.5,2.5]);
 assert.equal(hatches(g).length,0);
});

test('the first visible piece of a body-clipped threat has its own two-tone arrow',()=>{
 const p=path(),g=graphics(),body={x:80,y:70,right:230,bottom:125};
 drawCapturedAttackCue(g,p,null,body);
 const arrows=g.lines.filter(line=>line.color===0xffe5a1&&line.width===1.75);
 assert(arrows.length>=2);
 assert(arrows[0].x1>body.right&&arrows[0].x2<body.right+36);
 assert(arrows.every(line=>line.x2>line.x1));
});
