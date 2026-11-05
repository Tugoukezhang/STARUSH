import {partForView,projectPose} from './views.mjs';
export function buildRenderPlan(p,meta,{view='front',upperView=view,lowerView=view,anchor=p.root}={}){
 const profile=meta.performers[p.performerId];
 if(!profile||![view,upperView,lowerView].every(v=>profile.views.includes(v))||![anchor.x,anchor.y].every(Number.isFinite))throw new RangeError('Unsupported render view or anchor');
 const q=projectPose(p,upperView),lower=projectPose(p,lowerView),part=(id,v=upperView)=>profile.prefix+partForView(id,v),rows=[];
 const dx=anchor.x-p.root.x,dy=anchor.y-p.root.y;
 const add=(id,x,y,width,height,origin,angle=0,extra={})=>rows.push({part:id,x:x+dx,y:y+dy,width,height,origin,angle,...extra});
 const sprite=(id,x,y,width,origin=[.5,.5],angle=0)=>{const m=meta.parts[id];add(id,x,y,width,width*m.height/m.width,origin,angle);};
 const bone=(id,a,b)=>{
  const m=meta.parts[id],[start,end]=m.joints,sx=(end[0]-start[0])*m.width,sy=(end[1]-start[1])*m.height;
  const scale=Math.hypot(b.x-a.x,b.y-a.y)/Math.hypot(sx,sy),angle=(Math.atan2(b.y-a.y,b.x-a.x)-Math.atan2(sy,sx))*180/Math.PI;
  add(id,a.x,a.y,m.width*scale,m.height*scale,start,angle,{to:{x:b.x+dx,y:b.y+dy}});
 };
 if(p.performerId==='genya'&&upperView==='front')sprite('genya-back-hair',p.root.x,p.root.y-65+p.shift+p.breath,52,[.5,.05]);
 for(const j of [1,0]){const side=j?'left':'right',leg=lower.legs[j];bone(part(side+'-thigh',lowerView),leg.hip,leg.knee);bone(part(side+'-shin',lowerView),leg.knee,leg.ankle);
  const id=part(side+'-boot',lowerView),m=meta.parts[id],a=m.joints[0],b=m.joints[1],scale=6/((b[1]-a[1])*m.height);
  add(id,leg.ankle.x,leg.ankle.y,m.width*scale,m.height*scale,a);
 }
 const left=q.arms[1],right=q.arms[0];
 const deferFan=upperView==='front'&&p.showFan&&p.presentation==='attack'&&p.fanOpen;
 const drawFan=()=>{if(p.showFan){const id=part(p.fanOpen?'fan-open':'fan-rest');sprite(id,right.wrist.x,right.wrist.y,p.fanOpen?17:10,meta.parts[id].pivot??[.5,.94],q.fanAngle);}};
 const drawLeft=()=>{bone(part('left-upper-arm'),left.shoulder,left.elbow);bone(part('left-forearm'),left.elbow,left.wrist);};
 const drawRight=()=>{
  bone(part('right-upper-arm'),right.shoulder,right.elbow);bone(part('right-forearm'),right.elbow,right.wrist);
  if(!deferFan)drawFan();
 };
 drawLeft();if(upperView==='rear')drawRight();
 sprite(part('torso'),p.root.x,p.root.y-40+p.shift+p.breath,19,[.5,0]);
 sprite(part('skirt',lowerView),p.root.x,p.root.y-25+p.shift,25,[.5,0]);
 if(upperView!=='rear')drawRight();
 sprite(part(p.face),p.root.x,p.root.y-39+p.shift+p.breath,45,upperView==='rear'?(profile.rearHeadPivot??[.5,.88]):[.5,.88],q.headRotation);
 if(deferFan)drawFan();
 if(!p.showFan&&p.presentation==='victory'){drawLeft();drawRight();}
 return rows;
}
