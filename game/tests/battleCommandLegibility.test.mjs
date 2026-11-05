import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),postcss=require('postcss'),css=postcss.parse(fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8'));
const scope='#game-container[data-battle-mode=public] .mihoyo-skills:has(> [data-art=weapon])';
function rule(selector){let found;css.walkRules(r=>{if(r.selector===selector&&!r.parent.name)found=r;});assert(found,selector);return Object.fromEntries(found.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));}
test('current cast command feedback keeps native target geometry stable in every charge state',()=>{
 const r=rule(scope+' .skill-orb[data-charge-state]');for(const p of ['transform','translate','scale','animation'])assert.equal(r[p],'none');assert(!r.width&&!r.height&&!r.top&&!r.left&&!r.bottom&&!r.right);assert.equal(r.opacity,undefined,'retain original blocked-state opacity');
});
test('special weapon art and live text use separate fixed in-disc slots without smaller text',()=>{
 const art=rule(scope+' .battle-action-art'),label=rule(scope+' #special-label'),state=rule(scope+' #special-state');assert.equal(art.width,'24px');assert.equal(art.height,'24px');assert.equal(art.top,'6px');assert.equal(art.left,'24px');
 assert.equal(label.top,'31px');assert.equal(state.top,'48px');for(const r of [label,state])assert.equal(r['font-size'],'12px');assert.equal(state['line-height'],'16px');
});
test('encore icon label and longest captions fit current60px disc without changing its size',()=>{
 const icon=rule(scope+' #skill-encore svg'),label=rule(scope+' #encore-label'),state=rule(scope+' #encore-state');assert.equal(icon.top,'4px');assert.equal(icon.width,'14px');assert.equal(icon.height,'14px');assert.equal(icon.left,'23px');assert.equal(label.top,'19px');assert.equal(state.top,'35px');for(const r of [label,state]){assert.equal(r['font-size'],'12px');assert.equal(r['line-height'],'16px');}
});
test('only icon ink animates on ready and press; reduced motion also stops the children',()=>{
 assert.match(rule(scope+' .skill-orb[data-charge-state=ready] > :is(.battle-action-art,svg)').animation,/skill-ready-settle/);
 assert.equal(rule(scope+' .skill-orb[aria-disabled=false]:active > :is(.battle-action-art,svg)').transform,'translateY(1px)');
 let reduced;css.walkAtRules('media',m=>{if(m.params==='(prefers-reduced-motion:reduce)')m.walkRules(r=>{if(r.selector===scope+' .skill-orb > :is(.battle-action-art,svg)')reduced=r;});});assert(reduced);const declarations=Object.fromEntries(reduced.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));assert.equal(declarations.animation,'none');assert.equal(declarations.transform,'none');
});
