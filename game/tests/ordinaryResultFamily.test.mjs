import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';
const path=new URL('../src/styles/ordinaryResultFamily.css',import.meta.url);
const css=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const scope='#game-container #battle-result[data-combat-flow=true]';

test('ordinary result family loads after challenge styles and is limited to existing ordinary owner marker',()=>{
 assert(index.indexOf('/src/styles/ordinaryResultFamily.css')>index.indexOf('/src/styles/challengeScreenFamily.css'));
 // B248: the chapter result stage is the ordinary owner result with its own marker; at-rules hold only scoped rules.
 const chapter='#game-container #battle-result[data-result-stage=chapter]';
 postcss.parse(css).walkRules(rule=>{if(rule.parent.type==='atrule'&&rule.parent.name.endsWith('keyframes'))return;for(const selector of rule.selectors)assert(selector.startsWith(scope)||selector.startsWith(chapter),selector);});
 // Only the admitted generated control family, never legacy stretched art.
 for(const [,u] of css.matchAll(/url\('([^']+)'\)/g))assert.match(u,/^\/art\/owner-ui-family-20261031\/(primary|secondary|ledger|dialogue)\.webp$/);
 assert(!css.includes('!important'));
});
test('ordinary content replaces the stretched paper with a real scrollable white information surface',()=>{
 assert(css.includes(scope+' .battle-surface-content {'));
 for(const rule of ['border-image:none;','background:#fff;','overflow-y:auto;','scroll-padding-block:12px;'])assert(css.includes(rule),rule);
 assert(!/overflow-y:hidden|text-overflow:ellipsis/.test(css));
 const content=css.slice(css.indexOf(scope+' .battle-surface-content {')).split('}')[0];
 assert(!/[;{]height:/.test(content),'scrollable content must not acquire a fixed pixel height');
});
test('result identity stays compact and in flow without stretching original portrait or headline',()=>{
 assert(css.includes('grid-template-columns:minmax(0,1fr) 108px;'));
 assert(css.includes('object-fit:contain;'));
 assert(css.includes('font-size:26px;line-height:34px;'));
 assert(css.includes('.battle-result-chapter {grid-column:1;grid-row:3;'));
 assert(!/scale[XY]?\(|letter-spacing:\s*-/.test(css));
});
test('four original statistics remain two columns while all reward text and detail content remain visible',()=>{
 assert(css.includes('.battle-result-stats:has(> div:nth-child(4))'));
 assert(css.includes('grid-template-columns:repeat(2,minmax(0,1fr));'));
 assert(css.includes('.battle-earned-equipment {'));
 assert(css.includes('overflow-wrap:anywhere;'));
 assert(!/display:none|visibility:hidden|line-clamp|clip-path/.test(css));
});
test('original footer keeps primary and secondary commands at touch size with clear states',()=>{
 assert(css.includes('.battle-surface-footer {flex:none;'));
 assert(css.includes('.battle-surface-footer .battle-primary {grid-column:1 / -1;'));
 assert(css.includes('.battle-secondary:last-child:nth-child(2) {grid-column:1 / -1;'));
 assert(css.includes('min-height:44px;'));
 assert(css.includes(':focus-visible'));assert(css.includes(':disabled'));assert(css.includes(':active'));
});
test('save warning and retry retain readable contrast, no motion delay or UI invention',()=>{
 assert(css.includes('.battle-save:is([data-save-state=pending],[data-save-state=unrecorded],[data-save-state=blocked])'));
 assert(css.includes('background:#fff1cd;color:#68450b;'));
 assert(css.includes('[data-result-action=retry-save-result]'));
 assert(!/(?:[;{])(?:transition|content|font-family|font-face|animation-delay):|counter\(/.test(css));
 // Only the portrait may enter (short, entrance-run only), and reduced motion removes it; commands never wait.
 const animated=[...css.matchAll(/([^{}]+)\{[^{}]*animation:(?!none)/g)].map(m=>m[1].trim());
 assert.deepEqual(animated,['#game-container #battle-result[data-result-stage=chapter][data-motion=enter] .result-hero-portrait:not([hidden])']);
 assert(css.includes('@media (prefers-reduced-motion:reduce)'));
});
test('expanded review commands also lose legacy stretched backplates without hiding their labels',()=>{
 const rule=css.split(scope+' .battle-result-details button {')[1]?.split('}')[0];
 assert(rule,'all original review commands included');
 for(const value of ['border-image:none;','border:1px solid #d3dce0;','min-height:44px;','padding:8px 10px;'])assert(rule.includes(value),value);
});
test('disabled footer state has sufficient selector specificity to override its active primary surface',()=>{
 assert(css.includes(scope+' .battle-surface-footer button:disabled,'));
});
