import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as registry from '../src/systems/PortraitBaseRegistration.mjs';
import * as portraits from '../src/systems/MenuPortraitPresentation.mjs';
import {getMenuAvatarArt,mountMenuAvatar} from '../src/systems/MenuPortraitAvatar.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';

const tick=()=>new Promise(r=>setImmediate(r));
const near=(a,b,msg)=>assert(Math.abs(a-b)<1e-9,`${msg}: ${a} != ${b}`);
const BASES={enjo:'portraits/enjo-286/',kai:'portraits/kai-287/'};
const SIZE={enjo:[1024,1536],kai:[1024,1536]};
const PAYLOAD=[...RUNTIME_PAYLOAD,...JSON.parse(fs.readFileSync(new URL('../home-payload.json',import.meta.url),'utf8'))];
// Measured B255 face boxes after uniform padded export, not old pose masks.
const FACE={enjo:[521,202,105,81],kai:[517,211,126,94]};

// Minimal DOM: only what the mount touches, so failures point at the contract, not a harness.
class Style{constructor(){this.props=new Map();}setProperty(k,v){this.props.set(k,String(v));}removeProperty(k){this.props.delete(k);}getPropertyValue(k){return this.props.get(k)??'';}}
class El{
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.dataset={};this.attrs={};this.hidden=false;this.listeners=new Map();this.style=new Style();this.textContent='';this.className='';}
 append(...nodes){for(const n of nodes){n.remove();n.parentNode=this;this.children.push(n);}}
 remove(){const p=this.parentNode;if(!p)return;p.children.splice(p.children.indexOf(this),1);this.parentNode=null;}
 setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
 addEventListener(t,f){if(!this.listeners.has(t))this.listeners.set(t,new Set());this.listeners.get(t).add(f);}
 removeEventListener(t,f){this.listeners.get(t)?.delete(f);}
 get listenerCount(){let n=0;for(const s of this.listeners.values())n+=s.size;return n;}
 fire(t){for(const f of [...(this.listeners.get(t)??[])])f({type:t});}
 byClass(cls){return this.children.find(c=>c.className.split(' ').includes(cls))??null;}
}
function fixture(id,{decode='pending',motionOptions=null,priorVars=false}={}){
 const parent=new El('button'),fallback=new El('img');parent.append(fallback);
 if(priorVars)parent.style.setProperty('--portrait-head','0.5');
 let resolve,reject,decodeCalls=0;const pending=new Promise((a,b)=>{resolve=a;reject=b;});
 const created=[];
 const view={disposed:false,element(tag,cls,text,host){const n=new El(tag);n.className=cls;if(text!==undefined)n.textContent=text;host.append(n);created.push(n);
  if(tag==='img')n.decode=()=>{decodeCalls++;return decode==='pending'?pending:Promise.resolve();};return n;},
  doc:{createElement(tag){
   assert.equal(tag,'canvas');
   return {width:0,height:0,getContext(){
    return {drawImage(){},getImageData(x,y,w,h){const data=new Uint8ClampedArray(w*h*4);data.fill(255);return {data};}};
   }};
  }}};
 const dispose=portraits.mountMenuPortrait(view,parent,id,fallback,motionOptions);
 const image=parent.byClass('menu-portrait-surface').byClass('menu-portrait-image');
 return{parent,fallback,view,dispose,image,created,resolve,reject,get decodeCalls(){return decodeCalls;},
  load(w=SIZE[id][0],h=SIZE[id][1]){image.naturalWidth=w;image.naturalHeight=h;image.fire('load');}};
}

test('registry holds exactly two immutable roles with exact source dimensions and same-directory paths',()=>{
 assert.deepEqual(Object.keys(registry.PORTRAIT_BASES).sort(),['enjo','kai']);
 assert(Object.isFrozen(registry.PORTRAIT_BASES));
 for(const id of ['enjo','kai']){
  const b=registry.getPortraitBase(id);
  assert(Object.isFrozen(b)&&Object.isFrozen(b.face)&&Object.isFrozen(b.avatar));
  assert.equal(b.src,`${BASES[id]}source.png`);assert.equal(b.width,SIZE[id][0]);assert.equal(b.height,SIZE[id][1]);
  assert.equal(b.avatar.src,`${BASES[id]}${id}-avatar.webp`);assert.equal(b.avatar.width,160);assert.equal(b.avatar.height,160);
 }
 for(const id of ['sakura','bogus',null,'__proto__','toString'])assert.equal(registry.getPortraitBase(id),null);
});

test('face boxes use each measured source size and centers are box midpoints',()=>{
 for(const[id,[x,y,w,h]]of Object.entries(FACE)){
  const b=registry.getPortraitBase(id),m=registry.portraitBaseMetrics(b);
  const [W,H]=SIZE[id];
  near(b.face.x,x/W,id+' x');near(b.face.y,y/H,id+' y');near(b.face.width,w/W,id+' w');near(b.face.height,h/H,id+' h');
  near(m.faceX,(x+w/2)/W,id+' center x');near(m.faceY,(y+h/2)/H,id+' center y');
  near(m.head,b.face.height*H/W,id+' head');near(m.head,h/W,id+' head as width fraction');
  near(m.ratio,W/H,id+' ratio');
 }
 near(registry.portraitBaseMetrics(registry.getPortraitBase('enjo')).faceX,573.5/1024,'enjo cx');
 near(registry.portraitBaseMetrics(registry.getPortraitBase('kai')).faceY,258/1536,'kai cy');
});

test('optical face height: a 70px --portrait-head renders both faces exactly 70px tall',()=>{
 for(const id of ['enjo','kai']){
  const b=registry.getPortraitBase(id),{head}=registry.portraitBaseMetrics(b);
  const renderedWidth=70/head,renderedHeight=renderedWidth*b.height/b.width;
  near(b.face.height*renderedHeight,70,id+' face px');
 }
});

test('registration CSS vars carry the computed metrics as strings',()=>{
 for(const id of ['enjo','kai']){
  const b=registry.getPortraitBase(id),m=registry.portraitBaseMetrics(b),v=registry.portraitBaseVars(b);
  assert.deepEqual(Object.keys(v).sort(),['--face-x','--face-y','--portrait-frame-height','--portrait-frame-top','--portrait-head','--portrait-ratio']);
  assert(Object.values(v).every(s=>typeof s==='string'));
  near(Number(v['--face-x']),m.faceX,'x');near(Number(v['--face-y']),m.faceY,'y');near(Number(v['--portrait-head']),m.head,'head');
  assert.equal(v['--portrait-ratio'],SIZE[id].join(' / '));
  const frame=parseFloat(v['--portrait-frame-height'])/100,top=parseFloat(v['--portrait-frame-top'])/100;
  near(top+b.bounds.y/b.height*frame,0,'source ink top is frame top');
  near(top+(b.bounds.y+b.bounds.height)/b.height*frame,1,'source ink feet reach frame bottom');
 }
});

test('menu art and avatars resolve through the registry; Sakura avatar is unchanged',()=>{
 for(const id of ['enjo','kai']){
  const b=registry.getPortraitBase(id),art=portraits.getMenuPortraitArt(id),av=getMenuAvatarArt(id);
  assert.equal(art.src,b.src);assert.equal(art.width,SIZE[id][0]);assert.equal(art.height,SIZE[id][1]);
  assert.equal(av.src,b.avatar.src);assert.equal(av.src.slice(0,av.src.lastIndexOf('/')),b.src.slice(0,b.src.lastIndexOf('/')));
 }
 assert.equal(portraits.getMenuPortraitArt('sakura'),null);
 assert.deepEqual({...getMenuAvatarArt('sakura')},{src:'art/menu-coherent-cast-20261025/sakura-avatar.webp',width:160,height:160});
});

test('new mount neither imports nor calls the old motion/expression layer, even when animation is requested',async()=>{
 const src=fs.readFileSync(new URL('../src/systems/MenuPortraitPresentation.mjs',import.meta.url),'utf8');
 assert(!src.includes('MenuPortraitMotion'));assert(!src.includes('menu-expression'));assert(!src.includes('eyes.png'));
 const f=fixture('enjo',{motionOptions:{animate:true,background:new El('div')}});
 f.load();f.resolve();await tick();
 assert.equal(f.parent.dataset.menuPortraitState,'ready');
 assert.equal(f.parent.dataset.portraitMotion,'source-static');assert.equal(f.parent.dataset.portraitBase,'b255');
 assert.deepEqual(f.created.map(n=>n.className),['menu-portrait-surface','menu-portrait-image']);
 assert.equal(f.image.style.props.size,0);
 f.dispose();
});

test('mount hides Q immediately, applies registry vars on the parent, and cleanup removes everything it added',async()=>{
 const f=fixture('kai',{priorVars:true});
 assert.equal(f.fallback.hidden,true);assert.equal(f.image.hidden,true);
 const vars=registry.portraitBaseVars(registry.getPortraitBase('kai'));
 for(const[k,v]of Object.entries(vars))assert.equal(f.parent.style.getPropertyValue(k),v);
 assert.equal(f.image.alt,'');assert.equal(f.image.getAttribute('aria-hidden'),'true');
 f.load();f.load();assert.equal(f.decodeCalls,1);f.resolve();await tick();
 assert.equal(f.image.hidden,false);assert.equal(f.fallback.hidden,true);
 assert(f.image.listenerCount>0);
 const image=f.image;f.dispose();f.dispose();
 assert.equal(image.listenerCount,0);assert.equal(image.parentNode.parentNode,null);
 for(const k of ['menuPortrait','menuPortraitState','portraitBase','portraitMotion'])assert.equal(f.parent.dataset[k],undefined,k);
 for(const k of ['--face-x','--face-y','--portrait-ratio'])assert.equal(f.parent.style.getPropertyValue(k),'',k);
 // Cleanup restores the caller's own inline value rather than deleting it.
 assert.equal(f.parent.style.getPropertyValue('--portrait-head'),'0.5');
 assert.equal(f.fallback.hidden,false);
});

test('load error, decode rejection and wrong dimensions show an accessible error, never Q, never a spinner',async()=>{
 const cases=[['error',f=>f.image.fire('error')],['decode',async f=>{f.load();f.reject(Object.assign(Error('corrupt'),{name:'EncodingError'}));await tick();}],['dimension',f=>f.load(1152,1664)]];
 for(const[name,act]of cases){
  const f=fixture('enjo');const image=f.image;await act(f);
  assert.equal(f.fallback.hidden,true,name+' Q stays hidden');
  assert.equal(f.parent.dataset.menuPortraitState,'unavailable',name);
  assert.equal(image.parentNode,null,name+' image removed');
  const err=f.parent.byClass('menu-portrait-error');assert(err,name+' error node');
  assert.equal(err.getAttribute('role'),'status');assert(err.textContent.trim().length>0);
  if(name==='dimension')assert.equal(f.decodeCalls,0);
  f.resolve();await tick();assert.equal(f.parent.dataset.menuPortraitState,'unavailable',name+' late decode');
  f.dispose();
  assert.equal(f.parent.byClass('menu-portrait-error'),null,name+' error removed on cleanup');
  assert.equal(image.listenerCount,0);assert.equal(f.parent.dataset.portraitBase,undefined);
 }
});

test('companion page Kai/Enjo constants mirror the registry; Sakura line is untouched',()=>{
 const css=fs.readFileSync(new URL('../src/styles/companionConversationV3.css',import.meta.url),'utf8');
 assert(css.includes('& .pm-scene[data-member=sakura] {--portrait-head:0.2195;--face-x:0.542;--face-y:0.139;--portrait-ratio:853 / 1280;}'));
 for(const id of ['enjo','kai']){
  const rule=css.match(new RegExp(`\\.pm-scene\\[data-member=${id}\\] \\{([^}]*)\\}`))[1];
  const val=k=>rule.match(new RegExp(`${k}:([^;]+);`))[1].trim();
  const v=registry.portraitBaseVars(registry.getPortraitBase(id));
  for(const k of ['--portrait-head','--face-x','--face-y'])assert(Math.abs(Number(val(k))-Number(v[k]))<1e-6,`${id} ${k}`);
  assert.equal(val('--portrait-ratio'),v['--portrait-ratio']);
 }
});

test('runtime payload admits the exact new Enjo files and retains existing referenced bases',()=>{
 const rows=RUNTIME_PAYLOAD.filter(r=>r.group==='owner-enjo-rig-candidate');
 assert.deepEqual(rows.map(r=>r.file).sort(),['art/enjo-portrait-rig-20261101/enjo-avatar.webp','art/enjo-portrait-rig-20261101/enjo.webp','rigs/companion-enjo-20261101/enjo.p2lrt']);
 assert.equal(PAYLOAD.filter(r=>r.file.startsWith(BASES.enjo)).length,20);
 assert.equal(PAYLOAD.filter(r=>r.file.startsWith(BASES.kai)).length,20);
 for(const id of ['enjo','kai']){const b=registry.getPortraitBase(id);for(const s of [b.src,b.avatar.src])assert(PAYLOAD.some(r=>r.file===s),s);}
 // Old art stays listed until Codex audits other routes.
 assert(RUNTIME_PAYLOAD.some(r=>r.file==='art/menu-series-cast-20261031/kai.webp'));
});

test('new-source avatar IO failure is explicit and never revives the Q proxy',()=>{
 for(const id of ['kai','enjo']){
  const parent=new El('span'),fallback=new El('img');parent.append(fallback);
  const view={doc:{},disposed:false,element(tag,cls,text,host){const n=new El(tag);n.className=cls;if(text!==undefined)n.textContent=text;host.append(n);return n;}};
  const image=mountMenuAvatar(view,parent,id,fallback);image.fire('error');
  assert.equal(fallback.hidden,true);assert.equal(parent.dataset.avatarState,'unavailable');
  assert.equal(parent.byClass('menu-avatar-error').getAttribute('aria-label'),'头像未能载入');
 }
});

test('Sakura home/roster framing cannot leak into the existing companion rig',()=>{
 const css=fs.readFileSync(new URL('../src/styles/castRebuild.css',import.meta.url),'utf8');
 assert(css.includes('#public-shell:is([data-page=desk],[data-page=roster]) [data-home-portrait=sakura]'));
 assert(!css.includes('#public-shell [data-home-portrait=sakura]'));
});
