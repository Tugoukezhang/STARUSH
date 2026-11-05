const TAU=Math.PI*2;
const clamp=n=>Number.isFinite(n)?Math.max(-1,Math.min(1,n)):0;

export function homePortraitPose(time,look={},reduced=false){
 const t=Number.isFinite(time)?Math.max(0,time):0,phase=t%6400/6400;
 return reduced?{breath:0,hair:0,tail:0,lookX:0,lookY:0,blink:false}:{
  breath:8*(1-Math.cos(t*TAU/4200))/2,hair:Math.sin(t*TAU/5600)*1.8*Math.PI/180,
  tail:Math.sin(t*TAU/4800)*4.5*Math.PI/180,lookX:clamp(look.x),lookY:clamp(look.y),
  blink:phase>=.75&&phase<.765||phase>=.979&&phase<.992,
 };
}

export function applyPortraitReaction(pose,age,area,reduced=false){
 if(reduced||!Number.isFinite(age)||age<0||age>=900)return pose;
 const phase=age/900,pulse=Math.sin(Math.PI*phase)**2;
 return {...pose,breath:pose.breath+3*pulse,acknowledge:pulse*(area==='head'?1:-.65),blink:pose.blink||area==='head'&&age<140};
}

export function drawHomePortraitFrame(ctx,art,images,pose,width,height){
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);
 ctx.setTransform(width/art.width,0,0,height/art.height,0,0);
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 const warp=y=>y<=240||y>=650?0:-pose.breath*Math.sin((y-240)*Math.PI/410)**2;
 for(const row of art.layers){
  if(row.id==='blink'&&!pose.blink)continue;
  const image=images.get(row.id);
  if(row.id==='body'&&pose.breath>0){
   // Contiguous source strips keep the face and lower body exactly registered.
   const cuts=[0,...[240,280,320,360,400,440,480,520,560,600,650].map(y=>y-row.y),row.height];
   for(let i=1;i<cuts.length;i++){
    const a=cuts[i-1],b=cuts[i],top=row.y+a+warp(row.y+a),bottom=row.y+b+warp(row.y+b);
    ctx.drawImage(image,0,a,row.width,b-a,row.x,top,row.width,bottom-top);
   }
  }else if(row.id==='hair'||row.id==='tail'){
   const hair=row.id==='hair',px=row.x+(hair?row.width:0),py=row.y+(hair?0:row.height*.64);
   ctx.save();ctx.translate(px+pose.lookX*(hair?-1.2:.85),py+(hair?warp(row.y):pose.lookY*.55));
   ctx.rotate((hair?pose.hair:pose.tail)+(pose.acknowledge||0)*(hair?.035:.06));ctx.drawImage(image,row.x-px,row.y-py,row.width,row.height);ctx.restore();
  }else ctx.drawImage(image,row.x,row.y,row.width,row.height);
 }
}

export function mountHomePortraitCanvas(view,rig,art,images,background=null,renderer={}){
 const win=view.doc.defaultView;
 if(typeof win?.requestAnimationFrame!=='function')return null;
 const canvas=view.element('canvas','home-portrait-canvas',undefined,rig);
 canvas.setAttribute('aria-hidden','true');
 let ctx;try{ctx=canvas.getContext?.('2d',{alpha:true});}catch{ctx=null;}
 if(!ctx){canvas.remove();return null;}
 const media=win.matchMedia?.('(prefers-reduced-motion: reduce)');
 const originalBackgroundTransform=background?.style.transform||'';
 let disposed=false,raf=null,lastStamp=null,elapsed=0,paintedAt=0,dirtySize=true,observer,reactionSequence='',reactionAt=-Infinity;
 const cancel=()=>{if(raf!==null)win.cancelAnimationFrame(raf);raf=null;lastStamp=null;};
 const destroy=()=>{
  if(disposed)return;disposed=true;cancel();observer?.disconnect();
  media?.removeEventListener?.('change',sync);win.removeEventListener?.('resize',resize);
  canvas.removeEventListener('contextlost',destroy);
  canvas.remove();canvas.width=canvas.height=0;delete rig.dataset.renderer;
  if(background)background.style.transform=originalBackgroundTransform;
  renderer.onUnavailable?.();
 };
 const paint=()=>{
  if(disposed)return false;
  try{
   if(dirtySize){
    const box=rig.getBoundingClientRect(),dpr=2;
    if(!(box.width>0&&box.height>0))return false;
    const scale=Math.min(dpr,art.width/box.width,art.height/box.height);
    const width=Math.max(1,Math.min(art.width,Math.round(box.width*scale))),height=Math.max(1,Math.min(art.height,Math.round(box.height*scale)));
    if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;dirtySize=false;
   }
   const read=name=>Number.parseFloat(rig.style.getPropertyValue?.(name)??rig.style[name])||0;
   const reduced=media?.matches===true,idle=homePortraitPose(elapsed,{x:read('--portrait-look-x'),y:read('--portrait-look-y')},reduced);
   const sequence=rig.dataset.reactionSequence||'';
   if(sequence!==reactionSequence){reactionSequence=sequence;reactionAt=elapsed;}
   const reactionAge=sequence?elapsed-reactionAt:-1,basePose=sequence?applyPortraitReaction(idle,reactionAge,rig.dataset.reaction,reduced):idle;
   const pose=renderer.poseFrame?renderer.poseFrame(basePose,{elapsed,reactionAge,area:rig.dataset.reaction,reduced}):basePose;
   (renderer.drawFrame||drawHomePortraitFrame)(ctx,art,images,pose,canvas.width,canvas.height);
   // Share the paused/reduced-motion clock; never add another background animation loop.
   if(background){const x=reduced?0:Math.sin(elapsed*TAU/8400)*3.5-pose.lookX*2,y=reduced?0:Math.sin(elapsed*TAU/10600)*2-pose.lookY*1.5;background.style.transform=`translate3d(${x.toFixed(3)}px,${y.toFixed(3)}px,0) scale(1.04)`;}
   return true;
  }catch{destroy();return false;}
 };
 const tick=stamp=>{
  raf=null;if(disposed)return;if(view.disposed){destroy();return;}if(view.doc.hidden||media?.matches)return;
  if(lastStamp!==null)elapsed+=Math.max(0,stamp-lastStamp);lastStamp=stamp;
  if(elapsed-paintedAt>=1000/30){if(!paint())return;paintedAt=elapsed;}
  raf=win.requestAnimationFrame(tick);
 };
 function sync(){
  if(disposed)return;
  if(view.doc.hidden||media?.matches){cancel();if(!view.doc.hidden)paint();return;}
  if(raf===null){paint();raf=win.requestAnimationFrame(tick);}
 }
 function resize(){dirtySize=true;if(!view.doc.hidden)paint();}
 if(!paint()){destroy();return null;}
 rig.dataset.renderer='canvas';
 canvas.addEventListener('contextlost',destroy);
 if(typeof win.ResizeObserver==='function'){observer=new win.ResizeObserver(resize);observer.observe(rig);}
 win.addEventListener?.('resize',resize);media?.addEventListener?.('change',sync);
 if(!view.doc.hidden&&!media?.matches)raf=win.requestAnimationFrame(tick);
 return {sync,destroy};
}
