// Member training rebuild (B258). Fixture mirrors PublicShellView.workshop()/renderArchive() owner-pass nodes;
// the same native-<dialog> DOM stub as secondaryMenuHierarchy.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compactTrainingPage,compactSecondaryPage} from '../src/systems/SecondaryMenuHierarchy.mjs';

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
// Only keys mountSecondaryUi accepts (SecondaryUiArt KEYS); anything else throws at mount.
const LETTER_KEYS=new Set(['growth','library','records','venue','train','apply','confirm','cancel','assign','collapse','first','second','sources','compare','room','preflight','deploy']);

// Mirrors PublicShellView.workshop(): rank 2, cost 2 notes; balance/persisted/selection vary.
function workshopFixture({balance=5,persisted=true,current=true,rank=2,cost=2}={}){
  const view=makeView('workshop'),main=view.element('main','shell-content');
  const header=view.element('header','shell-header');view.button(header,'返回',()=>view.calls.push('header-back'),{action:'back',iconOnly:true});
  view.element('h2','shell-page-heading','成员训练计划',main);
  const strip=view.element('div','shell-member-strip',undefined,main);
  for(const id of ['sakura','kai','enjo']){const b=view.button(strip,id,()=>view.selection.previewMember(id),{className:'shell-member-option'});b.dataset.member=id;}
  const identity=view.element('section','workshop-member-context',undefined,main);
  identity.dataset.performer='sakura';identity.dataset.selection=current?'current':'candidate';
  const stage=view.element('div','workshop-portrait-stage',undefined,identity);view.element('div','member-mark',undefined,stage);
  const copy=view.element('div','workshop-member-copy',undefined,identity);
  view.element('small','',current?'当前出战':'候选准备 · 尚未出战',copy);view.element('strong','','Sakura',copy);
  view.element('span','workshop-member-action','连续涂染',copy);view.element('span','workshop-member-role','远程 · 连续扫射',copy);
  const training=view.element('section','workshop-training',undefined,main);
  view.element('h2','',`训练阶位 ${rank}`,training);
  const track=view.element('ol','workshop-rank-track',undefined,training);
  for(const level of [1,2,3,4]){const li=view.element('li','',undefined,track);li.dataset.trainingRank=String(level);}
  const effects=view.element('dl','workshop-effects',undefined,training);
  for(const [key,value] of [['current','+10%'],['next',cost===null?'已满阶':'+20%'],['cost',cost===null?'无需消耗':`${cost} 练习笔记`]]){
    const row=view.element('div','',undefined,effects);row.dataset.trainingEffect=key;view.element('dt','',key,row);view.element('dd','',value,row);
  }
  const train=view.button(training,cost===null?'训练已完成':`训练至阶位 ${rank+1}`,()=>view.calls.push('train:'+rank),{className:'shell-primary',action:'train'});
  train.querySelector('span').className='workshop-train-command';
  if(cost!==null)view.element('span','workshop-train-cost',`${cost} 练习笔记`,train);
  train.disabled=cost===null||balance<cost||!persisted;
  if(cost!==null&&balance<cost)view.element('small','workshop-muted',`还需 ${cost-balance} 练习笔记`,training);
  const wallet=view.element('section','workshop-wallet',undefined,main);
  view.element('span','','练习笔记',wallet);view.element('strong','',String(balance),wallet);view.element('small','','通关 +3 · 章节首通额外 +3',wallet);
  view.button(main,'成长资料',()=>view.showPage('growth'),{action:'training-catalog'});
  const inventory=view.element('section','workshop-inventory',undefined,main);view.element('h2','','演出配件',inventory);
  const gear=view.button(inventory,'广角喷嘴',()=>view.calls.push('equip:wide'),{className:'workshop-equipment'});gear.dataset.equipment='wide_nozzle';gear.insertBefore(view.element('img','old-equipment-icon',undefined,gear),gear.children[0]);
  const notice=view.element('p','workshop-status',persisted?'训练与装备保存在本机。':'记录尚未保存，训练与装备暂不可用。',main);
  if(!persisted)view.button(main,'重试保存',()=>view.calls.push('retry'),{action:'retry-save'});
  const footer=view.element('footer','shell-selection-footer shell-preparation-footer');
  view.element('p','',`霓虹街口 · Sakura · 阶位 ${rank}`,footer);footer.append(train,notice);
  view.button(footer,current?'返回成员':'确认Sakura出战',()=>view.calls.push(current?'footer-back':'confirm'),{className:'shell-primary',action:'confirm-preparation'});
  compactTrainingPage(view,main);
  return {view,main,identity,training,train,footer};
}
const q=(view,selector)=>view.root.querySelector(selector);
const openTool=(view,uiIcon)=>{view.root.querySelector(`[data-ui-icon=${uiIcon}]`).click();return view.root.querySelector('dialog');};

test('training: one identity stage, compact rank/compare/cost panel visible on first level', ()=>{
  const {view,main,identity,training}=workshopFixture();
  assert.equal(main.dataset.secondaryPage,'workshop');
  assert.equal(q(view,'h2.shell-page-heading').hidden,true);
  assert.ok(identity.classList.contains('sec-training-stage'));
  assert.equal(identity.querySelectorAll('.workshop-portrait-stage').length,1,'exactly one actor portrait');
  assert.ok(training.classList.contains('sec-training-body'));
  for(const selector of ['.workshop-rank-track','.workshop-effects','.workshop-wallet'])
    assert.ok(training.contains(q(view,selector))&&visible(q(view,selector)),selector+' visible in training panel');
  assert.ok(training.querySelector('h2').classList.contains('sec-training-rank'));
  assert.ok(q(view,'.workshop-wallet').querySelector('strong').textContent==='5','balance sits beside cost');
  assert.equal(visible(q(view,'.shell-member-strip')),false,'strip only in switch sheet');
  assert.equal(visible(q(view,'.workshop-inventory')),false,'equipment only in sheet');
  assert.equal(q(view,'.shell-preparation-footer').children[0].hidden,true,'duplicate footer summary retired');
});

test('training: train command keeps canonical handler and lettering; header back is the only back', ()=>{
  const {view,train}=workshopFixture();
  assert.equal(train.disabled,false);assert.equal(train.dataset.secondaryLetter,'train');
  assert.equal(train.dataset.uiIcon,undefined,'no icon-only dumbbell');
  // B263: cost is drawn once in the effects ledger; the command still announces it (sr-only span).
  assert.ok(q(view,'.workshop-train-cost').classList.contains('ui-sr-label'));
  assert.ok(visible(q(view,'[data-training-effect=cost]')));
  train.click();assert.deepEqual(view.calls,['train:2']);
  const exit=q(view,'[data-action=confirm-preparation]');
  assert.equal(visible(exit),false,'no duplicate footer back for current member');
  assert.ok(visible(q(view,'.shell-header').querySelector('[data-action=back]')));
});

test('training: disabled command shows its reason beside it (insufficient, max, unsaved)', ()=>{
  const short=workshopFixture({balance:1});
  assert.equal(short.train.disabled,true);assert.equal(short.train.dataset.trainingBlocked,'insufficient');
  const reason=short.footer.querySelector('.sec-training-reason');
  assert.ok(reason&&visible(reason));assert.equal(reason.textContent,'还需 1 练习笔记');
  assert.equal(short.train.getAttribute('aria-describedby'),reason.id);
  assert.equal(short.train.dataset.secondaryLetter,undefined,'native label stays readable while blocked');
  short.train.click();assert.deepEqual(short.view.calls,[]);
  const max=workshopFixture({rank:4,cost:null});
  assert.equal(max.train.dataset.trainingBlocked,'complete');
  assert.equal(max.footer.querySelector('.sec-training-reason').textContent,'训练已完成');
  const unsaved=workshopFixture({persisted:false});
  assert.equal(unsaved.train.dataset.trainingBlocked,'unsaved');
  assert.equal(unsaved.train.getAttribute('aria-describedby'),q(unsaved.view,'.workshop-status').id);
  assert.ok(unsaved.training.contains(q(unsaved.view,'[data-action=retry-save]')),'retry stays on first level');
  q(unsaved.view,'[data-action=retry-save]').click();assert.deepEqual(unsaved.view.calls,['retry']);
});

test('training: candidate keeps the real confirm command; equipment/info/switch sheets reuse canonical nodes', ()=>{
  const {view}=workshopFixture({current:false});
  const confirm=q(view,'[data-action=confirm-preparation]');
  assert.ok(visible(confirm));assert.equal(confirm.dataset.secondaryLetter,'deploy');
  confirm.click();assert.deepEqual(view.calls,['confirm']);
  const sheet=openTool(view,'equipment');
  assert.ok(sheet.contains(q(view,'.workshop-inventory')));
  q(view,'[data-equipment=wide_nozzle]').click();assert.ok(view.calls.includes('equip:wide'));
  const info=openTool(view,'info');assert.ok(info.contains(q(view,'[data-action=training-catalog]')));
  q(view,'[data-action=training-catalog]').click();assert.ok(view.calls.includes('page:growth'));
  for(const host of view.root.querySelectorAll('[data-secondary-letter]'))assert.ok(LETTER_KEYS.has(host.dataset.secondaryLetter),host.dataset.secondaryLetter);
});

test('records: chapter log rows with index, real empty state, commands preserved', ()=>{
  const view=makeView('records'),main=view.element('main','shell-content');
  view.element('div','shell-session-context');
  view.element('h2','shell-page-heading','成员成绩',main);
  const strip=view.element('div','shell-member-strip',undefined,main);
  view.element('p','archive-summary','Sakura · 通关 1 次',main);
  view.element('p','archive-summary archive-rules-label','当前规则 · 三人三章 · 规则 14',main);
  const list=view.element('section','archive-current-records',undefined,main);
  for(const [id,measured] of [['c1',true],['c2',false]]){
    const row=view.element('section','archive-record',undefined,list);row.dataset.recordChapter=id;
    view.element('figure','shell-route-preview archive-record-venue',undefined,row);view.element('h2','',id,row);
    if(measured)view.element('dl','archive-record-stats',undefined,row);else view.element('p','archive-empty','本成员暂无实测通关成绩',row);
  }
  view.element('details','archive-history archive-overview',undefined,main);
  view.button(main,'章节现场档案',()=>view.showPage('chapterArchive'),{action:'archive-chapters'});
  const footer=view.element('footer','shell-selection-footer');
  view.button(footer,'巡演手记',()=>view.calls.push('story'),{action:'story-journal'});
  compactSecondaryPage(view,main);
  const rows=list.querySelectorAll('.archive-record');
  assert.deepEqual(rows.map(row=>row.dataset.recordIndex),['01','02']);
  assert.ok(visible(q(view,'.archive-empty')));
  q(view,'[data-action=archive-chapters]').click();q(view,'[data-action=story-journal]').click();
  assert.deepEqual(view.calls,['page:chapterArchive','story']);
});

test('css: training/growth rules use one page scroller, no fixed 375x667 page height, no blank growth hero', ()=>{
  const css=readFileSync(new URL('../src/styles/secondaryHierarchy.css',import.meta.url),'utf8');
  const training=css.split('\n').filter(line=>/sec-training|workshop-/.test(line));
  assert.ok(training.length>0);
  assert.equal(training.some(line=>/sec-training-(stage|body)[^{]*\{[^}]*overflow:(auto|scroll)/.test(line)),false,'no nested scroller');
  assert.equal(/\b(667|812|844|740)px/.test(css),false,'no device page heights');
  assert.equal(css.includes('padding:0 105px 0 0'),false,'growth stage reserves no blank portrait column');
  assert.equal(/\.sec-growth-stage\{[^}]*min-height:166px/.test(css),false);
});

test('css: cost and balance share one full-width ledger (label left, value right)', ()=>{
  const css=readFileSync(new URL('../src/styles/secondaryHierarchy.css',import.meta.url),'utf8');
  const costRules=css.split('\n').filter(line=>line.includes('[data-training-effect=cost]{')||line.includes('[data-training-effect=cost],'));
  assert.ok(costRules.some(line=>/grid-column:1\/-1/.test(line)&&/justify-content:space-between/.test(line)));
  assert.equal(costRules.some(line=>/grid-column:auto/.test(line)),false,'cost row must not collapse into the current-value column');
});
