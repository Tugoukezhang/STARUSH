export const SAKURA_NATIVE_VISUAL_RECOVERY_MS=140;
const upperBones=new Set(['chest','head','hair','upper.R','forearm.R','fan','upper.L','forearm.L']);

// Mix only within the captured bind; the walking hips and legs retain their own pose.
export function blendSakuraNativeRecovery(rig,target,captured,elapsed) {
  const t=Math.max(0,Math.min(1,elapsed/SAKURA_NATIVE_VISUAL_RECOVERY_MS)),weight=1-t*t*(3-2*t);
  if(weight===0)return target;
  return {...target,fold:weight===1?captured.fold:target.fold+(captured.fold-target.fold)*weight,
    focus:weight>.5?captured.focus:target.focus,
    bones:target.bones.map((pose,i)=>!upperBones.has(rig.bones[i].name)?pose:pose.map((v,k)=>{
      const from=captured.bones[i][k];
      if(weight===1)return from;
      return v+(k===2?Math.atan2(Math.sin(from-v),Math.cos(from-v)):from-v)*weight;
    }))};
}
