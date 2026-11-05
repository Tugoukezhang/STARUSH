import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{loadScenes}from'./helpers/publicShellHarness.mjs';
test('selected home keeps a truthful disabled resume action visible before the first checkpoint',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.TitleScene);h.scene.create();
 const b=h.query('[data-action=resume-empty]');assert(b,'selected design secondary action is present even before save');assert.equal(b.disabled,true);assert.match(b.getAttribute('aria-label'),/继续演出/);assert.equal(h.all('[data-action=resume-run]').length,0);h.shutdown();
});
test('home breath has a bounded perceptible phase and still respects reduced motion',()=>{
 const css=fs.readFileSync(new URL('../src/styles/homeDemo.css',import.meta.url),'utf8');
 assert.match(css,/@keyframes home-selected-breathe/);assert.match(css,/scale\(1\.008,1\.012\)/);assert.match(css,/prefers-reduced-motion:reduce|prefers-reduced-motion: reduce/);
});
