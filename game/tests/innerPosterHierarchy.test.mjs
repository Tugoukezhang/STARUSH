import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{loadScenes}from'./helpers/publicShellHarness.mjs';
const setup=(page,owner=true)=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(owner);const h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage(page);return{e,h,v:h.scene._publicShell};};
test('selected equipment stage and effects precede native chooser; browsing does not persist',()=>{
 const{e,h}=setup('inventory'),raw=e.storage.getItem('starush.public-profile'),detail=h.query('.inventory-detail');
 assert(h.query('.inventory-object-stage'),'selected object gets a dedicated display bay');
 const children=detail.children;assert(children.indexOf(h.query('.inventory-detail-heading'))<children.indexOf(h.query('.inventory-effects')));assert(children.indexOf(h.query('.inventory-effects'))<children.indexOf(h.query('.inventory-chooser')));
 for(const cell of h.query('.inventory-grid').querySelectorAll('button')){h.click('[data-inventory-item='+cell.dataset.inventoryItem+']');assert.equal(h.query('.inventory-detail').dataset.item,cell.dataset.inventoryItem);assert.equal(e.document.activeElement,h.query('[data-inventory-item='+cell.dataset.inventoryItem+']'));}
 assert.equal(e.storage.getItem('starush.public-profile'),raw);h.shutdown();
});
test('tour sequence contains three native locked-state chapter controls and original selection confirmation',()=>{
 const{e,h}=setup('tour'),raw=e.storage.getItem('starush.public-profile'),sequence=h.query('.tour-stop-sequence');assert(sequence);assert.equal(sequence.getAttribute('aria-label'),'三站巡演顺序');
 const stops=sequence.querySelectorAll('.shell-chapter-option');assert.equal(stops.length,3);assert.equal(stops[0].dataset.state,'available');assert(stops[1].disabled);assert(stops[2].disabled);assert(h.query('[data-action=confirm-chapter]'));assert(h.query('[data-action=chapter-goals]'));assert.equal(e.storage.getItem('starush.public-profile'),raw);h.shutdown();
});
test('authored chassis only replaces its decoration after decode; errors and detached callbacks leave live native controls',async()=>{
 const{e,h,v}=setup('inventory'),stage=h.query('.inventory-object-stage'),image=stage?.querySelector('.inner-page-art');assert(image);let resolve;image.naturalWidth=611;image.naturalHeight=399;image.decode=()=>new Promise(r=>resolve=r);image.dispatchEvent({type:'load'});assert(image.hidden);resolve();await new Promise(r=>setImmediate(r));assert.equal(stage.dataset.innerArtState,'ready');assert(!image.hidden);
 image.dispatchEvent({type:'error'});assert.equal(stage.dataset.innerArtState,undefined);assert(stage.querySelector('.equipment-art'));assert(h.query('[data-action=equip-selected]'));
 v.showPage('tour');assert.equal(h.query('.inner-page-art'),null,'venue screen no longer loads the obsolete paper ticket');
 const plate=v.element('div','test-ticket',undefined,v.root),ticket=e.loadRuntime('systems/InnerPageArt.mjs').mountInnerPageArt(v,plate,'ticket');assert(ticket);ticket.naturalWidth=611;ticket.naturalHeight=345;ticket.decode=()=>new Promise(r=>resolve=r);ticket.dispatchEvent({type:'load'});v.showPage('inventory');resolve();await new Promise(r=>setImmediate(r));assert(ticket.hidden);h.shutdown();
});
test('legacy inventory and tour never mount owner poster assets',()=>{for(const page of['inventory','tour']){const{h}=setup(page,false);assert.equal(h.all('.inner-page-art').length,0);assert.equal(h.all('.tour-stop-sequence').length,0);h.shutdown();}});
test('poster CSS keeps raster aspect, restrained motion and explicit reduced-motion route',()=>{const css=fs.readFileSync(new URL('../src/styles/innerScreenFamily.css',import.meta.url),'utf8');assert(css.includes('.inventory-object-stage'));assert(css.includes('.tour-stop-sequence'));assert(css.includes('inner-poster-enter'));assert(css.includes('prefers-reduced-motion:reduce'));assert(css.includes('object-fit:contain'));});
