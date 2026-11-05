import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import{loadScenes}from'./helpers/publicShellHarness.mjs';
import{createRequire}from'node:module';
const postcss=createRequire(import.meta.url)('postcss');
const cssURL=new URL('../src/styles/stageUiV2.css',import.meta.url);
test('child pages keep an explicitly highlighted location root after the new navigation reset',()=>{
 const css=fs.readFileSync(cssURL,'utf8');let matched=false;postcss.parse(css).walkRules(rule=>{if(rule.selector.includes('.shell-navigation')&&rule.selector.includes('[aria-current=location]')&&rule.nodes.some(n=>n.prop==='color'&&n.value==='var(--stage-lime)'))matched=true;});assert(matched,'location root must receive the same explicit active treatment');
});
test('nonhome owner screens opt into the explicit second UI composition without changing home markup',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.TitleScene);h.scene.create();assert.equal(h.root.dataset.uiPass,'stage-v2');const model=e.storage.getItem('starush.public-profile');
 assert.equal(h.root.dataset.page,'desk');h.shutdown();const r=e.harness(e.IdolRosterScene);r.scene.create();assert.equal(r.all('.roster-headshot').length,3);assert.equal(r.query('.shell-brand').querySelectorAll('.shell-title-art').length,0);assert.equal(r.query('.shell-performer-name').querySelectorAll('.home-concept-art').length,0);assert.equal(e.storage.getItem('starush.public-profile'),model);r.shutdown();
});
test('three highresolution headshots are actual original role portraits and preview still never deploys',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.IdolRosterScene);h.scene.create();const old=e.storage.getItem('starush.public-profile'),art=e.loadRuntime('systems/MenuPortraitAvatar.mjs');
 for(const id of ['sakura','kai','enjo']){const button=h.query('[data-member='+id+']'),image=button.querySelector('.roster-headshot');assert(image);assert.equal(image.src,art.getMenuAvatarArt(id).src);assert.equal(image.width,160);h.click('[data-member='+id+']');assert.equal(h.query('.shell-performer-name').querySelector('h2').textContent,e.loadRuntime('utils/userCast.mjs').getUiPerformer(id).name);assert.equal(e.storage.getItem('starush.public-profile'),old);}
 h.shutdown();
});
test('roster tabs and explicit deployment retain their real behavior under the new presentation',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.IdolRosterScene);h.scene.create();h.click('[data-member=kai]');h.click('[data-roster-tab=dossier]');assert.equal(h.query('[data-roster-panel=dossier]').hidden,false);assert.equal(h.query('[data-roster-panel=ability]').hidden,true);h.click('[data-action=confirm-member]');assert.equal(e.profile.loadPublicProfile().selectedId,'kai');h.shutdown();
});
test('new stylesheet is opt-in, keeps home isolated and has responsive motion and visible native lettering',()=>{
 assert(fs.existsSync(cssURL),'new stage UI stylesheet missing');const css=fs.readFileSync(cssURL,'utf8');assert(css.includes('[data-ui-pass=stage-v2]'));assert(css.includes(':not([data-page=desk])'));assert(css.includes('prefers-reduced-motion'));assert(css.includes('max-width:340px'));assert(css.includes('.roster-headshot'));assert(css.includes('object-fit:cover'));assert.doesNotMatch(css,/scaleX|font-stretch|letter-spacing:\s*-/);
 postcss.parse(css).walkRules(rule=>{if(rule.parent.type==='atrule'&&rule.parent.name==='keyframes')return;assert(rule.selector.includes('[data-ui-pass=stage-v2]'),'unscoped '+rule.selector);});
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');assert(html.includes('/src/styles/stageUiV2.css'));assert(html.includes('/src/styles/tourInventoryV2.css'));
});
