import init,{Inochi2dRuntime} from './vendor/inochi2d.js';
import {GreenActions,neutral,boundedPose} from './actions.mjs';
import {GreenSpring,channels} from './green-spring.mjs';
import {applyPose,physicsInput} from './pose.mjs';
let boot;
const owners=new WeakSet();
async function resource(url,signal){const r=await fetch(url,{signal});if(!r.ok)throw Error(`角色资源读取失败 (${r.status}): ${url.pathname}`);return r}

export async function createGreenAvatar(canvas,{baseUrl=new URL('./',import.meta.url),signal,onError=()=>{},reducedMotion=false}={}) {
  if(!(canvas instanceof HTMLCanvasElement))throw TypeError('Canvas required');
  signal?.throwIfAborted();
  if(owners.has(canvas))throw Error('Canvas already owns a green avatar');
  const base=new URL(baseUrl,document.baseURI),gl=canvas.getContext('webgl2',{stencil:true});
  if(!gl||!gl.getContextAttributes().stencil)throw Error('角色需要带模板缓冲的 WebGL2');
  owners.add(canvas);
  const original=gl.texParameteri;
  gl.texParameteri=function(t,n,v){return original.call(gl,t,n,v===0x812d?gl.CLAMP_TO_EDGE:v)};
  let runtime,actions,model,frame=0,last=0,draws=0,elapsed=0,disposed=false,paused=false,lost=false;
  let state=neutral(),target=null,reduce=!!reducedMotion;
  const spring=new GreenSpring();
  try {
    boot??=init({module_or_path:new URL('./vendor/inochi2d_bg.wasm',import.meta.url)}).catch(e=>{boot=null;throw e});
    const [bytes,clips]=await Promise.all([resource(new URL('green.inp',base),signal).then(r=>r.arrayBuffer()),resource(new URL('actions.json',base),signal).then(r=>r.json()),boot]);
    signal?.throwIfAborted();actions=new GreenActions(clips);model=new Uint8Array(bytes);
    runtime=new Inochi2dRuntime(canvas);runtime.load_model(model);
  }catch(error){if(runtime){runtime.clear();runtime.free()}gl.texParameteri=original;owners.delete(canvas);throw error}
  const live=()=>{if(disposed)throw Error('角色已销毁');if(lost)throw Error('画面上下文已丢失，请重建角色')};
  function render(){if(disposed||lost)return;applyPose(runtime,state);channels.forEach((n,i)=>runtime.set_parameter_scalar(n,spring.x[i]));runtime.tick(0);draws++}
  function resize(){if(disposed||lost)return;const r=canvas.getBoundingClientRect();runtime.resize(Math.max(1,r.width),Math.max(1,r.height),Math.min(devicePixelRatio,2));runtime.set_camera_transform(0,0,Math.min(r.width/1100,r.height/1500));render()}
  function stop(){cancelAnimationFrame(frame);frame=0;last=0}
  function schedule(){if(!frame&&!disposed&&!paused&&!lost&&!document.hidden&&!reduce&&(actions.active||target||spring.moving())){last=performance.now();frame=requestAnimationFrame(step)}}
  function restore(){const base=actions.restore();if(base)state=base;target=null;spring.reset(physicsInput(state))}
  function step(now){
    frame=0;if(disposed||paused||lost||document.hidden||reduce)return;
    // Clips follow active wall time even on a slow renderer. Physics caps its own step.
    const dt=Math.max(0,(now-last)/1000);last=now;elapsed+=dt;
    try {
      if(actions.active)state=actions.advance(dt);
      else if(target){let moving=false;const a=1-Math.exp(-dt*10);for(const[k,v]of Object.entries(target)){state[k]+=(v-state[k])*a;if(Math.abs(v-state[k])<.0001)state[k]=v;else moving=true}if(!moving)target=null}
      spring.move(physicsInput(state));spring.advance(dt);render();
      if(actions.active||target||spring.moving())frame=requestAnimationFrame(step);
    }catch(error){paused=true;stop();onError(error)}
  }
  function visibility(){if(document.hidden){stop();restore();render()}}
  function pagehide(){api.destroy()}
  function contextLost(event){event.preventDefault();lost=true;stop();restore();onError(Error('角色画面已中断，请重建角色'))}
  const observer=new ResizeObserver(resize);
  const api={
    play(name){live();if(!Object.hasOwn(actions.clips,name))throw Error('Unknown action: '+name);if(reduce)return false;target=null;actions.start(name,state);schedule();return true},
    cancel(){live();target=null;actions.cancel(state);schedule()},
    look(x,y){live();if(!Number.isFinite(x)||!Number.isFinite(y))throw TypeError('Finite gaze required');if(reduce||actions.active)return;x=Math.max(-1,Math.min(1,x));y=Math.max(-1,Math.min(1,y));const next={yaw:x*8,pitch:y*5,gx:x,gy:y};target=Object.entries(next).some(([k,v])=>Math.abs(v-state[k])>.0001)?next:null;schedule()},
    setPose(values){live();const next=boundedPose(values,state);actions.clear();target=null;state=next;spring.reset(physicsInput(state));stop();render()},
    impulse(amount=.65){live();if(reduce)return;spring.impulse(amount);schedule()},
    pause(){live();paused=true;stop()},
    resume(){live();paused=false;schedule()},
    reset(){live();stop();actions.clear();target=null;state=neutral();spring.reset(physicsInput(state));elapsed=0;render()},
    setReducedMotion(value){live();reduce=!!value;if(reduce){stop();restore();state=neutral();spring.reset(physicsInput(state));render()}},
    reload(){live();stop();restore();runtime.clear();runtime.load_model(model);state=neutral();spring.reset(physicsInput(state));elapsed=0;resize()},
    resize,
    snapshot(){return {format:'Inochi2D INP',disposed,paused,lost,reducedMotion:reduce,visible:!document.hidden,animating:!!frame,draws,elapsed,pose:{...state},action:actions.snapshot(),physics:spring.snapshot()}},
    destroy(){if(disposed)return;stop();disposed=true;observer.disconnect();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pagehide);canvas.removeEventListener('webglcontextlost',contextLost);signal?.removeEventListener('abort',abort);runtime.clear();runtime.free();model=null;gl.texParameteri=original;owners.delete(canvas)},
  };
  function abort(){api.destroy()}
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',pagehide);canvas.addEventListener('webglcontextlost',contextLost);
  signal?.addEventListener('abort',abort,{once:true});observer.observe(canvas);
  try{resize();signal?.throwIfAborted();return api}catch(error){api.destroy();throw error}
}
