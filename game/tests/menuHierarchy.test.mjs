// UNRUN when written (Claude has no shell). Codex: `node --test tests/menuHierarchy.test.mjs`.
// Own minimal DOM stub with a native-like <dialog>; production code has no showModal fallback.
import test from 'node:test';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openHierarchySheet} from '../src/systems/HierarchySheets.mjs';
import {compactHierarchyPage,renderHierarchyNavigation,ownerRootFor,OWNER_ROOTS} from '../src/systems/MenuHierarchy.mjs';
import {PUBLIC_SHELL_ROOTS} from '../src/utils/publicShellNavigation.mjs';

const camel=name=>name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
class FakeNode extends EventTarget {
  constructor(doc,tag){
    super();this.ownerDocument=doc;this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;
    this.dataset={};this.attributes=new Map();this.hidden=false;this.disabled=false;this.textContent='';this.className='';
    this.style={setProperty(key,value){this[key]=value;}};
    if(tag==='dialog'){this.open=false;this.showModal=()=>{
      if(!this.isConnected||this.open)throw new Error('InvalidStateError');this.open=true;doc.modal=this;
    };this.close=()=>{if(!this.open)return;this.open=false;doc.modal=null;this.dispatchEvent(new Event('close'));};}
  }
  get classList(){const node=this;return {contains:c=>node.className.split(/\s+/).includes(c),add:(...c)=>{node.className=[...new Set([...node.className.split(/\s+/).filter(Boolean),...c])].join(' ');}};}
  get nextSibling(){const list=this.parentNode?.children;return list?list[list.indexOf(this)+1]||null:null;}
  get isConnected(){let node=this;while(node.parentNode)node=node.parentNode;return node===this.ownerDocument.documentElement;}
  setAttribute(k,v){this.attributes.set(k,String(v));}
  getAttribute(k){return this.attributes.has(k)?this.attributes.get(k):null;}
  removeAttribute(k){this.attributes.delete(k);}
  append(...nodes){for(const n of nodes)this.insertBefore(n,null);}
  insertBefore(node,ref){
    node.remove();const index=ref?this.children.indexOf(ref):-1;
    if(index<0)this.children.push(node);else this.children.splice(index,0,node);node.parentNode=this;return node;
  }
  remove(){if(!this.parentNode)return;const list=this.parentNode.children;list.splice(list.indexOf(this),1);this.parentNode=null;}
  replaceChildren(...nodes){for(const c of [...this.children])c.remove();this.append(...nodes);}
  contains(node){for(let n=node;n;n=n.parentNode)if(n===this)return true;return false;}
  click(){this.dispatchEvent(new Event('click'));}
  focus(){this.ownerDocument.activeElement=this;}
  matches(selector){
    if(selector.includes(','))return selector.split(',').some(part=>this.matches(part.trim()));
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
class FakeDocument {
  constructor(){this.documentElement=new FakeNode(this,'html');this.activeElement=null;this.modal=null;}
  createElement(tag){return new FakeNode(this,tag);}
}
const visible=node=>{for(let n=node;n;n=n.parentNode)if(n.hidden)return false;return true;};

function makeView(page){
  const doc=new FakeDocument(),root=doc.createElement('section');doc.documentElement.append(root);
  const calls=[];
  const view={doc,root,page,disposed:false,navigating:false,calls,renders:0,
    scene:{_sessionExperience:{isBlocking:()=>false,showStoryJournal:()=>calls.push('story')}},
    selection:{memberId:'sakura',previewMember(id){calls.push('preview:'+id);this.memberId=id;return true;},confirmMember(){calls.push('confirm');}},
    element(tag,className,text,parent=root){const n=doc.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;parent?.append(n);return n;},
    button(parent,label,callback,{className='',action,nav,iconOnly=false}={}){
      const b=view.element('button',className,undefined,parent);b.setAttribute('aria-label',label);
      if(action)b.dataset.action=action;if(nav)b.dataset.nav=nav;
      if(!iconOnly)view.element('span','',label,b);else b.title=label;
      b.addEventListener('click',()=>{if(view.disposed||view.navigating||b.disabled)return;callback();});return b;
    },
    showPage(target){calls.push('page:'+target);return true;},
    render(){view.hierarchySheetDispose?.();view.renders++;root.replaceChildren();},
  };
  return view;
}

function rosterFixture(){
  const view=makeView('roster'),main=view.element('main','shell-content');
  view.element('div','shell-session-context');
  const detail=view.element('section','shell-performer-detail',undefined,main);
  const portrait=view.element('div','roster-portrait-stage',undefined,detail);
  const strip=view.element('div','shell-member-strip',undefined,portrait);
  for(const id of ['sakura','kai','enjo']){
    const b=view.button(strip,id,()=>{view.selection.previewMember(id);view.render();},{className:'shell-member-option'});b.dataset.member=id;
  }
  view.element('div','roster-stage-stamp',undefined,portrait);
  view.element('span','roster-role-emblem',undefined,portrait);
  const name=view.element('div','shell-performer-name roster-stage-identity',undefined,portrait);
  view.element('h2','','Sakura',name);view.element('p','','当前出战成员',name);view.element('span','roster-role','远程',name);
  const inspector=view.element('section','roster-inspector',undefined,detail);
  const tabs=view.element('div','roster-inspector-tabs',undefined,inspector);
  const panels={};
  for(const [id,label] of [['ability','专属行动'],['preparation','演出准备'],['dossier','成员档案']]){
    const tab=view.button(tabs,label,()=>{view.rosterPanel=id;for(const [k,p] of Object.entries(panels))p.hidden=k!==id;},{className:'roster-inspector-tab'});
    tab.dataset.rosterTab=id;
    panels[id]=view.element('section','',label+' body',inspector);panels[id].dataset.rosterPanel=id;panels[id].hidden=id!=='ability';
  }
  view.button(panels.preparation,'查看成员训练',()=>view.showPage('workshop'),{action:'member-training'});
  view.element('div','shell-selection-context',undefined,main);
  const footer=view.element('footer','shell-selection-footer');
  view.element('div','roster-confirm-context',undefined,footer);
  view.button(footer,'确认Sakura出战',()=>view.selection.confirmMember(),{className:'shell-primary shell-confirm',action:'confirm-member'});
  compactHierarchyPage(view,main,{member:{id:'sakura'}});
  return {view,main,strip,panels,portrait};
}

test('owner navigation: four icon roots, no archive, archive pages highlight tour',()=>{
  assert.deepEqual(OWNER_ROOTS,['desk','roster','tour','inventory']);
  const view=makeView('chapterArchive'),opened=[];
  view.openRoot=page=>opened.push(page);
  assert.equal(renderHierarchyNavigation(view,PUBLIC_SHELL_ROOTS,'chapterArchive',()=>'records'),null);
  const nav=renderHierarchyNavigation(view,PUBLIC_SHELL_ROOTS,'tour',()=>'tour');
  const buttons=nav.querySelectorAll('button');
  assert.deepEqual(buttons.map(b=>b.dataset.nav),['desk','roster','tour','inventory']);
  assert.deepEqual(buttons.map(b=>b.dataset.uiIcon),['home','member','tour','bag']);
  assert.ok(buttons.every(b=>b.getAttribute('aria-label')&&b.querySelector('.showbill-nav-label')),'visible captions and accessible names');
  assert.equal(nav.querySelector('[data-nav=tour]').getAttribute('aria-current'),'page');
  assert.equal(ownerRootFor('records',()=>'records'),'tour');
  buttons[1].click();assert.deepEqual(opened,['roster']);
  const current=renderHierarchyNavigation(makeView('tour'),PUBLIC_SHELL_ROOTS,'tour',()=>'tour').querySelector('[data-nav=tour]');
  assert.equal(current.disabled,true);assert.equal(current.getAttribute('aria-current'),'page');
});

test('roster: one visible actor switch, not three visible actors; legacy slabs hidden',()=>{
  const {view,main,strip}=rosterFixture();
  assert.equal(visible(strip),false);
  assert.equal(view.root.querySelectorAll('.ui-actor-switch').length,1);
  assert.equal(view.root.querySelector('.ui-actor-switch').dataset.uiIcon,'switch');
  for(const s of ['.roster-stage-stamp','.roster-role-emblem','.shell-selection-context','.roster-confirm-context','.shell-session-context'])
    assert.equal(visible(view.root.querySelector(s)),false,s);
  assert.equal(view.root.querySelector('.roster-stage-identity').querySelector('h2').dataset.uiLetter,'sakura');
  assert.equal(view.root.querySelector('[data-action=confirm-member]').dataset.uiLetter,'confirm');
  assert.equal(visible(view.root.querySelector('.roster-inspector-tabs')),false);
});

test('sheet moves the existing strip with its handlers, preview does not deploy, render disposes',()=>{
  const {view,strip}=rosterFixture();
  const trigger=view.root.querySelector('.ui-actor-switch'),holder=strip.parentNode;
  trigger.click();
  const dialog=view.root.querySelector('dialog');
  assert.ok(dialog.open);assert.ok(dialog.contains(strip));assert.equal(strip.hidden,false);
  assert.equal(dialog.querySelector('[data-ui-icon=close]').tagName,'BUTTON');
  strip.querySelector('[data-member=kai]').click();
  assert.deepEqual(view.calls,['preview:kai']);
  assert.equal(view.selection.memberId,'kai');
  assert.equal(view.hierarchySheetDispose,null);assert.equal(dialog.open,false);
  assert.equal(strip.parentNode,holder,'restored before root.replaceChildren');
});

test('close command and Escape restore node, hidden state and focus; one live dialog',()=>{
  const {view,strip,panels}=rosterFixture();
  const trigger=view.root.querySelector('.ui-actor-switch'),holder=strip.parentNode;
  trigger.click();
  view.root.querySelector('.ui-sheet-close').click();
  assert.equal(view.root.querySelector('dialog'),null);assert.equal(strip.parentNode,holder);
  assert.equal(strip.hidden,false);assert.equal(view.doc.activeElement,trigger);
  const skill=view.root.querySelector('[data-ui-icon=skill]');
  trigger.click();view.root.querySelector('[data-action=roster-reference]').click();skill.click();
  assert.equal(view.root.querySelectorAll('dialog').length,1);
  assert.equal(strip.parentNode,holder,'previous sheet restored when replaced');
  const dialog=view.root.querySelector('dialog'),escape=new Event('cancel',{cancelable:true});
  dialog.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented,true);
  assert.equal(view.root.querySelector('dialog'),null);assert.equal(view.doc.activeElement.dataset.action,'roster-reference');
  assert.equal(panels.ability.hidden,false,'original select() state survives restore');
});

test('roster equipment tool goes directly to training; skill and dossier retain canonical sheets',()=>{
  const {view,panels}=rosterFixture();
  const tools=view.root.querySelector('.ui-roster-actions').querySelectorAll('button');
  assert.deepEqual(tools.map(b=>b.dataset.uiIcon),['train','skill','info']);
  tools[0].click();assert.equal(view.root.querySelector('dialog'),null);
  assert.ok(view.calls.includes('page:workshop'));
  tools[1].click();assert.equal(view.rosterPanel,'ability');
  assert.ok(view.root.querySelector('dialog').contains(panels.ability));
  assert.ok(!view.calls.includes('confirm'));
});

test('tour keeps five stops on the map and all four references in one drawer',()=>{
  const runtime=loadScenes();runtime.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  runtime.seed([]);const h=runtime.harness(runtime.TourRouteScene);h.scene.create();
  const map=h.query('.journey-map'),rows=map.querySelectorAll('.journey-chapter');
  assert.equal(rows.length,5);assert.equal(rows.filter(row=>row.disabled).length,4);
  assert.equal(h.query('.ui-tour-progress').textContent,'已通关 0 / 5 站');
  assert.equal(h.query('.ui-tour-tools'),null);
  assert.equal(h.query('.tour-reference-list').parentNode.hidden,true);
  h.click('[data-action=tour-reference]');
  const tools=h.query('dialog').querySelector('.tour-reference-list').querySelectorAll('button');
  assert.deepEqual(tools.map(b=>b.dataset.action),['tour-sheet-route','tour-story','tour-records','tour-modes']);
  tools[0].click();
  assert.equal(h.query('dialog').getAttribute('aria-label'),'路线与收获');
  assert.ok(h.query('dialog').querySelector('.tour-chapter-plan'));
  h.click('.ui-sheet-close');assert.equal(runtime.document.activeElement?.dataset.action,'tour-reference');
  h.shutdown();
});

test('playhub: the two real challenge modes become framed artwork entries keeping their handler and availability',()=>{
  const view=makeView('playhub'),main=view.element('main','shell-content');
  view.element('h2','shell-page-heading','公演中心',main);view.element('div','hub-categories',undefined,main);
  for(const [group,actions] of [['preparation',['hub-preflight','hub-goals','hub-finale-trial','hub-rehearsal','hub-library']],['growth',['hub-training']],['records',['hub-records']]]){
    const g=view.element('section','system-hub-group',undefined,main);g.dataset.hubGroup=group;g.hidden=group!=='preparation';
    for(const action of actions){const b=view.button(g,action,()=>view.calls.push(action),{className:'system-entry',action});
      b.replaceChildren();const copy=view.element('span','system-entry-copy',undefined,b);
      view.element('strong','',action==='hub-rehearsal'?'压轴排练室':'压轴连演',copy);
      view.element('small','',action==='hub-rehearsal'?'未开放 · 该场地保存通关后开放排练。':'已开放 · 三站压轴 · 生命继承',copy);
      if(action==='hub-rehearsal'){b.dataset.availability='locked';b.setAttribute('aria-label','压轴排练室 · 未开放 · 该场地保存通关后开放排练。');}
      if(action==='hub-finale-trial')b.dataset.availability='ready';}
  }
  compactHierarchyPage(view,main,{member:{id:'sakura'}});
  const entries=main.querySelectorAll('button').filter(visible);
  assert.deepEqual(entries.map(b=>b.dataset.action),['hub-finale-trial','hub-rehearsal']);
  assert.ok(entries.every(b=>b.classList.contains('pg-mode')&&!b.classList.contains('system-entry')&&b.dataset.uiIcon===undefined));
  assert.deepEqual(entries.map(b=>b.querySelector('.pg-mode-art').src),['art/chapter-journey-20261101/mode-finale.webp','art/chapter-journey-20261101/mode-rehearsal.webp']);
  assert.deepEqual(entries.map(b=>b.querySelector('strong').textContent),['压轴连演','压轴排练室']);
  assert.match(entries[1].querySelector('small').textContent,/未开放 · 该场地保存通关后开放排练/);
  assert.equal(entries[0].querySelector('[data-ui-icon=lock]'),null);
  assert.equal(entries[1].querySelector('.pg-mode-lock').dataset.uiIcon,'lock');
  assert.equal(entries[1].dataset.availability,'locked');assert.match(entries[1].getAttribute('aria-label'),/保存通关后开放/);
  entries[1].click();entries[0].click();assert.deepEqual(view.calls,['hub-rehearsal','hub-finale-trial']);
});

test('lounge: one actor switch, labelled AI topics, secondary record and unchanged dialogue/status',()=>{
  const view=makeView('lounge'),main=view.element('main','shell-content');
  const screen=view.element('div','product-module-screen',undefined,main);
  const strip=view.element('div','pm-cast-strip',undefined,screen);
  for(const id of ['sakura','kai','enjo'])view.button(strip,id,()=>view.calls.push('companion:'+id),{className:'pm-cast-option',action:'companion-member-'+id});
  const scene=view.element('section','pm-scene',undefined,screen);
  view.element('div','pm-scene-copy',undefined,scene);view.element('div','pm-scene-caption',undefined,scene);
  const dialogue=view.element('section','pm-dialogue',undefined,screen);
  const topics=view.element('div','pm-topics',undefined,screen);
  for(const id of ['greeting','rehearsal','encore']){const b=view.button(topics,id,()=>view.calls.push('topic:'+id),{className:'pm-topic',action:'companion-topic-'+id});b.dataset.companionLetter=id;b.dataset.companionGlyph=id;}
  view.button(screen,'返回话题',()=>{}, {className:'pm-question-back',action:'companion-question-back'});
  view.element('section','pm-companion-record',undefined,screen);
  const status=view.element('p','pm-save-status','保存失败，未确认新记录。',screen);
  view.element('footer','pm-footer',undefined,screen);
  compactHierarchyPage(view,main,{member:{id:'sakura'}});
  assert.equal(visible(strip),false);
  const sw=screen.querySelector('.ui-actor-switch');assert.ok(sw);assert.equal(sw.parentNode,screen,'switch stays inside the viewport rather than the overscanned room');
  assert.deepEqual(topics.querySelectorAll('button').map(b=>b.dataset.companionLetter),['greeting','rehearsal','encore']);
  assert.ok(screen.querySelector('[data-action=companion-record]'));
  assert.ok(topics.querySelectorAll('button').every(b=>b.getAttribute('aria-label')&&b.querySelector('span').classList.contains('ui-sr-label')));
  assert.ok(visible(dialogue)&&visible(status));
  assert.equal(visible(scene.querySelector('.pm-scene-copy')),false);
  sw.click();view.root.querySelector('dialog').querySelector('[data-action=companion-member-kai]').click();
  assert.deepEqual(view.calls,['companion:kai']);
});

test('wiring: sheet disposed before replaceChildren, compaction before navigation, no storage in new modules',()=>{
  const shell=readFileSync(new URL('../src/systems/PublicShellView.mjs',import.meta.url),'utf8');
  const render=shell.slice(shell.indexOf('  render(focusSelector'));
  assert.ok(render.indexOf('this.hierarchySheetDispose?.()')<render.indexOf('this.root.replaceChildren()'));
  assert.ok(render.indexOf('compactHierarchyPage(this,main,model)')<render.indexOf('this.navigation()'));
  assert.match(render,/owner\?mountHierarchyUi\(this\):mountOwnerGeneratedUi\(this\)/);
  assert.match(shell,/uiPass=owner\?'hierarchy-v1':'stage-v2'/);
  for(const file of ['MenuHierarchy.mjs','HierarchySheets.mjs']){
    const source=readFileSync(new URL('../src/systems/'+file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/localStorage|publicRunProgression|publicPreparation|updateBackstageProgress|selectPublic/);
  }
});

test('openHierarchySheet validates its boundary',()=>{
  const view=makeView('roster'),loose=view.doc.createElement('div');
  assert.throws(()=>openHierarchySheet(view,{title:'x',content:loose,trigger:view.root}),TypeError);
});
