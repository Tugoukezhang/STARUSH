import Rectangle from 'phaser/src/geom/rectangle/Rectangle.js';
import GetLineToRectangle from 'phaser/src/geom/intersects/GetLineToRectangle.js';

// A one-shot display mask. Existing blocker ownership, damage and paint stay untouched.
export function groundFxVisibility(x,y,radius,blockers,bounds){
  if(![x,y,radius].every(Number.isFinite)||radius<=0||!Array.isArray(blockers))return null;
  const rects=[];
  for(const row of blockers){
    const r=row?.footprint;
    if(!r||![r.x,r.y,r.width,r.height].every(Number.isFinite)||r.width<=0||r.height<=0)continue;
    const rect=new Rectangle(r.x-1,r.y-1,r.width+2,r.height+2);
    if(rect.contains(x,y))return null;
    const dx=x-Math.max(rect.x,Math.min(rect.right,x)),dy=y-Math.max(rect.y,Math.min(rect.bottom,y));
    if(dx*dx+dy*dy<=radius*radius)rects.push(rect);
  }
  const validBounds=bounds&&[bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite)&&bounds.width>0&&bounds.height>0;
  const right=validBounds?bounds.x+bounds.width:Infinity,bottom=validBounds?bounds.y+bounds.height:Infinity;
  if(validBounds&&(x<bounds.x||x>right||y<bounds.y||y>bottom))return null;
  const edge=validBounds&&(x-radius<bounds.x||x+radius>right||y-radius<bounds.y||y+radius>bottom);
  if(!rects.length&&!edge)return [];
  const angles=Array.from({length:64},(_,i)=>-Math.PI+i*Math.PI/32);
  for(const r of rects)for(const [cx,cy]of [[r.x,r.y],[r.right,r.y],[r.right,r.bottom],[r.x,r.bottom]]){
    const a=Math.atan2(cy-y,cx-x);
    for(const offset of [-1e-5,0,1e-5])angles.push(Math.atan2(Math.sin(a+offset),Math.cos(a+offset)));
  }
  return angles.sort((a,b)=>a-b).map(angle=>{
    const dx=Math.cos(angle),dy=Math.sin(angle);let reach=radius;
    if(validBounds){
      if(dx>1e-12)reach=Math.min(reach,(right-x)/dx);else if(dx< -1e-12)reach=Math.min(reach,(bounds.x-x)/dx);
      if(dy>1e-12)reach=Math.min(reach,(bottom-y)/dy);else if(dy< -1e-12)reach=Math.min(reach,(bounds.y-y)/dy);
    }
    const line={x1:x,y1:y,x2:x+dx*reach,y2:y+dy*reach};
    for(const rect of rects)for(const p of GetLineToRectangle(line,rect))reach=Math.min(reach,Math.max(0,Math.hypot(p.x-x,p.y-y)-.125));
    return {x:x+dx*reach,y:y+dy*reach};
  });
}
