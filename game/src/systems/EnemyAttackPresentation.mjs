import {canEnemyBePublicStage1PaintTarget} from './PublicStage1EnemyRoles.mjs';

const DANGER = 0xD84961;
const INK = 0x302A38;
const OPEN = 0x77D6C3;

export function resolveCapturedAttackPath({origin,capture,distance,width,height,clearLine} = {}) {
  if (![origin?.x,origin?.y,capture?.capturedX,capture?.capturedY,distance,width,height].every(Number.isFinite)
    || distance<=0 || width<=0 || height<=0
    || origin.x<0 || origin.y<0 || origin.x>width || origin.y>height) return null;
  const dx=capture.capturedX-origin.x,dy=capture.capturedY-origin.y,span=Math.hypot(dx,dy);
  const unit={x:span?dx/span:0,y:span?dy/span:0};
  let limit=span?distance:0;
  for (const [value,direction,max] of [[origin.x,unit.x,width],[origin.y,unit.y,height]]) {
    if (direction>0) limit=Math.min(limit,(max-value)/direction);
    if (direction<0) limit=Math.min(limit,-value/direction);
  }
  const point=t=>({x:origin.x+unit.x*t,y:origin.y+unit.y*t});
  let length=limit;
  // Match the existing projectile's 4px cover query, not its 7px player hit radius.
  if (clearLine) for (let t=0;t<limit;t+=8) {
    const next=Math.min(limit,t+8);
    if (clearLine(point(t),point(next),4)!==false) continue;
    let low=t,high=next;
    for (let i=0;i<10;i++) {
      const mid=(low+high)/2;
      if (clearLine(point(t),point(mid),4)===false) high=mid;else low=mid;
    }
    length=low;break;
  }
  return {origin:{x:origin.x,y:origin.y},end:point(length),unit,length,radius:7};
}

export function resolveOffscreenAttackSource(path,view) {
  if (!path || !view || ![view.x,view.y,view.width,view.height].every(Number.isFinite)
    || view.width<20 || view.height<20 || path.length<=0) return null;
  const {origin,unit,length}=path;
  if (origin.x>=view.x&&origin.x<=view.x+view.width&&origin.y>=view.y&&origin.y<=view.y+view.height) return null;
  let enter=0,exit=length;
  for (const [value,direction,min,size] of [[origin.x,unit.x,view.x,view.width],[origin.y,unit.y,view.y,view.height]]) {
    if (direction===0) {if(value<min||value>min+size)return null;continue;}
    const a=(min-value)/direction,b=(min+size-value)/direction;
    enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
  }
  if (enter>=exit) return null;
  const at=enter+Math.min(12,(exit-enter)/2);
  return {x:Math.max(view.x+9,Math.min(view.x+view.width-9,origin.x+unit.x*at)),
    y:Math.max(view.y+9,Math.min(view.y+view.height-9,origin.y+unit.y*at)),direction:{x:-unit.x||0,y:-unit.y||0}};
}

export function resolveAttackCueSpans(path,exclusion=null,startDistance=0) {
  if(!path)return [];
  const from=Number.isFinite(startDistance)?Math.max(0,Math.min(path.length,startDistance)):0;
  const full=from<path.length||path.length===0?[[from,path.length]]:[];
  if(!full.length)return full;
  if(!exclusion||![exclusion.x,exclusion.y,exclusion.right,exclusion.bottom].every(Number.isFinite)
    ||exclusion.x>=exclusion.right||exclusion.y>=exclusion.bottom||path.length<1)return full;
  // Expand only for this corridor's half-width and its outer stroke, never its physics.
  const padding=path.radius+2;
  let enter=0,exit=path.length;
  for(const [value,direction,min,max]of [[path.origin.x,path.unit.x,exclusion.x-padding,exclusion.right+padding],
    [path.origin.y,path.unit.y,exclusion.y-padding,exclusion.bottom+padding]]){
    if(direction===0){if(value<min||value>max)return full;continue;}
    const a=(min-value)/direction,b=(max-value)/direction;
    enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
  }
  if(enter>=exit)return full;
  const spans=[];
  if(enter>from)spans.push([from,enter]);
  if(exit<path.length)spans.push([Math.max(from,exit),path.length]);
  return spans;
}

export function drawCapturedAttackCue(gfx,path,view=null,exclusion=null,startDistance=0) {
  if (!gfx || !path) return;
  const {origin,end,unit,radius,length}=path,n={x:-unit.y*radius,y:unit.x*radius};
  if(Number.isFinite(startDistance)&&startDistance>0&&startDistance>=length)return;
  // Omit occluded direction glyphs whole; partial arrows imply a false direction.
  const markerVisible=(lines,width)=>!exclusion||lines.every(([x1,y1,x2,y2])=>{
    const distance=Math.hypot(x2-x1,y2-y1);
    if(!distance)return true;
    const segment={origin:{x:x1,y:y1},unit:{x:(x2-x1)/distance,y:(y2-y1)/distance},length:distance,radius:width/2};
    const spans=resolveAttackCueSpans(segment,exclusion);
    return spans.length===1&&spans[0][0]===0&&spans[0][1]===distance;
  });
  if (length<1) {
    gfx.fillStyle(DANGER,0.14);gfx.fillCircle(origin.x,origin.y,radius);
    gfx.lineStyle(2,DANGER,1);
    gfx.lineBetween(origin.x-4,origin.y-4,origin.x+4,origin.y+4);
    gfx.lineBetween(origin.x-4,origin.y+4,origin.x+4,origin.y-4);
    return;
  }
  const spans=resolveAttackCueSpans(path,exclusion,startDistance);
  for(const [start,finish]of spans){
    const a={x:origin.x+unit.x*start,y:origin.y+unit.y*start},b={x:origin.x+unit.x*finish,y:origin.y+unit.y*finish};
    gfx.fillStyle(DANGER,0.14);
    gfx.fillTriangle(a.x+n.x,a.y+n.y,b.x+n.x,b.y+n.y,b.x-n.x,b.y-n.y);
    gfx.fillTriangle(a.x+n.x,a.y+n.y,b.x-n.x,b.y-n.y,a.x-n.x,a.y-n.y);
    for(const [width,color,alpha]of [[3.25,INK,0.82],[1.5,DANGER,0.95]]){
      gfx.lineStyle(width,color,alpha);
      gfx.lineBetween(a.x+n.x,a.y+n.y,b.x+n.x,b.y+n.y);
      gfx.lineBetween(a.x-n.x,a.y-n.y,b.x-n.x,b.y-n.y);
    }
  }
  // World-anchored hatching distinguishes hostile lanes from continuous friendly pigment.
  const inset=Math.max(0,radius-2);
  for(let t=24,count=0;t<length&&count<32;t+=48){
    if(!spans.some(([start,finish])=>t-4>=start&&t+4<=finish))continue;
    const x=origin.x+unit.x*t,y=origin.y+unit.y*t;
    gfx.lineStyle(1.25,INK,0.68);
    gfx.lineBetween(x-unit.x*4-unit.y*inset,y-unit.y*4+unit.x*inset,
      x+unit.x*4+unit.y*inset,y+unit.y*4-unit.x*inset);
    count++;
  }
  // Direction changes only when the real pulse starts its return leg; geometry stays frozen.
  const returning=path.returning&&(path.travelLeg==='return'||path.travelLeg==='origin-contact');
  const direction=returning?-1:1;
  const head=path.returning?6:4,maxBack=path.returning?10:7;
  for (let t=Math.min(18,length);t<=length;t+=72) {
    const at=returning?length-t:t;
    const x=origin.x+unit.x*at,y=origin.y+unit.y*at,back=Math.min(maxBack,t);
    const tail=at-direction*back;
    if(!spans.some(([start,finish])=>Math.min(at,tail)>=start&&Math.max(at,tail)<=finish))continue;
    gfx.lineStyle(t<=18?2.5:1.6,DANGER,t<=18?1:0.8);
    gfx.lineBetween(x-unit.x*direction*back-unit.y*head,y-unit.y*direction*back+unit.x*head,x,y);
    gfx.lineBetween(x-unit.x*direction*back+unit.y*head,y-unit.y*direction*back-unit.x*head,x,y);
  }
  const source=resolveOffscreenAttackSource(path,view);
  if(path.returning){
    // The paired end marks declare a second pass along the same frozen corridor.
    const x=end.x,y=end.y,lines=[];
    for(const sign of [-1,1]){
      const tip={x:x+unit.x*sign*7,y:y+unit.y*sign*7};
      lines.push([tip.x-unit.x*sign*5-unit.y*4,tip.y-unit.y*sign*5+unit.x*4,tip.x,tip.y],
        [tip.x-unit.x*sign*5+unit.y*4,tip.y-unit.y*sign*5-unit.x*4,tip.x,tip.y]);
    }
    if(markerVisible(lines,2.25)){
      gfx.lineStyle(2.25,DANGER,1);
      for(const line of lines)gfx.lineBetween(...line);
    }
  }
  if (source) {
    const {x,y,direction:d}=source;
    const lines=[[x-d.x*5-d.y*5,y-d.y*5+d.x*5,x+d.x*5,y+d.y*5],
      [x-d.x*5+d.y*5,y-d.y*5-d.x*5,x+d.x*5,y+d.y*5]];
    if(markerVisible(lines,4))for (const [width,color] of [[4,INK],[2,DANGER]]) {
      gfx.lineStyle(width,color,1);
      for(const line of lines)gfx.lineBetween(...line);
    }
  }
}

export function drawChaserWindupTiming(gfx,path,ageMs,durationMs,exclusion=null) {
  if(!gfx||!path||![ageMs,durationMs].every(Number.isFinite)||durationMs<=0||ageMs<0||ageMs>=durationMs)return;
  const beat=Math.min(2,Math.floor(ageMs/durationMs*3));
  const {origin,unit}=path;
  const visible=at=>{
    const marker={origin:{x:origin.x+unit.x*(at-7),y:origin.y+unit.y*(at-7)},unit,length:9,radius:9.5};
    const spans=resolveAttackCueSpans(marker,exclusion);
    return spans.length===1&&spans[0][0]===0&&spans[0][1]===9;
  };
  const forward=[18,32,46].filter(at=>at+2<=path.length&&visible(at));
  // A close character may hide the entire lane. Move only the timing glyphs behind the source, never the danger area.
  const marks=forward.length?forward:[-26,-40,-54].filter(visible);
  for(let i=0;i<3;i++){
    const at=marks[i],back=7,wing=7;
    if(at===undefined)continue;
    const x=origin.x+unit.x*at,y=origin.y+unit.y*at;
    for(const [width,color,alpha]of [[5,INK,.95],[2.5,i<=beat?(beat===2?0xFFF0CE:0xF5A65B):DANGER,i<=beat?1:.45]]){
      gfx.lineStyle(width,color,alpha);
      gfx.lineBetween(x-unit.x*back-unit.y*wing,y-unit.y*back+unit.x*wing,x,y);
      gfx.lineBetween(x-unit.x*back+unit.y*wing,y-unit.y*back-unit.x*wing,x,y);
    }
  }
}

export function drawHostilePulse(gfx) {
  if (!gfx) return;
  gfx.lineStyle(3,INK,0.72);gfx.lineBetween(0,9,0,25);
  gfx.lineStyle(1.5,DANGER,0.82);gfx.lineBetween(0,9,0,25);
  gfx.fillStyle(INK,1);gfx.fillCircle(0,0,7);
  gfx.fillStyle(DANGER,1);gfx.fillCircle(0,0,5.5);
  gfx.fillStyle(0xFFFFFF,1);gfx.fillCircle(0,-1,2.5);
}

export function drawChaserRecoveryCue(gfx,{x,y,remainingMs,durationMs}={},exclusion=null){
  if(!gfx||![x,y,remainingMs,durationMs].every(Number.isFinite)||remainingMs<=0||durationMs<=0)return;
  if(exclusion&&x+16>=exclusion.x&&x-16<=exclusion.right&&y-20>=exclusion.y&&y-31<=exclusion.bottom)return;
  const left=x-12,top=y-25,span=24*Math.min(1,remainingMs/durationMs);
  gfx.lineStyle(4,INK,0.95);
  gfx.lineBetween(left,top,x+12,top);
  for(const sign of [-1,1])gfx.lineBetween(x+sign*14,top-4,x+sign*14,top+2);
  gfx.lineStyle(2,OPEN,1);
  for(const sign of [-1,1])gfx.lineBetween(x+sign*14,top-4,x+sign*14,top+2);
  gfx.lineBetween(left,top,left+span,top);
}

export function drawEnemyStateCue(gfx,{role,state,radius,offset=0} = {}) {
  if (!gfx || !Number.isFinite(radius) || role==='unlit-chaser') return;
  const exposed=canEnemyBePublicStage1PaintTarget({active:true,publicStage1EnemyRole:role,publicStage1EnemyState:state});
  if (exposed) {
    const y=offset+radius+4;
    gfx.lineStyle(4,INK,0.8);gfx.lineBetween(offset-12,y,offset+12,y);
    gfx.lineStyle(2.2,OPEN,1);gfx.lineBetween(offset-12,y,offset+12,y);
    gfx.lineBetween(offset-12,y-4,offset-12,y);gfx.lineBetween(offset+12,y-4,offset+12,y);
  } else {
    const y=offset-radius-5;
    gfx.lineStyle(2.5,INK,1);
    gfx.lineBetween(offset-10,y-5,offset-4,y);gfx.lineBetween(offset+10,y-5,offset+4,y);
    gfx.lineStyle(1.5,DANGER,1);
    gfx.lineBetween(offset-10,y-5,offset-4,y);gfx.lineBetween(offset+10,y-5,offset+4,y);
  }
}
