import {getPortraitBase} from './PortraitBaseRegistration.mjs';

// Continuous Kai mesh loaded from its own folder; shares no renderer or art with other portraits.
export function mountKaiContinuousPortrait(view,parent,original){
 original.hidden=true;parent.dataset.portraitState='loading';parent.dataset.homePortrait='kai';
 const rig=view.element('span','home-portrait-rig',undefined,parent),canvas=view.element('canvas','home-portrait-canvas',undefined,rig);
 const {height:h,bounds:b}=getPortraitBase('kai');
 rig.style.aspectRatio='1024 / 1536';rig.style.height=`calc(${h/b.height*100}% - ${8*h/b.height}px)`;rig.style.top=`calc(${-b.y/b.height*100}% + ${8*(1+b.y/b.height)}px)`;
 canvas.style.width='100%';canvas.style.height='100%';rig.style.visibility='hidden';canvas.setAttribute('aria-hidden','true');
 const controller=new AbortController();let disposed=false,failed=false,player=null,errorNode=null;
 // A view being left never reports failure: releasing a renderer can echo a context-loss event.
 const fail=error=>{if(!(error instanceof Error))throw error;if(disposed||failed||view.disposed||view.navigating)return;failed=true;controller.abort();player?.dispose();player=null;parent.dataset.portraitState='unavailable';rig.style.visibility='hidden';errorNode=view.element('span','portrait-load-error','人物动态加载失败',parent);errorNode.setAttribute('role','status');};
 const lost=e=>{e.preventDefault();fail(new Error('Kai portrait WebGL context lost'));};canvas.addEventListener('webglcontextlost',lost);
 import(/* @vite-ignore */ new URL('portraits/kai-287/renderer.js',view.doc.baseURI).href).then(m=>m.createKaiPortrait(canvas,rig,controller.signal)).then(p=>{
  if(disposed||failed||view.disposed||view.navigating){p.dispose();return;}player=p;rig.style.visibility='visible';parent.dataset.portraitState='ready';
 },fail);
 return ()=>{disposed=true;controller.abort();canvas.removeEventListener('webglcontextlost',lost);player?.dispose();rig.remove();errorNode?.remove();delete parent.dataset.portraitState;delete parent.dataset.homePortrait;if(!view.disposed&&!view.navigating)original.hidden=false;};
}
