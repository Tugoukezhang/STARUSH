import {mountHomePortraitCanvas} from './HomePortraitCanvas.mjs';
const BASE='art/home-portrait-demo-20261022/';
const RIFLE=Object.freeze({kind:'layered-demo',width:853,height:1280,layers:Object.freeze([
 {id:'body',x:38,y:8,width:800,height:1259},
 {id:'hair',x:7,y:324,width:208,height:434},
 {id:'tail',x:575,y:227,width:146,height:69},
 {id:'blink',x:330,y:65,width:230,height:200},
].map(row=>Object.freeze({...row,src:BASE+'sakura-'+row.id+'.webp'})))});

export function getHomePortraitArt(id){return id==='sakura'?RIFLE:null;}

// The layered menu demo shares rifle art with the roster, never battle textures.
export function mountHomePortrait(view,parent,id,fallback,background=null,options={}){
 const art=getHomePortraitArt(id);if(!art)return ()=>{};
 fallback.hidden=true;
 const rig=view.element('span','home-portrait-rig',undefined,parent);if(options.animate===false)rig.dataset.static='true';
 rig.setAttribute('aria-hidden','true');rig.hidden=true;parent.dataset.homePortrait=id;parent.dataset.portraitState='loading';
 const parts=view.element('span','home-portrait-parts',undefined,rig),ready=new Set(),cleanups=[],images=new Map();
 let disposed=false,failed=false,canvas=null;
 const live=()=>!disposed&&!failed&&!view.disposed&&rig.parentNode===parent;
 const fail=()=>{if(!live())return;failed=true;canvas?.destroy();rig.remove();fallback.hidden=false;parent.dataset.portraitState='unavailable';};
 const listen=(target,event,fn)=>{target.addEventListener(event,fn);cleanups.push(()=>target.removeEventListener(event,fn));};
 const motion=()=>{rig.dataset.motion=view.doc.hidden?'paused':'running';canvas?.sync();};motion();listen(view.doc,'visibilitychange',motion);
 const reset=()=>{rig.style.setProperty('--portrait-look-x','0');rig.style.setProperty('--portrait-look-y','0');};reset();
 listen(parent,'pointermove',event=>{
  if(disposed||failed||view.doc.hidden)return;
  const box=parent.getBoundingClientRect(),clamp=n=>Math.max(-1,Math.min(1,n));
  if(box.width<=0||box.height<=0)return;
  rig.style.setProperty('--portrait-look-x',String(clamp((event.clientX-box.left)/box.width*2-1)));
  rig.style.setProperty('--portrait-look-y',String(clamp((event.clientY-box.top)/box.height*2-1)));
 });listen(parent,'pointerleave',reset);listen(parent,'pointercancel',reset);
 for(const row of art.layers){
  const image=view.element('img','home-portrait-layer',undefined,parts);image.dataset.part=row.id;
  images.set(row.id,image);
  image.alt='';image.setAttribute('aria-hidden','true');image.draggable=false;image.width=row.width;image.height=row.height;image.decoding='async';
  Object.assign(image.style,{left:row.x/art.width*100+'%',top:row.y/art.height*100+'%',width:row.width/art.width*100+'%',height:row.height/art.height*100+'%'});
  let decodeStarted=false;
  const decoded=()=>{if(!live())return;ready.add(row.id);if(ready.size===art.layers.length){rig.hidden=false;fallback.hidden=true;parent.dataset.portraitState='ready';if(options.animate!==false)canvas=mountHomePortraitCanvas(view,rig,art,images,background);}};
  const loaded=()=>{
   if(!live()||decodeStarted)return;decodeStarted=true;
   if(image.naturalWidth>0&&(image.naturalWidth!==row.width||image.naturalHeight!==row.height)){fail();return;}
   if(typeof image.decode!=='function'){decoded();return;}
   // An async image's load event can precede paint readiness; reveal the composite atomically.
   try{Promise.resolve(image.decode()).then(decoded,fail);}catch{fail();}
  };
  listen(image,'load',loaded);listen(image,'error',fail);
  image.src=row.src;if(image.complete&&image.naturalWidth>0)loaded();
 }
 return ()=>{if(disposed)return;disposed=true;canvas?.destroy();cleanups.forEach(fn=>fn());rig.remove();fallback.hidden=false;delete parent.dataset.homePortrait;delete parent.dataset.portraitState;};
}
