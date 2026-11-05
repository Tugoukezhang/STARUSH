import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function setup(page='workshop',earned=true,owner=true) {
  const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(owner);
  if(earned)e.seed(['opening','neon','encore']);
  const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:page});h.scene.create();
  return {e,h};
}

test('training rail uses registry headshots with explicit dimensions and unchanged preview semantics',()=>{
  const {e,h}=setup(),saved=e.storage.getItem('starush.public-profile');
  const registry=e.loadRuntime('systems/MenuPortraitAvatar.mjs');
  for(const id of ['sakura','kai','enjo']){
    const button=h.query('[data-member='+id+']'),image=button.querySelector('.training-headshot');
    assert.ok(image,'expected registry headshot for '+id);
    assert.equal(image.src,registry.getMenuAvatarArt(id).src);
    assert.equal(image.width,160);assert.equal(image.height,160);assert.equal(image.alt,'');
    assert.equal(button.querySelector('.member-mark'),null);
    h.click('[data-member='+id+']');
    assert.equal(h.query('[data-member='+id+']').getAttribute('aria-pressed'),'true');
    assert.equal(h.query('.workshop-member-context').dataset.performer,id);
    assert.equal(e.storage.getItem('starush.public-profile'),saved);
  }
  h.shutdown();
});

test('training exposes actual current next cost and only train spends notes',()=>{
  const {e,h}=setup();
  const value=key=>h.query('[data-training-effect='+key+']').querySelector('dd').textContent;
  assert.equal(value('current'),'+0%');assert.equal(value('next'),'+10%');assert.equal(value('cost'),'3 练习笔记');
  h.click('[data-action=train]');
  assert.equal(value('current'),'+10%');assert.equal(value('next'),'+20%');assert.equal(value('cost'),'6 练习笔记');
  h.click('[data-action=train]');assert.equal(value('next'),'已满阶');assert.equal(value('cost'),'无需消耗');
  assert(h.query('[data-action=train]').disabled);h.shutdown();
  const fresh=setup('workshop',false);assert(fresh.h.query('[data-action=train]').disabled);fresh.h.shutdown();
});

test('growth draft preserves confirmation cancel and unchanged saved profile',()=>{
  const {e,h}=setup('growth'),saved=e.storage.getItem('starush.public-profile');
  h.click('[data-growth-rank=2]');
  assert.match(h.query('.growth-application').textContent,/3 练习笔记/);
  h.click('[data-action=growth-apply]');assert(h.query('[data-action=growth-confirm]'));
  h.click('[data-action=growth-cancel]');assert.equal(h.query('[data-action=growth-confirm]'),null);
  assert.equal(e.storage.getItem('starush.public-profile'),saved);h.shutdown();
});

test('training stylesheet is scoped and keeps cost row visible with responsive portrait and console surfaces',()=>{
  const url=new URL('../src/styles/trainingFamilyV2.css',import.meta.url);
  assert.ok(fs.existsSync(url),'training family stylesheet must exist');
  const css=fs.readFileSync(url,'utf8');
  assert.match(css,/\[data-cast=owner-three\]/);assert.match(css,/\[data-page=workshop\]/);assert.match(css,/\[data-page=growth\]/);
  assert.match(css,/\[data-training-effect=cost\][^{]*\{[^}]*display:flex/);
  assert.match(css,/\.training-headshot/);assert.match(css,/object-fit:contain/);
  assert.match(css,/@media \(max-width:340px\)/);assert.match(css,/prefers-reduced-motion:reduce/);
  assert.doesNotMatch(css,/url\(|(?:\{|;)\s*content:/);
});

test('legacy training rail does not receive owner registry headshots',()=>{
  const {h}=setup('workshop',true,false);assert.equal(h.query('.training-headshot'),null);
  assert(h.query('.shell-member-option').querySelector('.member-mark'));h.shutdown();
});
