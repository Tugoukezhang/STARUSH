// Visual-only cable model for the homecoming chapter. Reads gate flags; never decides them.
const edge=(from,to,...coords)=>Object.freeze({id:`harbor-${from}--${to}`,from:`harbor-${from}`,to:`harbor-${to}`,
 points:Object.freeze(coords.map(([x,y])=>Object.freeze({x,y})))});

export const HOMECOMING_CIRCUIT_ROUTES=Object.freeze([
 edge('meeting','west-deck',[500,1630],[500,1510],[240,1510],[240,1450]),
 edge('west-deck','shed',[240,1450],[280,1250]),
 edge('shed','control',[280,1250],[400,1250],[400,1050],[740,1050]),
 edge('control','crossing',[740,1050],[740,1005],[500,1005]),
 edge('crossing','north-entry',[500,1005],[500,850]),
 edge('north-entry','west-relay',[500,850],[400,850],[400,690],[280,690]),
 edge('north-entry','east-relay',[500,850],[600,850],[600,690],[720,690]),
 edge('west-relay','stage-left',[280,690],[190,690],[190,350],[350,350],[350,300]),
 edge('east-relay','stage-left',[720,690],[810,690],[810,270],[350,270],[350,300]),
 edge('stage-left','stage-right',[350,300],[650,300]),
]);

// Order is the contract: zone hides first, completion beats suppression, and locks beat
// suppression because clearing a suppressor would not make a locked destination receivable.
export function getHomecomingCircuitState(route,devices,currentZone){
 const from=devices.find(d=>d.id===route.from),to=devices.find(d=>d.id===route.to);
 if(to.zone>currentZone||!from.complete)return 'dormant';
 if(to.complete)return 'complete';
 if(to.chapterLocked)return 'waiting';
 return to.publicStage1Suppressed?'suppressed':'ready';
}

export function circuitPathLength(points){
 let total=0;
 for(let i=1;i<points.length;i++)total+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
 return total;
}

// A distance exactly on a join takes the incoming segment's heading.
export function sampleCircuitPath(points,distance){
 let remaining=Math.max(0,distance);
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  if(remaining<=length||i===points.length-1){
   const t=Math.min(1,remaining/length);
   return {x:a.x+dx*t,y:a.y+dy*t,angle:Math.atan2(dy,dx)};
  }
  remaining-=length;
 }
}
