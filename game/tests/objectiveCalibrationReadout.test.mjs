import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syncPublicObjectiveGuidance,resolvePublicObjectiveGuidanceTarget,destroyPublicObjectiveGuidance} from '../src/systems/PublicObjectiveGuidance.mjs';
import {createDocument} from './helpers/publicShellHarness.mjs';

function fixture(){
 const target={id:'harbor-stage-left',sourceLabel:'帆顶左灯',x:187.5,y:243.5,zone:1,chapterAwaitingCalibration:true,chapterCalibrationMs:400,chapterCalibrationDurationMs:1000};
 return {_userCastPresentation:true,_isPublicStage1Round:()=>true,battleData:{stageId:1,performerId:'sakura'},
  player:{x:187.5,y:333.5,hp:100,active:true},time:{now:1000},
  cameras:{main:{width:375,height:667,scrollX:0,scrollY:0,zoom:1,matrix:{transformPoint:(x,y,out)=>Object.assign(out,{x,y})}}},
  oldStreet:{clearLine:()=>true},paintZone:{currentZone:1,devices:[target],isComplete:()=>false,getNearestObjective:()=>target},
  actorPresentation:{userCastView:{cueExclusionBounds:()=>({x:145,y:270,right:240,bottom:360})}}};
}
const part=(s,key)=>s._publicObjectiveGuidance[key];
const target=s=>s.paintZone.devices[0];
const sync=s=>{const doc=createDocument();syncPublicObjectiveGuidance(s,{doc});return doc;};
const box=s=>{const p=part(s,'tag').style;return{x:parseFloat(p.left),y:parseFloat(p.top),w:parseFloat(p.width),h:parseFloat(p.height)};};

test('calibration reports true retained percent and range state, preserving the original name',()=>{
 const s=fixture();sync(s);
 assert.equal(part(s,'label').textContent,'校准 · 帆顶左灯');
 assert.equal(part(s,'hint').textContent,'校准中 · 40%');assert.equal(part(s,'hint').hidden,false);
 assert.equal(box(s).w,176);assert.equal(box(s).h,56);
 s.player.x=500;assert.equal(resolvePublicObjectiveGuidanceTarget(s).hint,'靠近校准 · 40%');
});
test('readout uses the actual chapter range, line and current-zone predicates',()=>{
 const s=fixture();s.player.y=target(s).y+112;target(s).chapterCalibrationRadius=900;
 assert.equal(resolvePublicObjectiveGuidanceTarget(s).hint,'校准中 · 40%');
 s.player.y+=.01;assert.equal(resolvePublicObjectiveGuidanceTarget(s).hint,'靠近校准 · 40%');
 s.player.y-=.01;s.oldStreet.clearLine=()=>false;assert.equal(resolvePublicObjectiveGuidanceTarget(s).hint,'靠近校准 · 40%');
 s.oldStreet.clearLine=()=>true;s.paintZone.currentZone=2;assert.equal(resolvePublicObjectiveGuidanceTarget(s).hint,'靠近校准 · 40%');
});
test('invalid percent cannot display NaN or exceed the true duration',()=>{
 const s=fixture();for(const [ms,percent]of[[undefined,0],[NaN,0],[Infinity,0],[-1,0],[999,99],[1000,100],[5000,100]]){
  target(s).chapterCalibrationMs=ms;assert.equal(resolvePublicObjectiveGuidanceTarget(s).hint,'校准中 · '+percent+'%');
 }
});
test('calibration avoids the existing opaque performer bounds without changing ordinary geometry',()=>{
 const s=fixture(),doc=sync(s),b=box(s),r=s.actorPresentation.userCastView.cueExclusionBounds();
 assert(b.y>=190&&b.x>=8&&b.x+b.w<=367&&b.y+b.h<=659);
 assert(b.x+b.w<=r.x||b.x>=r.right||b.y+b.h<=r.y||b.y>=r.bottom,'tag must not cover original player silhouette');
 target(s).chapterAwaitingCalibration=false;syncPublicObjectiveGuidance(s,{doc});assert.equal(box(s).w,132);assert.equal(box(s).h,36);assert.equal(part(s,'hint').hidden,true);
 assert.equal(part(s,'label').textContent,'帆顶左灯');
});
test('calibration readout follows true progress, then disappears when no target remains',()=>{
 const s=fixture(),doc=sync(s);target(s).chapterCalibrationMs=650;syncPublicObjectiveGuidance(s,{doc});assert.equal(part(s,'hint').textContent,'校准中 · 65%');
 s.paintZone.getNearestObjective=()=>null;syncPublicObjectiveGuidance(s,{doc});assert.equal(part(s,'root').hidden,true);
});
test('a raised hammer cannot be covered when the upper safe band is too short',()=>{
 const s=fixture();s.actorPresentation.userCastView.cueExclusionBounds=()=>({x:112,y:224,right:280,bottom:361});sync(s);
 const b=box(s),r=s.actorPresentation.userCastView.cueExclusionBounds();
 assert(b.y>=190&&b.y+b.h<=659);assert(b.x+b.w<=r.x||b.x>=r.right||b.y+b.h<=r.y||b.y>=r.bottom);
});
test('calibration display remains read-only through pause/resume and destroy',()=>{
 const s=fixture(),before=JSON.stringify({player:s.player,device:target(s)}),doc=sync(s);
 s._battlePaused=true;assert.equal(syncPublicObjectiveGuidance(s,{doc}),false);assert.equal(part(s,'root').hidden,true);
 s._battlePaused=false;syncPublicObjectiveGuidance(s,{doc});assert.equal(part(s,'root').dataset.motion,'steady');assert.equal(part(s,'hint').textContent,'校准中 · 40%');
 assert.equal(JSON.stringify({player:s.player,device:target(s)}),before);destroyPublicObjectiveGuidance(s);assert.equal(doc.getElementById('public-objective-guidance'),null);
});
test('calibration handles absent and invalid optional presentation bounds safely',()=>{
 for(const bounds of[null,{x:NaN,y:0,right:10,bottom:10},{x:20,y:20,right:10,bottom:10}]){
  const s=fixture();s.actorPresentation.userCastView.cueExclusionBounds=()=>bounds;sync(s);assert.equal(part(s,'root').hidden,false);assert.equal(box(s).w,176);
 }
 const s=fixture();delete s.actorPresentation;sync(s);assert.equal(part(s,'root').hidden,false);
});
test('second-line styling is scoped, uses admitted fonts and keeps hidden/read-only semantics',()=>{
 const css=readFileSync(new URL('../src/styles/objectiveGuidance.css',import.meta.url),'utf8');
 assert.match(css,/\[data-part=hint\][^}]*font-size:\s*14px/);assert.match(css,/\[data-part=copy\][^}]*min-width:\s*0/);
 const src=readFileSync(new URL('../src/systems/PublicObjectiveGuidance.mjs',import.meta.url),'utf8');
 assert.match(src,/cueExclusionBounds/);assert.doesNotMatch(src,/setInterval|setTimeout|addEventListener|\.tweens/);
});
