import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDocument} from './helpers/publicShellHarness.mjs';
import {BattleNoticeView} from '../src/systems/BattleNoticeView.mjs';

const ICONS={guidance:'art/battle-signals-b293/guidance.webp',phase:'art/battle-signals-b293/phase.webp',
  action:'art/battle-signals-b293/action.webp',danger:'art/battle-signals-b293/danger.webp'};
const LONG='压轴挑战开始：先离开预告弹路，再沿红圈外侧绕到舞台左翼，等待破绽开放后集中攻击标记（1/3）！  Stage cue · 00:42 · 不要追击回程声浪。';

function view(){
  const doc=createDocument(),notice=new BattleNoticeView(doc);
  return {doc,notice,root:notice.root,icon:notice.root.querySelector('.battle-signal-icon'),copy:notice.root.querySelector('.battle-signal-copy')};
}
function assertShowing(v,text,kind){
  assert.equal(v.root.hidden,false);
  assert.equal(v.root.textContent,text);
  assert.equal(v.copy.textContent,text);
  assert.equal(v.root.dataset.kind,kind);
  assert.equal(v.icon.getAttribute('src'),ICONS[kind]);
}
function assertHidden(v){
  assert.equal(v.root.hidden,true);
  assert.equal(v.root.textContent,'');
}

test('root holds a decorative icon then the copy, and keeps its live-region semantics',()=>{
  const v=view();
  assert.equal(v.doc.getElementById('battle-notice'),v.root);
  assert.equal(v.root.parentNode,v.doc.getElementById('game-container'));
  assert.equal(v.root.getAttribute('role'),'status');
  assert.equal(v.root.getAttribute('aria-live'),'polite');
  assert.deepEqual(v.root.children,[v.icon,v.copy]);
  assert.equal(v.icon.tagName,'IMG');
  assert.equal(v.icon.getAttribute('alt'),'');
  assert.equal(v.icon.getAttribute('aria-hidden'),'true');
  assert.equal(v.copy.tagName,'SPAN');
  assert.equal(v.copy.getAttribute('aria-hidden'),null,'the message itself stays exposed');
  assertHidden(v);
});

test('each kind maps to its explicit icon path, and the default kind stays phase',()=>{
  const v=view();
  for(const [index,kind] of Object.keys(ICONS).entries()){
    v.notice.show('信号 '+kind,{kind},index*10);
    assertShowing(v,'信号 '+kind,kind);
    v.notice.clear(kind);
  }
  v.notice.show('默认',undefined,100);
  assertShowing(v,'默认','phase');
});

test('long messages reach root textContent exactly, and non-strings still coerce',()=>{
  const v=view();
  v.notice.show(LONG,{kind:'danger',duration:1000},0);
  assertShowing(v,LONG,'danger');
  v.notice.show(42,{kind:'danger',duration:1000},10);
  assertShowing(v,'42','danger');
});

test('empty text is ignored',()=>{
  const v=view();
  v.notice.show('',{kind:'danger'},0);
  assertHidden(v);
});

test('queue preempts by priority, resumes the remainder, then drains high to low',()=>{
  const v=view(),n=v.notice;
  n.show('phase',{kind:'phase',duration:1000},0);
  n.show('danger',{kind:'danger',duration:500},100);
  assertShowing(v,'danger','danger');
  n.show('guidance',{kind:'guidance',duration:800},200);
  n.show('action',{kind:'action',duration:300},300);
  assertShowing(v,'danger','danger');
  n.update(599);assertShowing(v,'danger','danger');
  n.update(600);assertShowing(v,'action','action');
  n.update(899);assertShowing(v,'action','action');
  n.update(900);assertShowing(v,'phase','phase');
  n.update(1799);assertShowing(v,'phase','phase');
  n.update(1800);assertShowing(v,'guidance','guidance');
  n.update(2599);assertShowing(v,'guidance','guidance');
  n.update(2600);assertHidden(v);
});

test('same-kind messages replace, and durations clamp to the original limits',()=>{
  const v=view(),n=v.notice;
  n.show('first',{kind:'phase',duration:1000},0);
  n.show('second',{kind:'phase',duration:1000},10);
  assertShowing(v,'second','phase');
  n.update(1010);assertHidden(v);
  n.show('short',{kind:'guidance',duration:1},2000);
  n.update(2199);assertShowing(v,'short','guidance');
  n.update(2200);assertHidden(v);
  n.show('long',{kind:'guidance',duration:99999},3000);
  n.update(9499);assertShowing(v,'long','guidance');
  n.update(9500);assertHidden(v);
});

test('queued messages older than 6500ms are dropped at expiry',()=>{
  const fresh=view();
  fresh.notice.show('danger',{kind:'danger',duration:6500},0);
  fresh.notice.show('guidance',{kind:'guidance',duration:900},0);
  fresh.notice.update(6500);
  assertShowing(fresh,'guidance','guidance');
  const stale=view();
  stale.notice.show('danger',{kind:'danger',duration:6500},0);
  stale.notice.show('guidance',{kind:'guidance',duration:900},0);
  stale.notice.update(6501);
  assertHidden(stale);
});

test('hiding resets only the copy, so the icon and span survive and are reused',()=>{
  const v=view(),n=v.notice;
  n.show('one',{kind:'action',duration:300},0);
  n.update(300);
  assertHidden(v);
  assert.deepEqual(v.root.children,[v.icon,v.copy]);
  n.show('two',{kind:'danger',duration:300},400);
  assertShowing(v,'two','danger');
  n.clear('danger');
  assertHidden(v);
  assert.deepEqual(v.root.children,[v.icon,v.copy]);
  assert.equal(v.root.querySelector('.battle-signal-icon'),v.icon);
  assert.equal(v.root.querySelector('.battle-signal-copy'),v.copy);
});

test('clear keeps original semantics for current and pending kinds',()=>{
  const v=view(),n=v.notice;
  n.show('danger',{kind:'danger',duration:1000},0);
  n.show('phase',{kind:'phase',duration:500},0);
  n.show('guidance',{kind:'guidance',duration:500},0);
  n.clear('guidance');
  assertShowing(v,'danger','danger');
  n.clear('danger');
  assertHidden(v);
  n.update(10);
  assertShowing(v,'phase','phase');
  n.update(510);
  assertHidden(v);
});

test('repeated updates and shows do not rebuild or duplicate nodes',()=>{
  const v=view(),n=v.notice;
  n.show('steady',{kind:'phase',duration:1000},0);
  for(let now=1;now<1000;now+=100){
    n.update(now);
    assertShowing(v,'steady','phase');
    assert.deepEqual(v.root.children,[v.icon,v.copy]);
  }
  for(let index=0;index<5;index++)n.show('message '+index,{kind:'phase',duration:1000},1000+index);
  assertShowing(v,'message 4','phase');
  assert.deepEqual(v.root.children,[v.icon,v.copy]);
  assert.equal(v.root.querySelectorAll('img').length,1);
  assert.equal(v.root.querySelectorAll('span').length,1);
});

test('destroy removes the root, silences later calls and is idempotent',()=>{
  const v=view(),n=v.notice,host=v.doc.getElementById('game-container');
  n.show('bye',{kind:'danger',duration:1000},0);
  n.destroy();n.destroy();
  assert.equal(host.children.includes(v.root),false);
  assert.equal(n.current,null);
  n.show('after',{kind:'danger',duration:1000},10);
  n.update(20);
  assert.equal(n.current,null);
  assert.equal(v.root.textContent,'bye','a removed root is not touched again, matching the original');
});

// Static contract only: this does not resolve the cascade or lay anything out, so it needs a browser check alongside it.
const css=readFileSync(new URL('../src/styles/battleSignals.css',import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
const rules=new Map();
for(const [,selectors,body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
  for(const selector of selectors.split(','))rules.set(selector.trim().replace(/\s+/g,' '),body);
const G='#game-container[data-battle-mode="public"]';
const NOTICE_ON=':has(> #battle-notice:not([hidden]))',STRIP=':has(#hud > .public-boss-strip)';
function assertRule(selector,...declarations){
  const body=rules.get(selector);
  assert.ok(body!==undefined,'missing rule: '+selector);
  for(const declaration of declarations)assert.ok(body.includes(declaration),selector+' lacks '+declaration);
}

test('notice CSS is an unboxed icon and copy row at the agreed geometry',()=>{
  assertRule(G+' #battle-notice','display:grid','grid-template-columns:24px minmax(0,1fr)','gap:6px','top:110px','left:10px',
    'transform:none','max-width:290px','background:none','border:0','box-shadow:none','font-size:14px','line-height:19px','color:#fff');
  assertRule(G+' #battle-notice[data-kind="danger"]','background:none','border:0','color:var(--signal-alert)');
  assertRule(G+' #hud:has(> .public-boss-strip) ~ #battle-notice','top:180px');
  assert.doesNotMatch(css,/text-overflow|line-clamp/);
});

test('CSS restates every hidden and paused state that its display rules would otherwise defeat',()=>{
  for(const selector of [G+' #battle-notice[hidden]',G+'[data-battle-paused="true"] #battle-notice',
    G+' #combat-feedback #combat-entry[hidden]',G+' #combat-feedback #combat-hit[hidden]'])
    assertRule(selector,'display:none');
  assert.ok(!rules.get(G+' #combat-feedback #combat-hit .combat-hit-source').includes('display'),
    'source visibility stays with the legacy [hidden] rule');
});

test('countdown CSS drops the frame and uses the generated art behind the number',()=>{
  assertRule(G+' #combat-feedback #combat-entry','top:220px','left:calc(50% - 55px)','width:110px','height:90px',
    'background:none','border:0','border-image:none','font-size:48px');
  assertRule(G+' #combat-feedback #combat-entry::before',"url('/art/battle-signals-b293/phase.webp')",'width:76px','height:76px','opacity:.45','z-index:-1');
});

test('hit CSS is compact and avoids the notice and boss strip',()=>{
  assertRule(G+' #combat-feedback #combat-hit','top:164px','left:10px','max-width:285px','background:none','font-size:14px');
  assertRule(G+' #combat-feedback #combat-hit .combat-hit-life','font-size:14px');
  assertRule(G+' #combat-feedback #combat-hit .combat-hit-source','font-size:13px');
  assertRule(G+STRIP+' #combat-feedback #combat-hit','top:240px');
  assertRule(G+' #combat-feedback[data-boss="true"] #combat-hit','top:240px');
  assertRule(G+NOTICE_ON+' #combat-feedback #combat-hit','top:228px');
  assertRule(G+NOTICE_ON+STRIP+' #combat-feedback #combat-hit','top:282px');
  assertRule(G+NOTICE_ON+' #combat-feedback[data-boss="true"] #combat-hit','top:282px');
});

test('CSS adds no motion or blur, so visibility stays with the view owners',()=>{
  assert.doesNotMatch(css,/@keyframes|animation:(?!none)|transition:(?!none)/);
  for(const [selector,body] of rules){
    for(const shadow of body.matchAll(/(?:^|[;\s-])(?:signal-outline(?:-large)?):([^;]+)/g))
      for(const part of shadow[1].split(','))assert.match(part.trim(),/ 0 #101c22$/,selector+' outline must stay crisp');
  }
});
