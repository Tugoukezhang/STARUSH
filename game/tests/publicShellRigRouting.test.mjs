import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function marked(page,id,animate){
 const l=loadScenes();l.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const {PublicShellView}=l.loadRuntime('systems/PublicShellView.mjs'),doc=l.document;
 const parent=doc.createElement('button');doc.body.append(parent);
 const view={doc,page,navigating:false,disposed:false,element(tag,cls,text,host){const node=doc.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=text;host.append(node);return node;}};
 const mark=PublicShellView.prototype.mark.call(view,parent,{id,identityMark:id,colorHex:0xffffff},true,{animate});
 return{view,mark,dispose(){view.homePortraitDispose?.();view.menuPortraitDispose?.();}};
}

for(const page of ['desk','roster','preflight','lounge'])test(page+' uses the existing P2L player for animated Sakura, not layered strips',()=>{
 const f=marked(page,'sakura',true);try{
  assert.equal(f.mark.dataset.portraitState,'loading');assert(f.mark.querySelector('.home-portrait-rig').querySelector('canvas'));
  assert.equal(f.mark.querySelector('.home-portrait-parts'),null);assert(f.mark.querySelector('.member-portrait').hidden);
 }finally{f.dispose();}
});
test('nonanimated secondary portraits stay on the deliberate static art route',()=>{
 const f=marked('workshop','sakura',false);try{assert(f.mark.querySelector('.home-portrait-parts'));assert.equal(f.mark.querySelector('canvas'),null);}finally{f.dispose();}
});
for(const page of ['desk','roster','preflight','lounge'])test(page+' mounts the registered Enjo model for animated Enjo with its own aspect, never a static or Sakura substitute',()=>{
 const f=marked(page,'enjo',true);try{
  assert.equal(f.mark.dataset.homePortrait,'enjo');assert.equal(f.mark.dataset.portraitState,'loading');assert.equal(f.mark.dataset.menuPortrait,undefined);
  const rig=f.mark.querySelector('.home-portrait-rig');assert(rig.querySelector('canvas'));assert.equal(rig.style['aspect-ratio'],'1152 / 1664');assert(f.mark.querySelector('.member-portrait').hidden);
 }finally{f.dispose();}
});
test('animated Sakura keeps its 853x1280 registration',()=>{const f=marked('desk','sakura',true);try{assert.equal(f.mark.dataset.homePortrait,'sakura');assert.equal(f.mark.querySelector('.home-portrait-rig').style['aspect-ratio'],'853 / 1280');}finally{f.dispose();}});
test('Kai has no rig registration and stays on the static portrait route',()=>{
 const f=marked('desk','kai',true);try{assert.equal(f.mark.dataset.menuPortrait,'kai');assert.equal(f.mark.querySelector('.home-portrait-rig'),null);assert.equal(f.mark.dataset.portraitMotion,'source-static');}finally{f.dispose();}
});
test('nonanimated Enjo stays on the deliberate static route',()=>{
 const f=marked('workshop','enjo',false);try{assert.equal(f.mark.dataset.menuPortrait,'enjo');assert.equal(f.mark.querySelector('canvas'),null);assert.equal(f.mark.dataset.homePortrait,undefined);}finally{f.dispose();}
});
