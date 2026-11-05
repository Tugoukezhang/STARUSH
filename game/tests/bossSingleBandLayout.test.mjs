import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import postcss from 'postcss';
const css=fs.readFileSync(new URL('../src/styles/battleSurface.css',import.meta.url),'utf8'),rules=new Map();postcss.parse(css).walkRules(r=>{if(r.parent.type==='root')rules.set(r.selector,Object.fromEntries(r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value])));});
test('one existing70px boss band spans both phone widths without taking another arena row',()=>{
 const r=rules.get('.public-boss-strip');assert.equal(r.left,'8px');assert.equal(r.right,'8px');assert.equal(r.width,'auto');assert.equal(r.top,'106px');assert.equal(r.height,'70px');assert.equal(r['pointer-events'],'none');
 for(const w of [320,375])assert(w-parseFloat(r.left)-parseFloat(r.right)>=304);
});
test('single band keeps native14/16px information rows and factual progress rather than shrinking text',()=>{
 for(const name of ['title','status','count'])assert.equal(rules.get('.public-boss-'+name)['font-size'],'14px');assert.equal(rules.get('.public-boss-instruction')['font-size'],'16px');assert.equal(rules.get('.public-boss-status')['grid-column'],'1 / -1');assert.equal(rules.get('.public-boss-meter')['grid-row'],'4');
});
test('a real run-goal row reserves its existing104..124px band before the boss strip',()=>{
 const root=postcss.parse(fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8')),map=new Map();root.walkRules(r=>map.set(r.selector,Object.fromEntries(r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]))));
 const goal=map.get('#game-container[data-battle-mode=public] #run-goal'),boss=map.get('#game-container[data-battle-mode=public] #hud[data-run-goal=true] .public-boss-strip');assert(boss,'goal-enabled strip rule');assert(parseFloat(boss.top)>=parseFloat(goal.top)+parseFloat(goal['line-height'])+4);assert.equal(boss.top,'128px');assert.equal(goal.left,'30px','6px frame inset plus24px authored edge clears the first glyph');
});
test('transient danger notices sit below the boss band in normal and goal routes instead of drawing over its text',()=>{
 const root=postcss.parse(fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8')),map=new Map();root.walkRules(r=>map.set(r.selector,Object.fromEntries(r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]))));
 for(const [selector,bandTop]of [['#game-container[data-battle-mode=public] #hud:has(> .public-boss-strip) ~ #battle-notice',106],['#game-container[data-battle-mode=public] #hud[data-run-goal=true]:has(> .public-boss-strip) ~ #battle-notice',128]]){const row=map.get(selector);assert(row,selector);assert.equal(parseFloat(row.top),bandTop+70+4);assert.deepEqual(Object.keys(row),['top'],'notice content, lifetime and other presentation untouched');}
});
