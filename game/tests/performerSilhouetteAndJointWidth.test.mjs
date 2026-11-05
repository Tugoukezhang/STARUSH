import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import * as seams from '../src/systems/LayeredPoseTransition.mjs';
import {buildVenusPose} from '../src/systems/VenusLayeredPresentation.mjs';
import {buildGenyaPose} from '../src/systems/GenyaLayeredPresentation.mjs';
import {buildKaiPose} from '../src/systems/KaiLayeredPresentation.mjs';
import {buildEnjoPose} from '../src/systems/EnjoLayeredPresentation.mjs';
import {applyObliquePose} from '../src/systems/LayeredObliquePresentation.mjs';
const entries=[['venus',buildVenusPose],['genya',buildGenyaPose],['kai',buildKaiPose],['enjo',buildEnjoPose]];
const views=['down','left','up','right','down-left','down-right','up-left','up-right'];
const part=(p,n)=>p.parts.find(q=>q.name===n);
const rotate=(x,y,a)=>{const r=a*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const tableUrl=new URL('../src/utils/layeredKneeContours.mjs',import.meta.url);
const contours=fs.existsSync(tableUrl)?(await import(tableUrl)).LAYERED_KNEE_CONTOURS:null;
const pose=(build,view,state='walk')=>build({root:{x:100,y:100},facing:view,legFacing:view,state,clock:125,phase:.3,actionProgress:.4,shotWeight:.7});
for(const [id,build]of entries){
 test(id+' has substantial torso/legs without lengthening the anatomy',()=>{
  for(const view of ['down','right']){const p=pose(build,view),torso=part(p,'torso'),face=part(p,'face');
   assert(torso.width/face.width>=.65,'thin torso remains');
   assert(part(p,'thighL').width>=6.2,'thin thigh remains');assert(part(p,'shinL').width>=4.8,'thin shin remains');
   assert(part(p,'forearmL').width>=6.3,'thin forearm remains');
   near(face.height,id==='venus'||id==='genya'?31:31.5);
   for(const label of ['L','R']){const thigh=part(p,'thigh'+label),shin=part(p,'shin'+label),boot=part(p,'boot'+label);
    assert(Math.hypot(shin.x-thigh.x,shin.y-thigh.y)<=8.401);assert(Math.hypot(boot.x-shin.x,boot.y-shin.y)<=12.6);
   }
  }
 });
 test(id+' opaque knee contours meet across eight views and all priority states',()=>{
  assert.equal(typeof seams.buildLayeredShinVertices,'function','missing measured knee deformation');assert(contours?.[id]);
  assert.equal(Object.keys(contours[id]).length,16);
  for(const view of views)for(const state of ['idle','walk','attack','action','hurt']){
   const cardinal=view.includes('-')?view.split('-').at(-1):view;
   const raw=pose(build,cardinal,state),p=applyObliquePose({...raw,visualFacing:view,visualLegFacing:view},build,id),before=JSON.stringify(p);
   for(const label of ['L','R']){const shin=part(p,'shin'+label),thigh=part(p,'thigh'+label),c=contours[id][shin.frame];
    const points=seams.buildLayeredShinVertices(p,shin,c),row=points.filter(q=>q.v===shin.originY);assert.equal(row.length,3);assert.equal(points.length,18);
    for(let i=0;i<2;i++){const u=c.lower[i],a=row[0],b=row[2],actual={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};
     const offset=rotate((c.upper[i]-.5)*thigh.width,0,thigh.angle);near(actual.x,shin.x+offset.x);near(actual.y,shin.y+offset.y);
    }
    for(const q of points.filter(q=>q.v===1)){const o=rotate((q.u-.5)*shin.width,(1-shin.originY)*shin.height,shin.angle);near(q.x,shin.x+o.x);near(q.y,shin.y+o.y);}
    assert(points.every(q=>Number.isFinite(q.x+q.y)&&q.u>=0&&q.u<=1&&q.v>=0&&q.v<=1));
   }assert.equal(JSON.stringify(p),before,'mesh must not mutate authoritative bones/feet/root');
  }
  const source=fs.readFileSync(new URL('../src/systems/'+id[0].toUpperCase()+id.slice(1)+'LayeredPresentation.mjs',import.meta.url),'utf8');
  assert(source.includes('LAYERED_KNEE_CONTOURS.'+id),'production presenter must supply its own measured contours');
 });
 test(id+' sleeve bottom follows forearm width while shoulder remains rigid',()=>{
  const p=pose(build,'right','action'),arm=part(p,'upperArmL'),fore=part(p,'forearmL'),before=JSON.stringify(p);
  const points=seams.buildLayeredSeamVertices(p,arm),bottom=points.filter(q=>q.v===1),top=points[0],r=rotate(-arm.width/2,-arm.originY*arm.height,arm.angle);
  near(top.x,arm.x+r.x);near(top.y,arm.y+r.y);near(Math.hypot(bottom[2].x-bottom[0].x,bottom[2].y-bottom[0].y),fore.width);
  assert.equal(JSON.stringify(p),before);
 });
}
test('measured shin meshes reuse the atlas owner, hide only replacements and dispose once',()=>{
 assert(contours);const created=[],frame={cutX:0,cutY:0,cutWidth:60,cutHeight:80,source:{width:1024,height:1024}};
 const scene={textures:{getFrame:()=>frame},add:{mesh:()=>{const n={width:375,height:667,vertices:[],destroyCount:0};
  for(const k of ['setOrtho','preUpdate','setTint','setPosition','setDepth','setAlpha','setVisible','setTexture'])n[k]=()=>n;
  n.addVertices=(xy,uv,indices)=>{n.vertices=indices.map(i=>({setUVs(){}}));return n;};n.destroy=()=>n.destroyCount++;created.push(n);return n;
 }}};
 const owner=new seams.LayeredSeamMeshes(scene,'venus-atlas',null,contours.venus),p=pose(buildVenusPose,'down');
 const images=new Map(p.parts.map(q=>[q.name,{visible:true,setVisible(v){this.visible=v;}}]));
 owner.render(p,images,10,1,0xffffff);assert.equal(created.length,5);
 for(const name of ['shinL','shinR','upperArmL','upperArmR','skirt'])assert.equal(images.get(name).visible,false);
 assert.equal(images.get('thighL').visible,true);owner.render(p,images,11,.75,0xffffff);assert.equal(created.length,5);
 owner.destroy();owner.destroy();assert(created.every(n=>n.destroyCount===1));
});
