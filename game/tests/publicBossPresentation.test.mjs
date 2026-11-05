import test from 'node:test';import assert from 'node:assert/strict';
import {createDocument} from './helpers/publicShellHarness.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {PublicStage1FinaleController} from '../src/systems/PublicStage1FinaleController.mjs';
import {syncPublicBossPresentation,PUBLIC_BOSS_LABELS} from '../src/systems/PublicBossPresentation.mjs';

// B70: one existing finale boss shown as a chapter-labelled strip. Real finale controller states and the real
// BattleScene._syncPublicStage1FinaleHud slice; only the DOM, Phaser events and Web Animations are doubles.
function dom({reduced=false}={}){
  const doc=createDocument(),animations=[],make=doc.createElement;
  doc.defaultView={matchMedia:query=>({matches:reduced&&query==='(prefers-reduced-motion: reduce)'})};
  doc.createElement=tag=>{
    const element=make(tag);
    element.animate=(keyframes,options)=>{
      const animation={element,keyframes,options,cancelled:false,cancel(){this.cancelled=true;this.oncancel?.();}};
      animations.push(animation);return animation;
    };
    return element;
  };
  const wave=make('div');wave.id='wave-text';const clock=make('div');clock.id='round-clock';
  doc.getElementById('hud').append(wave,clock);
  return {doc,animations,hud:doc.getElementById('hud')};
}
function events(){
  const handlers=new Map();
  return {handlers,once(type,fn){handlers.set(type,[...(handlers.get(type)||[]),fn]);},
    off(type,fn){handlers.set(type,(handlers.get(type)||[]).filter(item=>item!==fn));},
    emit(type){for(const fn of handlers.get(type)||[])fn();}};
}
function scene(chapterId='opening',data={}){
  const battleData={stageId:1,practiceMode:false,defenseMode:false,campaignChapterId:chapterId,...data};
  const finale=new PublicStage1FinaleController(battleData);
  return {battleData,_userCastPresentation:true,_battleEnded:false,_battlePaused:false,events:events(),publicStage1Finale:finale,
    _publicStage1FinaleBoss:{active:true,hp:60,maxHp:60,publicStage1CuePulse:null},player:{hp:4},
    _isPublicStage1Round:()=>true,_isFinaleTrialRound:()=>false};
}
const strip=doc=>doc.querySelector('.public-boss-strip');
const text=(doc,name)=>strip(doc)?.querySelector('.public-boss-'+name)?.textContent;
const meter=doc=>strip(doc)?.querySelector('[role=progressbar]');
// Observe the paint round first, then open the finale: the natural entrance path.
function opened(s,doc){
  syncPublicBossPresentation(s,s.publicStage1Finale.snapshot(0),{doc});
  assert.ok(s.publicStage1Finale.begin({now:0}));
  return syncPublicBossPresentation(s,s.publicStage1Finale.snapshot(10),{doc});
}

test('four chapters label the same finale boss as an enemy with original chapter names',()=>{
  assert.deepEqual({...PUBLIC_BOSS_LABELS},{opening:'舞台指挥者',neon:'声浪领奏者',encore:'港湾终演者',raincheck:'雨幕播送者'});
  for(const [id,label,chapter] of [['opening','舞台指挥者','星光初演'],['neon','声浪领奏者','霓虹街口'],['encore','港湾终演者','终场合奏'],['raincheck','雨幕播送者','雨后返场']]){
    const {doc,hud}=dom(),s=scene(id);opened(s,doc);
    assert.equal(strip(doc).parentNode,hud);
    assert.equal(text(doc,'tag'),'BOSS');assert.equal(text(doc,'name'),label);
    assert.equal(strip(doc).getAttribute('aria-label'),chapter+' BOSS '+label);
    assert.equal(strip(doc).dataset.chapter,id);
    assert.equal(strip(doc).querySelectorAll('button').length,0);
    assert.equal(strip(doc).querySelectorAll('img').length+strip(doc).querySelectorAll('svg').length,0);
  }
});

test('status and progress follow actual finale phases and weak-point counts, recovery uses real boss paint',()=>{
  const {doc}=dom(),s=scene('neon'),f=s.publicStage1Finale,sync=now=>syncPublicBossPresentation(s,f.snapshot(now),{doc});
  opened(s,doc);
  assert.equal(f.snapshot(10).attackPattern,'momentum-cutoff');
  assert.equal(strip(doc).dataset.phase,'attack');assert.equal(text(doc,'status'),'横向预判','real windup pattern');
  const bar=meter(doc);
  assert.deepEqual(['aria-valuemin','aria-valuemax','aria-valuenow','aria-valuetext'].map(k=>bar.getAttribute(k)),['0','3','0','已破 0/3']);
  assert.equal(text(doc,'count'),'破绽 0/3');assert.equal(strip(doc).querySelector('.public-boss-fill').style.width,'0%');
  s._publicStage1FinaleBoss.publicStage1CuePulse={active:true};sync(20);
  assert.equal(text(doc,'status'),'避开攻势');
  f.recordAttackResolved(30);s._publicStage1FinaleBoss.publicStage1CuePulse=null;sync(30);
  assert.equal(strip(doc).dataset.phase,'weak-point');
  assert.equal(text(doc,'status'),'收势 · 等待破绽','no opening is claimed before the weak point is live');
  s._publicStage1FinaleWeakPoint={active:true,publicStage1EnemyRole:'finale-weak-point',hp:3,maxHp:3};sync(35);
  assert.equal(text(doc,'status'),'破绽开放');
  s._publicStage1FinaleWeakPoint=null;
  f.recordWeakPointResolved(40);sync(40);
  assert.equal(bar.getAttribute('aria-valuenow'),'1');assert.equal(text(doc,'count'),'破绽 1/3');
  assert.equal(strip(doc).querySelector('.public-boss-fill').style.width,'33%');
  for(const now of [50,60]){f.recordAttackResolved(now);f.recordWeakPointResolved(now);}
  sync(70);
  assert.equal(strip(doc).dataset.phase,'boss-recovery');assert.equal(text(doc,'status'),'集中涂染 · 已染 0%');
  assert.equal(bar.getAttribute('aria-valuetext'),'已破 3/3');
  s._publicStage1FinaleBoss.hp=36;sync(80);
  assert.equal(text(doc,'status'),'集中涂染 · 已染 40%');
  s._publicStage1FinaleBoss.maxHp=0;sync(90);
  assert.equal(text(doc,'status'),'集中涂染','no ratio is invented without a real paint pool');
});

test('entrance plays once per actual phase change, unchanged frames never replay and replacement cancels',()=>{
  const {doc,animations}=dom(),s=scene(),f=s.publicStage1Finale,sync=now=>syncPublicBossPresentation(s,f.snapshot(now),{doc});
  opened(s,doc);
  assert.equal(animations.length,1);
  assert.deepEqual(animations[0].keyframes.map(k=>Object.keys(k)),[['opacity'],['opacity']]);
  assert.ok(animations[0].options.duration<=240);
  for(const now of [20,30,40])sync(now);
  s._publicStage1FinaleBoss.publicStage1CuePulse={active:true};sync(50);
  assert.equal(animations.length,1,'same phase and status-only change do not replay');
  f.recordAttackResolved(60);sync(60);
  assert.equal(animations.length,2);assert.equal(animations[0].cancelled,true);
  sync(70);assert.equal(animations.length,2);
});

test('pause and dialogs cancel and rebase motion, reduced motion never animates',()=>{
  const {doc,animations}=dom(),s=scene(),f=s.publicStage1Finale,sync=now=>syncPublicBossPresentation(s,f.snapshot(now),{doc});
  opened(s,doc);
  s._battlePaused=true;sync(20);assert.equal(animations[0].cancelled,true);
  f.recordAttackResolved(30);sync(30);
  s._battlePaused=false;sync(40);
  assert.equal(animations.length,1,'phase seen while paused is the new baseline');
  assert.equal(strip(doc).dataset.phase,'weak-point');
  s._publicBattleDialog={root:{}};f.recordWeakPointResolved(50);sync(50);s._publicBattleDialog=null;sync(60);
  assert.equal(animations.length,1);
  const reduced=dom({reduced:true}),r=scene();opened(r,reduced.doc);
  r.publicStage1Finale.recordAttackResolved(20);syncPublicBossPresentation(r,r.publicStage1Finale.snapshot(20),{doc:reduced.doc});
  assert.equal(reduced.animations.length,0);assert.equal(text(reduced.doc,'status'),'收势 · 等待破绽');
  r._publicStage1FinaleWeakPoint={active:true,publicStage1EnemyRole:'finale-weak-point',hp:3,maxHp:3};
  syncPublicBossPresentation(r,r.publicStage1Finale.snapshot(25),{doc:reduced.doc});
  assert.equal(reduced.animations.length,0);assert.equal(text(reduced.doc,'status'),'破绽开放');
});

test('pending or applying restored checkpoints baseline the saved finale without entrance',()=>{
  for(const flag of ['_publicBattleResume','_restoringPublicBattleCheckpoint']){
    const {doc,animations}=dom(),s=scene('encore'),f=s.publicStage1Finale;
    s[flag]=flag==='_publicBattleResume'?{version:1}:true;
    syncPublicBossPresentation(s,f.snapshot(0),{doc});
    f.begin({now:0});f.recordAttackResolved(5);
    syncPublicBossPresentation(s,f.snapshot(10),{doc});
    s[flag]=null;syncPublicBossPresentation(s,f.snapshot(20),{doc});
    assert.equal(animations.length,0,flag);assert.equal(strip(doc).dataset.phase,'weak-point');
  }
  const {doc,animations}=dom(),s=scene(),f=s.publicStage1Finale;
  f.begin({now:0});syncPublicBossPresentation(s,f.snapshot(10),{doc});
  assert.equal(animations.length,0,'first observation already in finale is a restored baseline');
  assert.equal(strip(doc).dataset.phase,'attack');
});

test('failed, completed, ended or inactive finales remove the strip',()=>{
  const {doc,animations}=dom(),s=scene(),f=s.publicStage1Finale;
  opened(s,doc);
  syncPublicBossPresentation(s,f.advance(40000),{doc});
  assert.equal(f.snapshot(40000).failed,true);assert.equal(strip(doc),null);assert.equal(animations[0].cancelled,true);
  const done=dom(),c=scene();opened(c,done.doc);
  for(const now of [1,2,3]){c.publicStage1Finale.recordAttackResolved(now);c.publicStage1Finale.recordWeakPointResolved(now);}
  c.publicStage1Finale.recordBossDefeated(4);syncPublicBossPresentation(c,c.publicStage1Finale.snapshot(4),{doc:done.doc});
  assert.equal(strip(done.doc),null);
  const ended=dom(),e=scene();opened(e,ended.doc);e._battleEnded=true;
  syncPublicBossPresentation(e,e.publicStage1Finale.snapshot(20),{doc:ended.doc});assert.equal(strip(ended.doc),null);
});

test('hidden, legacy, practice, defense and finale-trial routes are not affected',()=>{
  const cases=[[{stageId:2}],[{practiceMode:true}],[{defenseMode:true}],[{},s=>{s._userCastPresentation=false;}],
    [{},s=>{s._isFinaleTrialRound=()=>true;}]];
  for(const [data,mutate] of cases){
    const {doc}=dom(),s=scene('opening',data);mutate?.(s);
    const state={active:true,phase:'attack',weakPointsResolved:0,weakPointCount:3};
    assert.equal(syncPublicBossPresentation(s,state,{doc}),null);
    assert.equal(strip(doc),null);assert.equal(s._publicBossPresentation,undefined);assert.equal(s.events.handlers.size,0);
  }
  const {doc}=dom(),s=scene();opened(s,doc);s._isFinaleTrialRound=()=>true;
  syncPublicBossPresentation(s,s.publicStage1Finale.snapshot(20),{doc});
  assert.equal(strip(doc),null,'an existing owner is released when the route stops qualifying');
});

test('missing document or hud is a no-op',()=>{
  const s=scene();s.publicStage1Finale.begin({now:0});const state=s.publicStage1Finale.snapshot(1);
  assert.equal(syncPublicBossPresentation(s,state,{doc:undefined}),null);
  const {doc,hud}=dom();hud.remove();
  assert.equal(syncPublicBossPresentation(s,state,{doc}),null);
  assert.equal(s._publicBossPresentation,undefined);
});

for(const type of ['shutdown','destroy']){
  test(type+' removes owned DOM, scene listeners and animations',()=>{
    const {doc,animations}=dom(),s=scene();opened(s,doc);
    s.events.emit(type);
    assert.equal(strip(doc),null);assert.equal(animations[0].cancelled,true);
    assert.equal(s._publicBossPresentation,undefined);
    assert.deepEqual([...s.events.handlers.values()].flat(),[]);
    s.events.emit(type==='shutdown'?'destroy':'shutdown');
  });
}

test('real BattleScene finale HUD sync drives the strip before its inactive return and mutates no combat state',()=>{
  const doc=dom().doc,Phaser={Scene:class{},Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}};
  const BattleScene=loadBattleScene({Phaser,document:doc});
  const s=Object.assign(Object.create(BattleScene.prototype),scene('neon'),{time:{now:0}});
  const inactive=s.publicStage1Finale.snapshot(0);
  assert.equal(s._syncPublicStage1FinaleHud(inactive),false);
  assert.equal(strip(doc),null);assert.ok(s._publicBossPresentation,'inactive frames are observed as the pre-finale baseline');
  s.publicStage1Finale.begin({now:0});
  const before=JSON.stringify({finale:s.publicStage1Finale,boss:s._publicStage1FinaleBoss,player:s.player,time:s.time});
  assert.equal(s._syncPublicStage1FinaleHud(s.publicStage1Finale.snapshot(100)),true);
  assert.equal(JSON.stringify({finale:s.publicStage1Finale,boss:s._publicStage1FinaleBoss,player:s.player,time:s.time}),before);
  assert.equal(text(doc,'name'),'声浪领奏者');
  assert.equal(doc.getElementById('wave-text').textContent,'压轴返场 · 读招 1/3','existing finale objective copy is unchanged');
  s.publicStage1Finale.reset();assert.equal(s._syncPublicStage1FinaleHud(),false);assert.equal(strip(doc),null);
});

test('style rules are appended strictly under the public-boss namespace within the HUD band',async()=>{
  const {readFileSync}=await import('node:fs');
  const css=readFileSync(new URL('../src/styles/battleSurface.css',import.meta.url),'utf8');
  const start=css.indexOf('/* B70 public boss strip');
  assert.ok(start>0,'boss rules are appended after the existing surface rules');
  const block=css.slice(start);
  const selectors=[...block.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{/g)].map(m=>m[1].trim()).filter(s=>!s.startsWith('@'));
  assert.ok(selectors.length>=4);
  for(const selector of selectors)for(const part of selector.split(','))assert.match(part.trim(),/^\.public-boss-[\w-]+/,part);
  const rule=block.match(/\.public-boss-strip\s*\{([^}]*)\}/)[1];
  assert.ok(Number(rule.match(/(?:^|;)\s*top:\s*(\d+)px/)[1])>=104,'below the 104px player HUD band');
  assert.equal(Number(rule.match(/(?:^|;)\s*height:\s*(\d+)px/)[1]),70,'three truthful status rows and meter fit the explicit 70px band');
  assert.match(rule,/pointer-events:\s*none/);assert.match(block,/prefers-reduced-motion/);
});
