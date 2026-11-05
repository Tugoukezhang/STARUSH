import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {loadScenes} from './helpers/publicShellHarness.mjs';
function setup(page='desk',owner=true){const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(owner);const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,...(page==='desk'?{}:{openPage:page})});h.scene.create();return{e,h,v:h.scene._publicShell};}
test('owner journey declares a single venue family but unrelated and legacy pages remain scoped out',()=>{
 const {h,v}=setup();for(const page of ['desk','roster','inventory','tour']){v.showPage(page);assert.equal(v.root.dataset.shellFamily,'venue',page);}v.showPage('growth');assert.equal(v.root.dataset.shellFamily,'legacy');h.shutdown();
 const legacy=setup('desk',false);assert.equal(legacy.v.root.dataset.shellFamily,'legacy');legacy.h.shutdown();
});
test('member change uses the existing bottom navigation rather than a patch floating over the portrait',()=>{
 const {h}=setup();assert.equal(h.query('.home-change-member'),null);const change=h.query('[data-action=choose-member]');assert(change);assert.equal(change.dataset.nav,'roster');assert.equal(change.parentNode.className,'shell-navigation');assert(h.query('[data-action=portrait-interact]'));h.shutdown();
});
test('all three inventory names have their own stable semantic label separated from the slot description',()=>{
 const {h,v,e}=setup('inventory'),saved=e.storage.getItem('starush.public-profile');
 for(const id of ['sakura','kai','enjo']){h.click('[data-member='+id+']');const context=h.query('.inventory-context');assert(context.querySelector('.inventory-member-name'));assert(context.querySelector('.inventory-slot-count'));assert.equal(context.dataset.performer,id);assert.equal(v.root.dataset.presentationMember,id);}
 assert.equal(e.storage.getItem('starush.public-profile'),saved);h.shutdown();
});
test('roster previews theme the displayed role without deploying it or changing the home role',()=>{
 const {h,v,e}=setup('roster');const saved=e.storage.getItem('starush.public-profile');h.click('[data-member=kai]');assert.equal(v.root.dataset.presentationMember,'kai');assert.equal(h.query('[data-roster-member=kai]').dataset.selection,'candidate');assert.equal(e.storage.getItem('starush.public-profile'),saved);v.showPage('desk');assert.equal(v.root.dataset.presentationMember,'sakura');h.shutdown();
});
test('new CTA uses one uniform transparent component, while preserving the original reference bank for old clients',()=>{
 const {h,e}=setup(),art=e.loadRuntime('systems/HomeConceptArt.mjs'),frame=art.mountHomeConceptArt({doc:h.document},h.document.createElement('button'),'start');
 const svg=frame.querySelector('svg');assert.equal(svg.getAttribute('viewBox'),'0 0 1536 384');assert.equal(svg.getAttribute('preserveAspectRatio'),'xMidYMid meet');assert.equal(svg.querySelector('image').getAttribute('href'),'art/venue-shell-20261026/start.png');assert(fs.existsSync(new URL('../public/art/home-integrity-20261025/start.png',import.meta.url)));h.shutdown();
});
test('venue stylesheet covers the actual journey and both narrow viewports, preserving reduction and native text',()=>{
 const css=fs.readFileSync(new URL('../src/styles/venueShell.css',import.meta.url),'utf8'),html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert(html.includes('/src/styles/venueShell.css'));assert(css.includes('data-shell-family=venue'));for(const cls of ['.lobby-mission','.roster-portrait-stage','.inventory-member-name','.shell-navigation','.shell-chapter-option'])assert(css.includes(cls));
 assert(css.includes('prefers-reduced-motion:reduce'));assert(css.includes('max-width:340px'));assert(css.includes('letter-spacing:0'));assert(!css.includes('transition:all'));assert(css.includes('[data-page=desk][data-motion] [data-concept-state=ready] > .home-concept-art {animation:home-visible-enter 280ms'));assert(css.includes('animation:none!important;transition:none!important;'));assert(css.includes('.inventory-object-stage[data-inner-art-state=ready] {aspect-ratio:611 / 399;background:'));
});
