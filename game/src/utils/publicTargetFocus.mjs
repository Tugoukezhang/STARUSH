const point=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const flags=['p15ManualFocusExperiment','p15SetlistCueExperiment','p15HostileProjectileExperiment','p15IntegratedActionCompositionExperiment','p15KaiPrototypeExperiment','p15PerformanceHighPointArcExperiment'];
export function isPublicTargetFocusEnabled(scene){
 const d=scene?.battleData;
 return scene?._userCastPresentation===true&&scene._isPublicStage1Round?.()===true&&d?.stageId===1
  &&['sakura','kai','enjo'].includes(d.performerId)&&d.practiceMode!==true&&d.defenseMode!==true
  &&!Object.hasOwn(d,'publicFinaleTrial')&&!flags.some(k=>d[k]===true);
}
export class PublicFocusGesture{
 constructor(){this.pending=new Map();}
 begin(p,now){
  if(p?.id==null||!point(p)||!Number.isFinite(now)||this.pending.size>=4)return false;
  this.pending.set(p.id,{x:p.x,y:p.y,at:now,dragged:false});return true;
 }
 move(p){const row=this.pending.get(p?.id);if(row&&(!point(p)||Math.hypot(p.x-row.x,p.y-row.y)>8))row.dragged=true;}
 end(p,now){
  const row=this.pending.get(p?.id);this.pending.delete(p?.id);
  if(!row||row.dragged||!point(p)||p.wasCanceled===true||!Number.isFinite(now)||now<row.at||now-row.at>350
   ||Math.hypot(p.x-row.x,p.y-row.y)>8)return null;
  return {x:p.x,y:p.y};
 }
 cancel(id){this.pending.delete(id);}
 clear(){this.pending.clear();}
}
export function projectPublicFocusPoint(camera,target){
 if(!point(target)||![camera?.scrollX,camera?.scrollY].every(Number.isFinite)||typeof camera.matrix?.transformPoint!=='function')return null;
 const p=camera.matrix.transformPoint(target.x-camera.scrollX,target.y-camera.scrollY,{});return point(p)?{x:p.x,y:p.y}:null;
}
export function pickPublicFocusTarget({point:p,candidates,project,isEligible,radius=24}={}){
 if(!point(p)||!Array.isArray(candidates)||typeof project!=='function'||typeof isEligible!=='function'||!Number.isFinite(radius)||radius<=0)return null;
 let best=null,distance=Infinity;
 for(const target of candidates){if(!isEligible(target))continue;const position=project(target);if(!point(position))continue;
  const d=Math.hypot(position.x-p.x,position.y-p.y);if(d<=radius&&d<distance){best=target;distance=d;}}
 return best;
}
