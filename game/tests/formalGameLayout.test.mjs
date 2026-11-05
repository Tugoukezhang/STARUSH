import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

test('eleven public screens share one named page heading and retain navigation',()=>{
 const e=loadScenes(),h=e.harness(e.TitleScene);h.scene.create();
 for(const page of ['desk','roster','tour','workshop','preflight','inventory','records','playhub','goals','library','growth']){
  h.scene._publicShell.showPage(page);
  assert.equal(h.root.querySelectorAll('h1').length,1,page+' must have a single header h1');
  assert(h.query('.shell-header').querySelector('h1'),page+' heading must be in the shared header');
  assert(h.query('h1').textContent);assert(h.query('.shell-navigation'));assert(h.query('.shell-content'));
 }
 h.shutdown();
});
test('growth comparison has explicit current and planned column labels without save changes',()=>{
 const e=loadScenes(),h=e.harness(e.TitleScene);h.scene.create();h.click('[data-action=play-hub]');h.click('[data-action=hub-growth]');
 const before=e.storage.getItem('starush.public-profile');h.click('[data-growth-rank="3"]');h.click('[data-growth-equipment="focus_lens"]');
 assert(h.query('.growth-comparison-labels'),'missing current/planned comparison labels');
 assert.match(h.query('.growth-comparison-labels').textContent,/当前.*规划/);
 assert.match(h.query('.growth-preview').textContent,/未应用/);assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});
test('shared formal layout loads last and keeps presentation separate from models',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert(html.includes('/src/styles/formalGameLayout.css'),'missing formal layout stylesheet');
 assert(html.indexOf('/src/styles/formalGameLayout.css')>html.indexOf('/src/styles/mobileGameScreens.css'));
 const css=fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');
 for(const selector of ['.shell-header','.shell-selection-footer','.shell-navigation','.growth-comparison-labels','.battle-choice-row','.session-panel'])assert(css.includes(selector),selector);
 const imageUrls=[...css.matchAll(/url\(['"]?([^)'\"]+)['"]?\)/g)].map(match=>match[1]);
 assert.deepEqual([...new Set(imageUrls)].sort(),[
  ...['primary','secondary','panel'].map(id=>`/art/core-journey-20261018/${id}.webp`),
  ...['disc','disc-ready'].map(id=>`/art/formal-ui-20261016/${id}.webp`),
  '/art/comic-ui-20261021/panel.png',
  ...['encore','rifle','sword','hammer'].map(id=>`/art/skill-command-20261022/${id}.png`),
  ...['status-idle','status-ready','status-active'].map(id=>`/art/battle-comic-skin-20261021/${id}.png`),
  '/art/battle-header-20261022/frame.png',
  '/art/briefing-reading-frame-20261022/frame.png',
  '/fonts/NotoSansSC-UI.woff2',
  ...['ready','active','preparing','paused','ended'].map(id=>'/art/command-state-family-20261022/'+id+'.png'),
  ...['primary','secondary','panel','slip','title','plaza'].map(id=>`/art/playable-ui-20261018/${id}.webp`),
 ].sort(),'only reviewed local UI surfaces and the exact admitted offline font may be referenced');
 assert(!/font-size:\s*[^;]*(?:vw|cqw)|letter-spacing:\s*-/.test(css));
});
