import {mountHomePortraitCanvas} from './HomePortraitCanvas.mjs';
import {getMenuPortraitExpressionArt,menuPortraitExpressionPose} from './MenuPortraitExpression.mjs';
const ART=Object.freeze(Object.fromEntries(['kai','enjo'].map(id=>[id,Object.freeze({id,width:1152,height:1664,expression:'authored-blink-smile',eyes:null})])));
export function getMenuPortraitMotionArt(id){return Object.hasOwn(ART,id)?ART[id]:null;}
export function menuPortraitFacePose(id,pose,context){return menuPortraitExpressionPose(pose,context);}
const finite=n=>Number.isFinite(n)?n:0,unit=n=>Math.max(-1,Math.min(1,finite(n))),bell=(x,y,cx,cy,rx,ry)=>Math.exp(-(((x-cx)/rx)**2+((y-cy)/ry)**2));
export function menuPortraitPoint(id,x,y,pose){
 const b=Math.max(0,Math.min(11,finite(pose.breath))),h=unit(finite(pose.hair)/.0315),t=unit(finite(pose.tail)/.079),look=unit(pose.lookX),ack=unit(pose.acknowledge);let dx=0,dy=0;
 if(id==='kai'){
  if(y<=474||y>=1350||x<=540||(x<=900&&y>=650))return{x,y};
  const chest=y<650&&x<800?bell(x,y,690,560,90,62):0,coat=x>850&&y>850?bell(x,y,930,1100,110,180):0;
  dx=coat*(h*17+look*3+ack*8);dy=-b*chest+coat*(t*4+ack*3);
 }else if(id==='enjo'){
  if(y<=460||y>=1350||(x>=650&&y<=700)||(x>=450&&x<=600&&y>=590&&y<=760))return{x,y};
  const chest=x>=520&&x<=650&&y<=590?bell(x,y,610,540,80,55):0,left=x<350&&y>=760?bell(x,y,240,950,120,180):0,right=x>900&&y>=850?bell(x,y,980,1060,90,150):0;
  dx=(left-right)*(h*19+look*3+ack*9);dy=-b*chest+(left+right)*(t*3+ack*3);
 }
 return{x:x+dx,y:y+dy};
}
const XS=[0,144,240,350,450,520,540,580,610,650,690,800,850,900,930,980,1088,1152],YS=[0,164,300,460,474,480,540,560,590,600,650,700,760,850,950,1100,1230,1350,1536,1664];
// One bounded original-pixel surface. Face/hands/blade/feet are pinned, not whole-image sway.
function triangle(ctx,image,s,d,padding){
 const [a,b,c]=s,[p,q,r]=d,den=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);
 const A=((q.x-p.x)*(c.y-a.y)-(r.x-p.x)*(b.y-a.y))/den,C=((r.x-p.x)*(b.x-a.x)-(q.x-p.x)*(c.x-a.x))/den,
 B=((q.y-p.y)*(c.y-a.y)-(r.y-p.y)*(b.y-a.y))/den,D=((r.y-p.y)*(b.x-a.x)-(q.y-p.y)*(c.x-a.x))/den;
 ctx.save();ctx.beginPath();const cx=(p.x+q.x+r.x)/3,cy=(p.y+q.y+r.y)/3;
 for(const[v,i]of d.map((v,i)=>[v,i])){const n=Math.hypot(v.x-cx,v.y-cy)||1,x=v.x+(v.x-cx)/n*padding,y=v.y+(v.y-cy)/n*padding;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.closePath();ctx.clip();ctx.transform(A,B,C,D,p.x-A*a.x-C*a.y,p.y-B*a.x-D*a.y);
 const left=Math.min(...s.map(v=>v.x)),top=Math.min(...s.map(v=>v.y)),width=Math.max(...s.map(v=>v.x))-left,height=Math.max(...s.map(v=>v.y))-top;
 ctx.drawImage(image,left,top,width,height,left,top,width,height);ctx.restore();
}
export function drawMenuPortraitFrame(ctx,art,images,pose,width,height){
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);const scale=Math.min(width/art.width,height/art.height);
 ctx.setTransform(scale,0,0,scale,(width-art.width*scale)/2,(height-art.height*scale)/2);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 const body=images.get('body'),active=[pose.breath,pose.hair,pose.tail,pose.lookX,pose.lookY,pose.acknowledge].some(v=>Number.isFinite(v)&&v!==0);
 ctx.drawImage(body,0,0);
 if(active){
  const mapped=YS.map(y=>XS.map(x=>({source:{x,y},target:menuPortraitPoint(art.id,x,y,pose)}))),moving=[];
  for(let y=1;y<YS.length;y++)for(let x=1;x<XS.length;x++){
   const a=mapped[y-1][x-1],b=mapped[y-1][x],c=mapped[y][x],d=mapped[y][x-1];
   for(const vertices of[[a,b,c],[a,c,d]])if(vertices.some(v=>Math.abs(v.source.x-v.target.x)+Math.abs(v.source.y-v.target.y)>1e-6))moving.push(vertices);
  }
  // Remove the moving source regions as one union before drawing their deformed replacements.
  if(moving.length){ctx.save();ctx.beginPath();for(const vertices of moving){vertices.forEach((v,i)=>{if(i)ctx.lineTo(v.source.x,v.source.y);else ctx.moveTo(v.source.x,v.source.y);});ctx.closePath();}ctx.clip();ctx.clearRect(0,0,art.width,art.height);ctx.restore();for(const vertices of moving)triangle(ctx,body,vertices.map(v=>v.source),vertices.map(v=>v.target),2/scale);}
 }
 const face=getMenuPortraitExpressionArt(art.id);
 if(pose.eyelid===1)ctx.drawImage(images.get('blink'),face.x,face.y,face.width,face.height);
 if(pose.smileOpacity>0){ctx.save();ctx.globalAlpha=pose.smileOpacity;ctx.drawImage(images.get('smile'),face.x,face.y,face.width,face.height);ctx.restore();}
}
export function mountMenuPortraitMotion(view,parent,id,body,background){
 const art=getMenuPortraitMotionArt(id),win=view.doc.defaultView;if(!art||typeof win?.requestAnimationFrame!=='function')return()=>{};
 const rig=view.element('span','menu-portrait-motion',undefined,parent);rig.hidden=true;rig.setAttribute('aria-hidden','true');rig.dataset.expression=art.expression;parent.dataset.menuMotionState='loading';
 const status=view.element('span','menu-portrait-error','\u8868\u60c5\u8d44\u6e90\u52a0\u8f7d\u5931\u8d25',parent);status.hidden=true;status.setAttribute('role','status');
 Object.assign(status.style,{position:'absolute',left:'8px',right:'8px',bottom:'8px',zIndex:'1',background:'#fff',color:'#8a1839',fontSize:'12px',padding:'4px',pointerEvents:'none'});
 let disposed=false,failed=false,controller=null;const cleanups=[],live=()=>!disposed&&!failed&&!view.disposed&&body.parentNode===parent&&rig.parentNode===parent;
 const listen=(target,event,fn)=>{target.addEventListener(event,fn);cleanups.push(()=>target.removeEventListener(event,fn));};
 const unavailable=()=>{if(!live())return;failed=true;const previous=controller;controller=null;previous?.destroy();cleanups.forEach(fn=>fn());body.hidden=false;rig.hidden=true;status.hidden=false;parent.dataset.menuMotionState='error';};
 const sync=()=>{rig.dataset.motion=view.doc.hidden?'paused':'running';controller?.sync();};listen(view.doc,'visibilitychange',sync);
 const reset=()=>{rig.style.setProperty('--portrait-look-x','0');rig.style.setProperty('--portrait-look-y','0');};reset();
 listen(parent,'pointermove',event=>{if(!live()||view.doc.hidden)return;const b=parent.getBoundingClientRect();if(b.width>0)rig.style.setProperty('--portrait-look-x',String(unit((event.clientX-b.left)/b.width*2-1)));});listen(parent,'pointerleave',reset);listen(parent,'pointercancel',reset);
 const face=getMenuPortraitExpressionArt(id),images=new Map([['body',body]]);
 const ready=()=>{
  if(!live()||images.size!==3)return;
  rig.hidden=false;controller=mountHomePortraitCanvas(view,rig,art,images,background,{poseFrame:(pose,context)=>menuPortraitFacePose(id,pose,context),drawFrame:drawMenuPortraitFrame,onUnavailable:unavailable});
  if(controller&&!failed){body.hidden=true;parent.dataset.menuMotionState='ready';rig.dataset.motion=view.doc.hidden?'paused':'running';}else unavailable();
 };
 for(const key of ['blink','smile']){
  const image=view.element('img','menu-expression-source',undefined,rig);image.hidden=true;image.alt='';image.setAttribute('aria-hidden','true');image.draggable=false;image.width=face.width;image.height=face.height;image.decoding='async';
  let started=false;
  const load=()=>{
   if(!live()||started)return;started=true;
   if(image.naturalWidth!==face.width||image.naturalHeight!==face.height||typeof image.decode!=='function'){unavailable();return;}
   // Decode is external IO; its rejection fails this set, never substitutes old art.
   Promise.resolve().then(()=>image.decode()).then(()=>{if(!live())return;images.set(key,image);ready();},unavailable);
  };
  listen(image,'load',load);listen(image,'error',unavailable);image.src=face[key];if(image.complete&&image.naturalWidth>0)load();
 }
 return()=>{if(disposed)return;disposed=true;controller?.destroy();cleanups.forEach(fn=>fn());rig.remove();status.remove();body.hidden=false;delete parent.dataset.menuMotionState;};
}
