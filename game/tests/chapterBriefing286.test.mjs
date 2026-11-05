import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function setup(cleared=[],chapter='opening'){
 const s=loadScenes();s.loadRuntime('utils/userCast.mjs').configureUserCast(true);s.seed(cleared,chapter);
 const h=s.harness(s.TourRouteScene);h.scene.create();return {s,h};
}

for(const [cleared,chapter,notes,ids]of [
 [[], 'opening',6,['wide_nozzle','travelling_nozzle']],
 [['opening'],'opening',3,[]],
 [['opening'],'neon',6,['rhythm_sync']],
 [['opening','neon','encore'],'raincheck',6,['rain_relay']],
])test(`reward preview agrees with actual settlement: ${chapter}/${cleared.length}`,()=>{
 const {s,h}=setup(cleared,chapter),p=s.loadRuntime('utils/publicPreparation.mjs'),profile=s.profile.loadPublicProfile();
 const before=JSON.stringify([...s.storage.values]);
 const preview=p.getChapterRewardPreview(profile,chapter,'sakura');
 assert.equal(preview.notes,notes);assert.deepEqual(Array.from(preview.equipment,x=>x.id),ids);
 assert.equal(JSON.stringify([...s.storage.values]),before,'preview is read-only');
 s.profile.recordPublicRun({runId:`reward286-${chapter}-${cleared.length}`,chapterId:chapter,performerId:'sakura',victory:true});
 const after=s.profile.loadPublicProfile();assert.equal(p.getPreparationResources(after).earned-p.getPreparationResources(profile).earned,preview.notes);
 h.shutdown();
});

test('new member first clear on replay includes their action equipment, not repeated chapter equipment',()=>{
 const {s,h}=setup(['opening']);const p=s.loadRuntime('utils/publicPreparation.mjs');
 const reward=p.getChapterRewardPreview(s.profile.loadPublicProfile(),'opening','enjo');
 assert.equal(reward.notes,3);assert.deepEqual(Array.from(reward.equipment,x=>x.id),['delayed_hammer']);h.shutdown();
});

test('chapter details expose reward objects and descriptions without changing progress',()=>{
 const{s,h}=setup();const before=JSON.stringify([...s.storage.values]);h.click('[data-chapter=opening]');
 assert.equal(h.query('dialog').dataset.chapterPresentation,'briefing294');
 assert.equal(h.query('[data-reward=notes]').querySelector('.journey-reward-value').textContent,'+6');
 assert.equal(h.all('.journey-reward-item').length,3);
 assert.equal(h.query('.journey-reward-description').hidden,true);
 h.click('[data-reward=wide_nozzle]');assert.equal(h.query('.journey-reward-description').hidden,false);
 assert.match(h.query('.journey-reward-description').textContent,/扩幅导流器.*12/);
 assert.equal(h.query('[data-reward=wide_nozzle]').getAttribute('aria-expanded'),'true');
 h.click('[data-reward=wide_nozzle]');assert.equal(h.query('.journey-reward-description').hidden,true);
 assert.equal(JSON.stringify([...s.storage.values]),before);h.shutdown();
});

test('fourth chapter has correct notes and no three-stop dead-end text',()=>{
 const{s,h}=setup(['opening','neon','encore'],'raincheck');
 assert.equal(h.query('.journey-route').getAttribute('aria-label'),'巡演章节顺序');
 assert.doesNotMatch(h.text,/三站巡演|不解锁第四站/);
 h.click('[data-chapter=raincheck]');assert.equal(h.query('[data-reward=notes]').querySelector('.journey-reward-value').textContent,'+6');
 assert.equal(h.all('.journey-reward-item').length,2);h.click('[data-action=journey-prepare]');
 assert.equal(s.profile.getPublicCampaignProgress().selectedChapterId,'raincheck');h.shutdown();
});

test('failed chapter save stays on tour and exposes the specific error outside the retired footer',()=>{
 const{s,h}=setup(['opening'],'opening');h.click('[data-chapter=neon]');
 s.storage.setItem=()=>{throw new Error('Storage unavailable');};
 h.click('[data-action=journey-prepare]');assert.equal(h.starts.length,0);
 const notice=h.all('.shell-save-notice').find(node=>node.textContent.includes('场地未能保存'));
 assert.ok(notice);for(let n=notice;n;n=n.parentNode)assert.notEqual(n.hidden,true);
 h.shutdown();
});
