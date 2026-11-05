import test from 'node:test';
import assert from 'node:assert/strict';
import {mountMenuPortrait} from '../src/systems/MenuPortraitPresentation.mjs';
import {mountPortraitInteraction} from '../src/systems/HomePortraitInteraction.mjs';
import {getPortraitBase} from '../src/systems/PortraitBaseRegistration.mjs';

// Test-only DOM/image/canvas double. Production code has no fallback for any of this.
class El{
 constructor(doc,tag){this.ownerDocument=doc;this.tagName=tag.toUpperCase();this.className='';this.dataset={};this.children=[];this.parentNode=null;this.hidden=false;this.textContent='';this.attrs={};this.listeners={};this.rect={left:0,top:0,width:0,height:0};
  const vars=new Map();this.style={getPropertyValue:k=>vars.get(k)??'',setProperty:(k,v)=>vars.set(k,String(v)),removeProperty:k=>vars.delete(k),vars};}
 appendChild(c){c.remove();c.parentNode=this;this.children.push(c);return c;}
 remove(){if(!this.parentNode)return;const p=this.parentNode;p.children.splice(p.children.indexOf(this),1);this.parentNode=null;}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]??null;}
 addEventListener(t,fn){(this.listeners[t]??=new Set()).add(fn);}
 removeEventListener(t,fn){this.listeners[t]?.delete(fn);}
 dispatch(t,e={}){for(const fn of [...(this.listeners[t]??[])])fn(e);}
 listenerCount(){return Object.values(this.listeners).reduce((n,s)=>n+s.size,0);}
 querySelector(sel){const cls=sel.slice(1);for(const c of this.children){if(c.className.split(' ').includes(cls))return c;const d=c.querySelector(sel);if(d)return d;}return null;}
 contains(n){for(;n;n=n.parentNode)if(n===this)return true;return false;}
 getBoundingClientRect(){return this.rect;}
}
class Img extends El{
 constructor(doc){super(doc,'img');this.naturalWidth=0;this.naturalHeight=0;this.complete=false;this.src='';this.paint=doc.paint;this.decodeResult=null;}
 decode(){this.decodeCalls=(this.decodeCalls||0)+1;return this.decodeResult??Promise.resolve();}
 finish(w=getPortraitBase('kai').width,h=getPortraitBase('kai').height){this.naturalWidth=w;this.naturalHeight=h;this.complete=true;this.dispatch('load');}
}
class Canvas extends El{
 constructor(doc){super(doc,'canvas');this.width=300;this.height=150;doc.canvases.push(this);}
 getContext(){const c=this;return{
  drawImage(img,x,y,w,h){c.drawn={img,w,h};},
  getImageData(x,y,w,h){if(c.ownerDocument.taint)throw Object.assign(new Error('tainted'),{name:'SecurityError'});
   const data=new Uint8ClampedArray(w*h*4),paint=c.drawn.img.paint;
   for(let j=0;j<h;j++)for(let i=0;i<w;i++)data[(j*w+i)*4+3]=paint((i+.5)/w,(j+.5)/h);
   return{data};}};}
}
const silhouette=(u,v)=>u>=.3&&u<.7&&v>=.1&&v<.95?255:0;
function setup({paint=silhouette,navigating=false}={}){
 let clock=1000;
 const doc={hidden:false,canvases:[],paint,taint:false,listeners:{},
  createElement:tag=>tag==='img'?new Img(doc):tag==='canvas'?new Canvas(doc):new El(doc,tag),
  addEventListener(t,fn){(doc.listeners[t]??=new Set()).add(fn);},removeEventListener(t,fn){doc.listeners[t]?.delete(fn);},
  defaultView:{setTimeout:()=>1,clearTimeout:()=>{},performance:{now:()=>clock}}};
 const view={doc,disposed:false,navigating,element(tag,cls,text,parent){const e=doc.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;parent?.appendChild(e);return e;}};
 const stage=doc.createElement('div'),button=stage.appendChild(doc.createElement('button')),fallback=doc.createElement('img');
 const output={bubble:doc.createElement('div'),line:doc.createElement('p')};
 const dispose=mountMenuPortrait(view,button,'kai',fallback);
 const speech=mountPortraitInteraction(view,button,stage,'kai',{output});
 const surface=button.querySelector('.menu-portrait-surface'),image=surface.querySelector('.menu-portrait-image');
 surface.rect=image.rect={left:100,top:50,width:800,height:832};
 const click=(x,y,detail=1)=>{clock+=1000;const before=button.dataset.interactionSequence;button.dispatch('click',{clientX:x,clientY:y,detail,defaultPrevented:false});
  return button.dataset.interactionSequence!==before?surface.dataset.reaction:null;};
 return{doc,view,stage,button,fallback,output,dispose,speech,surface,image,click};
}
const settle=()=>new Promise(r=>setImmediate(r));
// Match the contain box to the registered source, not a previous artwork's aspect ratio.
const at=(u,v)=>{const b=getPortraitBase('kai'),w=832*b.width/b.height;return[100+(800-w)/2+u*w,50+v*832];};
const kaiFace=()=>{const f=getPortraitBase('kai').face;return[f.x+f.width/2,f.y+f.height/2];};

test('nested P2L loading or failed host cannot answer through the outer portrait button',()=>{
 const f=setup(),host=f.doc.createElement('span');host.className='member-mark';host.dataset.homePortrait='sakura';f.button.appendChild(host);
 // Remove the unrelated static route to isolate the nested P2L readiness contract.
 f.dispose();host.dataset.portraitState='loading';assert.equal(f.speech.speak('should not speak'),false);
 host.dataset.portraitState='unavailable';assert.equal(f.speech.speak('should not speak'),false);
 host.dataset.portraitState='ready';assert.equal(f.speech.speak('ready'),true);f.speech();
});

test('loading portrait answers neither pointer nor keyboard', async()=>{
 const t=setup();
 assert.equal(t.button.dataset.menuPortraitState,'loading');
 assert.equal(t.click(...at(.5,.6)),null);
 assert.equal(t.click(NaN,NaN,0),null);
 assert.equal(t.speech.speak('topic'),false);
 assert.equal(t.image.hidden,true);
});

test('face hit is head, torso hit is body, top third below the head is body', async()=>{
 const t=setup();t.image.finish();await settle();
 assert.equal(t.button.dataset.menuPortraitState,'ready');
 assert.equal(t.button.dataset.portraitBase,'b255');
 assert.equal(t.button.dataset.portraitMotion,'source-static');
 assert.equal(t.click(...at(...kaiFace())),'head');
 assert.equal(t.output.line.textContent!=='',true);
 assert.equal(t.click(...at(.5,.6)),'body');
 assert.equal(t.click(...at(.5,.3)),'body');
 assert.equal(t.click(NaN,NaN,0),'body');// keyboard activation on a ready portrait
});

test('transparent pixels and contain padding miss', async()=>{
 const t=setup();t.image.finish();await settle();
 assert.equal(t.click(...at(.1,.5)),null);// transparent inside the drawn box
 assert.equal(t.click(150,400),null);// opaque mask column but inside left contain padding
 assert.equal(t.click(...at(.5,.99)),null);
 assert.equal(t.surface.portraitHitTest(211,50+.5*832),null);
 assert.equal(t.surface.portraitHitTest(...at(.5,.5)),'body');
 assert.equal(t.surface.portraitHitTest(900,400),null);// past right edge of contain box
});

test('size mismatch is visibly unavailable, hides Q and never speaks', async()=>{
 const t=setup();t.image.finish(1024,1024);await settle();
 assert.equal(t.button.dataset.menuPortraitState,'unavailable');
 assert.equal(t.fallback.hidden,true);
 const error=t.button.querySelector('.menu-portrait-error');
 assert.equal(error.getAttribute('role'),'status');
 assert.equal(t.image.parentNode,null);
 assert.equal(t.click(...at(.5,.6)),null);
 assert.equal(t.click(NaN,NaN,0),null);
 assert.equal(t.speech.speak('topic'),false);
});

test('decode rejection and tainted canvas are unavailable', async()=>{
 const a=setup();a.image.decodeResult=Promise.reject(Object.assign(new Error('decode'),{name:'EncodingError'}));a.image.finish();await settle();
 assert.equal(a.button.dataset.menuPortraitState,'unavailable');
 assert.equal(a.button.dataset.menuPortraitError,'decode');
 const b=setup();b.doc.taint=true;b.image.finish();await settle();
 assert.equal(b.button.dataset.menuPortraitState,'unavailable');
 assert.equal(b.button.dataset.menuPortraitError,'mask');
 assert.equal(b.doc.canvases[0].width,0);// scratch canvas released even on failure
 assert.equal(b.click(...at(.5,.6)),null);
});

test('alpha mask is bounded and its canvas released', async()=>{
 const t=setup();t.image.finish();await settle();
 assert.equal(t.doc.canvases.length,1);
 const c=t.doc.canvases[0];
 assert.ok(c.drawn.w<=128&&c.drawn.h<=192);
 assert.equal(t.surface.dataset.hitMask,`${c.drawn.w}x${c.drawn.h}`);
 assert.equal(c.width,0);assert.equal(c.height,0);
});

test('late decode after dispose does nothing', async()=>{
 const t=setup();let resolve;t.image.decodeResult=new Promise(r=>{resolve=r;});t.image.finish();
 t.dispose();t.speech();resolve();await settle();
 assert.equal(t.doc.canvases.length,0);
 assert.equal(t.button.dataset.menuPortraitState,undefined);
 assert.equal(t.button.children.length,0);
});

test('dispose removes surface, listeners, vars and dataset', async()=>{
 const t=setup();t.image.finish();await settle();
 t.dispose();
 assert.equal(t.button.querySelector('.menu-portrait-surface'),null);
 assert.equal(t.image.listenerCount(),0);
 assert.equal(t.button.style.vars.size,0);
 for(const k of ['menuPortrait','menuPortraitState','portraitBase','portraitMotion','menuPortraitError'])assert.equal(t.button.dataset[k],undefined);
 assert.equal(t.surface.portraitHitTest,undefined);
 assert.equal(t.fallback.hidden,false);
 t.dispose();// idempotent
});

test('dispose mid navigation does not reveal Q fallback', async()=>{
 const t=setup({navigating:true});t.image.finish();await settle();
 t.dispose();
 assert.equal(t.fallback.hidden,true);
});

test('Escape still dismisses while portrait is ready', async()=>{
 const t=setup();t.image.finish();await settle();
 assert.equal(t.click(...at(.5,.6)),'body');
 const events=t.doc.listeners.keydown;let prevented=false;
 for(const fn of events)fn({key:'Escape',preventDefault:()=>{prevented=true;}});
 assert.equal(prevented,true);
 assert.equal(t.stage.dataset.portraitSpeaking,undefined);
 assert.equal(t.surface.dataset.reaction,undefined);
});
