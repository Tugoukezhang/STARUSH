import { HOMECOMING_CIRCUIT_ROUTES, getHomecomingCircuitState, circuitPathLength, sampleCircuitPath } from '../utils/homecomingCircuit.mjs';
import { NEON_LINKS } from '../utils/chapterObjectives.mjs';

const cableInk = {
  dormant: [0x717677,.48], waiting: [0xd89c52,.92], ready: [0x329c98,1],
  complete: [0x517f75,.86], suppressed: [0xae724c,.85],
};

function stroke(graphics, points, width, color, alpha) {
  graphics.lineStyle(width,color,alpha).beginPath().moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length;i++) graphics.lineTo(points[i].x,points[i].y);
  graphics.strokePath();
}

function chevron(g, point, extent, width, color, alpha) {
  const dx=Math.cos(point.angle), dy=Math.sin(point.angle);
  const tailX=point.x-dx*extent, tailY=point.y-dy*extent;
  stroke(g,[
    {x:tailX+dy*extent*.7, y:tailY-dx*extent*.7},
    point,
    {x:tailX-dy*extent*.7, y:tailY+dx*extent*.7},
  ],width,color,alpha);
}

export function createShopCircuit(scene, devices) {
  const byId=new Map(devices.map(d=>[d.id,d]));
  const routes=[];
  // The dependency table that permits painting supplies both ends. Keep southern
  // conduits out of the shop footprints and separate the two northern outputs.
  for(const [target,inputs] of Object.entries(NEON_LINKS)){
    const to=byId.get(target);
    if(!to)continue;
    for(const id of inputs){
      const from=byId.get(id);
      if(!from)continue;
      const south=to.zone===0;
      const branchY=south?1170:target.endsWith('left')?493:473;
      const railX=south?(from.x<to.x?420:580):to.x;
      const points=[
        {x:from.x,y:from.y},{x:from.x,y:branchY},{x:railX,y:branchY},
        {x:railX,y:to.y+36},{x:to.x,y:to.y+36},{x:to.x,y:to.y},
      ].filter((p,i,all)=>i===0 || p.x!==all[i-1].x || p.y!==all[i-1].y);
      routes.push({from:id,to:target,points});
    }
  }
  return new HarborCircuitPresentation(scene,routes);
}

export class HarborCircuitPresentation {
  constructor(scene, routes=HOMECOMING_CIRCUIT_ROUTES){
    this.tracks=scene.add.graphics().setDepth(1.2);
    this.flow=scene.add.graphics().setDepth(1.21);
    this.routes=routes.map(route=>({...route,length:circuitPathLength(route.points)}));
    this.signature='';
    this.frozen=false;
    this.motionPreference=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  }

  update(devices,zone,now,running){
    const states=this.routes.map(route=>getHomecomingCircuitState(route,devices,zone));
    const signature=states.join('|');
    if(signature!==this.signature){
      this.signature=signature;
      this.tracks.clear();
      this.routes.forEach((route,i)=>{
        const state=states[i], [color,alpha]=cableInk[state];
        stroke(this.tracks,route.points,7,0x24393b,state==='dormant'?.37:.87);
        stroke(this.tracks,route.points,3.5,color,alpha);
        if(state==='dormant')return;
        // Outlined direction marks stay legible in a still frame or in reduced motion.
        for(let d=Math.min(32,route.length*.4);d<route.length-11;d+=105){
          const p=sampleCircuitPath(route.points,d);
          chevron(this.tracks,p,8,5,0x253c42,.93);
          chevron(this.tracks,p,8,2.5,state==='waiting'?0xffd787:state==='ready'?0xcffff0:0xb2c7b7,.96);
        }
      });
    }
    this.flow.clear();
    if(!running || this.frozen || this.motionPreference?.matches)return;
    this.routes.forEach((route,i)=>{
      if(states[i]!=='ready')return;
      for(let d=(now*.09)%140;d<route.length;d+=140){
        const p=sampleCircuitPath(route.points,d);
        chevron(this.flow,p,10,6,0x25595a,.88);
        chevron(this.flow,p,10,3,0xe3fff0,1);
      }
    });
  }

  freeze(){this.frozen=true;this.flow.clear();}
  destroy(){this.tracks.destroy();this.flow.destroy();}
}
