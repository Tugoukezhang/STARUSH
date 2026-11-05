import assert from 'node:assert/strict';
import test from 'node:test';
import {loadScenes} from './helpers/publicShellHarness.mjs';

test('chapter availability is distinct from selection and never unlocks locked rows',()=>{
 const e=loadScenes(),v=e.harness(e.TourRouteScene);v.scene.create();
 const current=v.query('.shell-chapter-option[data-chapter=opening]');
 assert.equal(current.dataset.state,'available');assert.equal(current.getAttribute('aria-pressed'),'true');
 for(const id of ['neon','encore']){const row=v.query('.shell-chapter-option[data-chapter='+id+']');assert.equal(row.dataset.state,'locked');assert.equal(row.disabled,true);assert(row.querySelector('.shell-chapter-state').textContent.includes('后开放'));}
 v.click('.shell-chapter-option[data-chapter=neon]');assert.equal(e.model().chapter.id,'opening');v.shutdown();
});
test('cleared chapters retain cleared semantics even while another row is previewed',()=>{
 const e=loadScenes();e.seed(['opening'],'opening');const v=e.harness(e.TourRouteScene);v.scene.create();
 assert.equal(v.query('.shell-chapter-option[data-chapter=opening]').dataset.state,'cleared');
 v.click('.shell-chapter-option[data-chapter=neon]');
 assert.equal(v.query('.shell-chapter-option[data-chapter=opening]').dataset.state,'cleared');
 assert.equal(v.query('.shell-chapter-option[data-chapter=neon]').dataset.state,'available');
 assert.equal(e.model().chapter.id,'opening','preview alone must not write selected chapter');v.shutdown();
});
test('desk route exposes actual completed, available and locked states',()=>{
 const e=loadScenes();e.seed(['opening'],'neon');const v=e.harness(e.TitleScene);v.scene.create();
 assert.deepEqual(v.all('.shell-progress-step').map(n=>n.dataset.state),['cleared','available','locked']);
 assert.match(v.query('[data-action=start]').textContent,/开始公演/);v.shutdown();
});
test('member preview distinguishes current performer from candidate without writing storage',()=>{
 const e=loadScenes(),v=e.harness(e.IdolRosterScene);v.scene.create();
 assert.equal(v.query('.shell-performer-detail').dataset.selection,'current');
 v.click('[data-member=venus]');assert.equal(v.query('.shell-performer-detail').dataset.selection,'candidate');
 assert.equal(e.model().member.id,'sakura');v.shutdown();
});
test('equipment owned, equipped and locked hooks preserve existing preparation effects',()=>{
 const e=loadScenes();e.seed(['opening','neon','encore']);
 const view=new (e.loadRuntime('systems/PublicShellView.mjs').PublicShellView)(e.harness(e.TitleScene).scene,{page:'workshop'});
 const first=view.root.querySelector('.workshop-equipment');assert.equal(first.dataset.state,'available');
 first.click();assert.equal(view.root.querySelector('.workshop-equipment').dataset.state,'equipped');
 assert.match(view.root.querySelector('.workshop-equipment').querySelector('.workshop-equipment-state').textContent,/已装备/);
 view.destroy();
 const fresh=loadScenes();const empty=new (fresh.loadRuntime('systems/PublicShellView.mjs').PublicShellView)(fresh.harness(fresh.TitleScene).scene,{page:'workshop'});
 for(const row of empty.root.querySelectorAll('.workshop-equipment')){assert.equal(row.dataset.state,'locked');assert.equal(row.disabled,true);}empty.destroy();
});
