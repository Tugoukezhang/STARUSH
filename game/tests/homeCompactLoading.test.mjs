import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';

test('the public home reads a single logo cell and only requests its original atlas on failure',()=>{
  const environment=loadScenes();
  environment.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const shell=environment.harness(environment.TitleScene,{suppressDebugAutoStart:true});
  shell.scene.create();
  const heading=shell.query('.shell-header').querySelector('h1');
  const logo=()=>heading.querySelector('[data-concept-art=logo]').querySelector('img');
  const fallback=heading.querySelector('.shell-brand-art');
  assert.equal(logo().src,'art/setdesign/home-logo.webp');
  assert.deepEqual([logo().width,logo().height],[435,151]);
  assert(!fallback.src);
  logo().dispatchEvent({type:'error'});
  assert.equal(logo().src,'art/home-transparent-components-20261024/components.png');
  assert.deepEqual([logo().width,logo().height],[941,1672]);
  assert.equal(fallback.src,'art/comic-ui-20261021/logo.png');
  assert.equal(heading.getAttribute('aria-label'),'ST☆RUSH');
  shell.shutdown();
});
