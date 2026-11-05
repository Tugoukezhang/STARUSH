import {nativeWorldMatrices,multiplyAffine} from './sakuraNativePose.mjs';

function inverse([a,b,c,d,x,y]) {
  const determinant=a*d-b*c;
  if(Math.abs(determinant)<1e-8)throw Error('Singular Sakura bind transform');
  return [d/determinant,-b/determinant,-c/determinant,a/determinant,
    (c*y-d*x)/determinant,(b*x-a*y)/determinant];
}

// Re-register approved pixels to a shorter torso/neck; face and planted legs stay rigid.
export function compactSakuraBind(views) {
  const result=structuredClone(views);
  for(const [direction,rig] of Object.entries(result)) {
    const source=views[direction];
    if(rig.bones[2]?.name!=='chest'||rig.bones[3]?.name!=='head')throw Error('Unexpected Sakura bind hierarchy');
    rig.rest[2][1]+=15;
    rig.rest[3][1]+=8;
    const world=nativeWorldMatrices(rig,{bones:rig.rest});
    const transforms=world.map((m,i)=>multiplyAffine(m,source.bones[i].inverseBind));
    const point=([x,y],weights)=>weights.reduce((p,[bone,w])=>{
      const m=transforms[bone];p[0]+=(m[0]*x+m[2]*y+m[4])*w;p[1]+=(m[1]*x+m[3]*y+m[5])*w;return p;
    },[0,0]);
    for(const mesh of rig.meshes) {
      if(mesh.name.startsWith('leg.'))continue;
      mesh.vertices=mesh.vertices.map((v,i)=>point(v,mesh.weights[i]));
      const registration=mesh.paintedRegistration;
      if(registration){for(const key of ['target','from'])if(registration[key])registration[key]=point(registration[key],[[registration.bone,1]]);}
    }
    rig.bones.forEach((bone,i)=>{bone.inverseBind=inverse(world[i]);});
    rig.proportionProfile='compact-torso-v1';
  }
  return result;
}
