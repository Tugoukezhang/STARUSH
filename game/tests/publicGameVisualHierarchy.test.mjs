import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';

const scene=()=>({input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},player:{body:{setVelocity(){}}},events:{once(){},off(){}},_sessionExperience:{isBlocking:()=>false},sound:null});

test('choice symbols are effect-specific, and gestures still use the existing single-choice owner',()=>{
  const env=loadScenes(),{BattleSurfaceView}=env.loadRuntime('systems/BattleSurfaceView.mjs');
  const chosen=[],before=plain(env.profile.loadPublicProfile()),glyphs=new Set();
  for(const ids of [['wide_brush','relay','tempo'],['echo','overdrive','recovery']]){
    const view=new BattleSurfaceView(scene(),{mode:'choice',member:env.profile.PUBLIC_PERFORMERS[0],number:1,choices:[],options:ids.map(id=>env.profile.getRunChoice(id)),onChoice:id=>chosen.push(id),onLeave(){}},env.document);
    for(const id of ids){const row=view.root.querySelector(`[data-choice=${id}]`),symbol=row.querySelector('.battle-choice-symbol');assert(symbol,'A distinct functional symbol is required for '+id);assert.equal(symbol.querySelector('img').src,`art/formal-ui-20261016/${id==='wide_brush'?'nozzle':id}.webp`);glyphs.add(symbol.dataset.icon);assert(row.textContent.includes(env.profile.getRunChoice(id).description),'Do not abbreviate away rules or invent bonuses');}
    view.root.querySelector(`[data-choice=${ids[0]}]`).click();view.root.querySelector(`[data-choice=${ids[1]}]`).click();view.destroy();
  }
  assert.equal(glyphs.size,6);assert.deepEqual(chosen,['wide_brush','echo']);assert.deepEqual(plain(env.profile.loadPublicProfile()),before,'Rendering choices must not write a save');
});

test('result puts recorded performance and reward before an explicit optional story disclosure',()=>{
  const env=loadScenes(),{BattleSurfaceView,getPublicResultSurfaceModel}=env.loadRuntime('systems/BattleSurfaceView.mjs');
  const actions=[],s=scene(),view=new BattleSurfaceView(s,{mode:'result',model:getPublicResultSurfaceModel({buttons:[{label:'再演本站',action:'retry'}]},{performerId:'sakura',chapterId:'opening',victory:true,durationMs:42000,actions:6,choices:['wide_brush','echo'],recorded:true,persisted:true,reward:{notes:6,equipmentIds:['wide_nozzle']}}),onAction:id=>actions.push(id)},env.document);
  const stats=view.root.querySelector('.battle-result-stats'),reward=view.root.querySelector('.battle-result-reward'),story=view.root.querySelector('.battle-story-ending'),toggle=view.root.querySelector('[data-action=result-story]');
  assert(toggle,'Story must be an explicit non-terminal disclosure');assert.equal(story.hidden,true);assert.equal(toggle.getAttribute('aria-expanded'),'false');
  const children=view.content.children;assert(children.indexOf(stats)<children.indexOf(story));assert(children.indexOf(reward)<children.indexOf(story));
  toggle.click();assert.equal(story.hidden,false);assert.equal(toggle.getAttribute('aria-expanded'),'true');toggle.click();assert.equal(story.hidden,true);assert.deepEqual(actions,[]);
  view.root.querySelector('[data-result-action=retry]').click();assert.deepEqual(actions,['retry']);view.destroy();assert.equal(s.input.enabled,true);assert.equal(env.document.getElementById('battle-result'),null);
});

test('member action is part of the first-view identity, not buried below its portrait',()=>{
  const env=loadScenes(),h=env.harness(env.IdolRosterScene);h.scene.create();
  const detail=h.query('.shell-performer-detail'),action=h.query('.shell-action-detail');assert(detail.contains(action),'The action must share the portrait/name identity band');
  assert(action.textContent.includes('扇形音浪'));h.click('[data-member=kai]');assert(h.query('.shell-action-detail').textContent.includes('仍会受伤'));h.shutdown();
});

test('short-screen layout has an explicit bounded map and a zero-minimum scroll track',()=>{
  const css=fs.readFileSync(new URL('../src/styles/freshExperience.css',import.meta.url),'utf8');
  assert.match(css,/#public-shell \.shell-content\s*\{[^}]*min-height:\s*0/);
  assert.match(css,/@media\s*\(max-height:\s*610px\)/);
  assert.match(css,/#public-shell\[data-page=desk\] \.shell-main-map\s*\{[^}]*height:\s*160px/);
});
