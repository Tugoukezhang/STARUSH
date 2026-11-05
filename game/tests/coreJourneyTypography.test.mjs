import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');
const core='#game-container #public-shell[data-core-journey=true]';
const rule=selector=>{
 const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return [...css.matchAll(new RegExp(escaped+' \\{([^}]+)\\}','g'))].map(match=>match[1]).join(';');
};
const type=(selector,size,line)=>{
 const declaration=rule(selector);
 assert.match(declaration,new RegExp('font-size:'+size+'px(?:;|$)'),selector+' size');
 assert.match(declaration,new RegExp('line-height:'+line+'px(?:;|$)'),selector+' line height');
};

test('member action copy stays readable beneath the original portrait and name',()=>{
 type(core+'[data-page=roster] .shell-action-detail p',14,22);
 type(core+'[data-page=roster] .shell-action-detail h3',16,22);
 type(core+'[data-page=roster] .shell-performer-name h2',20,28);
});

test('preflight secondary actions have a deliberate label size, not inherited metadata sizing',()=>{
 const selector=core+' .preflight-links button';
 type(selector,14,22);
 assert.match(rule(selector),/font-weight:700(?:;|$)/);
 assert.match(rule(selector),/min-height:44px(?:;|$)/);
 const label=rule(selector+' > span');
 for(const property of ['font-size','line-height','font-weight'])
  assert.match(label,new RegExp(property+':inherit(?:;|$)'),property+' reaches the actual label despite narrow-screen overrides');
});

test('preflight title, body, selected member and metadata keep distinct reading levels',()=>{
 type(core+' .preflight-hero-copy h2',21,28);
 type(core+' .preflight-hero-copy p',13,20);
 type(core+' .preflight-team-copy strong',15,22);
 type(core+' .preflight-team-copy span',13,20);
 type(core+'[data-page=preflight] .shell-content > .preflight-goal',13,21);
});

test('member and preflight confirmation commands stand above supporting metadata',()=>{
 for(const page of ['roster','preflight'])
  type(core+'[data-page='+page+'] .shell-selection-footer .shell-primary',17,24);
 type(core+'[data-page=preflight] .preflight-confirmation',13,20);
});

test('sword caption reserves the original wider weapon slot without resizing the portrait',()=>{
 const declaration=rule(core+' .preflight-hero[data-performer=kai] .preflight-hero-copy');
 assert.match(declaration,/max-width:calc\(58% - 18px\)/);
 assert(!/height:|transform:|right:/.test(declaration),'only the caption may change');
});
