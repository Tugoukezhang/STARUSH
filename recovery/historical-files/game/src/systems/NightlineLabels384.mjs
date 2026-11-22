export function nightlineActorBounds(actor,motion,frame){
 const b=motion.bounds[frame];if(!b)return null;
 const [l,t,r,bottom]=b,w=motion.frameWidth,h=motion.frameHeight,sx=Math.abs(actor.scaleX),sy=Math.abs(actor.scaleY);
 const left=actor.flipX?w-r:l,right=actor.flipX?w-l:r;
 return{x:actor.x+(left-motion.originX*w)*sx-5,y:actor.y+(t-motion.originY*h)*sy-5,width:(right-left)*sx+10,height:(bottom-t)*sy+10};
}
const intersects=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
export function layoutNightlineLabels(stations,sizes,actor,walls=[]){
 const out=[],occupied=stations.map(d=>({x:d.x-15,y:d.y-40,width:30,height:55})).concat(walls.map(w=>({x:w.x-7,y:w.y-7,width:w.width+14,height:w.height+14})));
 for(let i=0;i<stations.length;i++){
  const d=stations[i],width=Math.min(300,Math.max(24,sizes[i].width+4)),height=Math.max(18,sizes[i].height+4),side=width/2+32;
  const points=[[d.x,d.y+40],[d.x+side,d.y+8],[d.x-side,d.y+8],[d.x,d.y-54],[d.x+side,d.y-24],[d.x-side,d.y-24],[d.x,d.y+62]];
  const candidates=points.map(([x,y],rank)=>{x=Math.max(25+width/2,Math.min(350-width/2,x));y=Math.max(170+height/2,Math.min(525-height/2,y));const rect={x:x-width/2,y:y-height/2,width,height};return{x,y,rect,score:(actor&&intersects(rect,actor)?10000:0)+occupied.filter(o=>intersects(rect,o)).length*100+rank};});
  candidates.sort((a,b)=>a.score-b.score);const chosen=candidates[0];out.push({id:d.id,...chosen});occupied.push(chosen.rect);
 }
 return out;
}
export function updateNightlineLabels(scene,frame){
 const actor=nightlineActorBounds(scene.actor,scene.art.motion,frame),rows=layoutNightlineLabels(scene.map.stations,scene.labels,actor,scene.map.walls);
 scene.labelLeaders??=scene.add.graphics().setDepth(6.9);scene.labelLeaders.clear();
 for(let i=0;i<rows.length;i++){
  const row=rows[i],d=scene.map.stations[i];scene.labels[i].setPosition(row.x,row.y);
  const dx=row.x-d.x,dy=row.y-d.y,len=Math.hypot(dx,dy)||1;
  if(Math.abs(dx)>32){const endX=row.x-Math.sign(dx)*row.rect.width/2;scene.labelLeaders.lineStyle(1,0xa6c8bd,.65).lineBetween(d.x+dx/len*24,d.y+dy/len*24,endX,row.y);}
 }
 scene.labelLayout=rows;
}
