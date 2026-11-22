import {getChapterObjectivePrerequisites} from '../utils/chapterObjectives.mjs';
const finite=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
export function rooftopSupplyPlan(devices,zone,clearLine){
  const routes=[],terminals=[];
  if(typeof clearLine!=='function')return {routes,terminals};
  for(const target of devices){
    const ids=getChapterObjectivePrerequisites('raincheck',target);
    if(!ids.length||!finite(target)||target.zone>zone)continue;
    for(const id of ids){
      const source=devices.find(d=>d.id===id);if(!finite(source))continue;
      const side=Math.sign(source.x-target.x)||1,approach=target.x+side*80;
      const points=[{x:source.x,y:source.y},{x:approach,y:source.y},{x:approach,y:target.y},{x:target.x,y:target.y}];
      if(points.slice(1).some((p,i)=>!clearLine(points[i],p,3)))continue;
      const state=target.complete?'complete':target.publicStage1Suppressed||source.publicStage1Suppressed?'suppressed':source.complete?'powered':'waiting';
      routes.push({id:source.id+'>'+target.id,points,state});
    }
    if(!target.complete)terminals.push({id:target.id,x:target.x+42,y:target.y+30,charged:target.chapterCalibrationBuffered===true,suppressed:target.publicStage1Suppressed===true});
  }
  return {routes,terminals};
}
function stroke(g,points,width,color,alpha){
  g.lineStyle(width,color,alpha).beginPath().moveTo(points[0].x,points[0].y);
  for(const p of points.slice(1))g.lineTo(p.x,p.y);g.strokePath();
}
function dashed(g,points,color,alpha){
  g.lineStyle(1.5,color,alpha);
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y);if(!length)continue;
    for(let t=0;t<length;t+=14){const end=Math.min(length,t+7);g.lineBetween(a.x+(b.x-a.x)*t/length,a.y+(b.y-a.y)*t/length,a.x+(b.x-a.x)*end/length,a.y+(b.y-a.y)*end/length);}
  }
}
export class RooftopSupplyPresentation{
  constructor(scene){this.scene=scene;this.graphics=null;this.key=null;this.redraws=0;}
  update(devices,zone){
    const s=this.scene;if(!s||s.battleData?.campaignChapterId!=='raincheck')return;
    const plan=rooftopSupplyPlan(devices,zone,s.oldStreet?.clearLine?.bind(s.oldStreet)),key=JSON.stringify(plan);
    if(key===this.key)return;this.key=key;
    if(!plan.routes.length&&!plan.terminals.length){this.graphics?.clear();return;}
    const g=this.graphics??=s.add.graphics().setDepth(1.18);g.clear();this.redraws++;
    for(const r of plan.routes){
      const color=r.state==='suppressed'?0xc88454:r.state==='powered'?0x46bcae:0x526669;
      stroke(g,r.points,5,0x173436,.2);
      if(r.state==='waiting'||r.state==='suppressed')dashed(g,r.points,color,.65);
      else stroke(g,r.points,1.8,color,r.state==='complete'?.3:.85);
    }
    for(const p of plan.terminals){
      g.fillStyle(p.charged?0x40c6b3:0x69777a,p.charged?.9:.25).fillRoundedRect(p.x-9,p.y-11,18,22,3);
      g.lineStyle(2,0x243d42,.85).strokeRoundedRect(p.x-9,p.y-11,18,22,3).lineBetween(p.x-3,p.y-13,p.x+3,p.y-13);
      if(p.charged){g.lineStyle(2,p.suppressed?0xc88454:0xf3ac62,1).lineBetween(p.x+1,p.y-6,p.x-3,p.y+1).lineBetween(p.x-3,p.y+1,p.x+3,p.y-1).lineBetween(p.x+3,p.y-1,p.x-1,p.y+6);}
    }
  }
  destroy(){this.graphics?.destroy();this.graphics=null;this.key=null;this.scene=null;}
}
