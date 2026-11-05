// UNRUN when written (Claude has no shell). Codex: `node --test tests/secondaryMenuHierarchy.test.mjs`.
// Same minimal native-<dialog> DOM stub pattern as tests/menuHierarchy.test.mjs. Fixtures mirror the real
// node structure of renderGrowthCatalog / renderArrangementLibrary / renderArchive in the owner (user-cast) pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compactHierarchyPage} from '../src/systems/MenuHierarchy.mjs';
import {compactSecondaryPage} from '../src/systems/SecondaryMenuHierarchy.mjs';

const camel=name=>name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
class FakeNode extends EventTarget {
  constructor(doc,tag){
    super();this.ownerDocument=doc;this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;
    this.dataset={};this.attributes=new Map();this.hidden=false;this.disabled=false;this.textContent='';this.className='';
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
    selection:{memberId:'sakura',previewMember(id){calls.push('preview:'+id);this.memberId=id;return true;}},
    element(tag,className,text,parent=root){const n=doc.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;parent?.append(n);return n;},
    button(parent,label,callback,{className='',action,iconOnly=false}={}){
      const b=view.element('button',className,undefined,parent);b.setAttribute('aria-label',label);
      if(action)b.dataset.action=action;
      if(!iconOnly)view.element('span','',label,b);else b.title=label;
      b.addEventListener('click',()=>{if(view.disposed||view.navigating||b.disabled)return;callback();});return b;
    },
    showPage(target){calls.push('page:'+target);return true;},
    render(){view.hierarchySheetDispose?.();view.renders++;root.replaceChildren();},
  };
  return view;
}
const MODEL={member:{id:'sakura'}};
const strip=(view,parent,key)=>{
  const box=view.element('div','shell-member-strip',undefined,parent);
  for(const id of ['sakura','kai','enjo']){const b=view.button(box,id,()=>view.selection.previewMember(id),{className:'shell-member-option'});b.dataset[key]=id;}
  return box;
};
const openTool=(view,uiIcon)=>{view.root.querySelector(`[data-ui-icon=${uiIcon}]`).click();return view.root.querySelector('dialog');};

function growthFixture({confirming=false,blocked=null,source=true}={}){
  const view=makeView('growth'),main=view.element('main','shell-content');
  view.element('div','shell-session-context');
  view.element('h2','shell-page-heading','成长规划',main);
  const members=strip(view,main,'growthMember');
  view.element('p','system-context growth-member','Sakura · 当前阶位 2 · 练习笔记 30',main);
  const rankPool=view.element('section','arrangement-pool',undefined,main);view.element('h2','','训练阶位',rankPool);
  const ranks=view.element('div','growth-ranks',undefined,rankPool);
  for(const level of [1,2,3,4]){const b=view.button(ranks,`阶位 ${level}`,()=>{view.calls.push('rank:'+level);view.growthRank=level;},{className:'arrangement-option'});b.dataset.growthRank=String(level);view.element('small','',level===2?'当前':level<2?'已完成':'规划',b);}
  const preview=view.element('section','growth-preview',undefined,main);view.element('h2','','规划配置 · 未应用',preview);
  view.element('div','growth-comparison-labels',undefined,preview);
  const table=view.element('dl','growth-effects',undefined,preview);
  const row=view.element('div','',undefined,table);view.element('dt','','行动充能',row);view.element('dd','','10%',row);view.element('dd','','15%',row);
  const pool=view.element('section','arrangement-pool growth-equipment-pool',undefined,main);view.element('h2','','演出配件',pool);
  const options=view.element('div','arrangement-options',undefined,pool);
  for(const id of ['none','wide_nozzle']){const b=view.button(options,id,()=>{view.calls.push('equip:'+id);view.growthEquipmentId=id;},{className:'arrangement-option'});b.dataset.growthEquipment=id;}
  const application=view.element('section','growth-application',undefined,main);
  const cost=view.element('p','system-context','当前 → 规划 · 需 20 练习笔记',application);
  if(source){view.element('p','growth-source','获取：通关霓虹街口',application);view.button(application,'查看获取场地',()=>view.calls.push('source'),{action:'growth-source'});}
  if(blocked)view.element('p','workshop-muted',blocked,application);
  const actions=view.element('div','preflight-links',undefined,null);
  const apply=view.button(actions,'应用整套方案',()=>view.calls.push('apply'),{action:'growth-apply',className:'shell-primary'});apply.disabled=!!blocked;
  const links=view.element('div','preflight-links',undefined,main);
  view.button(links,'前往成员训练',()=>view.showPage('workshop'),{action:'growth-training'});
  view.button(links,'查看背包',()=>view.showPage('inventory'),{action:'growth-inventory'});
  const footer=view.element('footer','shell-selection-footer planning-command-footer');
  const status=view.element('p','workshop-status','规划尚未应用；下方出战使用已保存配置。',footer);
  footer.append(actions);
  if(confirming){
    actions.hidden=true;view.element('p','system-context','确认Sakura · 阶位 3。训练不可撤销。',footer);
    const row2=view.element('div','preflight-links',undefined,footer);
    view.button(row2,'确认应用 · 20 笔记',()=>view.calls.push('confirm-apply'),{className:'shell-primary',action:'growth-confirm'});
    view.button(row2,'取消应用',()=>view.calls.push('cancel'),{action:'growth-cancel'});
  }
  view.button(footer,'查看本场出战准备',()=>view.calls.push('prepared-preflight'),{className:'shell-primary',action:'prepared-preflight'});
  const handled=compactHierarchyPage(view,main,MODEL);
  return {view,main,members,ranks,pool,apply,cost,status,handled};
}

test('growth: handled through MenuHierarchy, one actor switch, all three members reachable, preview does not deploy',()=>{
  const {view,main,members,handled}=growthFixture();
  assert.equal(handled,true);assert.equal(main.dataset.secondaryPage,'growth');
  assert.equal(visible(view.root.querySelector('.shell-session-context')),false);
  assert.equal(visible(members),false);
  const switches=view.root.querySelectorAll('.ui-actor-switch').filter(visible);
  assert.equal(switches.length,1);assert.equal(switches[0].dataset.uiIcon,'switch');
  switches[0].click();
  const dialog=view.root.querySelector('dialog');
  assert.deepEqual(dialog.querySelectorAll('[data-growth-member]').map(b=>b.dataset.growthMember),['sakura','kai','enjo']);
  assert.deepEqual(view.calls,[],'opening the sheet writes nothing');
  dialog.querySelector('[data-growth-member=kai]').click();
  assert.deepEqual(view.calls,['preview:kai'],'original strip handler, preview only');
  assert.equal(view.root.querySelectorAll('nav').length,0,'no new primary navigation');
});

test('growth: stage shows caption + small rank tokens, body shows real comparison, equipment behind one sheet',()=>{
  const {view,main,ranks,pool}=growthFixture();
  const stage=main.querySelector('.sec-growth-stage'),body=main.querySelector('.sec-growth-body');
  assert.ok(stage.contains(main.querySelector('.growth-member')));
  assert.ok(stage.contains(ranks)&&visible(ranks)&&ranks.classList.contains('sec-growth-stages'));
  assert.equal(main.querySelector('h2.shell-page-heading').dataset.secondaryLetter,'growth');
  assert.deepEqual(ranks.querySelectorAll('[data-growth-rank]').filter(visible).map(b=>b.dataset.growthRank),['1','2','3','4']);
  ranks.querySelector('[data-growth-rank="3"]').click();
  assert.equal(view.growthRank,3);
  const preview=main.querySelector('.growth-preview');
  assert.ok(body.contains(preview)&&visible(preview));
  assert.deepEqual(preview.querySelectorAll('dd').map(n=>n.textContent),['10%','15%'],'real values untouched');
  assert.equal(visible(pool),false);
  const dialog=openTool(view,'equipment');
  assert.ok(dialog.contains(pool));
  dialog.querySelector('[data-growth-equipment=wide_nozzle]').click();
  assert.equal(view.growthEquipmentId,'wide_nozzle','original equipment handler retained');
});

test('growth: apply/confirm/cancel stay distinct native commands with cost and disabled reason visible',()=>{
  const draft=growthFixture();
  assert.ok(visible(draft.cost)&&draft.cost.textContent.includes('20'));
  assert.equal(draft.apply.dataset.secondaryLetter,'apply');
  draft.apply.click();assert.deepEqual(draft.view.calls,['apply']);
  assert.ok(visible(draft.status));
  const {view}=growthFixture({confirming:true});
  const confirm=view.root.querySelector('[data-action=growth-confirm]'),cancel=view.root.querySelector('[data-action=growth-cancel]');
  assert.ok(visible(confirm)&&visible(cancel)&&confirm!==cancel);
  assert.equal(confirm.dataset.secondaryLetter,undefined,'cost-bearing label is never replaced by static lettering');
  assert.equal(cancel.dataset.secondaryLetter,'cancel');
  assert.equal(visible(view.root.querySelector('[data-action=growth-apply]')),false,'renderer hides apply while confirming');
  confirm.click();cancel.click();
  assert.deepEqual(view.calls,['confirm-apply','cancel']);
  const blocked=growthFixture({blocked:'练习笔记不足'});
  assert.equal(blocked.apply.disabled,true);
  blocked.apply.click();assert.deepEqual(blocked.view.calls,[]);
  assert.ok(visible(blocked.main.querySelector('.workshop-muted')),'disabled reason stays visible');
});

test('growth: sources and secondary links are reachable in sheets, sources tool only when a source exists',()=>{
  const {view}=growthFixture();
  const dialog=openTool(view,'route');
  assert.ok(dialog.querySelector('.growth-source'));
  dialog.querySelector('[data-action=growth-source]').click();
  assert.deepEqual(view.calls,['source']);
  view.root.querySelector('.ui-sheet-close').click();
  const info=openTool(view,'info');
  info.querySelector('[data-action=growth-training]').click();
  assert.ok(view.calls.includes('page:workshop'));
  const none=growthFixture({source:false});
  assert.equal(none.view.root.querySelector('[data-ui-icon=route]'),null);
});

function libraryFixture({invalid=false}={}){
  const view=makeView('library'),main=view.element('main','shell-content');
  view.libraryStage='first';
  view.element('h2','shell-page-heading','编排组合',main);view.element('p','system-context','组合预览 · 不自动替换本场方案',main);
  const studies=view.element('section','arrangement-pool library-studies',undefined,main);view.element('h2','','搭配思路',studies);
  const options=view.element('div','arrangement-options',undefined,studies);
  for(const id of ['s1','s2','s3','s4']){const b=view.button(options,id,()=>{view.calls.push('study:'+id);view.arrangementFirst=id;},{className:'arrangement-option'});b.dataset.arrangementStudy=id;}
  const stages=view.element('div','library-stages',undefined,main);
  const tabs=view.element('div','library-stage-tabs',undefined,stages);tabs.setAttribute('role','tablist');
  for(const [label,id] of [['第一段','first'],['第二段','second']]){
    const tab=view.button(tabs,label,()=>{view.calls.push('tab:'+id);view.libraryStage=id;},{className:'library-stage-tab'});
    tab.id='library-tab-'+id;tab.dataset.libraryStage=id;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','library-panel-'+id);
    tab.replaceChildren();view.element('span','',label,tab);view.element('strong','',id==='first'&&invalid?'需重选':label+'选择',tab);
  }
  for(const [label,id,rows] of [['第一段','first',['fanfire','relay']],['第二段','second',['echo','anchor']]]){
    const section=view.element('section','arrangement-pool library-stage',undefined,stages);view.element('h2','',label,section);
    section.id='library-panel-'+id;section.hidden=id!=='first';section.setAttribute('role','tabpanel');section.setAttribute('aria-labelledby','library-tab-'+id);
    if(id==='first'&&invalid){const n=view.element('p','system-context','双刃不在当前成员的编排中，请重新选择第一段。',section);n.dataset.arrangementInvalid='blade';n.setAttribute('role','status');}
    const group=view.element('div','arrangement-options',undefined,section);
    for(const row of rows){const b=view.button(group,row,()=>{view.calls.push('pick:'+row);},{className:'arrangement-option'});b.dataset.arrangement=row;}
  }
  const footer=view.element('footer','shell-selection-footer');
  const use=view.button(footer,'预选方案并准备',()=>view.calls.push('plan-use'),{className:'shell-primary',action:'plan-use'});use.disabled=invalid;
  const links=view.element('div','preflight-links',undefined,null);
  view.button(links,'返回准备',()=>view.showPage('preflight'),{action:'library-preflight'});
  view.button(links,'返回玩法中心',()=>view.showPage('playhub'),{action:'library-back'});
  const preview=view.element('section','library-preview',undefined,main);view.element('h2','','预览效果',preview);
  if(invalid)view.element('p','system-context','第一段需重选后才能预览和预选。',preview);
  else{
    const dl=view.element('dl','arrangement-effects',undefined,preview);
    for(const [k,v] of [['攻击涂染范围','+1'],['接力涂染','未选择']]){const r=view.element('div','',undefined,dl);view.element('dt','',k,r);view.element('dd','',v,r);}
    const guide=view.element('details','archive-history library-guide',undefined,main);view.element('summary','','编排与场地说明',guide);view.element('p','system-context','扇面 · 说明',guide);
  }
  main.append(links);
  const handled=compactHierarchyPage(view,main,MODEL);
  return {view,main,use,tabs,handled};
}

test('library: composition tabs + selected panel are the main surface; tab/panel semantics and handlers kept',()=>{
  const {view,main,tabs,handled}=libraryFixture();
  assert.equal(handled,true);assert.equal(main.dataset.secondaryPage,'library');
  assert.ok(main.querySelector('.sec-library-stage').contains(tabs));
  const tabButtons=tabs.querySelectorAll('[role=tab]');
  assert.deepEqual(tabButtons.map(t=>t.querySelector('span').dataset.secondaryLetter),['first','second']);
  assert.deepEqual(tabButtons.map(t=>t.getAttribute('aria-controls')),['library-panel-first','library-panel-second']);
  const panels=main.querySelectorAll('.library-stage');
  assert.ok(panels.every(p=>main.querySelector('.sec-library-body').contains(p)&&p.getAttribute('role')==='tabpanel'));
  assert.deepEqual(panels.map(p=>p.hidden),[false,true],'renderer tab state untouched');
  tabButtons[1].click();assert.equal(view.libraryStage,'second');
  panels[0].querySelector('[data-arrangement=relay]').click();
  assert.ok(view.calls.includes('pick:relay'));
  const preview=main.querySelector('.library-preview');
  assert.ok(visible(preview));
  const idle=preview.querySelectorAll('[data-secondary-idle]');
  assert.equal(idle.length,1);assert.equal(idle[0].children[1].textContent,'未选择','value kept, only marked idle');
});

test('library: four studies behind one study sheet, guide behind info, one prominent use action',()=>{
  const {view,main,use}=libraryFixture();
  assert.equal(visible(main.querySelector('.library-studies')),false);
  assert.equal(visible(main.querySelector('.library-guide')),false);
  const study=openTool(view,'skill');
  assert.equal(study.querySelectorAll('[data-arrangement-study]').length,4);
  assert.deepEqual(view.calls,[]);
  study.querySelector('[data-arrangement-study=s3]').click();
  assert.equal(view.arrangementFirst,'s3');
  view.root.querySelector('.ui-sheet-close').click();
  assert.ok(openTool(view,'info').querySelector('.library-guide'));
  view.root.querySelector('.ui-sheet-close').click();
  assert.equal(view.root.querySelectorAll('.shell-primary').filter(visible).length,1);
  assert.equal(use.dataset.secondaryLetter,'preflight');
  const back=view.root.querySelector('[data-action=library-preflight]');
  // B262: the shell header back is the page return; canonical links stay wired but out of the composition stage.
  assert.equal(visible(back),false);assert.equal(main.querySelector('.sec-library-stage').contains(back),false);
  assert.equal(visible(view.root.querySelector('[data-action=library-back]')),false);
  back.click();assert.ok(view.calls.includes('page:preflight'));
  use.click();assert.ok(view.calls.includes('plan-use'));
});

test('library: invalid first stage stays guarded and explained',()=>{
  const {view,main,use}=libraryFixture({invalid:true});
  const notice=main.querySelector('[data-arrangement-invalid]');
  assert.ok(visible(notice));assert.equal(notice.getAttribute('role'),'status');
  assert.equal(use.disabled,true);use.click();
  assert.ok(!view.calls.includes('plan-use'));
  assert.ok(visible(main.querySelector('.library-preview')),'blocked preview message visible');
  assert.equal(view.root.querySelector('[data-ui-icon=info]'),null,'no guide sheet without a valid preview');
});

function recordsFixture({lastRun=true}={}){
  const view=makeView('records'),main=view.element('main','shell-content');
  view.element('h2','shell-page-heading','成员成绩',main);
  const members=strip(view,main,'member');
  view.element('p','archive-summary','Sakura · 通关 2 次',main);view.element('p','archive-summary archive-rules-label','当前规则 · 三人三章 3',main);
  const list=view.element('section','archive-current-records',undefined,main);
  for(const [id,name,measured,history] of [['opening','星光初演',true,true],['neon','霓虹街口',false,false],['encore','终场',false,true]]){
    const row=view.element('section','archive-record',undefined,list);row.dataset.recordChapter=id;row.dataset.recordState=measured?'measured':'empty';
    view.element('figure','shell-route-preview archive-record-venue',undefined,row);view.element('h2','',name,row);
    if(measured){const dl=view.element('dl','archive-record-stats',undefined,row);
      for(const [k,v] of [['最快通关','1:23.4'],['最少受击','0 次 · 无伤通关']]){const f=view.element('div','',undefined,dl);view.element('dt','',k,f);view.element('dd','',v,f);}}
    else view.element('p','archive-empty','本成员暂无实测通关成绩',row);
    if(history){const d=view.element('details','archive-history',undefined,row);view.element('summary','','历史纪录 · 不参与当前挑战',d);view.element('p','','三人三章 · 规则 1 · 最快 1:40.0 · 最少受击 2 次',d);}
  }
  const overview=view.element('details','archive-history archive-overview',undefined,main);view.element('summary','','全队覆盖与巡演里程碑',overview);
  if(lastRun){const last=view.element('section','archive-last-run',undefined,main);view.element('h2','','最近演出 · Sakura',last);view.element('p','','通关 · 1:23.4',last);}
  view.button(main,'章节现场档案',()=>view.showPage('chapterArchive'),{action:'archive-chapters'});
  const footer=view.element('footer','shell-selection-footer');
  view.button(footer,'巡演手记',()=>view.scene._sessionExperience.showStoryJournal(),{className:'shell-primary',action:'story-journal'});
  const before=list.querySelectorAll('.archive-record').map(r=>[r.dataset.recordChapter,r.dataset.recordState,r.querySelectorAll('dd').map(n=>n.textContent).join('|')||r.querySelector('.archive-empty').textContent]);
  const handled=compactHierarchyPage(view,main,MODEL);
  return {view,main,members,list,before,handled};
}

test('records: three venue rows keep measured/empty facts exactly; one switch; no invented badges',()=>{
  const {view,main,members,list,before,handled}=recordsFixture();
  assert.equal(handled,true);assert.equal(main.dataset.secondaryPage,'records');
  assert.ok(main.querySelector('.sec-records-body').contains(list)&&visible(list));
  const after=list.querySelectorAll('.archive-record').map(r=>[r.dataset.recordChapter,r.dataset.recordState,r.querySelectorAll('dd').map(n=>n.textContent).join('|')||r.querySelector('.archive-empty').textContent]);
  assert.deepEqual(after,before);
  assert.ok(list.querySelectorAll('.archive-record').every(visible));
  assert.equal(visible(members),false);
  assert.equal(view.root.querySelectorAll('.ui-actor-switch').filter(visible).length,1);
  assert.equal(main.querySelector('h2.shell-page-heading').dataset.secondaryLetter,'records');
  assert(main.querySelector('.sec-records-stage').contains(main.querySelector('.archive-summary')));
  assert.equal(visible(main.querySelector('.archive-rules-label')),false,'internal rules detail is secondary, not top-level jargon');
  assert.equal(view.root.querySelectorAll('nav').length,0);
});

test('records: history, overview and last run behind one info sheet, nothing deleted; journal/chapter archive kept',()=>{
  const {view,main,list}=recordsFixture();
  assert.equal(list.querySelectorAll('.archive-history').length,0,'row history moved out of the main rows');
  for(const s of ['.archive-overview','.archive-last-run'])assert.equal(visible(main.querySelector(s)),false,s);
  const dialog=openTool(view,'info');
  assert.deepEqual(view.calls,[]);
  assert.ok(dialog.querySelector('.archive-overview')&&dialog.querySelector('.archive-last-run'));
  const histories=dialog.querySelectorAll('.sec-records-history');
  assert.deepEqual(histories.map(h=>h.querySelector('h3').textContent),['星光初演','终场']);
  assert.ok(histories.every(h=>h.querySelector('details.archive-history')));
  view.root.querySelector('.ui-sheet-close').click();
  const chapters=view.root.querySelector('[data-action=archive-chapters]');
  assert.equal(chapters.dataset.uiIcon,'route');assert.equal(chapters.dataset.uiWidget,'true');assert.ok(visible(chapters));
  chapters.click();view.root.querySelector('[data-action=story-journal]').click();
  assert.deepEqual(view.calls,['page:chapterArchive','story']);
});

test('records: render while a sheet is open restores borrowed nodes before replaceChildren',()=>{
  const {view}=recordsFixture({lastRun:false});
  openTool(view,'info');
  const holder=view.root.querySelector('.ui-sheet-holder[data-holder=records]');
  view.render();
  assert.equal(view.hierarchySheetDispose,null);assert.equal(view.renders,1);
  assert.ok(holder.querySelector('.sec-records-info'),'info returned to its holder');
});

test('wiring: unknown pages are not handled; MenuHierarchy delegates; no storage/save calls in new module',()=>{
  const view=makeView('chapterArchive'),main=view.element('main','shell-content');
  assert.equal(compactSecondaryPage(view,main,MODEL),false);
  assert.equal(compactHierarchyPage(view,main,MODEL),false);
  assert.equal(main.dataset.secondaryPage,undefined);
  const hierarchy=readFileSync(new URL('../src/systems/MenuHierarchy.mjs',import.meta.url),'utf8');
  assert.match(hierarchy,/import \{compactSecondaryPage,compactTrainingPage\} from '\.\/SecondaryMenuHierarchy\.mjs'/);
  const source=readFileSync(new URL('../src/systems/SecondaryMenuHierarchy.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/localStorage|publicRunProgression|publicPreparation|applyGrowthPlan|createArrangementPlan|uiLetter/);
});
