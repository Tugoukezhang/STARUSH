const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

// The original fan bone is also the grip. Only the palm follows its rotation;
// the proximal sleeve and elbow retain their authored forearm weights.
export function prepareNativeGripRig(rig) {
 const fan=rig.fanBone,forearm=rig.bones[fan]?.parent,inverse=rig.bones[fan]?.inverseBind;
 const arm=rig.meshes.find(m=>m.name==='arm.R');
 if(!arm||!inverse||rig.bones[forearm]?.name!=='forearm.R')throw Error('Sakura grip bind is missing');
 const weights=arm.vertices.map(([x,y],i)=>{
  const localY=inverse[1]*x+inverse[3]*y+inverse[5];
  const t=clamp((localY+18)/12,0,1),blend=t*t*(3-2*t);
  if(blend===0)return arm.weights[i];
  const from=arm.weights[i],grip=(from.find(w=>w[0]===forearm)?.[1]??0)*blend;
  if(grip===0)return from;
  const next=from.map(([bone,weight])=>[bone,bone===forearm?weight-grip:weight]).filter(w=>w[1]>0);
  const existing=next.find(w=>w[0]===fan);
  if(existing)existing[1]+=grip;else next.push([fan,grip]);
  return next;
 });
 return {...rig,meshes:rig.meshes.map(m=>m===arm?{...arm,weights}:m)};
}
