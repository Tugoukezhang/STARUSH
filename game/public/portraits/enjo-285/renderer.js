import {loadMeshAvatar} from './mesh-avatar.js';
import {greetingEnvelope,blinkAmount} from '../enjo-277/enjo-motion.js';

export async function createEnjoPortrait(canvas,rigNode,signal){
 const avatar=await loadMeshAvatar(canvas,new URL('./',import.meta.url),{manual:true,padTop:0,padSide:0});
 if(signal.aborted){avatar.destroy();throw new DOMException('Portrait load cancelled','AbortError');}
 avatar.setAutoIdle(false);avatar.setAutoMotion(false);avatar.setSwayGain(.65);
 const source=new Image();source.src=new URL('../enjo-277/enjo.webp',import.meta.url).href;
 try{await source.decode();}catch(error){avatar.destroy();throw error;}
 if(signal.aborted){avatar.destroy();throw new DOMException('Portrait load cancelled','AbortError');}
 const maskCanvas=document.createElement('canvas');maskCanvas.width=128;maskCanvas.height=192;
 const ctx=maskCanvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,128,192);
 const mask=ctx.getImageData(0,0,128,192).data;maskCanvas.width=maskCanvas.height=0;
 const media=matchMedia('(prefers-reduced-motion: reduce)'),target=rigNode.closest('button')||rigNode;
 let disposed=false,raf=0,last=null,elapsed=0,greetAt=-10,sequence='',frames=0,look=0,desiredLook=0;
 const draw=(controls,dt=0)=>{
  avatar.setParameters({angleX:controls.look*6+Math.sin(controls.time*.7)*1.5*controls.breath,
   angleY:-controls.greet*4,angleZ:Math.sin(controls.time*.55)*1.2*controls.breath,
   bodyAngleX:0,bodyAngleZ:0,breath:controls.breath,gazeX:controls.look*.45,gazeY:0,
   eyeLOpen:1-controls.blink,eyeROpen:1-controls.blink,mouthOpen:0});
  avatar.advance(dt,dt>0?1/dt:60);frames++;
 };
 const rest=()=>draw({breath:0,greet:0,look:0,time:0,blink:0});
 const tick=stamp=>{
  raf=0;if(disposed||document.hidden||media.matches)return;
  const dt=last===null?0:Math.min((stamp-last)/1000,.05);last=stamp;elapsed+=dt;
  look+=(desiredLook-look)*(1-Math.exp(-dt*7));
  const next=rigNode.dataset.reactionSequence||'';if(next!==sequence){sequence=next;if(next)greetAt=elapsed;}
  draw({breath:.45+.45*Math.sin(elapsed*Math.PI*2/4),greet:greetingEnvelope(elapsed-greetAt),look,time:elapsed,blink:blinkAmount(elapsed)},dt);
  raf=requestAnimationFrame(tick);
 };
 const freeze=()=>{cancelAnimationFrame(raf);raf=0;last=null;};
 const sync=()=>{freeze();if(disposed||document.hidden)return;if(media.matches)rest();else raf=requestAnimationFrame(tick);};
 const follow=e=>{if(media.matches)return;const b=canvas.getBoundingClientRect();desiredLook=Math.max(-1,Math.min(1,(e.clientX-b.left)/b.width*2-1));};
 const release=()=>{desiredLook=0;};
 target.addEventListener('pointermove',follow);
 for(const event of ['pointerleave','pointerup','pointercancel'])target.addEventListener(event,release);
 document.addEventListener('visibilitychange',sync);media.addEventListener('change',sync);
 const observer=new ResizeObserver(()=>avatar.advance(0));observer.observe(canvas);
 rigNode.portraitHitTest=(x,y)=>{const b=canvas.getBoundingClientRect(),u=(x-b.left)/b.width,v=(y-b.top)/b.height;
  if(u<0||u>=1||v<0||v>=1||mask[(Math.floor(v*192)*128+Math.floor(u*128))*4+3]<24)return null;
  return u>.43&&u<.68&&v<.25?'head':'body';};
 rigNode.dataset.renderer='mesh-avatar-0.7.0';rigNode.dataset.rigCapabilities='breath registered-eyelids hair gaze acknowledgement';
 const api={draw,capture(controls){draw(controls);return canvas.toDataURL('image/png');},freeze,resume:sync,
  get frames(){return frames;},get elapsed(){return elapsed;},get parameters(){return avatar.getParameters();},dispose(){
   if(disposed)return;disposed=true;freeze();observer.disconnect();
   target.removeEventListener('pointermove',follow);for(const event of ['pointerleave','pointerup','pointercancel'])target.removeEventListener(event,release);
   document.removeEventListener('visibilitychange',sync);media.removeEventListener('change',sync);
   avatar.destroy();delete rigNode.portraitHitTest;delete canvas.__enjoQA;
  }};
 canvas.__enjoQA=api;rest();sync();return api;
}
