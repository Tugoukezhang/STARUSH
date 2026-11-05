import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync(new URL('../src/styles/battleSurface.css',import.meta.url),'utf8');
const scope='#game-container[data-battle-mode="public"]';
const rule=selector=>{const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=css.match(new RegExp(escaped+'\\s*\\{([^}]+)\\}'));assert(m,selector);return m[1];};
test('public actions retain their 54px touch targets but separate name and state into fixed grid tracks',()=>{
 const b=rule(scope+' .skill-orb');
 assert.match(b,/width:\s*54px/);assert.match(b,/height:\s*54px/);
 assert.match(b,/display:\s*grid/);
 assert.match(b,/grid-template-columns:\s*16px 24px/);
 assert.match(b,/grid-template-rows:\s*18px 13px/);
 assert.match(b,/column-gap:\s*4px/);assert.match(b,/row-gap:\s*2px/);
 assert.match(b,/align-content:\s*center/);assert.match(b,/justify-content:\s*center/);
 assert(16+24+4<=54-2*2-2);assert(18+13+2<=54-2*2-2);
});
test('existing icons occupy the first cell; labels and states cannot wrap or resize the control',()=>{
 const icon=rule(scope+' .skill-orb svg');assert.match(icon,/width:\s*16px/);assert.match(icon,/grid-column:\s*1/);assert.match(icon,/grid-row:\s*1/);
 const labels=rule(scope+' #special-label, '+scope+' #encore-label');assert.match(labels,/grid-column:\s*2/);assert.match(labels,/grid-row:\s*1/);assert.match(labels,/white-space:\s*nowrap/);
 const states=rule(scope+' #special-state, '+scope+' #encore-state');assert.match(states,/grid-column:\s*1\s*\/\s*-1/);assert.match(states,/grid-row:\s*2/);assert.match(states,/white-space:\s*nowrap/);
 assert.doesNotMatch(rule(scope+' .skill-orb'),/pointer-events:\s*none|display:\s*none/);
});
