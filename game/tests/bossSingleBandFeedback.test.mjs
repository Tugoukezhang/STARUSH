import test from 'node:test';import assert from 'node:assert/strict';
import {createDocument} from './helpers/publicShellHarness.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {PublicStage1FinaleController} from '../src/systems/PublicStage1FinaleController.mjs';
import {syncPublicBossPresentation,PUBLIC_BOSS_LABELS} from '../src/systems/PublicBossPresentation.mjs';
import {PublicCombatFeedbackView} from '../src/systems/PublicCombatFeedbackView.mjs';

// B87: a fresh real 2400ms boss announcement reads inside the one mounted boss strip instead of a second box.
// Real feedback view, strip, finale controller and BattleScene entry; only DOM, Phaser events and Web Animations are doubles.
function dom({reduced=false}={}){
  const doc=createDocument(),animations=[],make=doc.createElement;
  doc.defaultView={matchMedia:query=>({matches:reduced&&query==='(prefers-reduced-motion: reduce)'})};
  doc.createElement=tag=>{
    const element=make(tag);
    element.animate=(keyframes,options)=>{
      const animation={keyframes,options,cancelled:false,cancel(){this.cancelled=true;this.oncancel?.();}};
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
function scene(chapterId='opening'){
  const battleData={stageId:1,practiceMode:false,defenseMode:false,campaignChapterId:chapterId};
  return {battleData,_userCastPresentation:true,_battleEnded:false,_battlePaused:false,events:events(),time:{now:0},
    publicStage1Finale:new PublicStage1FinaleController(battleData),
    _publicStage1FinaleBoss:{active:true,hp:60,maxHp:60,publicStage1CuePulse:null},player:{hp:4},
    _isPublicStage1Round:()=>true,_isFinaleTrialRound:()=>false};
}
const node=(doc,name)=>doc.querySelector('.public-boss-'+name);
function band(doc){
  const strip=node(doc,'strip'),meter=node(doc,'meter');
  return {tag:node(doc,'tag').textContent,status:node(doc,'status').textContent,instruction:node(doc,'instruction').textContent,
    count:node(doc,'count').textContent,width:node(doc,'fill').style.width,entrance:strip.dataset.entrance,
    meter:['aria-valuemax','aria-valuenow','aria-valuetext'].map(key=>meter.getAttribute(key)),
    shape:strip.querySelectorAll('span').length+'/'+strip.children.length};
}
// The natural path: observe the paint round, open the finale, then the existing view announces the real label.
function arrived({chapter='opening',reduced=false,at=100}={}){
  const {doc,animations,hud}=dom({reduced}),s=scene(chapter);
  const sync=now=>{s.time.now=now;return syncPublicBossPresentation(s,s.publicStage1Finale.snapshot(now),{doc});};
  sync(0);assert.ok(s.publicStage1Finale.begin({now:0}));
  const view=s._combatFeedback=new PublicCombatFeedbackView(s,doc);
  assert.equal(view.boss(PUBLIC_BOSS_LABELS[chapter],at),true);
  return {doc,animations,hud,s,view,sync,frame(now,options){const owner=sync(now);view.update(now,options);return owner;}};
}
// The exact band the strip shows for the same finale state with no announcement anywhere.
function baseline(chapter,now,mutate=()=>{}){
  const {doc}=dom(),s=scene(chapter);
  syncPublicBossPresentation(s,s.publicStage1Finale.snapshot(0),{doc});s.publicStage1Finale.begin({now:0});mutate(s);
  s.time.now=now;syncPublicBossPresentation(s,s.publicStage1Finale.snapshot(now),{doc});
  return band(doc);
}
const without=(value,...keys)=>Object.fromEntries(Object.entries(value).filter(([key])=>!keys.includes(key)));

test('fractional real run-clock starts compose on the first call without subtraction rounding gaps',()=>{
  for(const at of [6712.2,6810.7,100.1,.1]){
    const f=arrived({at});f.sync(at-.01);assert.equal(band(f.doc).entrance,'false','a genuinely future window stays future');
    f.sync(at);assert.equal(band(f.doc).entrance,'true','actual fractional start '+at);assert.equal(f.view.bossNode.hidden,true,'no first-frame fallback '+at);
    f.sync(at+2400);assert.equal(band(f.doc).entrance,'false','same original expiry');
  }
});

test('a fresh real arrival is one band: BOSS 登场, true status plus cause, unchanged instruction and progress',()=>{
  for(const chapter of ['opening','neon','encore']){
    const {doc,hud,view,frame}=arrived({chapter}),plain=baseline(chapter,100);
    frame(100);
    const shown=band(doc);
    assert.equal(doc.querySelectorAll('.public-boss-strip').length,1);assert.equal(node(doc,'strip').parentNode,hud);
    assert.equal(shown.tag,'BOSS 登场');assert.equal(shown.status,plain.status+' · 设施已点亮');
    assert.equal(shown.entrance,'true');assert.equal(plain.entrance,'false');assert.equal(plain.tag,'BOSS');
    assert.deepEqual(without(shown,'tag','status','entrance'),without(plain,'tag','status','entrance'),
      'instruction, meter, count and DOM shape are the real ones, no extra row');
    assert.equal(view.bossNode.hidden,true,'the mounted strip carries the announcement, the separate box stays hidden');
    assert.equal(view.bossName.textContent,PUBLIC_BOSS_LABELS[chapter]);
    assert.equal(view.root.dataset.boss,'true');assert.equal(view.bossUntil,2500,'the view clock is never extended');
  }
});

test('repeated frames keep the composed band, real phase changes stay truthful, the 2400ms end restores exactly',()=>{
  const {doc,animations,view,frame,s}=arrived(),plain=baseline('opening',100);
  for(const now of [100,100,1200]){frame(now);assert.equal(band(doc).tag,'BOSS 登场');assert.equal(band(doc).status,plain.status+' · 设施已点亮');}
  assert.equal(animations.length,1,'only the existing phase fade, never replayed by the arrival');
  s.publicStage1Finale.recordAttackResolved(1500);frame(1500);
  assert.equal(band(doc).status,'收势 · 等待破绽 · 设施已点亮');assert.equal(band(doc).instruction,'等待弱点 · 自由移动');
  assert.equal(node(doc,'strip').dataset.phase,'weak-point');
  frame(2499);assert.equal(band(doc).entrance,'true');assert.equal(view.bossNode.hidden,true);
  frame(2500);
  assert.deepEqual(band(doc),baseline('opening',2500,b=>b.publicStage1Finale.recordAttackResolved(1500)));
  assert.equal(band(doc).tag,'BOSS');assert.equal(band(doc).status,'收势 · 等待破绽');
  assert.equal(view.bossNode.hidden,true,'original expiry');assert.equal(view.bossUntil,2500);
  frame(9000);assert.equal(band(doc).entrance,'false');
});

test('future, invalid, wrong-name, disposed or missing announcements never decorate the band',()=>{
  const cases={
    future:({view})=>{view.bossUntil=5000;},
    nan:({view})=>{view.bossUntil=Number.NaN;},
    infinite:({view})=>{view.bossUntil=Infinity;},
    missing:({view})=>{delete view.bossUntil;},
    'wrong-name':({view})=>{view.bossName.textContent='声浪领奏者';},
    disposed:({view})=>{view.destroy();},
    'no-view':({s})=>{s._combatFeedback=null;},
  };
  for(const [name,mutate] of Object.entries(cases)){
    const fixture=arrived();fixture.sync(100);assert.equal(band(fixture.doc).tag,'BOSS 登场',name);
    mutate(fixture);fixture.sync(100);
    assert.deepEqual(band(fixture.doc),baseline('opening',100),name);
    if(name==='wrong-name'){fixture.view.update(100);assert.equal(fixture.view.bossNode.hidden,false,'unclaimed announcement keeps its own box');}
  }
});

test('the separate box returns whenever the strip is not the mounted same-scene owner carrying the arrival',()=>{
  let f=arrived();f.frame(100);assert.equal(f.view.bossNode.hidden,true);
  f.s.publicStage1Finale.reset();f.frame(200);
  assert.equal(node(f.doc,'strip'),null);assert.equal(f.view.bossNode.hidden,false,'strip unmounted');
  f.frame(2500);assert.equal(f.view.bossNode.hidden,true,'fallback keeps the original 2400ms expiry');
  f=arrived();f.frame(100);const owner=f.s._publicBossPresentation;owner.cleanup();owner.cleanup();
  f.view.update(200);assert.equal(f.view.bossNode.hidden,false,'strip disposed');
  f=arrived();f.frame(100);node(f.doc,'strip').remove();f.view.update(200);assert.equal(f.view.bossNode.hidden,false,'strip detached');
  f=arrived();f.frame(100);f.doc.getElementById('game-container').append(node(f.doc,'strip'));f.view.update(200);
  assert.equal(f.view.bossNode.hidden,false,'strip mounted outside its hud');
  f=arrived();f.frame(100);f.s._publicBossPresentation.hud=undefined;f.view.update(200);
  assert.equal(f.view.bossNode.hidden,false,'owner without a hud');
  f=arrived();f.frame(100);const other=arrived();other.frame(100);f.s._publicBossPresentation=other.s._publicBossPresentation;
  f.view.update(200);assert.equal(f.view.bossNode.hidden,false,'another scene owner');
  const standalone=new PublicCombatFeedbackView({events:events()},dom().doc);standalone.boss('舞台指挥者',0);standalone.update(100);
  assert.equal(standalone.bossNode.hidden,false,'no strip owner at all');standalone.destroy();
});

test('pause and dialogs freeze it, reduced motion keeps text, restored checkpoints never replay, cleanup is idempotent',()=>{
  const f=arrived();f.frame(100);
  const state=()=>JSON.stringify({finale:f.s.publicStage1Finale,boss:f.s._publicStage1FinaleBoss,player:f.s.player,
    view:[f.view.bossUntil,f.view.entryUntil,f.view.hitUntil]});
  const before=state();
  f.s._battlePaused=true;f.frame(1000,{blocked:true});
  assert.equal(f.view.bossNode.hidden,true);assert.equal(band(f.doc).tag,'BOSS');assert.equal(band(f.doc).entrance,'false');
  f.s._battlePaused=false;f.frame(1000);assert.equal(band(f.doc).tag,'BOSS 登场','the same paused clock window resumes');
  f.s._publicBattleDialog={root:{}};f.sync(1100);assert.equal(band(f.doc).entrance,'false');f.s._publicBattleDialog=null;
  assert.equal(state(),before,'combat, finale and view clocks are untouched');
  for(const flag of ['_publicBattleResume','_restoringPublicBattleCheckpoint']){
    const r=arrived();r.s[flag]=flag==='_publicBattleResume'?{version:1}:true;r.sync(100);
    assert.deepEqual(band(r.doc),baseline('opening',100),flag);
  }
  const reduced=arrived({reduced:true});reduced.frame(100);
  assert.equal(band(reduced.doc).tag,'BOSS 登场');assert.equal(reduced.view.bossNode.hidden,true);assert.equal(reduced.animations.length,0);
  f.s.events.emit('shutdown');
  assert.equal(node(f.doc,'strip'),null);assert.equal(f.doc.getElementById('combat-feedback'),null);
  f.view.destroy();f.view.update(200);assert.equal(f.s._publicBossPresentation,undefined);
});

test('the real BattleScene finale entry mounts one band with the arrival and no duplicate box; resume never replays',()=>{
  for(const resume of [false,true]){
    const {doc,hud}=dom(),Phaser={Scene:class{},Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}};
    const BattleScene=loadBattleScene({Phaser,document:doc});
    let clock=100;const calls=[];
    const s=Object.assign(Object.create(BattleScene.prototype),scene('encore'),{_publicStage1FinaleBoss:null,
      publicPerformerRun:{pendingCheckpoint:()=>false,choiceOpen:false,now:()=>clock,recordEncounterEvent(){}},
      paintZone:{isComplete:()=>true,enterFinaleMode(){}},publicStage1Encounter:{canEnterFinale:()=>true,reset(){}},
      oldStreet:{atTheater:()=>true},enemyBullets:{getChildren:()=>[]},_showRoundBanner:t=>calls.push(t),
      _spawnPublicStage1FinaleBoss(){this._publicStage1FinaleBoss={active:true,hp:60,maxHp:60,publicStage1CuePulse:null};},
      _startPublicStage1FinaleAttack:()=>calls.push('first-danger'),_clearUnlitBlobs(){},_clearPublicStage1SpotlightCaptain(){},
      _clearPublicStage1ObjectiveDisruptor(){},_clearPublicStage1StageCueEmitter(){},_clearPublicStage1ObjectiveRouteCue(){},
      ...(resume?{_publicBattleResume:{version:1}}:{})});
    s._syncPublicStage1FinaleHud();
    assert.equal(s._beginPublicStage1Finale(),true);assert.ok(calls.includes('first-danger'));
    assert.equal(doc.querySelectorAll('.public-boss-strip').length,1);assert.equal(node(doc,'strip').parentNode,hud);
    assert.equal(doc.getElementById('wave-text').textContent,'压轴返场 · 读招 1/3');
    if(resume){
      assert.equal(s._combatFeedback,undefined);assert.equal(band(doc).tag,'BOSS');assert.equal(band(doc).entrance,'false');
      continue;
    }
    const view=s._combatFeedback;assert.equal(view.bossUntil,2500);
    assert.equal(view.bossNode.hidden,true,'the real entry call hides the separate box before any browser paint or next-frame view update');
    view.update(clock);
    const arrival=band(doc);
    assert.equal(arrival.tag,'BOSS 登场');assert.ok(arrival.status.endsWith(' · 设施已点亮'));assert.equal(arrival.instruction,'防护中 · 先闪避');
    assert.equal(arrival.count,'破绽 0/3');assert.equal(view.bossNode.hidden,true);
    clock=2500;s._updatePublicStage1Finale();view.update(clock);
    assert.equal(band(doc).tag,'BOSS');assert.equal(band(doc).entrance,'false');
    assert.equal(band(doc).status+' · 设施已点亮',arrival.status,'the arrival only appended its cause to the real status');
    s.events.emit('shutdown');assert.equal(node(doc,'strip'),null);assert.equal(doc.getElementById('combat-feedback'),null);
  }
});
