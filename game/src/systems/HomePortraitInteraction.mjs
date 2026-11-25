import {mountMenuAvatar} from './MenuPortraitAvatar.mjs';
const NAMES=Object.freeze({sakura:'战术女武神',kai:'翡翠风歌',enjo:'蔚蓝魔法师'});
const LINES=Object.freeze({
 sakura:{head:['别急，我已经听到下一拍了。','瞄准完成。下一场，我来开路。'],body:['弹匣检查好了，随时可以出发。','这一拍，想和你配合得更好。']},
 kai:{head:['风铃已调好音。你指方向，我来引路。','在这里，先听一会儿轻轻的风声吧。'],body:['前面的路，我会先替你探清。','准备好了。保持步调，我们一起前进。']},
 enjo:{head:['书页翻好啦，下一拍一起绽放！','刚才那一拍，还想再听一次吗？'],body:['书里还有好多故事，等开演后一起读吧。','等灯光亮起，我们就一起上台吧。']},
});
const UNSETTLED=new Set(['loading','unavailable']);
export function getPortraitDialogue(id,area,sequence){const lines=Object.hasOwn(LINES,id)?LINES[id][area==='head'?'head':'body']:null;return lines?lines[Math.abs(Math.trunc(sequence)||0)%lines.length]:null;}

export function mountPortraitInteraction(view,button,stage,id,options={}){
 if(!Object.hasOwn(LINES,id)||!button||!stage)return Object.assign(()=>{},{speak:()=>false});
 const win=view.doc.defaultView||globalThis,after=(fn,ms)=>win.setTimeout?win.setTimeout(fn,ms):globalThis.setTimeout(fn,ms),cancel=n=>win.clearTimeout?win.clearTimeout(n):globalThis.clearTimeout(n),now=()=>win.performance?.now?.()??Date.now();
 const external=options.output!==undefined;
 const bubble=external?options.output.bubble:view.element('div','portrait-dialogue',undefined,stage);
 let line=external?options.output.line:null;
 if(!external){
  bubble.hidden=true;bubble.setAttribute('role','status');bubble.setAttribute('aria-live','polite');bubble.setAttribute('aria-atomic','true');
  const heading=view.element('div','portrait-dialogue-heading',undefined,bubble),avatar=view.element('span','portrait-dialogue-avatar',undefined,heading);
  mountMenuAvatar(view,avatar,id);view.element('strong','portrait-dialogue-speaker',NAMES[id],heading);
  line=view.element('p','portrait-dialogue-line',undefined,bubble);
 }
 let disposed=false,timer=null,last=-Infinity,sequence=0,press=null,dragged=false,activeRig=null;
 const live=()=>!disposed&&!view.disposed&&!view.navigating&&button.parentNode===stage&&(!view.root||view.root.contains(button));
 // Direct touches wait for a decoded portrait. The separate conversation dock can display its text immediately.
 const settled=()=>{const host=button.querySelector('.member-mark');
  return !UNSETTLED.has(button.dataset.portraitState)&&!UNSETTLED.has(button.dataset.menuPortraitState)
   &&!UNSETTLED.has(host?.dataset.portraitState)&&!UNSETTLED.has(host?.dataset.menuPortraitState);};
 const canAddress=()=>live()&&!view.doc.hidden&&!view.scene?._sessionExperience?.isBlocking?.()&&!view.root?.inert;
 const available=()=>canAddress()&&settled();
 const dismiss=()=>{options.reaction?.clear();if(timer!==null)cancel(timer);timer=null;if(!external)bubble.hidden=true;delete stage.dataset.portraitSpeaking;if(activeRig){delete activeRig.dataset.reaction;delete activeRig.dataset.reactionSequence;activeRig=null;}};
 const key=e=>{if(e.key==='Escape'&&(external?timer!==null:!bubble.hidden)){dismiss();e.preventDefault?.();}};
 const visibility=()=>{if(view.doc.hidden)dismiss();};
 const down=e=>{press={x:e.clientX,y:e.clientY};dragged=false;};
 const up=e=>{if(press)dragged=Math.hypot(e.clientX-press.x,e.clientY-press.y)>8;press=null;};
 const abort=()=>{press=null;dragged=true;};
 const portraitRig=()=>button.querySelector('.home-portrait-rig')||button.querySelector('.menu-portrait-motion')||button.querySelector('.menu-portrait-surface');
 // Pointer and topic speech share output, reaction sequence and the single expiry clock.
 const present=(text,area,rig)=>{
  line.textContent=text;bubble.hidden=false;bubble.dataset.performer=id;stage.dataset.portraitSpeaking=id;
  options.reaction?.show(area);
  button.dataset.interactionSequence=String(++sequence);
  if(rig){activeRig=rig;rig.dataset.reaction=area;rig.dataset.reactionSequence=String(sequence);}
  if(timer!==null)cancel(timer);
  timer=after(dismiss,Math.max(2600,Math.min(4200,1400+line.textContent.length*60)));
  return true;
 };
 const speak=(text,area='body')=>canAddress()&&(options.topicDock===true||settled())?present(text,area,settled()?portraitRig():null):false;
 const click=e=>{
  if(!available()||e.defaultPrevented||now()-last<260)return;
  if(dragged&&e.detail!==0){dragged=false;return;}
  let area='body';const rig=portraitRig(),canvas=rig?.querySelector('canvas');
  if(e.detail!==0&&Number.isFinite(e.clientX)&&Number.isFinite(e.clientY)){
   const reactionHit = options.reaction?.hitTest(e.clientX,e.clientY);
   if(reactionHit !== undefined){
    if(reactionHit===null)return;area=reactionHit;
   }else if(typeof rig?.portraitHitTest==='function'){
    area=rig.portraitHitTest(e.clientX,e.clientY);if(area===null)return;
   }else{
   const box=(canvas||rig||button).getBoundingClientRect?.();
   if(box?.width>0&&box?.height>0){
    const u=(e.clientX-box.left)/box.width,v=(e.clientY-box.top)/box.height;if(u<0||v<0||u>=1||v>=1)return;
    if(canvas){try{if(canvas.getContext('2d').getImageData(Math.floor(u*canvas.width),Math.floor(v*canvas.height),1,1).data[3]<24)return;}catch{return;}}
    area=v<.33?'head':'body';
   }
   }
  }
  last=now();present(getPortraitDialogue(id,area,sequence),area,rig);
 };
 button.addEventListener('click',click);button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',abort);
 const keyTarget=view.root||view.doc;
 keyTarget.addEventListener('keydown',key);view.doc.addEventListener('visibilitychange',visibility);
 const dispose=()=>{if(disposed)return;disposed=true;dismiss();button.removeEventListener('click',click);button.removeEventListener('pointerdown',down);button.removeEventListener('pointerup',up);button.removeEventListener('pointercancel',abort);keyTarget.removeEventListener('keydown',key);view.doc.removeEventListener('visibilitychange',visibility);if(!external)bubble.remove();delete button.dataset.interactionSequence;};
 dispose.speak=speak;return dispose;
}
