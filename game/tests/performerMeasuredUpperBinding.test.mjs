import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import * as bindings from '../src/systems/LayeredPoseTransition.mjs';
import {buildVenusPose} from '../src/systems/VenusLayeredPresentation.mjs';
import {buildGenyaPose} from '../src/systems/GenyaLayeredPresentation.mjs';
import {buildKaiPose} from '../src/systems/KaiLayeredPresentation.mjs';
import {buildEnjoPose} from '../src/systems/EnjoLayeredPresentation.mjs';
import {applyObliquePose} from '../src/systems/LayeredObliquePresentation.mjs';
const url=new URL('../src/utils/layeredUpperContours.mjs',import.meta.url);
const contours=fs.existsSync(url)?(await import(url)).LAYERED_UPPER_CONTOURS:null;
const entries=[['venus',buildVenusPose],['genya',buildGenyaPose],['kai',buildKaiPose],['enjo',buildEnjoPose]];
const views=['down','left','up','right','down-left','down-right','up-left','up-right'];
const part=(p,n)=>p.parts.find(q=>q.name===n),near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const rotate=(x,y,a)=>{const r=a*Math.PI/180;return{x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
function gap(p,c){const t=part(p,'torso'),f=part(p,'face'),a=rotate(0,(c[t.frame].edge-t.originY)*t.height,t.angle),b=rotate(0,(c[f.frame].edge-f.originY)*f.height,f.angle);return t.y+a.y-f.y-b.y;}
for(const[id,build]of entries){
 test(id+' measured display binding compacts only an open neck and transports the whole hair group',()=>{
  assert.equal(typeof bindings.bindLayeredUpperBody,'function');assert(contours?.[id]);assert.equal(Object.keys(contours[id]).length,32);
  for(const view of views)for(const state of ['idle','walk','attack','action','hurt','defeat']){
   const raw=build({root:{x:100,y:100},facing:view.includes('-')?view.split('-').at(-1):view,legFacing:'right',state,clock:125,phase:.3,actionProgress:.4,shotWeight:.7,defeat:state==='defeat'?.6:0});
   const p=applyObliquePose({...raw,visualFacing:view,visualLegFacing:'down-right'},build,id),before=JSON.stringify(p),out=bindings.bindLayeredUpperBody(p,contours[id]);
   assert.equal(JSON.stringify(p),before);const a=part(p,'face'),b=part(out,'face'),shift=b.y-a.y;
   assert(shift>=0&&shift<=2.5+1e-6);near(shift,Math.max(0,Math.min(2.5,gap(p,contours[id])-.75)));near(b.x,a.x);near(b.width,a.width);near(b.height,a.height);near(b.angle,a.angle);
   for(const name of ['backHair','hairCap','tailL','tailR'])if(part(p,name)){near(part(out,name).y-part(p,name).y,shift);near(part(out,name).x,part(p,name).x);}
   assert.deepEqual(out.feet,p.feet);assert.deepEqual(out.legs,p.legs);assert.deepEqual(out.root,p.root);for(const q of p.parts.filter(q=>/^(boot|thigh|shin)/.test(q.name)))assert.deepEqual(part(out,q.name),q);
   if(part(out,'pelvis'))near(part(out,'pelvis').x-out.root.x,part(out,'torso').x-out.root.x);
  }
  const source=fs.readFileSync(new URL('../src/systems/'+id[0].toUpperCase()+id.slice(1)+'LayeredPresentation.mjs',import.meta.url),'utf8');assert(source.includes('bindLayeredUpperBody')&&source.includes('LAYERED_UPPER_CONTOURS.'+id));
 });
}
test('binding leaves unknown/missing measured art untouched and does not allocate game objects',()=>{
 assert.equal(typeof bindings.bindLayeredUpperBody,'function');const p=buildVenusPose({root:{x:0,y:0},facing:'down',state:'idle',clock:0});assert.equal(bindings.bindLayeredUpperBody(p,null),p);assert.equal(bindings.bindLayeredUpperBody(p,{}),p);
 const source=fs.readFileSync(new URL('../src/systems/LayeredPoseTransition.mjs',import.meta.url),'utf8'),block=source.slice(source.indexOf('export function bindLayeredUpperBody'),source.indexOf('export function buildLayeredWaistBinding'));assert(!/scene\.add|tween/.test(block));
});
