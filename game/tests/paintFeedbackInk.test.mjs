import test from 'node:test';
import assert from 'node:assert/strict';
import {PerformerShotFeedback} from '../src/systems/PerformerShotFeedback.mjs';
import {PerformerActionFeedback} from '../src/systems/PerformerActionFeedback.mjs';
let api={};
try{api=await import('../src/systems/PaintFeedbackInk.mjs');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
function gfx(){return {commands:[],clear(){this.commands=[];return this;},setDepth(d){this.depth=d;return this;},setAlpha(){return this;},lineStyle(...a){this.commands.push(['style',...a]);return this;},lineBetween(...a){this.commands.push(['line',...a]);return this;},destroy(){this.destroyed=true;}};}
const INK=0x263840;
test('two-pass registered accent keeps exact endpoints, color and outer coverage',()=>{
 assert.equal(typeof api.drawPaintFeedbackInk,'function','RED: no local contrast helper');
 const g=gfx(),a={x:10,y:20},b={x:16,y:24},queries=[],before=JSON.stringify([a,b]);
 assert(api.drawPaintFeedbackInk(g,a,b,0xF2D66F,.65,2.1,(p,q,r)=>{queries.push({p,q,r});return true;}));
 assert.deepEqual(g.commands,[['style',3.7,INK,.65*.7],['line',10,20,16,24],['style',2.1,0xF2D66F,.65],['line',10,20,16,24]]);
 assert(queries.some(q=>q.r===1.85));assert.equal(JSON.stringify([a,b]),before);
});
test('outer ink cannot leak past cover when the old colored center stroke was legal',()=>{
 assert.equal(typeof api.drawPaintFeedbackInk,'function');const g=gfx();
 assert.equal(api.drawPaintFeedbackInk(g,{x:0,y:0},{x:8,y:0},0xF2D66F,.65,2.1,(_a,_b,r)=>r<1.5),false);assert.equal(g.commands.length,0);
});
test('malformed, invisible, over-wide or zero-length strokes have no render work',()=>{
 assert.equal(typeof api.drawPaintFeedbackInk,'function');
 for(const [a,b,alpha,width]of [[{x:NaN,y:0},{x:1,y:1},.5,2],[{x:0,y:0},{x:1,y:1},0,2],[{x:0,y:0},{x:0,y:0},.5,2],[{x:0,y:0},{x:1,y:1},.5,8]]){
  const g=gfx();assert.equal(api.drawPaintFeedbackInk(g,a,b,0xF2D66F,alpha,width,()=>true),false);assert.equal(g.commands.length,0);
 }
});
function fixture(id){const g=gfx(),s={player:{hp:5,active:true},publicPerformerRun:{member:{id}},oldStreet:{clearLine:()=>true},add:{graphics:()=>g}},n={active:true,visible:true,width:20,height:40,displayOriginX:10,displayOriginY:4,frame:{name:'down/forearmR'},getWorldTransformMatrix:()=>({transformPoint:()=>({x:200,y:400})})};return {g,s,v:{scene:s,depth:9.3,pose:{state:'attack'},nodes:new Map([['forearmR',n]])}};}
for(const id of ['venus','genya','kai','enjo'])test(id+' current ordinary release and actual action contacts use the shared ink, not their bridges/large footprints',()=>{
 const {g,s,v}=fixture(id),shot=new PerformerShotFeedback(s),b={active:true,paintShot:true,x:210,y:400,bornX:200,bornY:400,moveVx:450,moveVy:0,color:'yellow'},pre=JSON.stringify(b);
 assert(shot.queue(b,0));shot.update(0,v);assert(g.commands.some(c=>c[0]==='style'&&c[2]===INK),'RED: emitted hand accent has no contrast');assert.equal(JSON.stringify(b),pre);
 const original=JSON.stringify(g.commands);s._battlePaused=true;shot.update(9000,v);assert.equal(JSON.stringify(g.commands),original);s._battlePaused=false;shot.destroy();
 const action=new PerformerActionFeedback(s,id);v.pose.state='action';action.queue({x:210,y:400,radius:36,start:0,angle:0,contacts:[]});action.update(30,v);
 // Only the registered hand may have ink when the release has no actual contacts.
 const handInk=g.commands.filter(c=>c[0]==='style'&&c[2]===INK).length;
 assert(handInk<=1);action.clear();action.queue({x:210,y:400,radius:36,start:40,angle:0,contacts:[{x:230,y:400,kind:'fixture'}]});action.update(70,v);
 assert(g.commands.filter(c=>c[0]==='style'&&c[2]===INK).length>handInk,'RED: actual contact accent has no contrast');assert.deepEqual(action.lastFrame[0].contacts,[{x:230,y:400,kind:'fixture'}]);
 s._battleEnded=true;action.update(90,v);assert.equal(g.commands.length,0);action.destroy();action.destroy();
});
test('active contact ink requires full origin and outer-width cover clearance',()=>{
 const {g,s,v}=fixture('enjo'),action=new PerformerActionFeedback(s,'enjo');v.pose.state='action';s.oldStreet.clearLine=(_p,_q,r)=>r<1.6;
 action.queue({x:210,y:400,radius:190,start:0,angle:0,contacts:[{x:230,y:400}]});action.update(30,v);assert(!g.commands.some(c=>c[0]==='style'&&c[2]===INK));action.destroy();
});
