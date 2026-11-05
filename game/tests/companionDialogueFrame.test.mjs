import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const css=fs.readFileSync(new URL('../src/styles/ownerGeneratedUi.css',import.meta.url),'utf8'),lounge=css.slice(css.indexOf(' &[data-page=lounge] {'),css.indexOf(' &[data-page=venue] {'));
test('the low-profile dialogue uses one exact admitted AI export; no gesture sources enter runtime',()=>{
 const asset=RUNTIME_PAYLOAD.filter(r=>r.file==='art/companion-dialogue-20261031/dialogue.webp');assert.equal(asset.length,1);assert.equal(asset[0].group,'owner-companion-dialogue');
 assert(!RUNTIME_PAYLOAD.some(r=>/greeting|art-source|sequence-preview/.test(r.file)));
});
test('the lounge frame is true bitmap9-slice behind native content, never whole-image stretching',()=>{
 assert.match(lounge,/\.pm-dialogue\[data-owner-ui-band\]::before/);
 assert.match(lounge,/border-image:url\('\/art\/companion-dialogue-20261031\/dialogue.webp'\)/);
 assert.match(lounge,/pointer-events:none/);assert.match(lounge,/isolation:isolate/);
 assert.doesNotMatch(lounge,/background-size:100% 100%/);
});
