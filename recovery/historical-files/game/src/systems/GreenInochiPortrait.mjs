// Q85: real green model only on member/preflight pages. The red homepage is independent.
export const GREEN_PORTRAIT=Object.freeze({id:'kai',src:'portraits/green-inochi/fallback.png',width:1086,height:1448});
export function mountGreenInochiPortrait(view,parent,original,options={}) {
  const win=view.doc.defaultView,base=new URL(options.baseUrl||'portraits/green-inochi/',view.doc.baseURI);
  original.src=new URL('fallback.png',base).href;original.width=1086;original.height=1448;
  Object.assign(original.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'contain',transform:'none',maxWidth:'none',maxHeight:'none'});
  const rig=view.element('span','green-inochi-rig',undefined,parent),canvas=view.element('canvas','green-inochi-canvas',undefined,rig);
  Object.assign(rig.style,{position:'absolute',inset:'0',width:'100%',height:'100%',animation:'none',transform:'none',visibility:'hidden'});
  Object.assign(canvas.style,{display:'block',width:'100%',height:'100%',touchAction:'pan-y'});
  Object.assign(parent.style,{position:'relative',width:'100%',height:'100%',maxWidth:'none',maxHeight:'none',transform:'none'});
  parent.dataset.greenModel='inochi2d';parent.dataset.portraitState='loading';rig.dataset.runtime='inochi2d';
  parent.setAttribute('role','button');parent.tabIndex=0;parent.setAttribute('aria-label','与绿色成员互动');canvas.setAttribute('aria-hidden','true');
  const controller=new AbortController(),cleanups=[],reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)');
  let avatar=null,disposed=false,failed=false,errorNode=null,press=null,dragged=false,last=-Infinity;
  const live=()=>!disposed&&!failed&&!view.disposed&&!view.navigating&&rig.parentNode===parent;
  const listen=(node,type,fn)=>{node?.addEventListener(type,fn);cleanups.push(()=>node?.removeEventListener(type,fn))};
  const fail=error=>{if(!live())return;failed=true;controller.abort();avatar?.destroy();rig.style.visibility='hidden';original.hidden=false;parent.dataset.portraitState='unavailable';errorNode=view.element('span','green-portrait-error','动态暂不可用',parent);errorNode.setAttribute('role','status');Object.assign(errorNode.style,{position:'absolute',left:'10px',bottom:'10px',font:'500 12px/18px sans-serif',background:'#163a32e6',color:'#f1fff8',padding:'4px 8px',borderRadius:'4px',pointerEvents:'none',zIndex:'7'});options.onError?.(error)};
  const motion=()=>{if(avatar&&live())avatar.setReducedMotion(!!reduced?.matches||options.animate===false)};listen(reduced,'change',motion);
  listen(parent,'pointermove',event=>{if(!avatar||!live()||reduced?.matches||options.animate===false||(event.pointerType==='touch'&&!event.buttons))return;const b=canvas.getBoundingClientRect();if(b.width&&b.height)avatar.look((event.clientX-b.left)/b.width*2-1,1-(event.clientY-b.top)/b.height*2)});
  listen(parent,'pointerleave',()=>{if(avatar&&live())avatar.look(0,0)});
  const hit=(clientX,clientY)=>{
    if(!avatar||!live())return null;const b=canvas.getBoundingClientRect(),u=(clientX-b.left)/b.width,v=(clientY-b.top)/b.height;if(!(u>=0&&v>=0&&u<1&&v<1))return null;
    avatar.resize();const gl=canvas.getContext('webgl2'),pixel=new Uint8Array(4);gl.readPixels(Math.floor(u*canvas.width),canvas.height-1-Math.floor(v*canvas.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    if(pixel[3]<24)return null;return v<.35?'head':'body';
  };
  rig.portraitHitTest=hit;
  const respond=area=>{if(!avatar||!live()||view.doc.hidden||reduced?.matches||options.animate===false||view.root?.inert)return;const now=win.performance?.now?.()??Date.now();if(now-last<260)return;last=now;avatar.play(area==='head'?'smile':'chime');rig.dataset.response=area;rig.dataset.responseSequence=String((Number(rig.dataset.responseSequence)||0)+1)};
  listen(parent,'pointerdown',event=>{press={x:event.clientX,y:event.clientY};dragged=false});
  listen(parent,'pointerup',event=>{if(press)dragged=Math.hypot(event.clientX-press.x,event.clientY-press.y)>8;press=null});
  listen(parent,'pointercancel',()=>{press=null;dragged=true;if(avatar&&live())avatar.cancel()});
  listen(parent,'click',event=>{if(event.defaultPrevented||dragged)return;if(event.detail===0){respond('body');return}const area=hit(event.clientX,event.clientY);if(area)respond(area)});
  listen(parent,'keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();respond('body')}});
  const ready=import(/* @vite-ignore */new URL('avatar.mjs',base).href).then(m=>m.createGreenAvatar(canvas,{baseUrl:base,signal:controller.signal,reducedMotion:!!reduced?.matches||options.animate===false,onError:fail})).then(instance=>{
    if(!live()){instance.destroy();return false}avatar=instance;rig.style.visibility='visible';original.hidden=true;parent.dataset.portraitState='ready';motion();return true;
  }).catch(error=>{if(!disposed&&!view.disposed&&!view.navigating)fail(error);return false});
  rig.portraitSnapshot=()=>avatar?.snapshot()??null;
  const dispose=()=>{if(disposed)return;disposed=true;controller.abort();avatar?.destroy();cleanups.forEach(fn=>fn());rig.remove();errorNode?.remove();delete parent.dataset.greenModel;delete parent.dataset.portraitState;parent.removeAttribute('role');parent.removeAttribute('tabindex');parent.removeAttribute('aria-label');if(!view.disposed&&!view.navigating)original.hidden=false};
  dispose.ready=ready;dispose.snapshot=()=>avatar?.snapshot()??null;return dispose;
}
