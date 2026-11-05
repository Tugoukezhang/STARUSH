import {nativeWorldMatrices,multiplyAffine} from './sakuraNativePose.mjs';
import {deformRefinedSecondary} from './sakuraRefinedDetails.mjs';
function skinNativeMesh(rig,mesh,pose,world){const t=world.map((m,i)=>multiplyAffine(m,rig.bones[i].inverseBind));return mesh.vertices.map(([x,y],i)=>{let px=0,py=0;for(const [b,w]of mesh.weights[i]){const m=t[b];px+=(m[0]*x+m[2]*y+m[4])*w;py+=(m[1]*x+m[3]*y+m[5])*w;}return [px,py];});}


const bindings=new WeakMap();
function skinFrontalLeg(rig,mesh,pose,world,bind){
 const index=mesh.name==='leg.R'?10:13,foot=index+2,hip=world[index],sole=world[foot];
 const dx=sole[4]-hip[4],dy=sole[5]-hip[5],distance=Math.hypot(dx,dy),length=2*rig.legLength;
 if(distance<1e-8)return skinNativeMesh(rig,mesh,pose,world);
 // Frontal flexion bends into depth. Its screen projection shortens the axis, not the width.
 const c=dy/distance,s=-dx/distance,ratio=Math.min(1,distance/length);
 const projected=world.slice(),matrix=[c,s,-s*ratio,c*ratio,hip[4],hip[5]];
 for(const bone of [index,index+1]){
  const t=(bind[bone][5]-bind[index][5])/length;
  projected[bone]=[...matrix.slice(0,4),hip[4]+dx*t,hip[5]+dy*t];
 }
 const result=skinNativeMesh(rig,mesh,pose,projected),transforms=projected.map((m,i)=>multiplyAffine(m,rig.bones[i].inverseBind));
 return result.map((point,i)=>{
  let ax=0,ay=0;
  for(const [bone,weight]of mesh.weights[i]){ax+=transforms[bone][0]*weight;ay+=transforms[bone][1]*weight;}
  const width=Math.hypot(ax,ay),offset=mesh.vertices[i][0]-bind[index][4];
  return width>1e-8?[point[0]+(ax/width-ax)*offset,point[1]+(ay/width-ay)*offset]:point;
 });
}
export function skinRefinedMesh(rig,mesh,pose,world=nativeWorldMatrices(rig,pose)) {
 const result=deformRefinedSecondary(rig,mesh,skinNativeMesh(rig,mesh,pose,world),pose,world);
 if(!/^(arm|leg)\./.test(mesh.name))return result;
 let bind=bindings.get(rig);
 if(!bind){bind=nativeWorldMatrices(rig,{bones:rig.rest});bindings.set(rig,bind);}
 if(mesh.jointProjection==='sagittal-depth')return skinFrontalLeg(rig,mesh,pose,world,bind);
 const transforms=world.map((m,i)=>multiplyAffine(m,rig.bones[i].inverseBind));
 return result.map((point,i)=>{
  const weights=mesh.weights[i].filter(([,w])=>w>1e-8);
  if(weights.length!==2)return point;
  const [[a,wa],[b,wb]]=weights,child=rig.bones[b].parent===a?b:rig.bones[a].parent===b?a:null;
  if(child===null||Math.abs(wa+wb-1)>1e-8)return point;
  const ma=transforms[a],mb=transforms[b];
  const c=(ma[0]+ma[3])*.5*wa+(mb[0]+mb[3])*.5*wb;
  const s=(ma[1]-ma[2])*.5*wa+(mb[1]-mb[2])*.5*wb,length=Math.hypot(c,s);
  if(Math.abs(length-1)<1e-12)return point;
  const dominant=wa>=wb?ma:mb,nc=length>1e-8?c/length:dominant[0],ns=length>1e-8?s/length:dominant[1];
  const [x,y]=mesh.vertices[i],dx=x-bind[child][4],dy=y-bind[child][5];
  // Adjacent rigid bones share this pivot; normalize only the collapsed rotation.
  return [point[0]+(nc-c)*dx-(ns-s)*dy,point[1]+(ns-s)*dx+(nc-c)*dy];
 });
}

