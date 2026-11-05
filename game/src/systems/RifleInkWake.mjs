const LIFE=240,MAX_SPAN=96,MAX_PATHS=24,MAX_POINTS=16;

// Samples the visual owner's actual positions. It cannot advance, paint or damage a projectile.
export class RifleInkWake {
  constructor(scene){this.scene=scene;this.rows=[];this.graphics=null;this.time=null;}
  add(node,color,now){
    if(!node||!Number.isFinite(node.x+node.y+now+color))return;
    this.rows.push({node,color,points:[{x:node.x,y:node.y,time:now,seq:0}]});
    if(this.rows.length>MAX_PATHS)this.rows.shift();
  }
  // The image owner can consume a shot after this frame's live sample.
  finish(node,point,now){
    const row=this.rows.find(r=>r.node===node),last=row?.points.at(-1);
    if(!last||row.finished||!Number.isFinite(point?.x+point?.y+now)||now<last.time||now-last.time>=LIFE)return false;
    const d=Math.hypot(point.x-last.x,point.y-last.y);
    if(d>MAX_SPAN||this.scene.oldStreet?.clearLine(last,point,2)===false)return false;
    row.finished=true;
    if(d===0)return false;
    row.points.push({x:point.x,y:point.y,time:now,seq:last.seq+1});
    row.points=row.points.slice(-MAX_POINTS);
    while(row.points.length>1&&Math.hypot(point.x-row.points[0].x,point.y-row.points[0].y)>MAX_SPAN)row.points.shift();
    return true;
  }
  update(now){
    if(!Number.isFinite(now))return;
    if(this.time!==null&&now<this.time)this.rows=[];
    this.time=now;this.graphics?.clear();
    this.rows=this.rows.filter(row=>{
      const n=row.node;
      if(n.active!==false&&!row.finished){
        if(!Number.isFinite(n.x+n.y)){row.points=[];return true;}
        const last=row.points.at(-1),p={x:n.x,y:n.y,time:now,seq:(last?.seq??-1)+1};
        if(!last)row.points.push(p);
        else {
          const d=Math.hypot(p.x-last.x,p.y-last.y);
          if(d>MAX_SPAN||this.scene.oldStreet?.clearLine(last,p,2)===false)row.points=[p];
          else if(d>=6)row.points.push(p);
        }
      }
      row.points=row.points.filter(p=>now-p.time<LIFE).slice(-MAX_POINTS);
      while(row.points.length>1&&Math.hypot(row.points.at(-1).x-row.points[0].x,row.points.at(-1).y-row.points[0].y)>MAX_SPAN)row.points.shift();
      for(let i=1;i<row.points.length;i++)this.draw(row.points[i-1],row.points[i],row.color,now,row.points[i].seq);
      return n.active!==false&&!row.finished||row.points.length>0;
    });
  }
  draw(a,b,color,now,index){
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<2)return;
    const g=this.graphics??=this.scene.add?.graphics?.().setDepth(5.99);if(!g)return;
    const nx=-dy/d,ny=dx/d,alpha=.78*Math.max(0,1-(now-a.time)/LIFE),w=1.2+2.6*alpha/.78;
    const quad=(offset,width,ink,opacity)=>{
      const ax=a.x+nx*offset,ay=a.y+ny*offset,bx=b.x+nx*offset,by=b.y+ny*offset;
      g.fillStyle(ink,opacity).fillTriangle(ax-nx*width*.35,ay-ny*width*.35,bx-nx*width,by-ny*width,bx+nx*width,by+ny*width)
        .fillTriangle(ax-nx*width*.35,ay-ny*width*.35,bx+nx*width,by+ny*width,ax+nx*width*.35,ay+ny*width*.35);
    };
    quad(0,w+1.1,0x19232c,alpha*.85);quad(0,w,color,alpha);
    if(index%2===0){
      const side=index%4===0?-1:1,at=t=>({x:a.x+dx*t+nx*side*5,y:a.y+dy*t+ny*side*5}),p=at(.2),q=at(.75);
      g.fillStyle(color===0x00ced1?0xff69b4:0x5df5ed,alpha*.9).fillTriangle(p.x,p.y,q.x+nx*side*1.4,q.y+ny*side*1.4,q.x,q.y);
    }else quad(-1,.55,0xf5ffff,alpha*.78);
  }
  clear(){this.rows=[];this.time=null;this.graphics?.destroy();this.graphics=null;}
}
