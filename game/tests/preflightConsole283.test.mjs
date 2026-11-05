import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
test('preflight has a registered original ticket skin and no duplicate visual actor name',()=>{
 assert(RUNTIME_PAYLOAD.some(x=>x.file==='art/preflight-console-20261103/choice.webp'));
 const css=fs.readFileSync(new URL('../src/styles/preflightStudio271.css',import.meta.url),'utf8');
 assert.match(css,/\.ui-preflight-member-name\s*\{\s*display:\s*none/);
 assert.match(css,/preflight-console-20261103\/choice.webp/);
});
test('clearing a draft returns focus to the visible arrangement control and preserves saved state',()=>{
 const s=loadScenes();s.loadRuntime('utils/userCast.mjs').configureUserCast(true);s.seed(['opening']);
 const h=s.harness(s.TitleScene,{suppressDebugAutoStart:true});h.scene.create();h.click('[data-action=start]');
 const before=JSON.stringify([...s.storage.values]);
 h.click('[data-action=preflight-arrangement]');h.click('[data-action=preflight-library]');
 h.click('[data-arrangement=tempo]');h.click('[data-arrangement=overdrive]');h.click('[data-action=plan-use]');
 h.click('[data-action=preflight-arrangement]');
 assert.equal(h.query('[data-action=plan-clear]').querySelector('.plan-clear-label').src,'art/preflight-console-20261103/clear.webp');
 h.click('[data-action=plan-clear]');
 assert.equal(h.scene._publicShell.arrangementPlan,null);
 assert.equal(s.document.activeElement,h.query('[data-action=preflight-arrangement]'));
 assert.equal(JSON.stringify([...s.storage.values]),before);
 h.shutdown();
});
