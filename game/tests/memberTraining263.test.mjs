// B263 member training -> growth composition. Fixtures mirror PublicShellView.workshop() (3 real ranks,
// cost 3/6/null, aria cost label, save notice variants) and renderGrowthCatalog() owner-pass nodes.
// Same minimal native-<dialog> DOM stub as memberTrainingRebuild.test.mjs.
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
// Visible to sighted users: not hidden and not moved into a screen-reader-only label.
const shown=node=>{for(let n=node;n;n=n.parentNode)if(n.hidden||n.classList?.contains('ui-sr-label'))return false;return true;};

function makeView(page){
  const doc=new FakeDocument(),root=doc.createElement('section');doc.documentElement.append(root);
  const calls=[];
  const view={doc,root,page,disposed:false,navigating:false,calls,
    scene:{_sessionExperience:{isBlocking:()=>false}},
    selection:{memberId:'sakura',previewMember(id){calls.push('preview:'+id);this.memberId=id;return true;}},
    element(tag,className,text,parent=root){const n=doc.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;parent?.append(n);return n;},
    button(parent,label,callback,{className='',action,iconOnly=false}={}){
      const b=view.element('button',className,undefined,parent);b.setAttribute('aria-label',label);
      if(action)b.dataset.action=action;
      if(!iconOnly)view.element('span','',label,b);else b.title=label;
      b.addEventListener('click',()=>{if(view.disposed||view.navigating||b.disabled)return;callback();});return b;
    },
    showPage(target){calls.push('page:'+target);return true;},
    render(){view.hierarchySheetDispose?.();root.replaceChildren();},
  };
  return view;
}
const LETTER_KEYS=new Set(['growth','library','records','venue','train','apply','confirm','cancel','assign','collapse','first','second','sources','compare','room','preflight','deploy']);
const COST={1:3,2:6,3:null};
const SAVE_NOTICE={saved:'训练与装备保存在本机。',fresh:'尚无已保存的训练或装备记录。',pending:'记录尚未保存，训练与装备暂不可用。',recovery:'原档已保留，恢复存档前训练与装备暂不可用。'};

// save: saved | fresh (no record yet) | pending (write failed, retry offered) | recovery (original kept)
function workshopFixture({balance=5,save='saved',current=true,rank=1,member='sakura'}={}){
  const view=makeView('workshop'),main=view.element('main','shell-content'),cost=COST[rank];
  view.selection.memberId=member;
  const header=view.element('header','shell-header');view.button(header,'返回',()=>view.calls.push('header-back'),{action:'back',iconOnly:true});
  if(save==='recovery')view.element('section','shell-save-recovery',undefined,main);
  view.element('h2','shell-page-heading','成员训练计划',main);
  const strip=view.element('div','shell-member-strip',undefined,main);
  for(const id of ['sakura','kai','enjo']){const b=view.button(strip,id,()=>view.selection.previewMember(id),{className:'shell-member-option'});b.dataset.member=id;b.setAttribute('aria-pressed',String(id===member));}
  const identity=view.element('section','workshop-member-context',undefined,main);
  identity.dataset.performer=member;identity.dataset.selection=current?'current':'candidate';
  const stage=view.element('div','workshop-portrait-stage',undefined,identity);view.element('span','member-mark member-mark-large member-mark-full',undefined,stage);
  const copy=view.element('div','workshop-member-copy',undefined,identity);
  view.element('small','',current?'当前出战':'候选准备 · 尚未出战',copy);view.element('strong','',member,copy);
  view.element('span','workshop-member-action','连续涂染',copy);view.element('span','workshop-member-role','远程 · 连续扫射',copy);
  const training=view.element('section','workshop-training',undefined,main);
  view.element('h2','',`训练阶位 ${rank}`,training);
  const track=view.element('ol','workshop-rank-track',undefined,training);
  for(const level of [1,2,3]){
    const li=view.element('li','',undefined,track);li.dataset.trainingRank=String(level);
    li.dataset.state=level<rank?'complete':level===rank?'current':level===rank+1?'next':'locked';
    if(level===rank)li.setAttribute('aria-current','step');
    view.element('b','',String(level).padStart(2,'0'),li);
    view.element('span','',level<rank?'已完成':level===rank?'当前阶位':level===rank+1?'下一阶位':'待训练',li);
  }
  const effects=view.element('dl','workshop-effects',undefined,training);
  for(const [key,label,value] of [['current','当前涂染增益',`+${(rank-1)*10}%`],['next','下阶涂染增益',cost===null?'已满阶':`+${rank*10}%`],['cost','本次消耗',cost===null?'无需消耗':`${cost} 练习笔记`]]){
    const row=view.element('div','',undefined,effects);row.dataset.trainingEffect=key;view.element('dt','',label,row);view.element('dd','',value,row);
  }
  const train=view.button(training,cost===null?'训练已完成':`训练至阶位 ${rank+1}`,()=>view.calls.push('train:'+rank),{className:'shell-primary',action:'train'});
  train.querySelector('span').className='workshop-train-command';
  if(cost!==null){view.element('span','workshop-train-cost',`${cost} 练习笔记`,train);train.setAttribute('aria-label',`训练至阶位 ${rank+1} · ${cost} 练习笔记`);}
  train.disabled=cost===null||balance<cost||save!=='saved';
  if(cost!==null&&balance<cost)view.element('small','workshop-muted',`还需 ${cost-balance} 练习笔记`,training);
  const wallet=view.element('section','workshop-wallet',undefined,main);
  view.element('span','','练习笔记',wallet);const owned=view.element('strong','',String(balance),wallet);owned.dataset.resource='notes';
  view.element('small','','通关 +3 · 章节首通额外 +3',wallet);
  view.button(main,'成长资料',()=>view.showPage('growth'),{action:'training-catalog'});
  const inventory=view.element('section','workshop-inventory',undefined,main);view.element('h2','','演出配件',inventory);
  view.element('p','workshop-muted',`${member}装备：无 · 1 个配件位`,inventory);
  const gear=view.button(inventory,'广角喷嘴',()=>view.calls.push('equip:wide'),{className:'workshop-equipment'});gear.dataset.equipment='wide_nozzle';gear.disabled=save!=='saved';
  const notice=view.element('p','workshop-status',SAVE_NOTICE[save],main);notice.setAttribute('role','status');
  if(save==='pending')view.button(main,'重试保存',()=>view.calls.push('retry'),{className:'shell-primary',action:'retry-save'});
  const footer=view.element('footer','shell-selection-footer shell-preparation-footer');
  view.element('p','',`霓虹街口 · ${member} · 阶位 ${rank}`,footer);footer.append(train,notice);
  view.button(footer,current?'返回成员':`确认${member}出战`,()=>view.calls.push(current?'footer-back':'confirm'),{className:'shell-primary',action:'confirm-preparation'});
  compactTrainingPage(view,main);
  return {view,main,identity,training,train,footer,notice,wallet,effects};
}
const q=(view,selector)=>view.root.querySelector(selector);
const openTool=(view,uiIcon)=>{view.root.querySelector(`[data-ui-icon=${uiIcon}]`).click();return view.root.querySelector('dialog');};
const shownText=(root,text)=>{const out=[];const walk=n=>{for(const c of n.children){if(shown(c)&&c.children.length===0&&c.textContent.includes(text))out.push(c);walk(c);}};walk(root);return out;};

test('workshop263: three real rank tokens keep number and native state, current one is marked', ()=>{
  const {view,training}=workshopFixture({rank:2});
  const track=q(view,'.workshop-rank-track');
  assert.ok(training.contains(track)&&shown(track));
  const tokens=track.querySelectorAll('[data-training-rank]');
  assert.deepEqual(tokens.map(t=>t.dataset.state),['complete','current','next']);
  assert.deepEqual(tokens.map(t=>shown(t.querySelector('span'))),[true,true,true],'state word is readable, not colour only');
  assert.equal(tokens[1].getAttribute('aria-current'),'step');
});

test('workshop263: required cost is drawn once, balance once; command keeps cost in aria-label', ()=>{
  const {view,train,wallet,effects}=workshopFixture({balance:5,rank:1});
  assert.equal(shownText(view.root,'3 练习笔记').length,1,'one visible required cost (the ledger row)');
  assert.ok(effects.querySelector('[data-training-effect=cost]').contains(shownText(view.root,'3 练习笔记')[0]));
  assert.equal(shown(train.querySelector('.workshop-train-cost')),false,'CTA does not repeat the cost');
  assert.equal(train.getAttribute('aria-label'),'训练至阶位 2 · 3 练习笔记','accessible name still carries cost');
  assert.ok(shown(wallet.querySelector('[data-resource=notes]')));
  assert.equal(wallet.querySelector('[data-resource=notes]').textContent,'5');
  assert.equal(wallet.getAttribute('aria-label'),'持有练习笔记','balance is labelled as owned, not as a second cost');
  assert.equal(wallet.querySelector('small'),null);
  assert.ok(q(view,'.ui-workshop-info').querySelector('small'),'source note lives in the info sheet');
  assert.deepEqual(view.calls,[],'composition never trains or saves');
});

test('workshop263: footer owns ONE primary command; candidate deploy is a distinct secondary command', ()=>{
  const cur=workshopFixture();
  const primaries=cur.footer.querySelectorAll('.shell-primary').filter(shown);
  assert.equal(primaries.length,1);assert.equal(primaries[0],cur.train);
  assert.equal(shown(q(cur.view,'[data-action=confirm-preparation]')),false,'header back is the only return');
  const cand=workshopFixture({current:false,member:'kai'});
  const deploy=q(cand.view,'[data-action=confirm-preparation]');
  assert.ok(shown(deploy));assert.ok(deploy.classList.contains('sec-training-deploy'));
  assert.equal(cand.footer.dataset.commands,'train deploy');
  assert.equal(deploy.dataset.secondaryLetter,'deploy');
  deploy.click();assert.deepEqual(cand.view.calls,['confirm'],'deploy only on its own explicit tap');
  cand.train.click();assert.deepEqual(cand.view.calls,['confirm','train:1']);
});

test('workshop263: fresh / pending / recovery / insufficient / complete stay legible and never read as success', ()=>{
  const fresh=workshopFixture({save:'fresh'});
  assert.equal(fresh.train.dataset.trainingBlocked,'unsaved');
  assert.equal(fresh.train.getAttribute('aria-describedby'),fresh.notice.id);
  assert.ok(shown(fresh.notice));assert.equal(fresh.notice.textContent,SAVE_NOTICE.fresh);
  assert.equal(fresh.footer.dataset.trainingState,'unsaved');
  const pending=workshopFixture({save:'pending'});
  const retry=q(pending.view,'[data-action=retry-save]');
  assert.ok(shown(retry)&&pending.training.contains(retry),'retry visible on first level');
  retry.click();assert.deepEqual(pending.view.calls,['retry']);
  const recovery=workshopFixture({save:'recovery'});
  assert.ok(shown(q(recovery.view,'.shell-save-recovery')),'recovery notice stays visible');
  assert.equal(recovery.notice.textContent,SAVE_NOTICE.recovery);
  const short=workshopFixture({balance:1});
  assert.equal(short.train.dataset.trainingBlocked,'insufficient');assert.equal(short.footer.dataset.trainingState,'insufficient');
  assert.equal(short.footer.querySelector('.sec-training-reason').textContent,'还需 2 练习笔记');
  const max=workshopFixture({rank:3});
  assert.equal(max.train.dataset.trainingBlocked,'complete');assert.equal(max.footer.dataset.trainingState,'complete');
  assert.deepEqual(max.view.root.querySelectorAll('[data-training-rank]').map(t=>t.dataset.state),['complete','complete','current']);
  const ready=workshopFixture();
  assert.equal(ready.footer.dataset.trainingState,'ready');
  for(const f of [fresh,pending,recovery,short,max,ready])assert.equal(f.training.dataset.trainingState,f.footer.dataset.trainingState,'ledger reflects the same authoritative command state');
  for(const f of [fresh,pending,recovery,short,max]){f.train.click();assert.equal(f.view.calls.includes('train:1')||f.view.calls.includes('train:3'),false);}
});

test('workshop263: one actor-switch sheet reaches all three actors as preview; equip/info sheets are real', ()=>{
  const {view}=workshopFixture();
  assert.equal(view.root.querySelectorAll('.ui-actor-switch').length,1);
  const sheet=openTool(view,'switch');
  assert.deepEqual(sheet.querySelectorAll('[data-member]').map(b=>b.dataset.member),['sakura','kai','enjo']);
  sheet.querySelector('[data-member=enjo]').click();assert.deepEqual(view.calls,['preview:enjo']);
  view.root.querySelector('.ui-sheet-close').click();
  const gear=openTool(view,'equipment');gear.querySelector('[data-equipment=wide_nozzle]').click();
  assert.ok(view.calls.includes('equip:wide'));
  view.root.querySelector('.ui-sheet-close').click();
  const info=openTool(view,'info');info.querySelector('[data-action=training-catalog]').click();
  assert.ok(view.calls.includes('page:growth'),'growth planning is a second-level page, reached explicitly');
  for(const host of view.root.querySelectorAll('[data-secondary-letter]'))assert.ok(LETTER_KEYS.has(host.dataset.secondaryLetter),host.dataset.secondaryLetter);
});

// Mirrors renderGrowthCatalog() owner pass: 3 ranks, native state words, footer apply/confirm/cancel.
function growthFixture({current=1,plan=current,confirming=false,blocked=null,applied=plan===current}={}){
  const view=makeView('growth'),main=view.element('main','shell-content');
  view.element('div','shell-session-context');
  view.element('h2','shell-page-heading','成长规划',main);
  const members=view.element('div','shell-member-strip',undefined,main);
  for(const id of ['sakura','kai','enjo']){const b=view.button(members,id,()=>view.selection.previewMember(id),{className:'shell-member-option'});b.dataset.growthMember=id;}
  view.element('p','system-context growth-member',`Sakura · 当前阶位 ${current} · 练习笔记 4`,main);
  const pool=view.element('section','arrangement-pool',undefined,main);view.element('h2','','训练阶位',pool);
  const ranks=view.element('div','growth-ranks',undefined,pool);
  for(const level of [1,2,3]){
    const b=view.button(ranks,`阶位 ${level}`,()=>{view.calls.push('rank:'+level);view.growthRank=level;},{className:'arrangement-option'});
    b.dataset.growthRank=String(level);b.setAttribute('aria-pressed',String(level===plan));b.replaceChildren();
    view.element('strong','',`阶位 ${level}`,b);view.element('small','',level===current?'当前':level<current?'已完成':'规划',b);
  }
  const preview=view.element('section','growth-preview',undefined,main);view.element('h2','',applied?'当前配置':'规划配置 · 未应用',preview);
  const labels=view.element('div','growth-comparison-labels',undefined,preview);for(const l of ['效果','当前','规划'])view.element('span','',l,labels);
  const table=view.element('dl','growth-effects',undefined,preview);
  const row=view.element('div','',undefined,table);view.element('dt','','行动涂染威力',row);view.element('dd','','0%',row);view.element('dd','',`${(plan-1)*10}%`,row);
  const gear=view.element('section','arrangement-pool growth-equipment-pool',undefined,main);view.element('h2','','演出配件',gear);
  const options=view.element('div','arrangement-options',undefined,gear);
  for(const id of ['none','wide_nozzle']){const b=view.button(options,id,()=>view.calls.push('equip:'+id),{className:'arrangement-option'});b.dataset.growthEquipment=id;}
  const application=view.element('section','growth-application',undefined,main);
  const cost=view.element('p','system-context',`当前 → 规划 · 需 ${plan>current?3:0} 练习笔记`,application);
  if(blocked)view.element('p','workshop-muted',blocked,application);
  const actions=view.element('div','preflight-links',undefined,application);
  const apply=view.button(actions,'应用整套方案',()=>view.calls.push('apply'),{action:'growth-apply'});apply.disabled=!!blocked;
  const links=view.element('div','preflight-links',undefined,main);
  view.button(links,'前往成员训练',()=>view.showPage('workshop'),{action:'growth-training'});
  view.button(links,'查看背包',()=>view.showPage('inventory'),{action:'growth-inventory'});
  const footer=view.element('footer','shell-selection-footer planning-command-footer');
  const status=view.element('p','workshop-status',applied?'当前方案已保存。':'规划尚未应用；下方出战使用已保存配置。',footer);
  footer.dataset.planState=confirming?'confirm':applied?'current':'draft';
  actions.hidden=confirming||applied;footer.append(actions);
  if(!applied)apply.classList.add('shell-primary');
  if(confirming){
    view.element('p','system-context','Sakura · 阶位 2 · 未装备。训练不可撤销，出战成员不变。',footer);
    const row2=view.element('div','preflight-links',undefined,footer);
    view.button(row2,'确认应用 · 3 笔记',()=>view.calls.push('confirm-apply'),{className:'shell-primary',action:'growth-confirm'});
    view.button(row2,'取消应用',()=>view.calls.push('cancel'),{action:'growth-cancel'});
  }
  view.button(footer,'前往出战准备',()=>view.calls.push('preflight'),{action:'prepared-preflight'});
  compactSecondaryPage(view,main,{member:{id:'sakura'}});
  return {view,main,ranks,cost,status,apply,footer};
}

test('growth263: rank tokens separate saved current rank from the planned (selected) rank', ()=>{
  const {ranks}=growthFixture({current:1,plan:2});
  const tokens=ranks.querySelectorAll('[data-growth-rank]');
  assert.deepEqual(tokens.map(t=>t.dataset.rankState),['current','plan','plan']);
  assert.deepEqual(tokens.map(t=>t.getAttribute('aria-pressed')),['false','true','false']);
  const later=growthFixture({current:3});
  assert.deepEqual(later.ranks.querySelectorAll('[data-growth-rank]').map(t=>t.dataset.rankState),['complete','complete','current']);
});

test('growth263: compact grouped before/after + one cost line, planning never applies by itself', ()=>{
  const {view,main,cost}=growthFixture({current:1,plan:2});
  assert.ok(cost.classList.contains('sec-growth-cost')&&shown(cost));
  assert.ok(main.querySelector('.sec-growth-body').contains(cost));
  assert.equal(shownText(view.root,'3 练习笔记').length,1,'draft shows required cost once');
  assert.ok(shown(main.querySelector('.growth-preview'))&&main.querySelector('.growth-preview').classList.contains('sec-growth-compare'));
  assert.deepEqual(view.calls,[],'composition does not apply, train or deploy');
  const apply=q(view,'[data-action=growth-apply]');assert.ok(shown(apply));assert.equal(apply.dataset.secondaryLetter,'apply');
  apply.click();assert.deepEqual(view.calls,['apply'],'apply is an explicit first step, not a write');
});

test('growth263: confirm step, applied, blocked states keep native text and distinct commands', ()=>{
  const confirm=growthFixture({current:1,plan:2,confirming:true});
  assert.equal(confirm.footer.dataset.planState,'confirm');
  assert.equal(shown(q(confirm.view,'[data-action=growth-apply]')),false);
  const ok=q(confirm.view,'[data-action=growth-confirm]'),cancel=q(confirm.view,'[data-action=growth-cancel]');
  assert.ok(shown(ok)&&shown(cancel));assert.equal(ok.dataset.secondaryLetter,undefined);assert.equal(cancel.dataset.secondaryLetter,'cancel');
  const applied=growthFixture({current:2});
  assert.ok(shown(applied.status));assert.equal(applied.status.textContent,'当前方案已保存。');
  const blocked=growthFixture({current:1,plan:3,blocked:'记录尚未保存'});
  assert.ok(shown(q(blocked.view,'.workshop-muted')));assert.equal(q(blocked.view,'[data-action=growth-apply]').disabled,true);
  q(blocked.view,'[data-action=growth-apply]').click();assert.deepEqual(blocked.view.calls,[]);
  assert.equal(blocked.view.root.querySelectorAll('.ui-actor-switch').length,1);
});

test('css263: scoped stylesheet uses the thin-ui AI surfaces, no metal bevel, no device heights, one scroller', ()=>{
  const css=readFileSync(new URL('../src/styles/memberTraining263.css',import.meta.url),'utf8');
  for(const art of ['row','selected','tab','primary','panel'])assert.ok(css.includes(`art/thin-ui-20261101/${art}.webp`),art);
  assert.equal(/member-studio-20261101/.test(css),false,'no dependency on not-yet-delivered art');
  assert.equal(/\b(667|812|844|740|932)px/.test(css),false,'no device page heights');
  assert.equal(/inset\s+0\s+[-\d]/.test(css)||/border-image/.test(css),false,'no bevel/border-image metal controls');
  assert.equal(/sec-training-(stage|body)[^{]*\{[^}]*overflow:(auto|scroll)/.test(css),false,'no nested scroller');
  const rules=css.replace(/\/\*[\s\S]*?\*\//g,'').match(/^[^{}@\s][^{}]*\{/gm)||[];
  assert.equal(rules.length,2,'two page-scoped blocks only');
  for(const rule of rules)assert.match(rule,/^#game-container #public-shell\[.*\]\[data-page=(workshop|growth)\]\{$/);
});
