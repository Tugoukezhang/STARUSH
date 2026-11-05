// UNRUN when written (Claude had no shell in B256). Codex: `node --test tests/portraitSafeAreaLayout.test.mjs`.
// Expected RED against B255 source: home identity sits in .ui-home-stage, roster tools/name sit on the stage,
// lounge scene has no portrait frame. DOM composition only; pixel framing is verified in Codex browser captures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderCompactHome} from '../src/systems/CompactMenuPages.mjs';
import {compactHierarchyPage} from '../src/systems/MenuHierarchy.mjs';

const camel=name=>name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
class FakeNode extends EventTarget {
  constructor(doc,tag){
    super();this.ownerDocument=doc;this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;
    this.dataset={};this.attributes=new Map();this.hidden=false;this.disabled=false;this.textContent='';this.className='';
  }
  get classList(){const node=this;return {contains:c=>node.className.split(/\s+/).includes(c),add:(...c)=>{node.className=[...new Set([...node.className.split(/\s+/).filter(Boolean),...c])].join(' ');}};}
  setAttribute(k,v){this.attributes.set(k,String(v));}
  getAttribute(k){return this.attributes.has(k)?this.attributes.get(k):null;}
  append(...nodes){for(const n of nodes)this.insertBefore(n,null);}
  insertBefore(node,ref){
    node.remove();const index=ref?this.children.indexOf(ref):-1;
    if(index<0)this.children.push(node);else this.children.splice(index,0,node);node.parentNode=this;return node;
  }
  remove(){if(!this.parentNode)return;const list=this.parentNode.children;list.splice(list.indexOf(this),1);this.parentNode=null;}
  replaceChildren(...nodes){for(const c of [...this.children])c.remove();this.append(...nodes);}
  contains(node){for(let n=node;n;n=n.parentNode)if(n===this)return true;return false;}
  click(){this.dispatchEvent(new Event('click'));}
  matches(selector){
    const m=/^([a-z0-9]*)((?:\.[\w-]+)*)((?:\[[^\]]+\])*)$/i.exec(selector);if(!m)throw new Error('unsupported selector '+selector);
    if(m[1]&&this.tagName!==m[1].toUpperCase())return false;
    for(const c of m[2].split('.').filter(Boolean))if(!this.classList.contains(c))return false;
    for(const [,name,value] of m[3].matchAll(/\[([\w-]+)(?:="?([^"\]]*)"?)?\]/g)){
      const actual=name.startsWith('data-')?this.dataset[camel(name.slice(5))]:this.getAttribute(name);
      if(actual===undefined||actual===null||(value!==undefined&&String(actual)!==value))return false;
    }
    return true;
  }
  querySelectorAll(selector){const out=[];const walk=n=>{for(const c of n.children){if(c.matches(selector))out.push(c);walk(c);}};walk(this);return out;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
class FakeDocument extends EventTarget {
  constructor(){super();this.documentElement=new FakeNode(this,'html');}
  createElement(tag){return new FakeNode(this,tag);}
}
const visible=node=>{for(let n=node;n;n=n.parentNode)if(n.hidden)return false;return true;};

function makeView(page){
  const doc=new FakeDocument(),root=doc.createElement('section');doc.documentElement.append(root);
  const calls=[];
  const view={doc,root,page,disposed:false,navigating:false,calls,options:{onResume:()=>calls.push('resume')},
    scene:{_sessionExperience:{isBlocking:()=>false}},
    selection:{memberId:'kai',previewMember(id){calls.push('preview:'+id);return true;},confirmMember(){calls.push('confirm');}},
    element(tag,className,text,parent=root){const n=doc.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;parent?.append(n);return n;},
    button(parent,label,callback,{className='',action,iconOnly=false}={}){
      const b=view.element('button',className,undefined,parent);b.setAttribute('aria-label',label);
      if(action)b.dataset.action=action;
      if(!iconOnly)view.element('span','',label,b);else b.title=label;
      b.addEventListener('click',()=>{if(view.disposed||view.navigating||b.disabled)return;callback();});return b;
    },
    mark(parent){view.element('div','member-mark',undefined,parent);},
    showPage(target){calls.push('page:'+target);return true;},
    render(){view.hierarchySheetDispose?.();root.replaceChildren();},
  };
  return view;
}

test('home: name and chapter form one dock caption beside the commands, nothing lettered over the figure',()=>{
  const view=makeView('desk'),main=view.element('main','shell-content');
  const renderContinue=(v,dock,actions)=>v.button(actions,'继续公演',()=>view.calls.push('resume'),{action:'resume-run'});
  renderCompactHome(view,main,{member:{id:'enjo',name:'重锤手'},chapter:{id:'opening',name:'星光初演'}},{start:()=>{},renderContinue});
  const stage=main.querySelector('.ui-home-stage'),dock=view.root.querySelector('.ui-home-dock');
  assert.equal(stage.querySelectorAll('[data-ui-letter]').length,0,'no letter art over the mascot/body');
  assert.ok(stage.querySelector('.ui-home-portrait'),'portrait stays the stage surface');
  const caption=dock.children[0];
  assert.ok(caption.classList.contains('ui-home-caption'));
  assert.deepEqual(caption.children.map(n=>n.dataset.uiLetter),['enjo','chapter-opening'],'name first, chapter secondary');
  assert.equal(view.root.querySelectorAll('.ui-home-identity').length,1,'one name, no duplicate heading');
  assert.equal(view.root.querySelectorAll('.ui-home-chapter').length,1);
  const actions=dock.querySelector('.ui-home-primary');
  assert.equal(dock.children[1],actions);
  assert.equal(actions.querySelector('[data-action=start]').querySelector('.ui-start-art').src,'art/home-integrity-20261025/start.png');
  assert.equal(view.root.parentNode.querySelector('.ui-room-background').parentNode.className,'ui-home-scene','one scene extends behind safe controls');
  assert.equal(actions.querySelector('[data-action=resume-run]').dataset.uiLetter,'resume');
  assert.equal(view.root.querySelectorAll('[data-action=start]').length,1);
  actions.querySelector('[data-action=start]').click();
  assert.deepEqual(view.calls,['page:preflight'],'start still opens the confirm-only preflight');
  assert.equal(main.querySelector('.ui-home-spaces').children.length,3,'edge spaces unchanged');
});

function rosterFixture(selection='preview'){
  const view=makeView('roster'),main=view.element('main','shell-content');
  const detail=view.element('section','shell-performer-detail',undefined,main);detail.dataset.selection=selection;
  const stage=view.element('div','roster-portrait-stage',undefined,detail);
  view.element('div','member-mark',undefined,stage);
  const strip=view.element('div','shell-member-strip',undefined,stage);
  for(const id of ['sakura','kai','enjo'])view.button(strip,id,()=>view.selection.previewMember(id),{className:'shell-member-option'});
  view.element('div','roster-stage-stamp',undefined,stage);view.element('span','roster-role-emblem',undefined,stage);
  const name=view.element('div','shell-performer-name roster-stage-identity',undefined,stage);
  view.element('h2','','机甲剑士',name);view.element('p','','预览成员',name);
  const inspector=view.element('section','roster-inspector',undefined,detail);
  const tabs=view.element('div','roster-inspector-tabs',undefined,inspector);
  for(const [id,label] of [['ability','专属行动'],['preparation','演出准备'],['dossier','成员档案']]){
    const tab=view.button(tabs,label,()=>{view.rosterPanel=id;},{className:'roster-inspector-tab'});tab.dataset.rosterTab=id;
    view.element('section','',label,inspector).dataset.rosterPanel=id;
  }
  view.button(inspector.querySelector('[data-roster-panel=preparation]'),'成员训练',()=>view.showPage('workshop'),{action:'member-training'});
  const footer=view.element('footer','shell-selection-footer');
  view.element('div','roster-confirm-context',undefined,footer);
  view.button(footer,'确认机甲剑士出战',()=>view.selection.confirmMember(),{className:'shell-primary shell-confirm',action:'confirm-member'});
  compactHierarchyPage(view,main,{member:{id:'kai'}});
  return {view,main,stage,strip,footer};
}

test('roster: utility lane is separate from the figure; name leaves the blade-tip corner',()=>{
  const {view,stage,strip,footer}=rosterFixture();
  const lane=stage.querySelector('.ui-roster-lane');
  assert.ok(lane,'reserved utility lane');
  assert.equal(stage.querySelectorAll('.ui-actor-switch').length,1,'one native actor switch');
  assert.equal(lane.querySelectorAll('.ui-actor-switch').length,1);
  assert.equal(visible(strip),false,'no three fixed actor selectors');
  assert.deepEqual(lane.querySelector('.ui-roster-actions').querySelectorAll('button').map(b=>b.dataset.uiIcon),['train','skill','info']);
  for(const button of stage.querySelectorAll('button'))assert.ok(lane.contains(button),'every stage control lives in the lane');
  assert.equal(stage.querySelector('.roster-stage-identity'),null,'name no longer overlays the stage');
  const identity=footer.querySelector('.roster-stage-identity'),confirm=footer.querySelector('[data-action=confirm-member]');
  assert.equal(identity.querySelector('h2').dataset.uiLetter,'kai');
  assert.equal(footer.children.indexOf(identity)+1,footer.children.indexOf(confirm),'caption directly precedes confirm');
  assert.equal(confirm.dataset.uiLetter,'confirm');
  assert.equal(stage.querySelectorAll('.member-mark').length,1,'full figure surface kept');
  // Sheet opening through these tools is covered by menuHierarchy.test.mjs.
  confirm.click();assert.deepEqual(view.calls,['confirm']);
});

test('roster: current actor has readable state instead of an unexplained return glyph',()=>{
  const {footer}=rosterFixture('current');
  const confirm=footer.querySelector('[data-action=confirm-member]');
  assert.equal(confirm.dataset.current,'true');assert.equal(confirm.dataset.uiLetter,undefined);
  assert.ok(footer.querySelector('.roster-stage-identity'));
  assert.equal(confirm.hidden,true);assert.equal(footer.querySelector('.ui-current-deploy').textContent,'当前出战');
});

test('lounge: thigh-up portrait frame, existing portrait element, one switch, dialogue and answers untouched',()=>{
  const view=makeView('lounge'),main=view.element('main','shell-content');
  const screen=view.element('div','product-module-screen',undefined,main);
  const strip=view.element('div','pm-cast-strip',undefined,screen);
  for(const id of ['sakura','kai','enjo'])view.button(strip,id,()=>view.calls.push('companion:'+id),{className:'pm-cast-option',action:'companion-member-'+id});
  const scene=view.element('section','pm-scene',undefined,screen);
  const portrait=view.element('div','pm-scene-portrait',undefined,scene);view.element('div','member-mark',undefined,portrait);
  view.element('div','pm-scene-copy',undefined,scene);view.element('div','pm-scene-caption',undefined,scene);
  const dialogue=view.element('section','pm-dialogue',undefined,screen);
  const answer=view.button(dialogue,'好呀',()=>view.calls.push('answer'),{className:'pm-answer'});
  const topics=view.element('div','pm-topics',undefined,screen);
  for(const id of ['greeting','rehearsal','encore'])view.button(topics,id,()=>view.calls.push('topic:'+id),{className:'pm-topic',action:'companion-topic-'+id});
  view.button(screen,'返回话题',()=>{}, {className:'pm-question-back',action:'companion-question-back'});
  view.element('section','pm-companion-record',undefined,screen);
  view.element('footer','pm-footer',undefined,screen);
  compactHierarchyPage(view,main,{member:{id:'kai'}});
  assert.equal(scene.dataset.portraitFrame,'thigh-up');
  assert.equal(scene.querySelector('.pm-scene-portrait'),portrait,'rig host element unchanged');
  assert.equal(portrait.parentNode,scene);
  assert.equal(view.root.querySelectorAll('.ui-actor-switch').length,1);
  assert.equal(view.root.querySelector('.ui-actor-switch').parentNode,screen,'switch anchors to the viewport-width screen, not the overscanned room');
  assert.equal(dialogue.parentNode,screen,'dialogue panel not re-parented or enlarged into the scene');
  assert.equal(screen.querySelectorAll('.pm-dialogue').length,1,'no duplicate dialogue surface');
  assert.equal(screen.querySelectorAll('.pm-topic').length,3,'no duplicate entry points');
  topics.querySelector('[data-action=companion-topic-greeting]').click();answer.click();
  assert.deepEqual(view.calls,['topic:greeting','answer']);
});
