import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const css=fs.readFileSync(new URL('../src/styles/choiceStudio290.css',import.meta.url),'utf8');
test('choice stage replaces old ticket skin and isolates the selected detail region',()=>{
 assert(css.includes('data-choice-studio="303"'));
 assert(css.includes('art/choice-stage-b303/row.webp'));
 assert(!css.includes('art/choice-studio-20261104/ticket.webp'));
 assert.match(css,/\.battle-choice-detail\s*\{[^}]*min-height/);
 assert.match(css,/\.battle-choice-row\s*\{[^}]*grid-template-columns/);
});
test('confirmation uses generated typography without stretching and honors reduced motion',()=>{
 assert(css.includes('art/choice-stage-b303/confirm.webp'));
 assert(css.includes('[data-action="confirm-choice"]'));
 assert.match(css,/background-size:contain/);
 assert(css.includes('prefers-reduced-motion:reduce'));
 assert(css.includes('aria-pressed="true"'));
});
