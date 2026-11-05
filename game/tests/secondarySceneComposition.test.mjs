import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from './helpers/publicShellHarness.mjs';
import {composeSecondaryScene} from '../src/systems/SecondarySceneComposition.mjs';

function fixture(page){
  const doc=createDocument(),root=doc.createElement('section');doc.body.append(root);
  const view={root,page,element(tag,cls,text,parent=root){const n=doc.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;parent.append(n);return n;},button(parent,label,callback,options={}){const n=this.element('button',options.className||'',label,parent);n.setAttribute('aria-label',label);if(options.action)n.dataset.action=options.action;n.addEventListener('click',callback);return n;}};
  return {view,main:view.element('main','shell-content')};
}
test('training uses original effects and train command without losing handlers',()=>{
  const {view,main}=fixture('workshop');
  const identity=view.element('section','workshop-member-context',undefined,main);identity.dataset.performer='enjo';
  view.element('div','workshop-member-copy',undefined,identity);
  const training=view.element('section','workshop-training',undefined,main);view.element('h2','','训练阶位 1',training);
  const holder=view.element('div','ui-sheet-holder',undefined,main);holder.hidden=true;
  const effects=view.element('dl','workshop-effects',undefined,holder);
  const footer=view.element('footer','shell-preparation-footer');let trained=0;
  const train=view.button(footer,'训练至阶位2',()=>trained++,{action:'train'});train.disabled=true;
  composeSecondaryScene(view,main);
  assert.equal(effects.parentNode,training);assert.equal(effects.hidden,false);
  assert.equal(train.parentNode,footer);assert.equal(train.disabled,true);assert.equal(train.dataset.secondaryLetter,undefined,'blocked reason stays in native text');
  assert.equal(main.dataset.secondaryPage,'workshop');assert.equal(identity.querySelector('.workshop-member-copy').querySelector('strong')?.textContent,undefined);
  assert.equal(trained,0);
});
test('venue promotes original room selection and borrows original assignment content',()=>{
  const {view,main}=fixture('venue'),screen=view.element('section','product-module-screen',undefined,main);
  const scene=view.element('section','pm-scene',undefined,screen);view.element('img','pm-scene-art',undefined,scene);view.element('div','pm-scene-copy','old',scene);view.element('div','pm-scene-caption','old',scene);view.element('div','pm-scene-portrait','old',scene);
  const map=view.element('nav','pm-room-map',undefined,scene);let rooms=0;const room=view.button(map,'休息室',()=>rooms++);room.dataset.roomTarget='lounge';
  const plan=view.element('div','pm-venue-plan',undefined,screen),row=view.element('section','pm-room',undefined,plan);row.dataset.room='lounge';
  const fields=view.element('div','pm-room-fields',undefined,row);view.element('p','pm-room-saved','未排班',row);
  view.element('small','pm-room-draft','未确认',row);const actions=view.element('div','pm-room-actions',undefined,row);
  const assign=view.button(actions,'保存排班',()=>{}, {action:'venue-assign-lounge'}),prepare=view.button(actions,'确认筹备',()=>{}, {action:'venue-prepare-lounge'});assign.disabled=true;
  view.element('footer','pm-footer','old',screen);
  for(const button of [room,assign,prepare]){const text=button.textContent;button.textContent='';view.element('span','',text,button);}
  composeSecondaryScene(view,main);
  assert.equal(fields.parentNode.className,'sec-venue-editor');assert.equal(fields.parentNode.parentNode.hidden,true);
  assert.equal(map.parentNode,scene);room.dispatchEvent({type:'click'});assert.equal(rooms,1);
  assert.equal(prepare.dataset.secondaryLetter,undefined);assert.equal(prepare.querySelector('span').dataset.venueLetter,'prepare');assert.equal(assign.querySelector('span').dataset.venueLetter,'assign');assert.equal(assign.disabled,true);
  assert.equal(scene.querySelector('.pm-scene-portrait').hidden,true);
  assert.equal(main.querySelectorAll('[data-action=venue-edit]').length,1);
});
