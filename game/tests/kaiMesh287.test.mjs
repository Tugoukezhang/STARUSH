import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const zero=value=>assert.equal(Math.abs(value),0);

// ---------- mount harness: same source-transform pattern as enjoLoadFailure285 ----------
const BASE={height:1536,bounds:{height:1400,y:60}};
const mountSource=()=>read('../src/systems/KaiContinuousPortrait.mjs')
 .replace(/^import .*;\r?\n/,'').replace('export function','function').replace('import(/* @vite-ignore */ ','importRenderer(');

function mountHarness(createKaiPortrait){
 const urls=[],nodes=[];
 const importRenderer=url=>{urls.push(url);return Promise.resolve({createKaiPortrait});};
 const mount=new Function('getPortraitBase','importRenderer',mountSource()+';return mountKaiContinuousPortrait;')(id=>{assert.equal(id,'kai');return BASE;},importRenderer);
 const view={disposed:false,navigating:false,doc:{baseURI:'http://localhost/game/'},element(tag,className,text){
  const node=new EventTarget();
  Object.assign(node,{tag,className,text,style:{},dataset:{},attributes:{},removed:false,setAttribute(k,v){this.attributes[k]=v;},remove(){this.removed=true;}});
  nodes.push(node);return node;
 }};
 const parent={dataset:{}},original={hidden:false};
 return {urls,nodes,view,parent,original,start:()=>mount(view,parent,original),get rig(){return nodes[0];},get canvas(){return nodes[1];},errorNode:()=>nodes.find(n=>n.className==='portrait-load-error')};
}
const loseContext=canvas=>{const event=new Event('webglcontextlost',{cancelable:true});canvas.dispatchEvent(event);return event;};
const player=()=>({releases:0,dispose(){this.releases++;}});

test('mount loads Kai renderer from its own route with Enjo parent conventions',async()=>{
 const p=player();let args;
 const h=mountHarness((...a)=>{args=a;return p;});
 const dispose=h.start();
 assert.equal(h.original.hidden,true);assert.equal(h.parent.dataset.homePortrait,'kai');assert.equal(h.parent.dataset.portraitState,'loading');
 assert.equal(h.rig.style.aspectRatio,'1024 / 1536');assert.equal(h.rig.style.visibility,'hidden');assert.equal(h.canvas.attributes['aria-hidden'],'true');
 await flush();
 assert.deepEqual(h.urls,['http://localhost/game/portraits/kai-287/renderer.js']);
 assert.equal(args[0],h.canvas);assert.equal(args[1],h.rig);assert.ok(args[2] instanceof AbortSignal);assert.equal(args[2].aborted,false);
 assert.equal(h.parent.dataset.portraitState,'ready');assert.equal(h.rig.style.visibility,'visible');
 dispose();
 assert.equal(p.releases,1);assert.equal(args[2].aborted,true);assert.equal(h.rig.removed,true);
 assert.equal(h.parent.dataset.portraitState,undefined);assert.equal(h.parent.dataset.homePortrait,undefined);assert.equal(h.original.hidden,false);
});

test('context loss during load cannot be revived by a late renderer',async()=>{
 const pending=deferred();let signal;
 const h=mountHarness((_c,_r,s)=>{signal=s;return pending.promise;});
 const dispose=h.start();await flush();
 const event=loseContext(h.canvas);
 assert.equal(event.defaultPrevented,true);assert.equal(signal.aborted,true);
 assert.equal(h.parent.dataset.portraitState,'unavailable');assert.equal(h.errorNode().attributes.role,'status');
 const late=player();pending.resolve(late);await flush();
 assert.equal(late.releases,1);assert.equal(h.parent.dataset.portraitState,'unavailable');assert.equal(h.rig.style.visibility,'hidden');
 dispose();
 assert.equal(late.releases,1);assert.equal(h.errorNode().removed,true);
});

test('context loss after ready releases the renderer once and shows the failure',async()=>{
 const p=player(),h=mountHarness(()=>p);
 const dispose=h.start();await flush();
 loseContext(h.canvas);loseContext(h.canvas);
 assert.equal(p.releases,1);assert.equal(h.parent.dataset.portraitState,'unavailable');assert.equal(h.rig.style.visibility,'hidden');
 assert.equal(h.nodes.filter(n=>n.className==='portrait-load-error').length,1);
 dispose();assert.equal(p.releases,1);
});

test('caller abort during load releases the late renderer without reporting failure',async()=>{
 const pending=deferred();let signal;
 const h=mountHarness((_c,_r,s)=>{signal=s;return pending.promise;});
 const dispose=h.start();await flush();
 dispose();assert.equal(signal.aborted,true);
 const late=player();pending.resolve(late);await flush();
 assert.equal(late.releases,1);assert.equal(h.errorNode(),undefined);assert.equal(h.parent.dataset.portraitState,undefined);assert.equal(h.original.hidden,false);
});

test('renderer AbortError after caller dispose is silent',async()=>{
 const pending=deferred(),h=mountHarness(()=>pending.promise);
 const dispose=h.start();await flush();dispose();
 pending.reject(new DOMException('Portrait load cancelled','AbortError'));await flush();
 assert.equal(h.errorNode(),undefined);assert.equal(h.parent.dataset.portraitState,undefined);
});

test('load rejection reports unavailable and leaves the original hidden until dispose',async()=>{
 const h=mountHarness(()=>Promise.reject(new Error('missing rig')));
 const dispose=h.start();await flush();
 assert.equal(h.parent.dataset.portraitState,'unavailable');assert.equal(h.original.hidden,true);assert.ok(h.errorNode());
 dispose();assert.equal(h.original.hidden,false);
});

test('navigation during load releases the renderer and its context-loss echo reports nothing',async()=>{
 const pending=deferred(),h=mountHarness(()=>pending.promise);
 const dispose=h.start();await flush();
 h.view.navigating=true;
 const late=player();pending.resolve(late);await flush();
 assert.equal(late.releases,1);assert.equal(h.rig.style.visibility,'hidden');
 loseContext(h.canvas);
 assert.equal(h.errorNode(),undefined);
 dispose();assert.equal(late.releases,1);assert.equal(h.original.hidden,true);
});

// ---------- renderer harness: real motion functions, fake browser and mesh runtime ----------
const META_URL='http://localhost/portraits/kai-287/renderer.js';
const motion=new Function(read('../public/portraits/enjo-277/enjo-motion.js').replace(/^export /gm,'')+';return {greetingEnvelope,blinkAmount};')();
const silhouette=(x,y)=>x>=300&&x<800&&y>=100&&y<1400?255:0;

class Tracked extends EventTarget{
 listeners=0;
 addEventListener(...a){this.listeners++;super.addEventListener(...a);}
 removeEventListener(...a){this.listeners--;super.removeEventListener(...a);}
}

function rendererWorld({alphaAt=silhouette,imageWidth=1024,imageHeight=1536,reduced=false,hidden=false,loaded,decoded}={}){
 const world={images:[],drawn:[],loads:[],clock:1000,callbacks:new Map(),nextRaf:1,observer:null,controller:new AbortController()};
 const avatar={destroys:0,advances:[],settings:{},params:{},
  setAutoIdle(v){this.settings.autoIdle=v;},setAutoMotion(v){this.settings.autoMotion=v;},setSwayGain(v){this.settings.sway=v;},
  setParameters(p){this.params={...p};},getParameters(){return {...this.params};},advance(...a){this.advances.push(a);},destroy(){this.destroys++;}};
 const documentFake=new Tracked();documentFake.hidden=hidden;
 documentFake.createElement=tag=>{assert.equal(tag,'canvas');return {width:0,height:0,getContext:(kind)=>{assert.equal(kind,'2d');return {
  drawImage:(...a)=>world.drawn.push(a),
  getImageData:(_x,_y,w,h)=>{const data=new Uint8ClampedArray(w*h*4);for(let r=0;r<h;r++)for(let c=0;c<w;c++)data[(r*w+c)*4+3]=alphaAt((c+.5)*1024/w,(r+.5)*1536/h);return {data};}
 };}};};
 const media=new Tracked();media.matches=reduced;
 class ImageFake{constructor(){this.naturalWidth=imageWidth;this.naturalHeight=imageHeight;world.images.push(this);}decode(){return decoded?decoded.promise:Promise.resolve();}}
 class ObserverFake{constructor(callback){this.callback=callback;this.observed=[];this.disconnected=false;world.observer=this;}observe(n){this.observed.push(n);}disconnect(){this.disconnected=true;}}
 const target=new Tracked();
 const rig=new EventTarget();Object.assign(rig,{dataset:{},closest:selector=>{assert.equal(selector,'button');return target;}});
 const canvas={getBoundingClientRect:()=>({left:0,top:0,width:1024,height:1536}),toDataURL:type=>`data:${type};kai`};
 const env={
  META_URL,document:documentFake,Image:ImageFake,ResizeObserver:ObserverFake,
  loadMeshAvatar:(...a)=>{world.loads.push(a);return loaded?loaded.promise:Promise.resolve(avatar);},
  greetingEnvelope:motion.greetingEnvelope,blinkAmount:motion.blinkAmount,
  matchMedia:query=>{assert.equal(query,'(prefers-reduced-motion: reduce)');return media;},
  requestAnimationFrame:cb=>{const id=world.nextRaf++;world.callbacks.set(id,cb);return id;},
  cancelAnimationFrame:id=>{world.callbacks.delete(id);}
 };
 const source=read('../public/portraits/kai-287/renderer.js').replace(/^import .*;\r?\n/gm,'').replace('export async function','async function').replaceAll('import.meta.url','META_URL');
 const create=new Function(...Object.keys(env),source+';return createKaiPortrait;')(...Object.values(env));
 return Object.assign(world,{avatar,document:documentFake,media,target,rig,canvas,
  create:()=>create(canvas,rig,world.controller.signal),
  frame(ms=16){world.clock+=ms;const due=[...world.callbacks.values()];world.callbacks.clear();for(const cb of due)cb(world.clock);},
  frames(count,ms=16){for(let i=0;i<count;i++)world.frame(ms);},
  listeners:()=>documentFake.listeners+media.listeners+target.listeners});
}
const boot=async options=>{const world=rendererWorld(options);world.api=await world.create();return world;};
const hit=(world,x,y)=>world.rig.portraitHitTest(x,y);
const pointer=(type,clientX)=>Object.assign(new Event(type),{clientX});

test('renderer loads its own folder and samples its own source for alpha',async()=>{
 const w=await boot();
 assert.equal(w.loads[0][0],w.canvas);assert.equal(w.loads[0][1].href,'http://localhost/portraits/kai-287/');
 assert.deepEqual(w.loads[0][2],{manual:true,padTop:0,padSide:0});
 assert.deepEqual(w.images.map(i=>i.src),['http://localhost/portraits/kai-287/source.png']);
 assert.deepEqual(w.drawn[0],[w.images[0],0,0,128,192]);
 assert.equal(w.avatar.settings.autoIdle,false);assert.equal(w.avatar.settings.autoMotion,false);
 assert.equal(w.rig.dataset.renderer,'mesh-avatar-0.7.0');assert.equal(w.rig.dataset.artRevision,'kai287');
 const renderer=read('../public/portraits/kai-287/renderer.js'),mounted=read('../src/systems/KaiContinuousPortrait.mjs');
 assert.match(renderer,/from '\.\/mesh-avatar\.js'/);assert.match(renderer,/from '\.\.\/enjo-277\/enjo-motion\.js'/);
 assert.doesNotMatch(renderer,/enjo-286|__enjoQA|cast-portrait/);assert.doesNotMatch(mounted,/enjo/i);
});

test('head box is x500..700,y110..315 and other opaque source pixels are body',async()=>{
 const w=await boot();
 for(const [x,y] of [[500,200],[700,200],[600,110],[600,315],[600,220]])assert.equal(hit(w,x,y),'head',`${x},${y}`);
 for(const [x,y] of [[499,200],[701,200],[600,109],[600,316],[400,700]])assert.equal(hit(w,x,y),'body',`${x},${y}`);
 for(const [x,y] of [[100,100],[900,700],[-1,200],[1024,200],[600,1536]])assert.equal(hit(w,x,y),null,`${x},${y}`);
});

test('transparent pixels inside the head box are misses',async()=>{
 const w=await boot({alphaAt:(x,y)=>x<600&&y<300?0:255});
 assert.equal(hit(w,550,200),null);assert.equal(hit(w,650,200),'head');
});

test('a collapsed canvas never reports a hit',async()=>{
 const w=await boot();
 w.canvas.getBoundingClientRect=()=>({left:0,top:0,width:0,height:0});
 assert.equal(hit(w,0,0),null);
});

test('wrong source dimensions and an opaque source fail at the asset boundary',async()=>{
 for(const options of [{imageWidth:1152,imageHeight:1664},{alphaAt:()=>255}]){
  const w=rendererWorld(options);
  await assert.rejects(w.create(),/source\.png/);
  assert.equal(w.avatar.destroys,1);assert.equal(w.canvas.__kaiQA,undefined);assert.equal(w.listeners(),0);
 }
});

test('abort while the mesh loads destroys the avatar and leaks nothing',async()=>{
 const loaded=deferred(),w=rendererWorld({loaded}),pending=w.create();
 w.controller.abort();loaded.resolve(w.avatar);
 await assert.rejects(pending,{name:'AbortError'});
 assert.equal(w.avatar.destroys,1);assert.equal(w.images.length,0);assert.equal(w.canvas.__kaiQA,undefined);
 assert.equal(w.rig.portraitHitTest,undefined);assert.equal(w.listeners(),0);assert.equal(w.callbacks.size,0);
});

test('abort while the source decodes destroys the avatar and leaks nothing',async()=>{
 const decoded=deferred(),w=rendererWorld({decoded}),pending=w.create();
 await flush();assert.equal(w.images.length,1);
 w.controller.abort();decoded.resolve();
 await assert.rejects(pending,{name:'AbortError'});
 assert.equal(w.avatar.destroys,1);assert.equal(w.drawn.length,0);assert.equal(w.canvas.__kaiQA,undefined);assert.equal(w.listeners(),0);assert.equal(w.callbacks.size,0);
});

test('source decode failure destroys the avatar and keeps the original error',async()=>{
 const decoded=deferred(),w=rendererWorld({decoded}),pending=w.create(),failure=new Error('decode failed');
 await flush();decoded.reject(failure);
 await assert.rejects(pending,error=>error===failure);
 assert.equal(w.avatar.destroys,1);assert.equal(w.listeners(),0);
});

test('controls stay inside the armored parameter limits',async()=>{
 const w=await boot();
 for(let time=0;time<60;time+=.25){
  w.api.draw({breath:1,greet:1,look:1,time,blink:.25});
  const p=w.api.parameters;
  assert.ok(p.angleX>=4&&p.angleX<=6,`angleX ${p.angleX}`);assert.equal(p.angleY,-3);assert.ok(Math.abs(p.angleZ)<=1,`angleZ ${p.angleZ}`);
  zero(p.bodyAngleX);zero(p.bodyAngleZ);zero(p.mouthOpen);zero(p.gazeY);
  assert.ok(p.breath>0&&p.breath<=.2,`breath ${p.breath}`);assert.equal(p.eyeLOpen,.75);assert.equal(p.eyeROpen,.75);
 }
 w.api.draw({breath:1,greet:0,look:-1,time:0,blink:0});
 assert.ok(w.api.parameters.gazeX<0);assert.equal(w.api.parameters.angleX,-5);
});

test('rest is exact and the first animated frames leave it without a pop',async()=>{
 const w=await boot();
 for(const id of ['angleX','angleY','angleZ','breath','gazeX'])zero(w.avatar.params[id]);
 assert.equal(w.avatar.params.eyeLOpen,1);
 w.frame();
 for(const id of ['angleX','angleY','angleZ','breath','gazeX'])zero(w.avatar.params[id]);
 w.frame();
 assert.ok(w.avatar.params.breath<.001);assert.ok(Math.abs(w.avatar.params.angleX)<.001);
 w.frames(155);assert.ok(w.avatar.params.breath>.19,`breath peak ${w.avatar.params.breath}`);
});

test('a reaction nods once and a reaction older than the first frame does not',async()=>{
 const w=await boot();
 w.frame();w.rig.dataset.reactionSequence='r1';
 let deepest=0;for(let i=0;i<100;i++){w.frame();deepest=Math.min(deepest,w.avatar.params.angleY);}
 assert.ok(deepest<=-2.9&&deepest>=-3,`deepest ${deepest}`);zero(w.avatar.params.angleY);

 const stale=rendererWorld();stale.rig.dataset.reactionSequence='before-mount';stale.api=await stale.create();
 for(let i=0;i<60;i++){stale.frame();zero(stale.avatar.params.angleY);}
});

test('gaze follows the pointer and every release returns it to center',async()=>{
 for(const release of ['pointerleave','pointerup','pointercancel']){
  const w=await boot();
  w.target.dispatchEvent(pointer('pointermove',1024));w.frames(120);
  assert.ok(w.avatar.params.gazeX>.44,`${release} follow ${w.avatar.params.gazeX}`);
  w.target.dispatchEvent(pointer(release,1024));w.frames(120);
  assert.ok(Math.abs(w.avatar.params.gazeX)<.01,`${release} settle ${w.avatar.params.gazeX}`);
  w.api.dispose();
 }
});

test('reduced motion holds an exact rest and keeps no state for later',async()=>{
 const still=await boot({reduced:true});
 assert.equal(still.callbacks.size,0);
 const drawnAtRest=still.api.frames;still.frames(5);assert.equal(still.api.frames,drawnAtRest);
 still.target.dispatchEvent(pointer('pointermove',1024));
 still.media.matches=false;still.media.dispatchEvent(new Event('change'));still.frames(60);
 assert.ok(Math.abs(still.avatar.params.gazeX)<1e-9,'pointer ignored while reduced');

 const w=await boot();
 w.target.dispatchEvent(pointer('pointermove',1024));w.frames(60);
 w.media.matches=true;w.media.dispatchEvent(new Event('change'));
 assert.equal(w.callbacks.size,0);assert.equal(w.api.elapsed,0);
 for(const id of ['angleX','angleY','angleZ','breath','gazeX'])zero(w.avatar.params[id]);
 assert.equal(w.avatar.params.eyeLOpen,1);
 w.rig.dataset.reactionSequence='while-still';
 const before=w.api.frames;w.frames(5);assert.equal(w.api.frames,before);
 w.media.matches=false;w.media.dispatchEvent(new Event('change'));
 for(let i=0;i<60;i++){w.frame();zero(w.avatar.params.angleY);assert.ok(Math.abs(w.avatar.params.gazeX)<1e-9);}
});

test('a hidden document pauses without a time jump',async()=>{
 const w=await boot({hidden:true});
 assert.equal(w.callbacks.size,0);
 w.document.hidden=false;w.document.dispatchEvent(new Event('visibilitychange'));
 assert.equal(w.callbacks.size,1);
 w.frames(10);
 const paused=w.api.elapsed,frames=w.api.frames;
 w.document.hidden=true;w.document.dispatchEvent(new Event('visibilitychange'));
 assert.equal(w.callbacks.size,0);
 w.clock+=60000;w.document.hidden=false;w.document.dispatchEvent(new Event('visibilitychange'));
 w.frame();assert.equal(w.api.elapsed,paused);assert.equal(w.api.frames,frames+1);
 w.frame();assert.ok(Math.abs(w.api.elapsed-paused-.016)<1e-9);
});

test('QA contract matches Enjo under its Kai name',async()=>{
 const w=await boot();
 assert.equal(w.canvas.__kaiQA,w.api);assert.equal(w.canvas.__enjoQA,undefined);
 assert.equal(w.api.capture({breath:0,greet:0,look:0,time:0,blink:1}),'data:image/png;kai');
 assert.equal(w.api.parameters.eyeLOpen,0);
 const drawn=w.api.frames;w.api.draw({breath:0,greet:0,look:0,time:0,blink:0});assert.equal(w.api.frames,drawn+1);
 w.api.freeze();assert.equal(w.callbacks.size,0);
 w.api.resume();assert.equal(w.callbacks.size,1);
 assert.equal(w.api.elapsed,0);
});

test('resize repaints and dispose releases every resource once',async()=>{
 const w=await boot();
 assert.deepEqual(w.observer.observed,[w.canvas]);
 const painted=w.avatar.advances.length;w.observer.callback();
 assert.deepEqual(w.avatar.advances[painted],[0]);
 assert.ok(w.listeners()>0);
 const stale=[...w.callbacks.values()],frames=w.api.frames;
 w.api.dispose();w.api.dispose();
 assert.equal(w.avatar.destroys,1);assert.equal(w.observer.disconnected,true);assert.equal(w.listeners(),0);assert.equal(w.callbacks.size,0);
 assert.equal(w.canvas.__kaiQA,undefined);assert.equal(w.rig.portraitHitTest,undefined);
 for(const cb of stale)cb(w.clock+16);
 w.api.resume();
 assert.equal(w.api.frames,frames);assert.equal(w.callbacks.size,0);
});

// ---------- delivery gates: expected to FAIL until Codex delivers art and registration ----------
function decodePng(buffer){
 assert.equal(buffer.subarray(0,8).toString('latin1'),'\x89PNG\r\n\x1a\n');
 const idat=[];let width,height,depth,type,interlace;
 for(let at=8;at<buffer.length;){
  const size=buffer.readUInt32BE(at),kind=buffer.toString('latin1',at+4,at+8),body=buffer.subarray(at+8,at+8+size);
  if(kind==='IHDR'){width=body.readUInt32BE(0);height=body.readUInt32BE(4);depth=body[8];type=body[9];interlace=body[12];}
  if(kind==='IDAT')idat.push(body);
  at+=12+size;
 }
 assert.deepEqual([width,height,depth,type,interlace],[1024,1536,8,6,0],'source.png must be non-interlaced 8-bit RGBA at 1024x1536');
 const raw=inflateSync(Buffer.concat(idat)),stride=width*4,pixels=new Uint8Array(stride*height);
 for(let y=0;y<height;y++){
  const filter=raw[y*(stride+1)],row=y*(stride+1)+1,out=y*stride;
  for(let i=0;i<stride;i++){
   const a=i>=4?pixels[out+i-4]:0,b=y?pixels[out+i-stride]:0,c=i>=4&&y?pixels[out+i-stride-4]:0,p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
   const predicted=[0,a,b,(a+b)>>1,pa<=pb&&pa<=pc?a:pb<=pc?b:c][filter];
   pixels[out+i]=raw[row+i]+predicted;
  }
 }
 return (x,y)=>pixels[(y*width+x)*4+3];
}

test('DELIVERY GATE: portraits/kai-287/source.png is new transparent art with a covered head box',()=>{
 const url=new URL('../public/portraits/kai-287/source.png',import.meta.url),bytes=readFileSync(url);
 assert.equal(bytes.equals(readFileSync(new URL('../public/portraits/enjo-286/source.png',import.meta.url))),false,'Kai must not reuse Enjo source');
 const alpha=decodePng(bytes);
 for(const [x,y] of [[0,0],[1023,0],[0,1535],[1023,1535]])assert.ok(alpha(x,y)<24,`corner ${x},${y} must be transparent`);
 assert.ok(alpha(600,220)>=24,'face must be opaque');assert.ok(alpha(640,430)>=24,'chest must be opaque');
});

test('DELIVERY GATE: kai-287 folder protocol matches the source size',()=>{
 const rig=JSON.parse(read('../public/portraits/kai-287/rig.json')),layers=JSON.parse(read('../public/portraits/kai-287/built/layers.json')),manifest=JSON.parse(read('../public/portraits/kai-287/avatar.json'));
 assert.deepEqual([rig.image.width,rig.image.height],[1024,1536]);assert.deepEqual(layers.size,[1024,1536]);
 assert.equal(manifest.format,'mesh-avatar');assert.equal(manifest.version,1);
 assert.match(read('../public/portraits/kai-287/mesh-avatar.js'),/loadMeshAvatar/);
});

test('DELIVERY GATE: portrait registry points Kai at the new source',async()=>{
 const {getPortraitBase}=await import('../src/systems/PortraitBaseRegistration.mjs');
 const kai=getPortraitBase('kai');
 assert.equal(kai.src,'portraits/kai-287/source.png');assert.equal(kai.width,1024);assert.equal(kai.height,1536);
});
