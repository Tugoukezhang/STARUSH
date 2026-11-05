import {nativeWorldMatrices} from './sakuraNativePose.mjs';
import {solveEqualLengthLeg} from './sakuraRefinedMotion.mjs';
const ease=t=>t*t*(3-2*t),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const REFINED_CONTACT_CYCLE=64;
export class WorldContactPlanner {
 constructor(){this.travel=0;this.feet={};this.serial=0;this.vector={x:0,y:0};this.wasMoving=false;this.hipY=null;}
 apply(layer,rig,{x,y,dx,dy,clock,weight,scale}){
  const step=Math.hypot(dx,dy),moving=step>.001;
  if(step>40){this.feet={};this.travel=0;}
  if(moving){this.travel+=step;this.vector={x:dx/step,y:dy/step};}
  // Reserve reach while moving; idle must not inherit a permanent crouch.
  layer.pose.bones[1][1]+=12*weight;
  if(!moving&&this.wasMoving&&this.hipY!==null)layer.pose.bones[1][1]=this.hipY;
  this.hipY=layer.pose.bones[1][1];
  const ground=y+26,toWorld=m=>({x:x+(m[4]-layer.rootTravel-160)*scale,y:ground+(m[5]-333)*scale});
  const metadata={};
  for(const [side,index,offset]of [['R',10,0],['L',13,.5]]){
   let world=nativeWorldMatrices(rig,layer.pose);const hip=toWorld(world[index]),max=(2*rig.legLength-.002)*scale;
   const reachable=p=>distance(p,hip)<=2*rig.legLength*scale+1e-7&&p.y>=hip.y+5;
   const project=p=>{
    const q={...p};q.y=Math.max(q.y,hip.y+5);const d=distance(q,hip);
    if(d>max){q.x=hip.x+(q.x-hip.x)*max/d;q.y=hip.y+(q.y-hip.y)*max/d;}return q;
   };
   const phase=(this.travel/REFINED_CONTACT_CYCLE+offset)%1;
   const base={x:x+rig.rest[index][0]*scale,y:ground};
   const lead=moving?{x:this.vector.x*4,y:this.vector.y*(this.vector.y<0?9:2)}:{x:0,y:0};
   const goal=project({x:base.x+lead.x,y:base.y+lead.y});
   let foot=this.feet[side];
   if(!foot)foot=this.feet[side]={state:'stance',anchor:project(base),actual:project(base),phase,id:++this.serial};
   if(!moving&&this.wasMoving&&foot.state==='swing'){foot.start={...foot.actual};foot.liftAt=clock;}
   const entered=phase<.25&&foot.phase>=.25;
   if(foot.state==='stance'&&(!reachable(foot.anchor)||(moving&&phase>=.25))){
    foot.state='swing';foot.start={...foot.actual};foot.liftAt=clock;foot.reason=reachable(foot.anchor)?'cycle-lift':'reach-lift';
   }
   if(foot.state==='swing'){
    const t=moving?clamp((phase-.25)/.75,0,1):clamp((clock-foot.liftAt)/140,0,1);
    const q=project({x:foot.start.x+(goal.x-foot.start.x)*ease(t),y:foot.start.y+(goal.y-foot.start.y)*ease(t)-Math.sin(t*Math.PI)*1.5});
    foot.actual=q;
    if((moving&&entered)||(!moving&&t===1)){
     foot.state='stance';foot.anchor={...goal};foot.actual={...goal};foot.id=++this.serial;foot.reason='plant';
    }
   }else foot.actual={...foot.anchor};
   const target=[160+layer.rootTravel+(foot.actual.x-x)/scale,333+(foot.actual.y-ground)/scale];
   const bend=layer.direction.includes('left')?1:layer.direction.includes('right')?-1:side==='R'?1:-1;
   const angles=solveEqualLengthLeg(target[0]-world[index][4],target[1]-world[index][5],bend,rig.legLength);
   for(let j=0;j<3;j++)layer.pose.bones[index+j][2]=angles[j];
   const lateral=layer.direction.includes('left')||layer.direction.includes('right');
   const swing=clamp((phase-.25)/.75,0,1);
   const roll=foot.state==='swing'&&lateral?(layer.direction.includes('left')?-1:1)
    *(12*Math.sin(swing*Math.PI)-14*Math.sin(swing*2*Math.PI))*Math.PI/180*weight:0;
   layer.pose.bones[index+2][2]+=roll;
   world=nativeWorldMatrices(rig,layer.pose);const actual=toWorld(world[index+2]);
   metadata[side]={state:foot.state,id:foot.id,anchor:{...foot.anchor},actual,error:distance(actual,foot.actual),phase,reason:foot.reason||'initial'};
   foot.actual=actual;foot.phase=phase;
   layer.feet[side]={...layer.feet[side],stance:foot.state==='stance',world:world[index+2].slice(4,6),targetError:metadata[side].error/scale};
  }
  this.wasMoving=moving;layer.world=nativeWorldMatrices(rig,layer.pose);return metadata;
 }
}

