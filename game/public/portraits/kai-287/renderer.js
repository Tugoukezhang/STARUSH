import {loadMeshAvatar} from './mesh-avatar.js';
import {greetingEnvelope,blinkAmount} from '../enjo-277/enjo-motion.js';

const SOURCE_WIDTH=1024,SOURCE_HEIGHT=1536,MASK_WIDTH=128,MASK_HEIGHT=192,MIN_ALPHA=24;
const HEAD={left:500/SOURCE_WIDTH,right:700/SOURCE_WIDTH,top:110/SOURCE_HEIGHT,bottom:315/SOURCE_HEIGHT};
// The runtime lifts by up to 9 source px per unit of breath, so armor, sword and grip move under 2 px.
const BREATH_PARAMETER=.2,BREATH_SECONDS=5;

async function readSourceMask(signal){
 const checkAbort=()=>{if(signal.aborted)throw new DOMException('Portrait load cancelled','AbortError');};
 checkAbort();
 const source=new Image();source.src=new URL('./source.png',import.meta.url).href;
 await source.decode();
 checkAbort();
 if(source.naturalWidth!==SOURCE_WIDTH||source.naturalHeight!==SOURCE_HEIGHT)throw new RangeError(`Kai source.png must be ${SOURCE_WIDTH}x${SOURCE_HEIGHT}, got ${source.naturalWidth}x${source.naturalHeight}`);
 const maskCanvas=document.createElement('canvas');maskCanvas.width=MASK_WIDTH;maskCanvas.height=MASK_HEIGHT;
 const ctx=maskCanvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,MASK_WIDTH,MASK_HEIGHT);
 const mask=ctx.getImageData(0,0,MASK_WIDTH,MASK_HEIGHT).data;maskCanvas.width=maskCanvas.height=0;
 if(mask[3]>=MIN_ALPHA)throw new RangeError('Kai source.png must have a transparent background');
 return mask;
}

export async function createKaiPortrait(canvas,rigNode,signal){
 const avatar=await loadMeshAvatar(canvas,new URL('./',import.meta.url),{manual:true,padTop:0,padSide:0});
 let mask;
 try{mask=await readSourceMask(signal);}catch(error){avatar.destroy();throw error;}
 avatar.setAutoIdle(false);avatar.setAutoMotion(false);avatar.setSwayGain(.4);
 const media=matchMedia('(prefers-reduced-motion: reduce)'),target=rigNode.closest('button')||rigNode;
 let disposed=false,raf=0,last=null,elapsed=0,greetAt=-10,sequence='',frames=0,look=0,desiredLook=0;
 const draw=(controls,dt=0)=>{
  avatar.setParameters({angleX:controls.look*5+Math.sin(controls.time*.7)*controls.breath,
   angleY:-controls.greet*3,angleZ:Math.sin(controls.time*.55)*controls.breath,
   bodyAngleX:0,bodyAngleZ:0,breath:controls.breath*BREATH_PARAMETER,gazeX:controls.look*.45,gazeY:0,
   eyeLOpen:1-controls.blink,eyeROpen:1-controls.blink,mouthOpen:0});
  avatar.advance(dt,dt>0?1/dt:60);frames++;
 };
 const rest=()=>draw({breath:0,greet:0,look:0,time:0,blink:0});
 const tick=stamp=>{
  raf=0;if(disposed||document.hidden||media.matches)return;
  const dt=last===null?0:Math.min((stamp-last)/1000,.05);last=stamp;elapsed+=dt;
  look+=(desiredLook-look)*(1-Math.exp(-dt*7));
  const next=rigNode.dataset.reactionSequence||'';if(next!==sequence){sequence=next;if(next)greetAt=elapsed;}
  // Breath starts at 0 with zero slope, so motion leaves the rest pose without a visible pop.
  draw({breath:.5*(1-Math.cos(elapsed*Math.PI*2/BREATH_SECONDS)),greet:greetingEnvelope(elapsed-greetAt),look,time:elapsed,blink:blinkAmount(elapsed)},dt);
  raf=requestAnimationFrame(tick);
 };
 const freeze=()=>{cancelAnimationFrame(raf);raf=0;last=null;};
 const sync=()=>{
  freeze();if(disposed||document.hidden)return;
  // Reactions that arrived while no frame could show them are dropped, never replayed late.
  sequence=rigNode.dataset.reactionSequence||'';
  if(media.matches){elapsed=0;look=desiredLook=0;greetAt=-10;rest();}else raf=requestAnimationFrame(tick);
 };
 const follow=e=>{if(media.matches)return;const b=canvas.getBoundingClientRect();desiredLook=Math.max(-1,Math.min(1,(e.clientX-b.left)/b.width*2-1));};
 const release=()=>{desiredLook=0;};
 target.addEventListener('pointermove',follow);
 for(const event of ['pointerleave','pointerup','pointercancel'])target.addEventListener(event,release);
 document.addEventListener('visibilitychange',sync);media.addEventListener('change',sync);
 const observer=new ResizeObserver(()=>avatar.advance(0));observer.observe(canvas);
 rigNode.portraitHitTest=(x,y)=>{const b=canvas.getBoundingClientRect(),u=(x-b.left)/b.width,v=(y-b.top)/b.height;
  // Written as a negated range so the NaN from a collapsed canvas is also a miss.
  if(!(u>=0&&u<1&&v>=0&&v<1)||mask[(Math.floor(v*MASK_HEIGHT)*MASK_WIDTH+Math.floor(u*MASK_WIDTH))*4+3]<MIN_ALPHA)return null;
  return u>=HEAD.left&&u<=HEAD.right&&v>=HEAD.top&&v<=HEAD.bottom?'head':'body';};
 rigNode.dataset.renderer='mesh-avatar-0.7.0';rigNode.dataset.artRevision='kai287';rigNode.dataset.rigCapabilities='breath blink gaze acknowledgement';
 const api={draw,capture(controls){draw(controls);return canvas.toDataURL('image/png');},freeze,resume:sync,
  get frames(){return frames;},get elapsed(){return elapsed;},get parameters(){return avatar.getParameters();},dispose(){
   if(disposed)return;disposed=true;freeze();observer.disconnect();
   target.removeEventListener('pointermove',follow);for(const event of ['pointerleave','pointerup','pointercancel'])target.removeEventListener(event,release);
   document.removeEventListener('visibilitychange',sync);media.removeEventListener('change',sync);
   avatar.destroy();delete rigNode.portraitHitTest;delete canvas.__kaiQA;
  }};
 canvas.__kaiQA=api;rest();sync();return api;
}
