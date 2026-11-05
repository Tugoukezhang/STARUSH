import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';
import {EventEmitter} from 'node:events';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';

const css=fs.readFileSync(new URL('../src/styles/ordinaryResultFamily.css',import.meta.url),'utf8');
const art=file=>new URL('../public/'+file,import.meta.url);
const PORTRAITS={sakura:'art/home-portrait-demo-20261022/sakura-body.webp',
  kai:'portraits/kai-287/source.png',enjo:'portraits/enjo-286/source.png'};

test('chapter completion title is explicitly admitted to the built runtime payload',()=>{
  const file='art/result-stage-20261031/complete.webp';
  assert.equal(RUNTIME_PAYLOAD.filter(row=>row.file===file).length,1);
  assert(fs.existsSync(art(file)));
});

function fixture(id='sakura',{victory=true,persisted=true,recorded=true,continuation,flags={},buttons}={}) {
  const env=loadScenes();env.loadRuntime('utils/userCast.mjs').configureUserCast(!flags.legacy);
  const api=env.loadRuntime('systems/BattleSurfaceView.mjs');
  const {getChapterStory}=env.loadRuntime('utils/publicStory.mjs');
  const {CHAPTER_VENUE_ART}=env.loadRuntime('systems/ChapterVenueArt.mjs');
  const scene={events:new EventEmitter(),input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},
    player:{body:{setVelocity(){}}},sound:null,_userCastPresentation:!flags.legacy,
    battleData:{stageId:1,performerId:id,campaignChapterId:'opening',...flags},publicPerformerRun:{runId:'stage-run'}};
  if(flags.trial)scene._isFinaleTrialRound=()=>true;
  const model=api.getPublicResultSurfaceModel({descriptionLines:['下一站：霓虹街口'],
    buttons:buttons||[...(victory?[{label:'下一站准备',action:'campaign-next'}]:[]),{label:victory?'再演本站':'重试本站',action:'retry'},{label:'返回巡演',action:'campaign-tour'}]},
    {performerId:id,chapterId:'opening',victory,durationMs:65000,actions:4,choices:['wide_brush'],recorded,persisted,
      reward:{notes:6,equipmentIds:['wide_nozzle']}});
  if(continuation!==undefined)model.continuation=continuation;
  const actions=[];
  const view=new api.BattleSurfaceView(scene,{mode:'result',model,onAction:x=>{actions.push(x);return false;}},env.document);
  return {env,api,scene,model,view,actions,getChapterStory,CHAPTER_VENUE_ART};
}
const stageOf=view=>view.root.querySelector('.battle-performance-header');

test('ordinary result hero uses the owned full portrait, never the Q body, for all three roles',()=>{
  for(const id of ['sakura','kai','enjo'])for(const victory of [true,false]){
    const {view}=fixture(id,{victory}),stage=stageOf(view);
    assert.equal(view.root.dataset.resultStage,'chapter');
    const portrait=stage.querySelector('.result-hero-portrait');assert(portrait,id);
    assert.equal(portrait.src,PORTRAITS[id]);assert(fs.existsSync(art(portrait.src)),portrait.src);
    assert.equal(portrait.alt,'');assert.equal(portrait.hidden,true,'portrait waits for its own decode, no placeholder flash');
    assert.equal(stage.dataset.portraitState,'loading');
    for(const img of stage.querySelectorAll('img'))assert(!img.src.includes('five-q-ui'),img.src);
    assert.equal(stage.querySelector('.battle-visual-copy').querySelector('strong').textContent,view.options.model.member.name);
    view.destroy();
  }
});

test('portrait framing gives the three roles the same rendered head size and face anchor',()=>{
  const heads=[];
  for(const id of ['sakura','kai','enjo']){
    const {view}=fixture(id),p=stageOf(view).querySelector('.result-hero-portrait');
    const ratio=Number(p.style['--portrait-head']),x=Number(p.style['--portrait-face-x']),y=Number(p.style['--portrait-face-y']);
    for(const v of [ratio,x,y])assert(v>0&&v<1,id+' framing '+v);
    heads.push(ratio);assert.equal(p.width>0&&p.height>0,true);view.destroy();
    if(id==='kai'){assert(Math.abs(x-580/1024)<1e-12);assert(Math.abs(y-258/1536)<1e-12);}
    if(id==='enjo'){assert(Math.abs(x-573.5/1024)<1e-12);assert(Math.abs(y-242.5/1536)<1e-12);}
  }
  const css2=css.split('.result-hero-portrait {')[1]?.split('}')[0]||'';
  assert(css2.includes('width:calc(var(--result-head) / var(--portrait-head))'),'width derives from shared head size');
  assert(css2.includes('object-fit:contain'));
});

test('portrait load gate: ready reveals the image, failure removes it without alternate art',()=>{
  const first=fixture('sakura'),sp=stageOf(first.view).querySelector('.result-hero-portrait');
  assert.equal(sp.width,800);assert.equal(sp.height,1259);
  sp.naturalWidth=800;sp.naturalHeight=1259;sp.dispatchEvent({type:'load'});
  assert.equal(stageOf(first.view).dataset.portraitState,'ready');first.view.destroy();
  const {view}=fixture('kai'),stage=stageOf(view),p=stage.querySelector('.result-hero-portrait');
  p.naturalWidth=1024;p.naturalHeight=1536;p.dispatchEvent({type:'load'});
  assert.equal(p.hidden,false);assert.equal(stage.dataset.portraitState,'ready');view.destroy();
  const second=fixture('enjo'),s2=stageOf(second.view),q=s2.querySelector('.result-hero-portrait');
  q.dispatchEvent({type:'error'});assert.equal(s2.querySelector('.result-hero-portrait'),null);
  assert.equal(s2.dataset.portraitState,'unavailable');assert.equal(s2.querySelectorAll('img').filter(i=>i.src.includes('five-q-ui')).length,0);
  second.view.destroy();
  const third=fixture('kai'),s3=stageOf(third.view),r=s3.querySelector('.result-hero-portrait');
  r.naturalWidth=20;r.naturalHeight=20;r.dispatchEvent({type:'load'});assert.equal(s3.dataset.portraitState,'unavailable');third.view.destroy();
});

test('own chapter venue sits behind the portrait; no reference pixels are referenced',()=>{
  const {view,CHAPTER_VENUE_ART}=fixture('sakura'),venue=stageOf(view).querySelector('.result-hero-venue');
  assert.equal(venue.src,CHAPTER_VENUE_ART.opening);assert.equal(venue.getAttribute('aria-hidden'),'true');
  assert(!/reference|azur|uma/i.test(css));view.destroy();
});

test('first view order: hero, save, compact stats, reward receipt, next station, story, then real details',()=>{
  const {view}=fixture('kai',{continuation:{chapterId:'neon',name:'霓虹街口',available:true,persisted:true}});
  const kids=view.content.children,at=s=>kids.indexOf(view.root.querySelector(s));
  const order=['.battle-performance-header','.battle-result-stats','.battle-result-reward','.battle-result-continuation-state','.battle-result-story-section','.battle-result-details'].map(at);
  for(const i of order)assert(i>=0);assert.deepEqual([...order].sort((a,b)=>a-b),order);
  assert.equal(at('.battle-result-stats')+1,kids.indexOf(view.resultStatus),'saved status follows stats');
  assert.equal(view.root.querySelector('.battle-result-reward').dataset.ownerUiBand,'ledger');
  assert(view.root.querySelector('.battle-result-reward').textContent.includes('练习笔记 +6'));
  view.destroy();
});

test('next station identity shows only the supplied continuation, with honest state',()=>{
  const cases=[[{chapterId:'neon',name:'霓虹街口',available:true,persisted:true},'ready'],
    [{chapterId:'neon',name:'霓虹街口',available:true,persisted:false},'pending'],
    [{chapterId:'neon',name:'霓虹街口',available:false,persisted:false},'pending'],
    [{chapterId:'neon',name:'霓虹街口',available:false,persisted:true},'blocked']];
  for(const [continuation,state] of cases){
    const {view}=fixture('sakura',{continuation,persisted:continuation.persisted}),next=view.root.querySelector('.battle-result-continuation-state');
    assert.equal(next.dataset.continuationState,state);assert.equal(next.dataset.chapter,'neon');assert(view.root.querySelector('[data-result-action=campaign-next]').textContent.includes('霓虹街口'));
    assert.equal(next.querySelectorAll('button').length,0,'identity only; the footer command owns the transition');view.destroy();
  }
  const absent=fixture('sakura');assert.equal(absent.view.root.querySelector('.battle-result-continuation-state'),null,'no invented next station');absent.view.destroy();
  const defeat=fixture('sakura',{victory:false,continuation:{chapterId:'neon',name:'霓虹街口',available:true,persisted:true}});
  assert.equal(defeat.view.root.querySelector('.battle-result-continuation-state'),null);defeat.view.destroy();
});

test('an actual pending continuation keeps next preparation disabled until the existing result-save retry rerenders it',()=>{
  const pending=fixture('sakura',{persisted:false,continuation:{chapterId:'neon',name:'霓虹街口',available:false,persisted:false}});
  assert.equal(pending.view.root.querySelector('[data-result-action=campaign-next]').disabled,true);
  assert(pending.view.root.querySelector('[data-result-action=retry-save-result]'));pending.view.destroy();
});

test('footer keeps the existing command contract and labels, primary first with generated skins',()=>{
  const {view,actions}=fixture('enjo',{continuation:{chapterId:'neon',name:'霓虹街口',available:true,persisted:true}});
  const footer=view.root.querySelector('.battle-surface-footer'),buttons=footer.querySelectorAll('button');
  assert.deepEqual(buttons.map(b=>b.dataset.resultAction),['campaign-next','retry','campaign-tour']);
  assert.equal(buttons[0].textContent,'下一站 · 霓虹街口');assert.equal(buttons[0].className,'battle-primary');
  assert.deepEqual(buttons.map(b=>b.dataset.resultSkin),['primary','secondary','secondary']);
  buttons[0].click();assert.deepEqual(actions,['campaign-next']);view.destroy();
});

test('victory outro is a distinct story section with real lines and a native non-blocking toggle',()=>{
  const {view,getChapterStory,actions}=fixture('kai'),section=view.root.querySelector('.battle-result-story-section');
  const detail=view.root.querySelector('.battle-result-details'),beat=getChapterStory('opening','outro','kai');
  assert.equal(section.parentNode,view.content);assert(!detail.contains(section));
  const toggle=section.querySelector('[data-action=result-story]'),ending=section.querySelector('#battle-result-story');
  assert.equal(ending.hidden,true);assert.equal(toggle.getAttribute('aria-expanded'),'false');assert.equal(toggle.getAttribute('aria-controls'),'battle-result-story');
  for(const line of beat.lines)assert(ending.textContent.includes(line.text),line.text);
  toggle.click();assert.equal(ending.hidden,false);assert.equal(toggle.getAttribute('aria-expanded'),'true');
  toggle.click();assert.equal(ending.hidden,true);assert.deepEqual(actions,[]);assert.equal(view.busy,false);
  assert.equal(view.root.querySelectorAll('#battle-result-story').length,1);view.destroy();
});

test('defeat never shows victory story, next station or victory styling hooks',()=>{
  for(const id of ['sakura','kai','enjo']){
    const {view}=fixture(id,{victory:false});
    for(const s of ['.battle-result-story-section','#battle-result-story','[data-action=result-story]','.battle-result-continuation-state','[data-result-action=campaign-next]'])
      assert.equal(view.root.querySelector(s),null,id+' '+s);
    assert.equal(view.root.dataset.outcome,'defeat');assert.equal(view.root.querySelector('h2').textContent,'星光初演');assert.equal(view.root.querySelector('.battle-eyebrow').textContent,'本场未完成');view.destroy();
  }
});

test('saved, pending and rejected save states stay distinct and retry remains first-view',()=>{
  const saved=fixture('sakura');assert.equal(saved.view.resultStatus.dataset.saveState,'saved');saved.view.destroy();
  const pending=fixture('sakura',{persisted:false}),v=pending.view;
  assert.equal(v.resultStatus.dataset.saveState,'pending');
  const retry=v.root.querySelector('[data-result-action=retry-save-result]');assert.equal(retry.parentNode,v.content);
  retry.click();v.rejectResultSave();assert.equal(v.resultStatus.dataset.saveState,'pending');assert.deepEqual(pending.actions,['retry-save-result']);
  v.rejectNextChapter({retryable:false});assert.equal(v.resultStatus.dataset.saveState,'blocked');v.destroy();
  for(const state of ['saved','pending','blocked','unrecorded'])assert(css.includes(`[data-save-state=${state}]`),state);
  const rule=s=>css.split(s+' {')[1]?.split('}')[0]||'';
  const scope='#game-container #battle-result[data-result-stage=chapter]';
  const looks=['saved','pending','blocked'].map(s=>rule(scope+' .battle-save[data-save-state='+s+']'));
  assert.equal(new Set(looks).size,3,'three different visual states');for(const l of looks)assert(l.length>0);
});

test('rejected next chapter marks the station blocked without removing the command or status owner',()=>{
  const {view}=fixture('kai',{continuation:{chapterId:'neon',name:'霓虹街口',available:true,persisted:true}});
  const status=view.resultStatus;view.rejectNextChapter({retryable:true});
  assert.equal(view.resultStatus,status);assert.equal(view.root.querySelector('.battle-result-continuation-state').dataset.continuationState,'blocked');
  assert.equal(view.root.querySelector('[data-result-action=campaign-next]').disabled,false);view.destroy();
});

test('legacy, practice, defense and trial results keep their previous presentation untouched',()=>{
  for(const flags of [{legacy:true},{practiceMode:true},{defenseMode:true},{trial:true}]){
    const {view}=fixture('kai',{flags});assert.equal(view.root.dataset.resultStage,undefined);
    assert.equal(view.root.querySelector('.result-hero-portrait'),null);assert.equal(view.root.querySelector('.battle-result-story-section'),null);
    view.destroy();
  }
});

test('stage CSS: generated control art only, native text, scrolling content, reduced motion and narrow layout',()=>{
  const urls=[...css.matchAll(/url\('([^']+)'\)/g)].map(m=>m[1]);assert(urls.length>0);
  for(const u of urls){assert.match(u,/^\/art\/owner-ui-family-20261031\/(primary|secondary|ledger|dialogue|selected|tab)\.webp$/,u);assert(fs.existsSync(art(u.slice(1))),u);}
  assert(css.includes('overflow-y:auto'));assert(!/text-overflow:ellipsis|line-clamp|visibility:hidden/.test(css));
  assert(css.includes('@media (max-height:600px)'),'320x568 sizing');assert(css.includes('prefers-reduced-motion'));
  assert(!/scale[XY]?\(|letter-spacing:\s*-/.test(css));
  postcss.parse(css).walkRules(rule=>{if(rule.parent.type==='atrule'&&rule.parent.name.endsWith('keyframes'))return;for(const selector of rule.selectors)assert(selector.startsWith('#game-container #battle-result'),selector);});
});
