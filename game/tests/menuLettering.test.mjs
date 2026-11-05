import assert from 'node:assert/strict';import{test}from'node:test';import fs from'node:fs';import crypto from'node:crypto';import{loadScenes}from'./helpers/publicShellHarness.mjs';
function fixture(page='roster',enabled=true,cached=false){const l=loadScenes();l.loadRuntime('utils/userCast.mjs').configureUserCast(enabled);if(cached){const create=l.document.createElement;l.document.createElement=tag=>{const e=create(tag);if(tag==='img'){e.complete=true;e.naturalWidth=1536;}return e;};}const v=l.harness(l.TitleScene,{suppressDebugAutoStart:true,openPage:page});v.scene.create();return{l,v,h:v.query('h1'),image:v.query('.shell-title-art')};}
test('original source mappings remain intact; the nonhome v2 view no longer mounts raster titles',()=>{const l=loadScenes(),a=l.loadRuntime('systems/PublicMenuArt.mjs').PUBLIC_TITLE_ART;assert.deepEqual(JSON.parse(JSON.stringify(a.rows)),{roster:0,preflight:2});assert.equal(a.src,'art/menu-lettering-20261021/titles.png');assert.equal(a.single.tour,'art/inner-poster-family-20261025/tour-title.png');assert.equal(a.single.inventory,'art/inner-poster-family-20261025/inventory-title.png');});
test('every redesigned title is real accessible text with no decorative window or load-dependent state',()=>{
 for(const[p,label]of[['roster','偶像名册'],['tour','巡演路线'],['preflight','出战准备'],['inventory','装备背包']]){const{v,h,image}=fixture(p);assert.equal(image,null);assert.equal(h.textContent,label);assert.equal(h.getAttribute('aria-label'),label);assert.equal(h.dataset.lettered,undefined);assert.equal(h.dataset.titleArt,undefined);assert.equal(v.query('.shell-title-window'),null);assert.equal(v.root.dataset.uiPass,'stage-v2');v.shutdown();}
});
test('nonhome navigation keeps exact next heading and original profile without stale image callbacks',()=>{
 const{l,v,h}=fixture('preflight');const before=JSON.stringify([...l.storage.values]);assert(v.query('[data-action=start]'));v.scene._publicShell.showPage('inventory');const next=v.query('h1');assert.notEqual(next,h);assert.equal(next.textContent,'装备背包');assert.equal(v.query('.shell-title-art'),null);assert.equal(JSON.stringify([...l.storage.values]),before);assert.equal(v.starts.length,0);v.shutdown();
});
test('legacy and home text remain unchanged and cached unrelated images cannot switch a v2 title',()=>{
 for(const[p,on,label]of[['roster',false,'偶像名册'],['desk',true,'ST☆RUSH'],['workshop',false,'成员训练']]){const{v,h,image}=fixture(p,on);assert.equal(image,null);assert.equal(h.textContent,label);assert.equal(h.dataset.titleArt,undefined);v.shutdown();}
 const{v,h}=fixture('preflight',true,true);assert.equal(h.dataset.lettered,undefined);assert.equal(h.textContent,'出战准备');v.shutdown();
});
test('native title and button family has explicit typography while original title pixels remain unchanged',()=>{
 const css=fs.readFileSync(new URL('../src/styles/stageUiV2.css',import.meta.url),'utf8');assert(css.includes('.shell-brand h1'));assert(css.includes('font-size:21px;line-height:27px'));assert.doesNotMatch(css,/scaleX|font-stretch/);
 const bytes=fs.readFileSync(new URL('../public/art/menu-lettering-20261021/titles.png',import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase(),'D6CA7783ED1E4948E1280FAE3966FAA86C5CC69B3F84F6967774E8A713798E57');
});
