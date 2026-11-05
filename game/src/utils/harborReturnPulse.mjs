import {circuitPathLength,sampleCircuitPath} from './homecomingCircuit.mjs';

export class HarborReturnPulse {
  #distance=0;
  #hit=new Set();

  constructor({points,start}){
    this.points=Object.freeze(points.map(({x,y})=>Object.freeze({x,y})));
    this.start=start;this.speed=360;this.radius=28;this.damage=18;this.color=null;
    this.length=circuitPathLength(this.points);
    this.end=start+this.length/this.speed*1000;
    Object.freeze(this);
  }

  get distance(){return this.#distance;}

  sample(now){
    const distance=now>=this.end?this.length:Math.min(this.length,Math.max(0,(now-this.start)*this.speed/1000));
    return {...sampleCircuitPath(this.points,distance),distance,done:distance===this.length};
  }

  advance(now,targets,clearLine){
    const fromDistance=this.#distance,toDistance=Math.max(fromDistance,this.sample(now).distance);
    const segments=[],hits=[],head=sampleCircuitPath(this.points,toDistance),done=toDistance===this.length;
    if(toDistance<=fromDistance)return {segments,hits,head,done};
    // Split the traveled interval at every bend; a single chord would cut corners.
    let walked=0;
    for(let i=1;i<this.points.length;i++){
      const a=this.points[i-1],b=this.points[i],length=Math.hypot(b.x-a.x,b.y-a.y);
      const low=Math.max(fromDistance,walked),high=Math.min(toDistance,walked+length);
      if(high>low){
        const from=sampleCircuitPath(this.points,low),to=sampleCircuitPath(this.points,high);
        segments.push({from:{x:from.x,y:from.y},to:{x:to.x,y:to.y}});
      }
      walked+=length;
      if(walked>=toDistance)break;
    }
    this.#distance=toDistance;
    for(const target of targets){
      if(this.#hit.has(target))continue;
      for(const {from,to} of segments){
        const dx=to.x-from.x,dy=to.y-from.y,lengthSquared=dx*dx+dy*dy;
        const t=Math.max(0,Math.min(1,((target.x-from.x)*dx+(target.y-from.y)*dy)/lengthSquared));
        const nearest={x:from.x+dx*t,y:from.y+dy*t};
        if(Math.hypot(target.x-nearest.x,target.y-nearest.y)>this.radius||!clearLine(nearest,target))continue;
        this.#hit.add(target);hits.push(target);break;
      }
    }
    return {segments,hits,head,done};
  }
}
