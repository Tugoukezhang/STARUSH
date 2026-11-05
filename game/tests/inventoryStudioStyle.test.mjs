import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const file=new URL('../src/styles/inventoryStudioV3.css',import.meta.url);
test('equipment studio has a separately scoped stylesheet registered after roster styles',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert(html.includes('/src/styles/inventoryStudioV3.css'));
 assert(html.indexOf('/src/styles/inventoryStudioV3.css')>html.indexOf('/src/styles/rosterShowcaseV3.css'));
 assert(fs.existsSync(file));
});
test('studio reserves a real item stage and readable native identity, not baked name art',()=>{
 assert(fs.existsSync(file));const css=fs.readFileSync(file,'utf8');
 assert(css.includes('[data-inventory-layout=showcase]'));
 for(const name of ['.inventory-object-stage','.inventory-selection-copy','.inventory-effects','.inventory-availability','.inventory-grid','.inventory-footer'])assert(css.includes(name),name);
 assert(css.includes('art/roster-studio-20261031/stage.webp'));
 assert(css.includes('object-fit:contain'));
 assert(!/scaleX|transition:all|infinite|font-size:[^;]*vw/.test(css));
});
test('studio controls have explicit responsive space, focus and reduced motion',()=>{
 assert(fs.existsSync(file));const css=fs.readFileSync(file,'utf8');
 assert(css.includes('min-height:44px'));
 assert(css.includes(':focus-visible'));
 assert(css.includes('prefers-reduced-motion:reduce'));
 assert(css.includes('max-height:600px'));
 assert(css.includes('.inventory-chooser > summary'));
 assert(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))'));
});
test('directory native icon cannot inherit an absolute full-page slot or compound disclosure rotation',()=>{
 const css=fs.readFileSync(file,'utf8');
 assert(css.includes('.inventory-chooser > summary > .inventory-chooser-icon {position:static;display:grid;place-items:center;flex:0 0 24px;width:24px;height:24px;'));
 assert(css.includes('.inventory-chooser-icon svg {position:static;inset:auto;width:22px;height:22px;'));
 assert(css.includes('rotate:none;transform:rotate(90deg)'));
 assert(css.includes('.inventory-chooser > summary > .inventory-chooser-action {display:none;}'));
});
test('inventory retains the existing visually clipped focusable page heading used by showPage',()=>{
 const css=fs.readFileSync(file,'utf8');
 assert(!css.includes('.shell-content > .shell-page-heading {display:none;}'));
 assert(css.includes('.shell-content > .shell-page-heading {display:block;position:absolute;width:1px;height:1px;'));
});
