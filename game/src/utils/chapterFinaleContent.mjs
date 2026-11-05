import {getChapterContent} from './publicChapterContent.mjs';
const PATTERNS=new Set(['captured-line','momentum-cutoff','momentum-vector']);
const finale=id=>(getChapterContent(id)||getChapterContent('opening')).performanceFinale;
export const getChapterFinalePatterns=id=>finale(id).patterns;
export const getChapterFinaleSummary=id=>finale(id).summary;
export function getCompletedFinaleMotion(player,frameDeltaMs){
 if(player?.active!==true||player.body?.enable!==true||!Number.isFinite(frameDeltaMs)||frameDeltaMs<=0)return {x:0,y:0};
 const read=method=>{const delta=typeof player.body[method]==='function'?player.body[method]():0;const velocity=delta/(frameDeltaMs/1000);return Number.isFinite(velocity)?velocity:0;};
 return {x:read('deltaXFinal'),y:read('deltaYFinal')};
}
export function resolveChapterFinalePlan({pattern,origin,player,motion,windupMs,speed,width,height}={}){
 if(!PATTERNS.has(pattern)||![origin?.x,origin?.y,player?.x,player?.y,windupMs,speed,width,height].every(Number.isFinite)
  ||speed<=0||windupMs<0||width<28||height<28||origin.x<0||origin.x>width||origin.y<0||origin.y>height
  ||player.x<0||player.x>width||player.y<0||player.y>height)return null;
 const seconds=windupMs/1000+Math.hypot(player.x-origin.x,player.y-origin.y)/speed;
 const vx=Number.isFinite(motion?.x)?motion.x:0,vy=Number.isFinite(motion?.y)?motion.y:0;
 const clamp=(value,max)=>Math.max(14,Math.min(max-14,value));
 return Object.freeze({pattern,origin:Object.freeze({x:origin.x,y:origin.y}),playerAtCapture:Object.freeze({x:player.x,y:player.y}),
  motion:Object.freeze({x:vx,y:vy}),projectionSeconds:seconds,
  capture:Object.freeze({capturedX:clamp(player.x+(pattern==='captured-line'?0:vx*seconds),width),
   capturedY:clamp(player.y+(pattern==='momentum-vector'?vy*seconds:0),height)})});
}
export function getFinaleResponseSummary(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>3||rows.some((r,i)=>r?.index!==i||!PATTERNS.has(r.pattern)||!['hit','evaded'].includes(r.outcome)
  ||(r.travelMode!==undefined&&r.travelMode!=='return')))return null;
 const contacts=rows.filter(r=>r.outcome==='hit').length;
 const labels={'captured-line':'定点锁定','momentum-cutoff':'横向预判','momentum-vector':'二维预判'};
 return {resolved:rows.length,contacts,uncontacted:rows.length-contacts,
  beats:rows.map(r=>({index:r.index,label:labels[r.pattern]+(r.travelMode==='return'?' · 折返':''),outcome:r.outcome,description:r.outcome==='hit'?'记录到弹体接触':'未记录弹体接触'}))};
}

export function resolveFinaleReturnPath({chapterId,attackIndex,origin,capture,speed,lifetimeMs,width,height,clearLine}={}){
 if(!((chapterId==='neon'&&attackIndex===2)||(chapterId==='encore'&&(attackIndex===0||attackIndex===2)))
  ||![origin?.x,origin?.y,capture?.capturedX,capture?.capturedY,speed,lifetimeMs,width,height].every(Number.isFinite)
  ||speed<=0||lifetimeMs<=100||width<28||height<28||typeof clearLine!=='function')return null;
 const dx=capture.capturedX-origin.x,dy=capture.capturedY-origin.y,span=Math.hypot(dx,dy);
 if(span<1)return null;
 const length=span+80,unit={x:dx/span,y:dy/span},end={x:origin.x+unit.x*length,y:origin.y+unit.y*length};
 const durationMs=2*length/speed*1000;
 if(durationMs+100>lifetimeMs||[origin,end].some(p=>p.x<7||p.y<7||p.x>width-7||p.y>height-7))return null;
 try{if(clearLine(origin,end,7)!==true)return null;}catch{return null;}
 return Object.freeze({origin:Object.freeze({x:origin.x,y:origin.y}),end:Object.freeze(end),
  unit:Object.freeze(unit),length,speed,durationMs});
}

export function stepFinaleReturnPath(path,distance,leg,seconds){
 if(!path||!['outbound','return'].includes(leg)||![distance,seconds].every(Number.isFinite)||distance<0||seconds<0)return null;
 const next=Math.min(path.length,distance+path.speed*seconds),along=leg==='return'?path.length-next:next;
 return {distance:next,x:path.origin.x+path.unit.x*along,y:path.origin.y+path.unit.y*along,atEnd:next===path.length};
}
