import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import postcss from 'postcss';
const css=fs.readFileSync(new URL('../src/styles/ordinaryResultFamily.css',import.meta.url),'utf8');
const scope='#game-container #battle-result[data-combat-flow=true]';
const rule=s=>css.split(s+' {')[1]?.split('}')[0]||'';
test('ordinary result has three deliberate role palettes rather than one generic white form',()=>{
 for(const[id,color]of [['sakura','#d8f3ff'],['kai','#d8f3e9'],['enjo','#ffe1de']])assert(rule(scope+'[data-performer='+id+']').includes('--result-poster:'+color+';'),id);
 assert(rule(scope+' .battle-performance-header').includes('background:var(--result-poster,#d8f3ff);'));
});
test('result stage gives the original character a stable intrinsic-fit slot and unscaled outcome title',()=>{
 const header=rule(scope+' .battle-performance-header'),art=rule(scope+' .battle-performance-header .battle-performer-visual img');
 assert(header.includes('grid-template-columns:minmax(0,1fr) 108px;'));assert(header.includes('min-height:154px;'));
 assert(art.includes('width:108px;height:124px;object-fit:contain;'));
 const heading=rule(scope+' .battle-performance-header > h2');assert(heading.includes('font-size:26px;line-height:34px;'));
 assert(!/scale[XY]?\(|letter-spacing:\s*-/.test(css));
 for(const [,url]of css.matchAll(/url\('([^']+)'\)/g))assert.match(url,/^\/art\/owner-ui-family-20261031\/(primary|secondary|ledger|dialogue)\.webp$/);
});
test('real metrics and actual earned notes get separate restrained color bands without hiding content',()=>{
 assert(rule(scope+' .battle-result-stats > div').includes('border-left:3px solid #00a4bd;'));
 assert(rule(scope+' .battle-result-stats > div:nth-child(4)').includes('border-left-color:#d12b55;'));
 assert(rule(scope+' .battle-result-reward > strong').includes('background:#fff0a6;'));
 assert(!/display:none|visibility:hidden|line-clamp|clip-path|text-overflow:ellipsis/.test(css));
});
test('pending saves override the decorative success region; only the finite chapter portrait entrance is added',()=>{
 assert(rule(scope+' .battle-save:is([data-save-state=pending],[data-save-state=unrecorded],[data-save-state=blocked])').includes('background:#fff1cd;color:#68450b;'));
 assert(!/(?:[;{])(?:transition|content|font-family|font-face):|counter\(/.test(css));
 const ast=postcss.parse(css);ast.walkDecls('animation',decl=>assert(decl.value==='none'||decl.value==='result-hero-rise 240ms ease-out both',decl.value));
 ast.walkRules(rule=>{if(rule.parent.type==='atrule'&&rule.parent.name.endsWith('keyframes'))return;for(const selector of rule.selectors)assert(selector.startsWith(scope)||selector.startsWith('#game-container #battle-result[data-result-stage=chapter]'),selector);});
});
