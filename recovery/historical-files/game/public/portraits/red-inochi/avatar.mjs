import init,{Inochi2dRuntime} from './vendor/inochi2d.js';
import {ArmGesturePlayer} from './arm-gesture-player.mjs';
import {CombinedSpring} from './combined-spring.mjs';
const neutral=[0,0,0,1,1,0,0,0,0,0,0,0,0,0,0];
const ranges=[[-20,20],[-12,12],[-5,5],[0,1],[0,1],[-1,1],[-1,1],[0,1],[-1,1],[-1,1],[-1,1],[-1,1],[-1,1],[-1,1],[-1,1]];
const names=['Hair:: Upper','Hair:: Middle','Hair:: Tip','Hair:: Fringe Left','Hair:: Fringe Center','Hair:: Fringe Right','Hair:: Left Lock','Cloth:: Hem','Cloth:: Left Ribbon','Cloth:: Right Ribbon'];
let boot;
const bounded=(v,i)=>Math.max(ranges[i][0],Math.min(ranges[i][1],v));
async function resource(url,signal){const r=await fetch(url,{signal});if(!r.ok)throw Error(`资源读取失败 ${r.status}: ${new URL(url).pathname}`);return r}
export async function createRedAvatar(canvas,{baseUrl=new URL('./',import.meta.url),signal,onError=()=>{}}={}){
 if(!(canvas instanceof HTMLCanvasElement))throw TypeError('Canvas required');
 const base=new URL(baseUrl,document.baseURI);
 const gl=canvas.getContext('webgl2');if(!gl)throw Error('设备未提供 WebGL2');
 // This fallback is confined to the owned canvas; no global WebGL mutation.
 const original=gl.texParameteri;gl.texParameteri=function(t,n,v){return original.call(gl,t,n,v===0x812d?gl.CLAMP_TO_EDGE:v)};
 let runtime,frame=0,last=0,disposed=false,paused=false,lost=false,draws=0,elapsed=0;
 let pose=neutral.slice(),look=[0,0],gesture,physics=new CombinedSpring();
 const input=()=>({hair:pose[0]/20+.15*pose[1]/12+.2*pose[12],cloth:.25*pose[0]/20+.15*pose[1]/12+pose[12]+.3*pose[13]});
 try{
  boot??=init({module_or_path:new URL('./vendor/inochi2d_bg.wasm',import.meta.url)}).catch(e=>{boot=null;throw e});
  const [model,clips]=await Promise.all([resource(new URL('red.inp',base),signal).then(r=>r.arrayBuffer()),resource(new URL('arm-gestures.json',base),signal).then(r=>r.json()),boot]);
  signal?.throwIfAborted();gesture=new ArmGesturePlayer(clips);runtime=new Inochi2dRuntime(canvas);runtime.load_model(new Uint8Array(model));
 }catch(e){if(runtime){runtime.clear();runtime.free()}gl.texParameteri=original;throw e}
 function live(){if(disposed)throw Error('角色实例已销毁');if(lost)throw Error('WebGL上下文已丢失，请重建角色')}
 function render(){if(disposed||lost)return;applyPose(runtime,pose);names.forEach((n,i)=>runtime.set_parameter_scalar(n,physics.x[i]));runtime.tick(0);draws++}
 function resize(){if(disposed||lost)return;const r=canvas.getBoundingClientRect();runtime.resize(Math.max(1,r.width),Math.max(1,r.height),Math.min(devicePixelRatio,2));runtime.set_camera_transform(0,0,Math.min(r.width/1100,r.height/1500));render()}
 function stop(){cancelAnimationFrame(frame);frame=0;last=0}
 function schedule(){if(!disposed&&!paused&&!lost&&!document.hidden&&!frame){last=performance.now();frame=requestAnimationFrame(step)}}
 function step(now){frame=0;if(disposed||paused||lost||document.hidden)return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;elapsed+=dt;try{
  if(gesture.active){pose=gesture.advance(dt);if(!gesture.active)look=[pose[5],pose[6]]}else{const a=1-Math.exp(-dt*9);for(const [i,target]of [[0,look[0]*8],[1,look[1]*5],[5,look[0]],[6,look[1]]])pose[i]+=(target-pose[i])*a}
  physics.advance(dt,input());render();frame=requestAnimationFrame(step);
 }catch(e){paused=true;stop();onError(e)}}
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 function visibility(){if(document.hidden)stop();else schedule()}
 function contextLost(e){e.preventDefault();lost=true;stop();onError(Error('画面上下文已丢失，请重建角色'))}
 document.addEventListener('visibilitychange',visibility);canvas.addEventListener('webglcontextlost',contextLost);
 const api={
  play(name){live();gesture.start(name,pose);paused=false;schedule()},
  cancel(){live();gesture.cancel();paused=false;schedule()},
  look(x,y){live();if(!Number.isFinite(x)||!Number.isFinite(y))throw TypeError('Finite gaze required');look=[Math.max(-1,Math.min(1,x)),Math.max(-1,Math.min(1,y))]},
  setPose(values){live();if(values.length!==15||values.some(v=>!Number.isFinite(v)))throw TypeError('Finite full pose required');gesture.clear();pose=values.map(bounded);look=[pose[5],pose[6]];render()},
  impulse(){live();physics.impulse()},
  pause(){live();paused=true;stop()},resume(){live();paused=false;schedule()},
  reset(){live();gesture.clear();pose=neutral.slice();look=[0,0];physics.reset(input());elapsed=0;render()},
  resize,
  snapshot(){return{format:'Inochi2D INP',disposed,paused,lost,visible:!document.hidden,draws,elapsed,pose:pose.slice(),gesture:gesture.snapshot(),physics:physics.snapshot()}},
  destroy(){if(disposed)return;stop();disposed=true;observer.disconnect();document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',contextLost);runtime.clear();runtime.free();gl.texParameteri=original;signal?.removeEventListener('abort',abort)},
 };
 function abort(){api.destroy()}
 signal?.addEventListener('abort',abort,{once:true});resize();schedule();return api;
}
