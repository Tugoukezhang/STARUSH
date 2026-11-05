import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

const css=fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');

test('only real page navigation marks a direction for the page transition',()=>{
 const e=loadScenes(),h=e.harness(e.TitleScene);h.scene.create();
 const shell=h.scene._publicShell;
 assert.equal(h.root.dataset.motion,'enter','first shell render is a scene entry');
 shell.render();
 assert.equal(h.root.dataset.motion,undefined,'a form rerender must not replay page motion');
 assert.equal(shell.showPage('playhub'),true);
 assert.equal(h.root.dataset.motion,'forward');
 shell.render('[data-action=back]');
 assert.equal(h.root.dataset.motion,undefined);
 shell.showPage('growth');assert.equal(h.root.dataset.motion,'forward');
 shell.backPage();
 assert.equal(shell.page,'playhub');assert.equal(h.root.dataset.motion,'back');
 shell.showPage('records',{remember:false,root:true});
 assert.equal(h.root.dataset.motion,'root');
 h.shutdown();
});

test('navigation motion keeps focus, commands and storage synchronous',()=>{
 const e=loadScenes(),h=e.harness(e.TitleScene);h.scene.create();
 const shell=h.scene._publicShell;
 const before=e.storage.getItem('starush.public-profile');
 shell.showPage('playhub');
 assert.equal(shell.page,'playhub','page swaps in the same call; no delayed command');
 assert(h.root.contains(e.document.activeElement),'focus lands inside the new page immediately');
 assert.equal(e.storage.getItem('starush.public-profile'),before,'motion never writes storage');
 h.shutdown();
 assert.equal(shell.disposed,true);
 assert.equal(shell.showPage('growth'),false,'destroyed shell ignores navigation');
 assert.equal(shell.pendingMotion,null,'no motion is left queued after destroy');
});

test('blocked session input does not queue motion for a later render',()=>{
 const e=loadScenes(),h=e.harness(e.TitleScene);h.scene.create();
 const shell=h.scene._publicShell;shell.render();
 h.scene._sessionExperience={isBlocking:()=>true};
 assert.equal(shell.showPage('playhub'),false);
 h.scene._sessionExperience=null;shell.render();
 assert.equal(h.root.dataset.motion,undefined);
 h.shutdown();
});

test('stylesheet owns transition, press feedback, reduced motion and narrow text layout',()=>{
 for(const motion of ['enter','forward','back','root'])
  assert(css.includes(`#public-shell[data-motion=${motion}] .shell-content`),motion+' page motion selector');
 assert(/@keyframes shell-page-forward/.test(css)&&/@keyframes shell-page-back/.test(css));
 const durations=[...css.matchAll(/animation:\s*shell-[\w-]+\s+(\d+)ms/g)].map(match=>Number(match[1]));
 assert(durations.length>=3);assert(durations.every(ms=>ms<=240),'page motion stays short: '+durations);
 assert(/#public-shell button:not\(:disabled\)[^{]*:active\s*\{[^}]*transform:/.test(css),'pressed buttons move');
 assert(/\[aria-pressed=true\][^{]*\{[^}]*animation:\s*shell-select/.test(css),'selection change has feedback');
 const reducedBlocks=css.match(/@media \(prefers-reduced-motion:\s*reduce\) \{[\s\S]*?\n\}/g);
 const reduced=reducedBlocks.find(block=>block.includes('#game-container #public-shell *'));
 assert(reduced,'shell-specific reduced-motion block exists');
 assert(/animation:\s*none\s*!important/.test(reduced)&&/transform:\s*none\s*!important/.test(reduced));
 assert(/@media \(max-width:380px\)/.test(css),'375px layout rules');
 assert(/overflow-wrap:anywhere/.test(css.slice(css.indexOf('/* Stable text layout'))),'stable text block wraps long CJK labels');
 assert(!/transition:\s*all/.test(css),'no broad transition that would animate every rerender');
 assert(!/font-size:\s*[^;]*(?:vw|cqw)|letter-spacing:\s*-/.test(css));
});
