import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {drawCapturedAttackCue,resolveCapturedAttackPath} from '../src/systems/EnemyAttackPresentation.mjs';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';
import {getUserCastArt} from '../src/utils/userCast.mjs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url),lineHits=require('phaser/src/geom/intersects/LineToRectangle');
function graphics(){const g={lines:[],fills:[],active:true};g.clear=()=>g;g.setDepth=()=>g;g.lineStyle=(width,color,alpha)=>{g.style={width,color,alpha};return g;};g.lineBetween=(x1,y1,x2,y2)=>{g.lines.push({x1,y1,x2,y2,...g.style});return g;};g.fillStyle=()=>g;g.fillCircle=(x,y,r)=>{g.fills.push({x,y,r});return g;};g.fillTriangle=()=>g;return g;}
const path=(origin,capture,distance=900)=>resolveCapturedAttackPath({origin,capture:{capturedX:capture.x,capturedY:capture.y},distance,width:1200,height:1400});
function crosses(line,b){const p=line.width/2,r={left:b.x-p,right:b.right+p,top:b.y-p,bottom:b.bottom+p};r.x=r.left;r.y=r.top;r.width=r.right-r.left;r.height=r.bottom-r.top;return lineHits(line,r);}
const api=loadScenes().loadRuntime('scenes/BattleScene.js');

for(const id of ['sakura','kai','enjo'])test(id+' actual current atlas bounds reach the real Battle cue owner',()=>{
 const art=getUserCastArt(id),v=Object.assign(Object.create(UserCastPresentation.prototype),{art,disposed:false,image:{frame:{name:12},getBounds:()=>({x:300,y:300,right:492,bottom:460})}});
 const b=v.cueExclusionBounds(),scene={actorPresentation:{userCastView:v},oldStreet:{clearLine:()=>true},cameras:{main:{zoom:1,scrollX:200,scrollY:150}}},g=graphics();
 const enemy={x:400,y:200,publicStage1CueCapture:{capturedX:400,capturedY:450}};
 api.BattleScene.prototype._drawPublicStage1AttackCue.call(scene,g,enemy);
 assert.deepEqual(plain(g.publicAttackExclusion),b);assert(g.lines.length>0);assert(g.lines.every(l=>!crosses(l,b)));assert.equal(v.art,art);
});

test('legacy bounds remain the fallback and current cast has priority without mutating captured geometry',()=>{
 const a={x:10,y:10,right:20,bottom:20},b={x:30,y:30,right:40,bottom:40},g=graphics(),enemy={x:100,y:100,publicStage1CueCapture:{capturedX:600,capturedY:100}};
 const scene={actorPresentation:{userCastView:{cueExclusionBounds:()=>a},sakuraView:{cueExclusionBounds:()=>b}},cameras:{main:{scrollX:0,scrollY:0}}};
 api.BattleScene.prototype._drawPublicStage1AttackCue.call(scene,g,enemy);assert.deepEqual(plain(g.publicAttackExclusion),a);const frozen=JSON.stringify(g.publicAttackPath);
 scene.actorPresentation.userCastView=null;api.BattleScene.prototype._drawPublicStage1AttackCue.call(scene,g,enemy);assert.deepEqual(plain(g.publicAttackExclusion),b);assert.equal(JSON.stringify(g.publicAttackPath),frozen);
});

test('return endpoint marks cannot paint across the protected body',()=>{
 const p=path({x:100,y:100},{x:500,y:100},400);p.returning=true;const b={x:480,y:80,right:520,bottom:130},g=graphics(),before=JSON.stringify(p);
 drawCapturedAttackCue(g,p,null,b);assert(g.lines.length>0);assert(g.lines.every(l=>!crosses(l,b)));assert.equal(JSON.stringify(p),before);
});

test('offscreen source chevron respects body exclusion without removing the remaining corridor',()=>{
 const p=path({x:100,y:100},{x:100,y:900}),b={x:80,y:250,right:120,bottom:285},g=graphics();
 drawCapturedAttackCue(g,p,{x:50,y:250,width:200,height:300},b);assert(g.lines.length>0);assert(g.lines.every(l=>!crosses(l,b)));assert(g.lines.some(l=>l.y1>300||l.y2>300));
});

test('stationary real danger keeps its sole small cue even when the player overlaps it',()=>{
 const p=path({x:100,y:100},{x:100,y:100}),b={x:90,y:90,right:110,bottom:110},g=graphics();drawCapturedAttackCue(g,p,null,b);
 assert.equal(g.lines.length,2);assert.equal(g.fills.length,1);
 for(const box of [null,{...b,x:NaN},{...b,x:500,right:600}]){const h=graphics();drawCapturedAttackCue(h,p,null,box);assert.equal(h.fills.length,1);assert(h.lines.length>0);}
});

test('far-away and invalid exclusions leave every original marker command identical',()=>{
 for(const zero of [false,true]){
  const p=path({x:100,y:100},zero?{x:100,y:100}:{x:100,y:900});p.returning=true;
  const a=graphics();drawCapturedAttackCue(a,p,{x:50,y:250,width:200,height:300});
  for(const b of [{x:900,y:900,right:950,bottom:950},{x:NaN,y:0,right:30,bottom:30}]){
   const g=graphics();drawCapturedAttackCue(g,p,{x:50,y:250,width:200,height:300},b);assert.deepEqual(g.lines,a.lines);assert.deepEqual(g.fills,a.fills);
  }
 }
});

test('unclipped diagonal markers keep exact original endpoints, including floating-point angles',()=>{
 for(const angle of [.17,.317,.91,1.3,2.2,3.4,5.2]){
  const p=path({x:600,y:600},{x:600+Math.cos(angle)*400,y:600+Math.sin(angle)*400},300);p.returning=true;
  const a=graphics(),b=graphics();drawCapturedAttackCue(a,p);drawCapturedAttackCue(b,p,null,{x:-500,y:-500,right:-450,bottom:-450});assert.deepEqual(b.lines,a.lines);
 }
});

test('occluded return marker is omitted as one glyph while corridor and separate return notices remain',()=>{
 const p=path({x:100,y:100},{x:500,y:100},400);p.returning=true;const b={x:480,y:80,right:520,bottom:130},g=graphics();drawCapturedAttackCue(g,p,null,b);
 assert.equal(g.lines.filter(l=>l.width===2.25).length,0);assert(g.lines.some(l=>l.color===0xD84961));
 const source=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 assert.match(source,/折返声浪 · 让开后留意回程/);
 assert.match(source,/声浪折返 · 等回程通过/);
 assert.equal(p.end.x,500);assert.equal(p.length,400);
});

test('a partially obstructed direction glyph is omitted whole, not left as broken arrow arms',()=>{
 const p=path({x:100,y:100},{x:500,y:100},400);p.returning=true;const g=graphics(),control=graphics();
 drawCapturedAttackCue(control,p);assert.equal(control.lines.filter(l=>l.width===2.25).length,4);
 drawCapturedAttackCue(g,p,null,{x:504,y:95,right:520,bottom:105});
 assert.equal(g.lines.filter(l=>l.width===2.25).length,0);
 const h=graphics(),q=path({x:100,y:100},{x:100,y:900}),source=graphics(),view={x:50,y:250,width:200,height:300};
 drawCapturedAttackCue(source,q,view);assert.equal(source.lines.filter(l=>l.width===4).length,2);assert.equal(source.lines.filter(l=>l.width===2).length,2);
 drawCapturedAttackCue(h,q,view,{x:103,y:264,right:115,bottom:278});
 assert.equal(h.lines.filter(l=>l.width===4).length,0);
 assert.equal(h.lines.filter(l=>l.width===2).length,0);
});

test('an explicit invisible current owner does not mask for an unrelated old costume',()=>{
 let legacyReads=0;const g=graphics(),scene={actorPresentation:{userCastView:{cueExclusionBounds:()=>null},sakuraView:{cueExclusionBounds(){legacyReads++;return {x:0,y:0,right:900,bottom:900};}}},cameras:{main:{scrollX:0,scrollY:0}}};
 api.BattleScene.prototype._drawPublicStage1AttackCue.call(scene,g,{x:100,y:100,publicStage1CueCapture:{capturedX:500,capturedY:100}});
 assert.equal(g.publicAttackExclusion,null);assert.equal(legacyReads,0);assert(g.lines.length>0);
});
