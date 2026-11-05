import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { loadScenes } from './helpers/publicShellHarness.mjs';
import { OldStreetScene } from '../src/systems/OldStreetScene.mjs';

test('desk showcases the selected original performer over the actual street without another start command', () => {
  for (const id of ['sakura','venus','genya','kai','enjo']) {
    const env=loadScenes();env.profile.selectPublicPerformer(id);
    const view=env.harness(env.TitleScene);view.scene.create();
    const visual=view.query('.lobby-member-visual');
    assert.ok(visual,'Selected full portrait must be a first-screen signal');
    assert.equal(visual.dataset.performer,id);
    assert.match(visual.querySelector('img').src,/portrait\.webp/);
    assert.equal(view.all('[data-action=start]').length,1);
    assert.ok(view.query('.shell-map-ground'));
    view.shutdown();assert.equal(view.root,null);
  }
});

test('tour uses four actual chapter maps and keeps locked previews read-only', () => {
  const env=loadScenes(),view=env.harness(env.TourRouteScene);view.scene.create();
  assert.equal(view.all('.shell-route-preview').length,4);
  assert.equal(view.all('.shell-map-ground').length,4);
  assert.equal(view.query('[data-chapter=neon]').disabled,true);
  view.query('[data-chapter=neon]').click();assert.equal(env.model().chapter.id,'opening');
  view.shutdown();
});

test('choice and result show the actual performer without changing commands or choice effects', () => {
  const env=loadScenes(),{BattleSurfaceView,getPublicResultSurfaceModel}=env.loadRuntime('systems/BattleSurfaceView.mjs');
  const scene={events:new EventEmitter(),input:{enabled:true,keyboard:{enabled:true}},sound:{}};
  const member=env.profile.PUBLIC_PERFORMERS.find(m=>m.id==='kai');let choice=null;
  const options=[{id:'test-choice',label:'选项',description:'描述'}];
  const v=new BattleSurfaceView(scene,{mode:'choice',member,number:1,choices:[],options,onChoice:id=>{choice=id;},onLeave(){}},env.document);
  assert.equal(v.root.querySelector('.battle-performer-visual').dataset.performer,'kai');
  v.root.querySelector('[data-choice=test-choice]').click();assert.equal(choice,'test-choice');v.destroy();
  for(const victory of [true,false]) {
    const m=getPublicResultSurfaceModel({buttons:[{label:'再演一次',action:'retry'}]}, {performerId:'kai',chapterId:'opening',victory,durationMs:33000,choices:[],actions:1,persisted:true});
    const r=new BattleSurfaceView(scene,{mode:'result',model:m,onAction(){}},env.document);
    assert.equal(r.root.querySelector('.battle-performer-visual').querySelector('img').src,'art/five-q-ui-20261013/kai-'+(victory?'victory':'defeat')+'.webp');
    assert.ok(r.root.querySelector('[data-result-action=retry]'));r.destroy();
  }
  assert.equal(scene.input.enabled,true);
});

test('preparation briefing carries the actual selected performer and preserves the real start command',()=>{
  const env=loadScenes(),{PlayerSessionExperience}=env.loadRuntime('systems/PlayerSessionExperience.mjs');
  const scene={battleData:{performerId:'venus',campaignChapterId:'opening'},input:{enabled:true,keyboard:{enabled:true}},sound:{setVolume(){},setMute(){}},events:new EventEmitter()};
  const experience=new PlayerSessionExperience(scene);experience.showBriefing(true);
  const portrait=experience.root.querySelector('.session-performer').querySelector('img');
  assert.match(portrait.src,/venus-avatar\.webp$/);assert.equal(portrait.alt,'');
  assert.ok(experience.root.textContent.includes('准备开演'));
  assert.equal(env.document.activeElement.id,'player-session-heading','Preparation initially focuses the visible heading, not the offscreen start button');
  experience.destroy();assert.equal(env.document.getElementById('player-session-dialog'),null);
});

test('initial dialog focus does not scroll past the performer or result heading',()=>{
  const env=loadScenes(),{BattleSurfaceView,getPublicResultSurfaceModel}=env.loadRuntime('systems/BattleSurfaceView.mjs');
  const create=env.document.createElement.bind(env.document),calls=[];
  env.document.createElement=tag=>{const el=create(tag),focus=el.focus;el.focus=options=>{calls.push(options);focus.call(el);};return el;};
  const scene={events:new EventEmitter(),input:{enabled:true,keyboard:{enabled:true}},sound:{}};
  const model=getPublicResultSurfaceModel({buttons:[{label:'再演一次',action:'retry'}]}, {performerId:'sakura',chapterId:'opening',victory:true,choices:[],persisted:true,reward:{notes:6}});
  const view=new BattleSurfaceView(scene,{mode:'result',model,onAction(){}},env.document);
  assert.equal(calls[0]?.preventScroll,true,'Keyboard focus must preserve the initial visible heading');
  assert.equal(env.document.activeElement.id,'battle-result-heading','Initial focus must be visible on a long result');view.destroy();
});

test('performer identity overrides the legacy choice span palette without removing button focus cues',()=>{
  const css=postcss.parse(readFileSync(new URL('../src/styles/freshExperience.css',import.meta.url),'utf8'));
  const declarations=selector=>{const values={};css.walkRules(selector,rule=>rule.walkDecls(d=>{values[d.prop]=d.value;}));return values;};
  const copy=declarations('#game-container .battle-surface .battle-visual-copy span');
  assert.equal(copy.color,'#70233f','The legacy #run-choice span rule must not win');
  assert.equal(copy['font-size'],'16px');
  assert.equal(copy['font-weight'],'600');
  assert.equal(declarations('#game-container .battle-surface button:focus-visible').outline,'3px solid #176854');
});

function restorationFixture(config=null) {
  let now=100;const commands=[],nodes=[];
  function graphics(){const node={active:true,clear(){commands.push(['clear']);return this;},setDepth(){return this;},fillStyle(...a){commands.push(['fillStyle',...a]);return this;},fillTriangle(...a){commands.push(['fillTriangle',...a]);return this;},destroy(){this.active=false;}};nodes.push(node);return node;}
  const scene={player:{x:0,y:0},add:{graphics},publicPerformerRun:{now:()=>now},_battlePaused:false,_battleEnded:false};
  const owner=Object.assign(Object.create(OldStreetScene.prototype),{config,scene,disposed:false,items:new Map(),state:{restored:new Set(),restore(id){this.restored.add(id);},isOpen:()=>false}});
  owner.updateRestoration=()=>{};
  scene.paintZone={devices:[{restores:'record-shop',complete:true,paint:52,paintMax:52}]};
  return {owner,scene,nodes,commands,tick:t=>{now=t;}};
}

test('first-chapter restore accent is accepted-only, deduplicated, bounded, pause-aware and reusable',()=>{
  const f=restorationFixture(),device={restores:'record-shop',x:350,y:1460};
  f.scene.paintZone.devices[0].paint=0;f.scene.paintZone.devices[0].complete=false;
  f.owner.restore(device);assert.equal(f.nodes.length,0,'Incomplete place is not an accepted restoration');
  f.scene.paintZone.devices[0].paint=52;f.scene.paintZone.devices[0].complete=true;
  f.owner.restore(device);f.owner.restore(device);
  assert.equal(f.nodes.length,1,'One reused Graphics node');assert.equal(f.owner.restorationAccents.length,1);
  f.owner.drawRestorationAccents();assert.ok(f.commands.some(c=>c[0]==='fillTriangle'));
  const firstAlpha=f.commands.find(c=>c[0]==='fillStyle')[2];f.commands.length=0;
  f.scene._battlePaused=true;f.owner.drawRestorationAccents();
  assert.equal(f.commands.find(c=>c[0]==='fillStyle')[2],firstAlpha,'Unadvanced run clock keeps the accent frozen');
  assert.equal(f.owner.restorationAccents.length,1);f.scene._battlePaused=false;
  for(let i=0;i<12;i++){f.scene.paintZone.devices=[{restores:'test-'+i,complete:true,paint:52,paintMax:52}];f.owner.restore({restores:'test-'+i,x:20,y:40});}
  assert(f.owner.restorationAccents.length<=6);assert.equal(f.nodes.length,1);
  f.tick(800);f.owner.drawRestorationAccents();assert.equal(f.owner.restorationAccents.length,0);
  f.owner.freeze();assert.equal(f.nodes[0].active,true,'Freeze clears drawing without allocating replacement');
  f.owner.destroy();f.owner.destroy();assert.equal(f.nodes[0].active,false);
});

test('restoration accent does not extend to other chapters, missing renderer or invalid positions',()=>{
  const f=restorationFixture({chapterId:'neon',progressiveRestoration:true});
  f.owner.restore({restores:'record-shop',x:350,y:1460});assert.equal(f.nodes.length,0);
  const bad=restorationFixture();bad.owner.restore({restores:'record-shop',x:NaN,y:1460});assert.equal(bad.nodes.length,0);
  const noRenderer=restorationFixture();delete noRenderer.scene.add.graphics;
  noRenderer.owner.restore({restores:'record-shop',x:350,y:1460});assert.equal(noRenderer.nodes.length,0);
});
