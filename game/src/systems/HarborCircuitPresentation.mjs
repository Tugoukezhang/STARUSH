import {HOMECOMING_CIRCUIT_ROUTES,getHomecomingCircuitState,circuitPathLength,sampleCircuitPath} from '../utils/homecomingCircuit.mjs';

const INK={dormant:[0x526669,.35],waiting:[0xc78d47,.65],ready:[0x40b6b1,.9],complete:[0x469d93,.65],suppressed:[0xd58b55,.85]};
function stroke(gfx,points,width,color,alpha){
 gfx.lineStyle(width,color,alpha).beginPath().moveTo(points[0].x,points[0].y);
 for(let i=1;i<points.length;i++)gfx.lineTo(points[i].x,points[i].y);
 gfx.strokePath();
}

export class HarborCircuitPresentation{
 constructor(scene){
  this.tracks=scene.add.graphics().setDepth(1.2);this.flow=scene.add.graphics().setDepth(1.21);
  this.routes=HOMECOMING_CIRCUIT_ROUTES.map(route=>({...route,length:circuitPathLength(route.points)}));
  this.signature='';this.frozen=false;
 }
 update(devices,zone,now,running){
  const states=this.routes.map(route=>getHomecomingCircuitState(route,devices,zone)),signature=states.join('|');
  if(signature!==this.signature){
   this.signature=signature;this.tracks.clear();
   for(let i=0;i<this.routes.length;i++){
    const points=this.routes[i].points,[color,alpha]=INK[states[i]];
    stroke(this.tracks,points,9,0x163334,.18);stroke(this.tracks,points,5,0x223b3d,.8);stroke(this.tracks,points,2.5,color,alpha);
   }
  }
  this.flow.clear();if(!running||this.frozen)return;
  for(let i=0;i<this.routes.length;i++){
   if(states[i]!=='ready')continue;
   const route=this.routes[i],phase=(now*.09)%140;
   for(let distance=phase;distance<route.length;distance+=140){
    const points=[];for(let step=0;step<=20;step+=5)points.push(sampleCircuitPath(route.points,Math.min(route.length,distance+step)));
    stroke(this.flow,points,7,0x52e0cd,.16);stroke(this.flow,points,2.5,0xd2fff0,.95);
   }
  }
 }
 freeze(){this.frozen=true;this.flow.clear();}
 destroy(){this.tracks.destroy();this.flow.destroy();}
}
