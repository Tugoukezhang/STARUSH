import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),postcss=require('postcss'),css=postcss.parse(fs.readFileSync(new URL('../src/styles/homeDemo.css',import.meta.url),'utf8')),S='#game-container #public-shell[data-core-journey=true][data-home-demo=true][data-page=desk]';
const rules=selector=>{const a=[];css.walkRules(r=>{if(r.selector===selector&&r.parent.type==='root')a.push(r);});return a;},decl=r=>Object.fromEntries(r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value])),last=selector=>{const a=rules(selector);assert(a.length,'rule exists: '+selector);return decl(a.at(-1));};
test('actual ready concept crops, not hidden native labels, receive finite navigation entrance',()=>{
 const d=last(S+'[data-motion] [data-concept-state=ready] > .home-concept-art');assert.match(d.animation,/home-visible-enter 300ms/);assert.match(d.animation,/backwards/);
 assert.match(last(S+'[data-motion] [data-portrait-state=ready] .home-portrait-rig').animation,/home-visible-portrait 360ms/);
 assert.equal(last(S+' > .shell-navigation')['--home-visible-delay'],'250ms');assert.equal(last(S+' .lobby-start > .lobby-primary-actions')['--home-visible-delay'],'210ms');
});
test('wide original chibi portraits have explicit centered framing, without replacing identity or stretching',()=>{
 for(const id of ['kai','enjo']){const d=last(S+' .lobby-member-visual[data-performer='+id+'] .lobby-character');assert.equal(d['object-fit'],'contain');assert.equal(d['object-position'],'center');assert.equal(d.position,'absolute');assert(parseFloat(d.width)>100);assert(parseFloat(d.top)<20);assert(parseFloat(d.height)>=70&&parseFloat(d.height)<=80);}
});
test('mission route tap target is44px and pressed buttons keep their layout and hit rectangles',()=>{
 const d=last(S+' .lobby-mission button');assert.equal(d.width,'44px');assert.equal(d['min-width'],'44px');assert.equal(d.height,'44px');
 assert.equal(last(S+' button:not(:disabled):active').transform,'none');const art=last(S+' button:not(:disabled):active > .home-concept-art');assert.equal(art.translate,'0 2px');assert.equal(art.animation,'none');
});
test('entry keyframes only composite opacity/translate and leave portrait transform-origin contract alone',()=>{
 for(const name of ['home-visible-enter','home-visible-portrait']){let k;css.walkAtRules('keyframes',a=>{if(a.params===name)k=a;});assert(k,name);k.walkDecls(d=>assert(['opacity','translate'].includes(d.prop),name+' '+d.prop));}
 assert(!last(S+'[data-motion] [data-portrait-state=ready] .home-portrait-rig').transform,'existing translateX centering and child breathing remain separate');
});
test('new visible-art motion has explicit reduced-motion zero-motion variants',()=>{
 let r;css.walkAtRules('media',a=>{if(a.params==='(prefers-reduced-motion:reduce)'&&a.toString().includes('[data-motion] [data-concept-state=ready]'))r=a;});assert(r,'dedicated visible-art reduced motion block');assert(r.toString().includes('.home-concept-art'));assert(r.toString().includes('.home-portrait-rig'));assert(r.toString().includes('animation:none'));assert(r.toString().includes('transition:none'));assert(!r.toString().includes('.01ms'));
});
