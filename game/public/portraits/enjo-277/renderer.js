import * as THREE from './three.module.js';
import {deformEnjo,greetingEnvelope,blinkAmount} from './enjo-motion.js';

const W=1024,H=1536;
export async function createEnjoPortrait(canvas,rigNode,signal){
 const loader=new THREE.TextureLoader();
 const loaded=await Promise.allSettled(['enjo.webp','blink.webp'].map(p=>loader.loadAsync(new URL(p,import.meta.url).href)));
 if(signal.aborted||loaded.some(r=>r.status==='rejected')){
  for(const r of loaded)if(r.status==='fulfilled')r.value.dispose();
  if(signal.aborted)throw new DOMException('Portrait load cancelled','AbortError');
  throw new Error('Enjo portrait texture load failed',{cause:loaded.find(r=>r.status==='rejected').reason});
 }
 const [portrait,blink]=loaded.map(r=>r.value);
 for(const t of [portrait,blink]){t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;}
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-W/2,W/2,H/2,-H/2,.1,10);camera.position.z=2;
 const geometry=new THREE.PlaneGeometry(W,H,64,96),positions=geometry.attributes.position,rest=Float32Array.from(positions.array);
 const material=new THREE.MeshBasicMaterial({map:portrait,transparent:true,depthWrite:false,toneMapped:false});
 const eyesMaterial=new THREE.MeshBasicMaterial({map:blink,transparent:true,depthWrite:false,depthTest:false,toneMapped:false,opacity:0});
 const figure=new THREE.Mesh(geometry,material),eyes=new THREE.Mesh(geometry,eyesMaterial);figure.renderOrder=0;eyes.renderOrder=1;scene.add(figure,eyes);
 const maskCanvas=document.createElement('canvas');maskCanvas.width=128;maskCanvas.height=192;
 const ctx=maskCanvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(portrait.image,0,0,128,192);const mask=ctx.getImageData(0,0,128,192).data;maskCanvas.width=maskCanvas.height=0;
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 let disposed=false,raf=0,last=null,elapsed=0,greetAt=-10,sequence=rigNode.dataset.reactionSequence||'',frames=0;
 const draw=controls=>{
  for(let i=0;i<positions.count;i++){const p=deformEnjo(rest[i*3]+W/2,H/2-rest[i*3+1],controls);positions.setXYZ(i,p.x-W/2,H/2-p.y,0);}positions.needsUpdate=true;
  eyesMaterial.opacity=controls.blink;renderer.render(scene,camera);frames++;
 };
 const resize=()=>{const b=canvas.getBoundingClientRect();if(b.width>0&&b.height>0){renderer.setSize(b.width,b.height,false);draw({breath:0,greet:0,look:0,time:0,blink:0});}};
 const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
 const tick=stamp=>{
  raf=0;if(disposed||document.hidden||media.matches)return;
  const dt=last===null?0:Math.min((stamp-last)/1000,.08);last=stamp;elapsed+=dt;
  const next=rigNode.dataset.reactionSequence||'';if(next!==sequence){sequence=next;if(next)greetAt=elapsed;}
  draw({breath:.3+.7*(.5-.5*Math.cos(elapsed*2*Math.PI/3.8)),greet:greetingEnvelope(elapsed-greetAt),look:0,time:elapsed,blink:blinkAmount(elapsed)});
  raf=requestAnimationFrame(tick);
 };
 const sync=()=>{cancelAnimationFrame(raf);raf=0;last=null;if(document.hidden)return;if(media.matches)draw({breath:0,greet:0,look:0,time:0,blink:0});else raf=requestAnimationFrame(tick);};
 document.addEventListener('visibilitychange',sync);media.addEventListener('change',sync);
 rigNode.portraitHitTest=(x,y)=>{const b=canvas.getBoundingClientRect(),u=(x-b.left)/b.width,v=(y-b.top)/b.height;if(u<0||u>=1||v<0||v>=1||mask[(Math.floor(v*192)*128+Math.floor(u*128))*4+3]<24)return null;return u>.43&&u<.68&&v<.25?'head':'body';};
 rigNode.dataset.renderer='three-continuous-2d';rigNode.dataset.rigCapabilities='breath blink acknowledgement';
 const api={draw,capture(controls){draw(controls);return canvas.toDataURL('image/png');},freeze(){cancelAnimationFrame(raf);raf=0;},resume:sync,get frames(){return frames;},get elapsed(){return elapsed;},dispose(){
  if(disposed)return;disposed=true;cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',sync);media.removeEventListener('change',sync);
  geometry.dispose();material.dispose();eyesMaterial.dispose();portrait.dispose();blink.dispose();renderer.dispose();renderer.forceContextLoss();
  delete rigNode.portraitHitTest;delete canvas.__enjoQA;
 }};
 canvas.__enjoQA=api;sync();return api;
}
