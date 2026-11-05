import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

const BASE='art/home-lettering-20261022/';
const SHORTCUTS={preflight:'preflight',prepare:'training','story-journal':'journal','play-hub':'hub'};
const NAMES={sakura:'rifle',kai:'sword',enjo:'hammer'};
const LABELS={preflight:'出战准备',prepare:'成员训练','story-journal':'巡演手记','play-hub':'玩法中心'};

function home(member,currentCast=true){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(currentCast);
 if(member)e.profile.selectPublicPerformer(member);
 const h=e.harness(e.TitleScene);h.scene.create();return h;
}
const lettering=node=>node.querySelector('img.home-lettering');

test('current-cast home attaches exactly the eight decorative lettering assets beside native labels',()=>{
 const seen=new Set();
 for(const member of ['sakura','kai','enjo']){
  const h=home(member);
  assert.equal(h.all('img.home-lettering').length,6,member);
  for(const [action,file]of Object.entries(SHORTCUTS)){
   const button=h.query('[data-action='+action+']');
   assert.equal(button.getAttribute('aria-label'),LABELS[action]);assert.equal(button.title,LABELS[action]);
   assert(button.querySelector('.menu-art')||button.querySelector('svg'),'familiar icon kept for '+action);
   const copy=button.querySelector('.lobby-shortcut-copy');
   assert.equal(copy.querySelector('strong').textContent,LABELS[action]);
   assert.equal(lettering(copy).src,BASE+file+'.png');seen.add(lettering(copy).src);
  }
  const name=h.query('.lobby-member-name');
  assert.equal(lettering(name).src,BASE+NAMES[member]+'.png');seen.add(lettering(name).src);
  assert.equal(h.query('.lobby-member-visual').getAttribute('aria-label').startsWith('与'),true);
  const start=h.query('[data-action=start]');
  assert.equal(start.getAttribute('aria-label'),'开始公演');assert.match(start.textContent,/开始公演/);
  assert.equal(lettering(start).src,BASE+'start.png');seen.add(lettering(start).src);
  for(const image of h.all('img.home-lettering')){
   assert.equal(image.alt,'');assert.equal(image.getAttribute('aria-hidden'),'true');
   assert.equal(image.width,512);assert.equal(image.height,128);assert.equal(image.draggable,false);
   assert.equal(image.parentNode.dataset.lettering,undefined,'native label stays visible before load');
  }
  h.click('[data-action=start]');assert.equal(h.starts[0][0],'BattleScene');h.shutdown();
 }
 assert.deepEqual([...seen].sort(),['start','rifle','sword','hammer','preflight','training','journal','hub'].map(id=>BASE+id+'.png').sort());
});

test('load marks only the owning label; error removes the image and restores native fallback',()=>{
 const h=home();
 const copy=h.query('[data-action=preflight]').querySelector('.lobby-shortcut-copy');
 const image=lettering(copy);image.dispatchEvent({type:'load'});
 assert.equal(copy.dataset.lettering,'loaded');
 assert.equal(h.query('[data-action=prepare]').querySelector('.lobby-shortcut-copy').dataset.lettering,undefined);
 image.dispatchEvent({type:'error'});
 assert.equal(lettering(copy),null);assert.equal(copy.dataset.lettering,undefined);
 assert.equal(copy.querySelector('strong').textContent,'出战准备');
 const start=h.query('[data-action=start]');lettering(start).dispatchEvent({type:'error'});
 assert.equal(lettering(start),null);assert.equal(start.dataset.lettering,undefined);assert.match(start.textContent,/开始公演/);
 h.click('[data-action=preflight]');assert.equal(h.root.dataset.page,'preflight');h.shutdown();
});

test('legacy cast home renders no lettering images and keeps its existing labels',()=>{
 const h=home(null,false);
 assert.equal(h.all('img.home-lettering').length,0);
 for(const [action,label]of Object.entries(LABELS))assert.equal(h.query('[data-action='+action+']').querySelector('strong').textContent,label);
 assert.equal(h.query('[data-action=start]').dataset.lettering,undefined);h.shutdown();
});

test('desk typography and home entrance are scoped, finite, motion-gated and reduce-safe',()=>{
 const css=fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');
 const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([,selector,body])=>({selector:selector.trim(),body}));
 for(const rule of rules.filter(rule=>/\.lobby-character|home-lettering|lobby-shortcut-copy|lobby-shortcut > /.test(rule.selector)&&/animation:/.test(rule.body)))
  assert.match(rule.selector,/\[data-motion\]/,'unconditional home animation: '+rule.selector);
 assert(rules.some(rule=>/\[data-motion\]/.test(rule.selector)&&/\.lobby-character/.test(rule.selector)&&/comic-home-arrive/.test(rule.body)));
 const entrance=rules.filter(rule=>/\[data-motion\]/.test(rule.selector)&&/\[data-page=desk\]/.test(rule.selector)&&/home-lettering-arrive/.test(rule.body));
 assert(entrance.length>=3,'child-only lettering entrance');
 for(const rule of entrance){
  assert.doesNotMatch(rule.body,/infinite/);assert.doesNotMatch(rule.selector,/\.lobby-shortcut\s*(?:,|$)|shell-primary\s*(?:,|$)/,'no whole-button animation');
  for(const [,ms]of rule.body.matchAll(/(\d+)ms/g))assert(Number(ms)<=420,rule.selector);
 }
 assert.match(css,/@keyframes home-lettering-arrive/);assert.doesNotMatch(css,/infinite/);
 assert.match(css,/@keyframes home-lettering-arrive\s*\{from\s*\{opacity:0;transform:scale\(\.94\)/,'ink entrance must stay inside contiguous short-screen targets');
 assert(rules.some(rule=>rule.selector.endsWith('.lobby-shortcut-copy')&&rule.selector.includes('[data-page=desk]')&&/background:#fff/.test(rule.body)),'small raster labels need an opaque reading band');
 assert(rules.some(rule=>rule.selector.endsWith('.lobby-shortcuts .menu-art')&&rule.selector.includes('[data-page=desk]')&&/height:26px/.test(rule.body)),'short viewport icon must fit label and hit target');
 assert(rules.some(rule=>rule.selector.includes('[data-page=desk]')&&rule.selector.endsWith('.shell-content')&&/animation:none/.test(rule.body)),'home content must override inherited page slide so hit rectangles stay fixed');
 assert.match(css,/prefers-reduced-motion:reduce[\s\S]*#public-shell \*\s*\{animation:none !important/);
 const desk=sel=>rules.find(rule=>rule.selector.includes('[data-page=desk]')&&rule.selector.endsWith(sel)&&/font-size:14px/.test(rule.body));
 for(const sel of ['.shell-eyebrow','.lobby-preparation','.shell-navigation button'])assert(desk(sel),sel+' must be 14px on current-cast desk');
 for(const sel of ['.lobby-shortcut-copy[data-lettering=loaded] strong','.lobby-member-name[data-lettering=loaded] strong','.lobby-start .shell-primary[data-lettering=loaded] > span'])
  assert(rules.some(rule=>rule.selector.split(',').some(part=>part.trim().endsWith(sel))&&/clip-path:inset\(50%\)/.test(rule.body)),'native label is clipped only after load: '+sel);
 assert(rules.some(rule=>/\.home-lettering/.test(rule.selector)&&!/data-lettering=loaded/.test(rule.selector)&&/display:none/.test(rule.body)),'raster hidden until loaded');
});
