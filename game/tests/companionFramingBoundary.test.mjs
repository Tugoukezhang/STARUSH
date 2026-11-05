import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('one lounge stylesheet owns proportional portrait framing; legacy cast rebuilding cannot override it',()=>{
 const css=fs.readFileSync(new URL('../src/styles/companionConversationV3.css',import.meta.url),'utf8'),old=fs.readFileSync(new URL('../src/styles/castRebuild.css',import.meta.url),'utf8');
 assert(!old.includes('[data-page=lounge]'),'retired wrong-width/top overrides must not return');assert(css.includes('--portrait-width:calc(var(--head-px) / var(--portrait-head))'));assert(css.includes('width:var(--portrait-width);height:calc(var(--portrait-width) / (var(--portrait-ratio)))'));assert(!css.includes('--portrait-height:'));assert(css.includes('--face-top:112px'));assert(css.includes('--face-top:94px'));
});
