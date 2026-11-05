import {getPortraitBase,portraitBaseVars} from './PortraitBaseRegistration.mjs';
const ART=Object.freeze(Object.fromEntries(['kai','enjo'].map(id=>{const {src,width,height}=getPortraitBase(id);return[id,Object.freeze({src,width,height})];})));
export function getMenuPortraitArt(id){return Object.hasOwn(ART,id)?ART[id]:null;}

// Hit alpha is sampled once into at most MASK_W x MASK_H bytes; the scratch canvas is never shown.
const MASK_W=128,MASK_H=192,OPAQUE=24;
// Head = registered face box plus a restrained margin for hair/ears above and beside it, not a top-third band.
const HEAD_SIDE=.6,HEAD_TOP=1,HEAD_CHIN=.25;
const headRegion=f=>Object.freeze({left:f.x-f.width*HEAD_SIDE,right:f.x+f.width*(1+HEAD_SIDE),top:f.y-f.height*HEAD_TOP,bottom:f.y+f.height*(1+HEAD_CHIN)});

function readAlphaMask(doc,image,width,height){
 const s=Math.min(MASK_W/width,MASK_H/height),w=Math.max(1,Math.min(MASK_W,Math.round(width*s))),h=Math.max(1,Math.min(MASK_H,Math.round(height*s)));
 const canvas=doc.createElement('canvas');canvas.width=w;canvas.height=h;
 try{
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
  ctx.drawImage(image,0,0,w,h);
  const rgba=ctx.getImageData(0,0,w,h).data,alpha=new Uint8Array(w*h);
  for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3];
  return Object.freeze({width:w,height:h,alpha});
 }finally{canvas.width=0;canvas.height=0;}
}

// object-fit:contain, centred: map a client point into source uv, then sample the mask.
function hitArea(mask,head,art,rect,x,y){
 const s=Math.min(rect.width/art.width,rect.height/art.height);if(!(s>0))return null;
 const w=art.width*s,h=art.height*s,u=(x-rect.left-(rect.width-w)/2)/w,v=(y-rect.top-(rect.height-h)/2)/h;
 if(!(u>=0&&v>=0&&u<1&&v<1))return null;
 if(mask.alpha[Math.floor(v*mask.height)*mask.width+Math.floor(u*mask.width)]<OPAQUE)return null;
 return u>=head.left&&u<head.right&&v>=head.top&&v<head.bottom?'head':'body';
}

// B255 source-candidate stills, not actor textures or Cubism models. They are static on purpose:
// no RAF, tween or mask overlay is drawn over these faces.
export function mountMenuPortrait(view,parent,id,fallback,_motionOptions=null){
 const art=getMenuPortraitArt(id);if(!art)return ()=>{};
 const base=getPortraitBase(id),head=headRegion(base.face);
 const fallbackWasHidden=fallback.hidden;fallback.hidden=true;
 // Inline on the mount parent, so they outrank the inherited per-member page constants.
 const vars=Object.entries(portraitBaseVars(base)),prior=vars.map(([k])=>parent.style.getPropertyValue(k));
 for(const[k,v]of vars)parent.style.setProperty(k,v);
 const surface=view.element('div','menu-portrait-surface',undefined,parent);
 const image=view.element('img','menu-portrait-image',undefined,surface);
 image.hidden=true;image.alt='';image.setAttribute('aria-hidden','true');image.draggable=false;
 image.width=art.width;image.height=art.height;image.decoding='async';
 parent.dataset.menuPortrait=id;parent.dataset.menuPortraitState='loading';
 parent.dataset.portraitBase='b255';parent.dataset.portraitMotion='source-static';
 let disposed=false,failed=false,started=false,error=null,mask=null;
 const live=()=>!disposed&&!failed&&!view.disposed&&image.parentNode===surface&&surface.parentNode===parent;
 surface.portraitHitTest=(x,y)=>mask&&live()?hitArea(mask,head,art,image.getBoundingClientRect(),x,y):null;
 // A missing candidate is reported, not disguised with the old Q art. The empty surface stays so
 // interaction can still read the parent's unavailable state.
 const fail=reason=>{if(!live())return;failed=true;mask=null;image.remove();parent.dataset.menuPortraitState='unavailable';parent.dataset.menuPortraitError=reason;
  error=view.element('p','menu-portrait-error','立绘未能载入',parent);error.setAttribute('role','status');};
 const ready=()=>{
  if(!live())return;
  try{mask=readAlphaMask(view.doc,image,art.width,art.height);}catch(error){
   if(error.name!=='SecurityError'&&error.name!=='InvalidStateError')throw error;
   fail('mask');return;
  }
  if(!mask){fail('mask');return;}
  surface.dataset.hitMask=`${mask.width}x${mask.height}`;image.hidden=false;parent.dataset.menuPortraitState='ready';
 };
 const loadError=()=>fail('load');
 const load=()=>{
  if(!live()||started)return;started=true;
  if(image.naturalWidth!==art.width||image.naturalHeight!==art.height){fail('size');return;}
  const failedDecode=error=>{if(error.name!=='EncodingError'&&error.name!=='InvalidStateError')throw error;fail('decode');};
  try{image.decode().then(ready,failedDecode);}catch(error){failedDecode(error);}
 };
 image.addEventListener('load',load);image.addEventListener('error',loadError);
 image.src=art.src;if(image.complete&&image.naturalWidth>0)load();
 return ()=>{if(disposed)return;disposed=true;mask=null;image.removeEventListener('load',load);image.removeEventListener('error',loadError);
  delete surface.portraitHitTest;surface.remove();error?.remove();
  // Leaving the scene: keep Q hidden rather than flashing it under the outgoing page.
  if(!view.navigating&&!view.disposed)fallback.hidden=fallbackWasHidden;
  vars.forEach(([k],i)=>prior[i]?parent.style.setProperty(k,prior[i]):parent.style.removeProperty(k));
  for(const k of ['menuPortrait','menuPortraitState','menuPortraitError','portraitBase','portraitMotion'])delete parent.dataset[k];};
}
