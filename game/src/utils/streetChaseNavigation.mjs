import PF from 'pathfinding';
import {STAGE1_PAINT_WORLD_WIDTH as WIDTH,STAGE1_PAINT_WORLD_HEIGHT as HEIGHT} from './stage1PaintRound.mjs';
import {CHAPTER_CHASER_TUNING} from './chapterChaserContent.mjs';

const CELL=20,RADIUS=CHAPTER_CHASER_TUNING.radius;
const COLS=Math.ceil(WIDTH/CELL),ROWS=Math.ceil(HEIGHT/CELL);
const finite=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const center=(x,y)=>({x:(x+.5)*CELL,y:(y+.5)*CELL});

// Only approach routing. Exact street collision still owns every movement step.
export class StreetChaseNavigation {
 constructor(state){
  this.state=state;this.grid=null;this.revision=null;this.routes=new WeakMap();
  this.finder=new PF.AStarFinder({diagonalMovement:PF.DiagonalMovement.Never});
 }
 valid(point,minY){
  return finite(point)&&point.x>=RADIUS&&point.x<=WIDTH-RADIUS&&point.y>=Math.max(RADIUS,minY)
   &&point.y<=HEIGHT-RADIUS&&this.state.clearLine(point,point,RADIUS);
 }
 refresh(minY){
  const revision=[...this.state.opened].sort().join(',')+'|'+minY;
  if(this.grid&&revision===this.revision)return;
  this.revision=revision;this.routes=new WeakMap();this.grid=new PF.Grid(COLS,ROWS);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)this.grid.setWalkableAt(x,y,this.valid(center(x,y),minY));
 }
 nearest(point,from){
  const x=Math.floor(point.x/CELL),y=Math.floor(point.y/CELL),candidates=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const cx=x+dx,cy=y+dy;if(!this.grid.isWalkableAt(cx,cy))continue;
   const p=center(cx,cy);
   if(this.state.clearLine(point,p,from?RADIUS:0))candidates.push({x:cx,y:cy,p,d:Math.hypot(p.x-point.x,p.y-point.y)});
  }
  candidates.sort((a,b)=>a.d-b.d);return candidates[0]||null;
 }
 waypoint(from,target,owner,now,minY=RADIUS){
  if(!this.state||!owner||typeof owner!=='object'||!finite(target)||!Number.isFinite(now)||!Number.isFinite(minY)
   ||!this.valid(from,minY))return null;
  this.refresh(minY);
  if(this.valid(target,minY)&&this.state.clearLine(from,target,RADIUS))return {x:target.x,y:target.y};
  let route=this.routes.get(owner);
  if(!route||now<route.at||now-route.at>=400||Math.hypot(target.x-route.target.x,target.y-route.target.y)>=CELL*2){
   const start=this.nearest(from,true),end=this.nearest(target,false);
   // Search mutates Grid nodes; never reuse the cached collision grid as search state.
   const points=start&&end?this.finder.findPath(start.x,start.y,end.x,end.y,this.grid.clone()).map(([x,y])=>center(x,y)):[];
   if(points.length&&!this.valid(target,minY)){
    // Player cover clearance is smaller than the chaser body. Finish at legal contact range, not a grid center.
    const last=points[points.length-1];let lo=0,hi=1;
    for(let i=0;i<16;i++){
     const t=(lo+hi)/2,p={x:last.x+(target.x-last.x)*t,y:last.y+(target.y-last.y)*t};
     if(this.valid(p,minY)&&this.state.clearLine(last,p,RADIUS))lo=t;else hi=t;
    }
    if(lo>0)points.push({x:last.x+(target.x-last.x)*lo,y:last.y+(target.y-last.y)*lo});
   }
   route={at:now,target:{x:target.x,y:target.y},points,index:0};this.routes.set(owner,route);
  }
  while(route.index<route.points.length&&Math.hypot(route.points[route.index].x-from.x,route.points[route.index].y-from.y)<=4)route.index++;
  for(let i=Math.min(route.index+5,route.points.length-1);i>=route.index;i--){
   if(this.state.clearLine(from,route.points[i],RADIUS)){route.index=i;return {...route.points[i]};}
  }
  return null;
 }
 destroy(){this.state=null;this.grid=null;this.routes=new WeakMap();}
}
