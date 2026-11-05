import assert from 'node:assert/strict';
import {test} from 'node:test';
import {LayeredPoseTransition,buildLayeredSeamVertices,LayeredSeamMeshes} from '../src/systems/LayeredPoseTransition.mjs';
import {buildVenusPose} from '../src/systems/VenusLayeredPresentation.mjs';
import {buildGenyaPose} from '../src/systems/GenyaLayeredPresentation.mjs';
import {buildKaiPose} from '../src/systems/KaiLayeredPresentation.mjs';
import {buildEnjoPose} from '../src/systems/EnjoLayeredPresentation.mjs';
const part=(p,n)=>p.parts.find(q=>q.name===n);
const rotate=(x,y,a)=>{const r=a*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('renderer updates Phaser translated UVs, reuses three meshes and disposes them once',()=>{
 const frame={cutX:100,cutY:200,cutWidth:60,cutHeight:80,source:{width:1024,height:1024}};
 const created=[],mesh=()=>{const n={width:375,height:667,vertices:[],destroyCount:0};
  for(const key of ['setOrtho','preUpdate','setTint'])n[key]=()=>n;
  for(const [key,field]of [['setDepth','depth'],['setAlpha','alpha'],['setVisible','visible']])n[key]=v=>{n[field]=v;return n;};
  n.setPosition=(x,y)=>{n.x=x;n.y=y;return n;};n.destroy=()=>n.destroyCount++;
  n.addVertices=(xy,uv,indices)=>{n.vertices=indices.map(i=>({x:xy[i*2],y:xy[i*2+1],u:uv[i*2],v:uv[i*2+1],tu:uv[i*2],tv:uv[i*2+1],
   setUVs(u,v){this.u=this.tu=u;this.v=this.tv=v;}}));return n;};created.push(n);return n;};
 const scene={add:{mesh},textures:{getFrame:()=>frame}},seams=new LayeredSeamMeshes(scene,'own-atlas');
 const p=buildGenyaPose({root:{x:100,y:100},facing:'right',state:'walk',clock:0,phase:.25});
 const images=new Map(p.parts.map(q=>[q.name,{visible:true,setVisible(v){this.visible=v;}}]));
 seams.render(p,images,12,.7,0xffffff);assert.equal(created.length,3);
 for(const [name,node]of seams.nodes){const shape=buildLayeredSeamVertices(p,part(p,name));
  for(let i=0;i<node.vertices.length;i++){const v=node.vertices[i],point=shape[seams.indices[i]];
   near(v.tu,(100.5+point.u*59)/1024);near(v.tv,(200.5+point.v*79)/1024);
  }assert.equal(images.get(name).visible,false);assert.equal(node.alpha,.7);}
 seams.render(p,images,15,.3,0xffffff);assert.equal(created.length,3);
 assert(created.every(n=>n.depth>=15&&n.alpha===.3));seams.destroy();seams.destroy();assert(created.every(n=>n.destroyCount===1));
});
for(const [id,build,ankle] of [['venus',buildVenusPose,4],['genya',buildGenyaPose,4],['kai',buildKaiPose,4],['enjo',buildEnjoPose,5]]){
 const pose=(facing,clock,extra={})=>build({root:{x:100,y:100},facing,legFacing:facing,state:'walk',clock,phase:.22,...extra});
 test(id+' turns geometry continuously without moving the root or planted boots',()=>{
  const turn=new LayeredPoseTransition(ankle),a=pose('down',0);turn.sample(a);
  const target=pose('right',10),before=JSON.stringify(target),first=turn.sample(target);
  near(part(first,'face').width,part(a,'face').width);assert.equal(first.facing,'right');
  assert.deepEqual(first.root,target.root);assert.equal(JSON.stringify(target),before);
  for(const name of ['bootL','bootR'])assert.deepEqual(part(first,name),part(target,name));
  const mid=turn.sample(pose('right',55));assert.notEqual(part(mid,'torso').width,part(target,'torso').width);
  const end=turn.sample(pose('right',110));assert.deepEqual(end.parts,pose('right',110).parts);
 });
 test(id+' keeps shoulder/elbow and knee/ankle chains registered during rapid turns',()=>{
  const turn=new LayeredPoseTransition(ankle);turn.sample(pose('down',0));
  for(let t=10;t<=240;t+=10){const raw=pose(t<70?'right':t<140?'up':'left',t),p=turn.sample(raw);
   for(const name of ['thighL','thighR','shinL','shinR','bootL','bootR'])assert.deepEqual(part(p,name),part(raw,name),'lower gait projection must not blend across views');
   for(const label of ['L','R']){
    const arm=part(p,'upperArm'+label),fore=part(p,'forearm'+label),v=rotate(fore.x-arm.x,fore.y-arm.y,-arm.angle);
    near(v.x,0);assert.ok(v.y>7&&v.y<12);
    const thigh=part(p,'thigh'+label),shin=part(p,'shin'+label),boot=part(p,'boot'+label);
    const upper=rotate(0,Math.hypot(shin.x-thigh.x,shin.y-thigh.y),thigh.angle);
    near(thigh.x+upper.x,shin.x);near(thigh.y+upper.y,shin.y);
    const lower=rotate(0,Math.hypot(boot.x-shin.x,boot.y-ankle-shin.y),shin.angle);
    near(shin.x+lower.x,boot.x);near(shin.y+lower.y,boot.y-ankle);
   }
  }
 });
 test(id+' priority poses preempt turn and defeat starts from actual displayed snapshot',()=>{
  const turn=new LayeredPoseTransition(ankle);turn.sample(pose('down',0));turn.sample(pose('right',10));
  const hurt=pose('left',20,{state:'hurt'});assert.deepEqual(turn.sample(hurt).parts,hurt.parts);
  const action=pose('up',30,{state:'action'});assert.deepEqual(turn.sample(action).parts,action.parts);
  turn.sample(pose('down',40));const displayed=turn.sample(pose('right',50));
  const dead=new LayeredPoseTransition(ankle),start=pose('right',50,{presentationSeed:displayed,defeat:0});
  dead.sample(pose('down',0));
  assert.deepEqual(dead.sample(start).parts,displayed.parts);
  const later=pose('right',50,{presentationSeed:displayed,defeat:.5});assert.deepEqual(dead.sample(later).parts,later.parts);
 });
 test(id+' sleeve and cloth meshes use one atlas, anchored tops and bounded deformation',()=>{
  const p=pose('right',50,{state:'action',actionProgress:.45}),arm=part(p,'upperArmL'),fore=part(p,'forearmL');
  const vertices=buildLayeredSeamVertices(p,arm),rigid=rotate(-arm.width/2,-arm.originY*arm.height,arm.angle);
  near(vertices[0].x,arm.x+rigid.x);near(vertices[0].y,arm.y+rigid.y);
  const elbow=Math.hypot(fore.x-arm.x,fore.y-arm.y),joint=vertices.find(v=>v.u===.5&&Math.abs(v.v-(elbow/arm.height+arm.originY))<1e-7);
  assert(joint);near(joint.x,fore.x);near(joint.y,fore.y);
  const cloth=part(p,'skirt')??part(p,'pelvis'),mesh=buildLayeredSeamVertices(p,cloth);
  for(const v of mesh){assert.ok(Number.isFinite(v.x+v.y));assert.ok(v.u>=0&&v.u<=1&&v.v>=0&&v.v<=1);}
  const top=mesh.filter(v=>v.v===0);for(const v of top){const r=rotate((v.u-.5)*cloth.width,-cloth.originY*cloth.height,cloth.angle);near(v.x,cloth.x+r.x);near(v.y,cloth.y+r.y);}
 });
}
