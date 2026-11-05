import test from 'node:test';
import assert from 'node:assert/strict';
import {PUBLIC_PRODUCT_MODULES,validatePublicProductFramework} from '../src/utils/publicProductModules.mjs';
import {PUBLIC_SHELL_ROUTES,getPublicShellRoute} from '../src/utils/publicShellNavigation.mjs';
const api=await import('../src/utils/publicProductHub.mjs').catch(()=>({}));
const need=()=>{assert.equal(typeof api.getProductHubSections,'function','whole-product hub model missing');return api;};
test('all registered modules have one real destination or an explicit service dependency, not duplicate disconnected reports',()=>{
 const sections=need().getProductHubSections({clears:0});
 const rows=sections.flatMap(s=>s.entries);
 assert.equal(rows.length,PUBLIC_PRODUCT_MODULES.length);
 assert.deepEqual(rows.map(r=>r.id).sort(),PUBLIC_PRODUCT_MODULES.map(m=>m.id).sort());
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 for(const row of rows){assert(row.label&&row.description&&row.icon);assert(getPublicShellRoute(row.page),row.id);assert(['available','framework','service-required'].includes(row.status));}
 for(const id of ['cloud','social','platform'])assert.equal(rows.find(r=>r.id===id).status,'service-required');
 for(const id of ['bonds','venue'])assert.equal(rows.find(r=>r.id===id).status,'framework');
 assert(Object.isFrozen(sections));assert(sections.every(s=>Object.isFrozen(s.entries)));
});
test('whole-product pages are real child routes with five stable roots and no registry validation errors',()=>{
 need();assert.equal(PUBLIC_SHELL_ROUTES.length,21);
 assert.deepEqual(validatePublicProductFramework({routes:PUBLIC_SHELL_ROUTES}),[]);
 for(const page of ['backstage','lounge','venue','events','recruitment','sideplay','services']){const r=getPublicShellRoute(page);assert(r,page);assert.equal(r.rootId,'desk');assert.equal(r.parentId,['backstage','lounge','venue'].includes(page)?'desk':'backstage');}
 assert.equal(PUBLIC_SHELL_ROUTES.filter(r=>r.navigation).length,5);
});
