import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';
const PREFIX='#game-container #public-shell[data-core-journey=true][data-home-demo=true][data-page=desk]';
const sheet=()=>postcss.parse(fs.readFileSync(new URL('../src/styles/homeDemo.css',import.meta.url),'utf8'));
function rule(suffix,media){let result={};sheet().walkRules(r=>{if(r.selector!==PREFIX+' '+suffix)return;if(media?r.parent.params!==media:r.parent.type!=='root')return;for(const n of r.nodes)if(n.type==='decl')result[n.prop]=n.value;});return result;}
test('home details stays nonmodal with a sticky readable summary and bounded native scrolling',()=>{
 const details=rule('.lobby-details[open]'),header=rule('.lobby-details[open] > summary');
 assert.equal(details['overscroll-behavior'],'contain');assert.equal(details['scroll-padding-top'],'68px');
 assert.equal(details['scrollbar-gutter'],'stable');assert.equal(header.position,'sticky');assert.equal(header.top,'0');
 assert.equal(header['min-height'],'56px');assert.equal(header['font-size'],'18px');
});
test('native summary has fixed44px target and distinct book and close glyph states',()=>{
 assert.equal(rule('.lobby-details > summary')['min-height'],'44px');
 assert.equal(rule('.home-details-close-icon').display,'none');
 assert.equal(rule('.lobby-details[open] > summary .home-details-open-icon').display,'none');
 assert.equal(rule('.lobby-details[open] > summary .home-details-close-icon').display,'block');
 assert.equal(rule('.lobby-details > summary svg').width,'24px');
});
test('progress uses three readable rows instead of squeezing chapter names into narrow columns',()=>{
 const route=rule('.lobby-details .shell-progress-route'),step=rule('.lobby-details .shell-progress-step');
 assert.equal(route.display,'grid');assert.equal(route['min-height'],'44px');
 assert.equal(step.display,'grid');assert.equal(step['grid-template-columns'],'28px minmax(0,1fr)');
 assert.equal(step['min-height'],'36px');
});
test('secondary body and actual action labels have a14px floor without shrinking to fit',()=>{
 for(const suffix of ['.lobby-details .lobby-section-kicker','.lobby-details .lobby-session-copy span','.lobby-details .lobby-progress :is(span,b)','.lobby-details :is(.lobby-session-action,.lobby-record-action)','.lobby-details .lobby-tour-next :is(p,li,blockquote)']){
  assert.equal(rule(suffix)['font-size'],'14px',suffix);
 }
 assert.equal(rule('.lobby-details .lobby-session-copy strong')['font-size'],'17px');
 assert.equal(rule('.lobby-details :is(.lobby-session-action,.lobby-record-action)')['min-height'],'44px');
});
test('opening animates opacity only, not sheet geometry or clickable target transforms',()=>{
 const animation=rule('.lobby-details[open][data-reveal=open] > :not(summary)').animation;
 assert.match(animation,/home-details-reveal 180ms/);
 let frame;sheet().walkAtRules('keyframes',r=>{if(r.params==='home-details-reveal')frame=r;});
 assert(frame);assert(!/transform|translate|scale|height|width/.test(frame.toString()));
 assert(!rule('.lobby-details[open]').animation);
});
test('reduced motion explicitly disables the new content feedback and shortcut press transitions',()=>{
 assert.equal(rule('.lobby-details[open][data-reveal=open] > :not(summary)','(prefers-reduced-motion:reduce)').animation,'none');
 assert.equal(rule('.lobby-shortcut > :is(.menu-art,svg,.lobby-shortcut-copy)','(prefers-reduced-motion:reduce)').transition,'none');
});
test('sheet focus and long real records have a safe scroll margin and wrapping policy',()=>{
 assert.equal(rule('.lobby-details :is(button,summary)')['scroll-margin-top'],'68px');
 assert.equal(rule('.lobby-details :is(strong,p,span)')['overflow-wrap'],'anywhere');
 assert.equal(rule('.lobby-details .lobby-session-overview')['grid-template-columns'],'minmax(0,1fr) auto');
});
test('sheet uses clean neutral backing instead of stretching an authored interior across the reading surface',()=>{
 assert.equal(rule('.lobby-details[open]')['border-image'],'none');
 assert.equal(rule('.lobby-details[open]').background,'#fff');
 assert.equal(rule('.lobby-details[open] > summary')['font-size'],'18px');
 assert.equal(rule('.lobby-details .lobby-preparation').padding,'8px 0');
});
test('collapsed warning has a readable bounded target and does not hide behind a generic book alone',()=>{
 assert.equal(rule('.home-details-warning').display,'none');
 assert.equal(rule('.lobby-details[data-save-warning=pending]:not([open]) > summary').width,'92px');
 assert.equal(rule('.lobby-details[data-save-warning=recovery]:not([open]) > summary').width,'92px');
 assert.equal(rule('.lobby-details:not([open]) .home-details-warning')['font-size'],'14px');
});
test('warning target reserves nameplate room even in narrow tall windows',()=>{
 assert.equal(rule('.shell-content:has(.lobby-details:not([data-save-warning=none])) .lobby-member-name')['max-width'],'calc(100% - 128px)');
});
test('letterboxed narrow tall viewports use compact home geometry instead of full viewport height',()=>{
 const media='(min-height:621px) and (max-width:348px)';
 assert.equal(rule('.lobby-shortcut',media).height,'48px');
 assert.equal(rule('.lobby-shortcut[data-action=story-journal]',media).top,'182px');
 assert.equal(rule('.lobby-member-name',media).bottom,'100px');
 assert.equal(rule('.lobby-mission p',media).display,'none');
 const narrow='(min-height:621px) and (max-width:300px)';
 assert.equal(rule('.lobby-shortcut',narrow).height,'44px');
 assert.equal(rule('.lobby-shortcut[data-action=prepare]',narrow).top,'126px');
 assert.equal(rule('.lobby-shortcut[data-action=story-journal]',narrow).top,'130px');
 assert.equal(rule('.lobby-shortcut[data-action=story-journal]',narrow).right,'12px');
 assert.equal(rule('.lobby-shortcut[data-action=story-journal]',narrow).left,'auto');
});
