import test from'node:test';import assert from'node:assert/strict';import{loadScenes}from'./helpers/publicShellHarness.mjs';
import{createRequire}from'node:module';import{RUNTIME_PAYLOAD}from'../scripts/runtime-payload.mjs';
import{fileURLToPath}from'node:url';
import fs from'node:fs';
test('roster entrance never translates the interactive scroll container',()=>{
 const css=fs.readFileSync(new URL('../src/styles/venueShell.css',import.meta.url),'utf8');
 assert.match(css,/#game-container #public-shell\[data-cast=owner-three\]\[data-shell-family=venue\]\[data-page=roster\] \.shell-content \{[^}]*animation:none;/);
 assert.match(css,/#game-container #public-shell\[data-cast=owner-three\]\[data-shell-family=venue\]\[data-page=roster\] \.shell-content \{[^}]*scroll-padding:12px;/);
});
test('owner portrait stage contains the member rail and one reserved native identity',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('roster');const saved=e.storage.getItem('starush.public-profile');
 for(const id of ['sakura','kai','enjo']){h.click('[data-member='+id+']');const stage=h.query('.roster-portrait-stage'),detail=h.query('.shell-performer-detail'),name=h.query('.shell-performer-name');assert(stage.contains(h.query('.shell-member-strip')));assert.equal(name.parentNode,stage);assert.equal(stage.children.at(-1),name);assert(detail.contains(name));assert.equal(h.query('.roster-role').textContent.startsWith(id==='sakura'?'远程':'近战'),true);assert.equal(h.query('[data-member='+id+']').getAttribute('aria-pressed'),'true');assert.equal(e.storage.getItem('starush.public-profile'),saved);assert.equal(name.querySelector('.home-concept-art'),null);assert.equal(h.query('[data-member='+id+']').querySelector('.roster-headshot').src,e.loadRuntime('systems/MenuPortraitAvatar.mjs').getMenuAvatarArt(id).src);}
 h.shutdown();
});
test('legacy roster retains its existing member rail outside the portrait stage',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(false);const h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('roster');assert(h.query('.shell-member-strip'));assert.equal(h.query('.roster-portrait-stage'),null);h.shutdown();
});
test('all three roster names use exact transparent exports with uniform native aspect, old home names stay separate',async()=>{
 const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
 const e=loadScenes(),mount=e.loadRuntime('systems/HomeConceptArt.mjs').mountHomeConceptArt,doc=e.harness(e.TitleScene).document;
 for(const[id,w,h]of [['sakura',1411,385],['kai',1431,357],['enjo',1221,338]]){
  const path='art/roster-lettering-20261028/'+id+'.png';assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===path).length,1);
  const p=doc.createElement('h2'),frame=mount({doc},p,'roster-name-'+id),svg=frame.querySelector('svg');assert.equal(svg.getAttribute('viewBox'),`0 0 ${w} ${h}`);assert.equal(svg.getAttribute('preserveAspectRatio'),'xMidYMid meet');assert.equal(svg.querySelector('image').getAttribute('href'),path);
  const{data,info}=await sharp(fileURLToPath(new URL('../public/'+path,import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height],[w,h]);let visible=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=data[(y*w+x)*4+3];if(a)visible++;if(Math.min(x,y,w-1-x,h-1-y)<16)assert.equal(a,0);}assert(visible>10000&&visible<w*h*.8);
 }
});
