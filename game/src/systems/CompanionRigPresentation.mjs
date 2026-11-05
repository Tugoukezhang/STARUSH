import {createCompanionRigClock} from './CompanionRigHost.mjs';
import {getPortraitBase} from './PortraitBaseRegistration.mjs';

class RigLoadError extends Error {}

async function loadCompanionRig(canvas,doc,model){
 const url=file=>new URL(file,doc.baseURI).href;
 // This boundary owns network, module, WASM and third-party renderer failures only.
 try{
  const [module,wasm,modelResponse]=await Promise.all([
   import(/* @vite-ignore */ url('vendor/psd2live-3.6.6/p2l.js')),
   fetch(url('vendor/psd2live-3.6.6/p2l_runtime.wasm')),
   fetch(url(model.model)),
  ]);
  if(!wasm.ok||!modelResponse.ok)throw new RigLoadError('Companion rig HTTP '+wasm.status+'/'+modelResponse.status);
  const [wasmBytes,modelBytes]=await Promise.all([wasm.arrayBuffer(),modelResponse.arrayBuffer()]);
  const {instance}=await WebAssembly.instantiate(wasmBytes,{});
  return await module.P2LPlayer.fromBytes(canvas,instance.exports,new Uint8Array(modelBytes));
 }catch(error){if(!(error instanceof Error))throw error;throw new RigLoadError('Companion rig load failed',{cause:error});}
}

// model is a CompanionRigRegistry entry; the inline aspect overrides legacy 853/1280 frame rules for other registered sizes.
export function mountCompanionRig(view,parent,original,model,background=null,loadPlayer=loadCompanionRig){
 original.hidden=true;parent.dataset.portraitState='loading';parent.dataset.homePortrait=model.member;
 const rig=view.element('span','home-portrait-rig',undefined,parent),canvas=view.element('canvas','home-portrait-canvas',undefined,rig);
 rig.hidden=true;rig.style.setProperty('aspect-ratio',model.width+' / '+model.height);rig.setAttribute('aria-hidden','true');canvas.setAttribute('aria-hidden','true');
 const base=getPortraitBase(model.member);if(base){
  // Fit the measured ink, leaving eight screen pixels for breathing above the ears; feet keep the same baseline.
  const {height:h,bounds:b}=base,safeTop=8;
  rig.style.setProperty('height',`calc(${h/b.height*100}% - ${safeTop*h/b.height}px)`);
  rig.style.setProperty('top',`calc(${-b.y/b.height*100}% + ${safeTop*(1+b.y/b.height)}px)`);
 }
 let disposed=false,failed=false,player=null,clock=null,errorNode=null;
 const reset=()=>{rig.style.setProperty('--portrait-look-x','0');rig.style.setProperty('--portrait-look-y','0');};reset();
 const move=event=>{const box=parent.getBoundingClientRect();const x=Math.max(-1,Math.min(1,(event.clientX-box.left)/box.width*2-1)),y=Math.max(-1,Math.min(1,1-(event.clientY-box.top)/box.height*2));rig.style.setProperty('--portrait-look-x',String(x));rig.style.setProperty('--portrait-look-y',String(y));};
 parent.addEventListener('pointermove',move);parent.addEventListener('pointerleave',reset);parent.addEventListener('pointercancel',reset);parent.addEventListener('pointerup',reset);
 const fail=error=>{
  if(!(error instanceof Error))throw error;if(disposed||failed)return;failed=true;
  canvas.removeEventListener('webglcontextlost',loadingLost);
  if(clock)clock.destroy();else if(player?.rig)player.dispose();rig.remove();
  parent.dataset.portraitState='unavailable';errorNode=view.element('span','portrait-load-error','人物动态加载失败',parent);errorNode.setAttribute('role','status');
 };
 const loadingLost=()=>fail(new RigLoadError('Companion context lost while loading'));
 canvas.addEventListener('webglcontextlost',loadingLost);
 loadPlayer(canvas,view.doc,model).then(loaded=>{
  if(disposed||failed||view.disposed||rig.parentNode!==parent){loaded.dispose();return;}
  player=loaded;
  if(player.width!==model.width||player.height!==model.height||!player.hitAreas.includes(model.hitAreas.head)||!player.hitAreas.includes(model.hitAreas.body)){fail(new RigLoadError('Companion model registration mismatch'));return;}
  rig.portraitHitTest=(x,y)=>{const hit=player.hitTest(x,y);return hit===null?null:hit===model.hitAreas.head?'head':'body';};
  // A hidden element has zero WebGL backing dimensions. Reveal in this task, then synchronously paint before the browser presents it.
  rig.hidden=false;
  // RangeError here is a rejected external model binding, not a recoverable internal code error.
  try{clock=createCompanionRigClock({player,doc:view.doc,win:view.doc.defaultView,rigNode:rig,background,verifiedChannels:model.verifiedChannels,breathDriver:model.breathDriver,onError:fail});}
  catch(error){if(!(error instanceof RangeError))throw error;fail(new RigLoadError('Companion model bindings rejected',{cause:error}));return;}
  canvas.removeEventListener('webglcontextlost',loadingLost);
  if(failed)return;parent.dataset.portraitState='ready';
 },fail);
 return ()=>{
  if(disposed)return;disposed=true;parent.removeEventListener('pointermove',move);parent.removeEventListener('pointerleave',reset);parent.removeEventListener('pointercancel',reset);parent.removeEventListener('pointerup',reset);canvas.removeEventListener('webglcontextlost',loadingLost);
  if(clock)clock.destroy();else if(player?.rig)player.dispose();delete rig.portraitHitTest;rig.remove();canvas.width=canvas.height=0;errorNode?.remove();
  if(!view.navigating&&!view.disposed)original.hidden=false;
  delete parent.dataset.portraitState;delete parent.dataset.homePortrait;
 };
}
