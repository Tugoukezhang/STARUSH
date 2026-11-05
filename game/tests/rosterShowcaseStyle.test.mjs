import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const postcss=createRequire(import.meta.url)('postcss'),cssFile=new URL('../src/styles/rosterShowcaseV3.css',import.meta.url);
test('one explicitly registered stylesheet owns only the current roster composition',()=>{
 assert(fs.existsSync(cssFile),'new whole-screen roster style exists');const css=fs.readFileSync(cssFile,'utf8');assert(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').includes('/src/styles/rosterShowcaseV3.css'));
 postcss.parse(css).walkRules(r=>{if(r.parent.type==='atrule'&&r.parent.name==='keyframes')return;assert(r.selector.includes('[data-page=roster][data-roster-layout=showcase]'),r.selector);});
 assert(!/font-size:\s*[^;]*(?:vw|cqw)|letter-spacing:\s*-/.test(css));assert(!css.includes('menu-art'));assert(css.includes('prefers-reduced-motion:reduce'));assert(css.includes(':focus-visible'));
});
test('portrait, rail, role command and all data tabs have stable native mobile constraints',()=>{
 assert(fs.existsSync(cssFile));const css=fs.readFileSync(cssFile,'utf8');for(const cls of ['roster-portrait-stage','roster-headshot','roster-role-emblem','roster-action-visual','roster-preparation-rank','roster-inspector-tab','shell-selection-footer'])assert(css.includes('.'+cls));
 assert(css.includes('roster-studio-20261031/stage.webp'));assert(css.includes('max-width:340px'));assert(css.includes('min-height:44px'));assert(css.includes('overflow-wrap:anywhere'));assert(css.includes('aspect-ratio:1'));assert(!/filter:\s*blur/.test(css));
});
test('preparation overrides inherited white span text and explicit old grid rows',()=>{
 const rules=[];postcss.parse(fs.readFileSync(cssFile,'utf8')).walkRules(r=>rules.push(r));
 const rule=suffix=>{const r=rules.find(r=>r.selector.endsWith(suffix));assert(r,'specific preparation override exists: '+suffix);return r;},decl=(r,key)=>r.nodes.find(n=>n.prop===key)?.value;
 assert.equal(decl(rule('.shell-member-preparation .roster-preparation-rank'),'color'),'var(--cast-accent)');
 assert.equal(decl(rule('.shell-member-preparation .roster-preparation-loadout'),'color'),'#41545e');
 assert.equal(decl(rule('.shell-member-preparation button :is(span,svg)'),'color'),'inherit');
 assert.equal(decl(rule('.shell-member-preparation > strong'),'grid-row'),'1');
 assert.equal(decl(rule('.shell-member-preparation button'),'grid-row'),'1');
 assert.equal(decl(rule('.shell-member-preparation button'),'grid-column'),'2');
 assert.equal(decl(rule('.shell-member-preparation button'),'align-self'),'start');
 assert.equal(decl(rule('.shell-member-preparation > strong'),'gap'),'6px');
});
