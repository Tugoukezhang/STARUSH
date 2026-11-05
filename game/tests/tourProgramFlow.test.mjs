import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes, plain} from './helpers/publicShellHarness.mjs';

function setup({owner=true, scene='TitleScene', unlocked=true, data}={}) {
  const e=loadScenes();
  e.loadRuntime('utils/userCast.mjs').configureUserCast(owner);
  if(unlocked)e.seed(['opening','neon']);
  const h=e.harness(e[scene],data);
  h.scene.create();
  const v=h.scene._publicShell;
  if(v.page!=='tour')v.showPage('tour');
  return {e,h,v};
}

test('program marker belongs only to the owner tour main',()=>{
  const {h,v}=setup();
  assert.equal(h.query('.shell-content').dataset.tourPresentation,'program');
  assert.equal(h.query('.shell-content').dataset.tourLayout,'venue');
  assert.equal(h.root.dataset.tourPresentation,undefined);
  v.showPage('inventory');
  assert.equal(h.query('[data-tour-presentation]'),null);
  h.shutdown();
  const old=setup({owner:false});
  assert.equal(old.h.query('[data-tour-presentation]'),null);
  assert.equal(old.h.query('.tour-story-title'),null);
  old.h.shutdown();
});

test('each owner preview captions the actual authored story title without saving',()=>{
  const {e,h}=setup(),before=e.storage.getItem('starush.public-profile');
  const {getChapterContent}=e.loadRuntime('utils/publicChapterContent.mjs');
  for(const id of ['opening','neon','encore']){
    h.click('[data-chapter='+id+']');
    const title=h.query('.tour-story-title');
    assert.ok(title);
    assert.equal(title.parentNode,h.query('.tour-venue-caption'));
    assert.equal(title.textContent,'\u5e8f\u5e55 \u00b7 '+getChapterContent(id).story.title);
    assert.equal(title.querySelector('img'),null);
    assert.equal(e.storage.getItem('starush.public-profile'),before);
  }
  h.shutdown();
});

test('owner stop names and stop/command icons are native rather than baked lettering or bitmaps',()=>{
  const {e,h}=setup();
  for(const chapter of e.model().chapters){
    const row=h.query('[data-chapter='+chapter.id+']');
    assert.equal(row.querySelector('strong').textContent,chapter.name);
    assert.ok(!row.querySelector('.home-concept-art'));
    assert.equal(row.querySelector('.menu-art'),null);
    assert.ok(row.querySelector('svg'));
  }
  for(const action of ['confirm-chapter','chapter-goals']){
    const button=h.query('[data-action='+action+']');
    assert.equal(button.querySelector('img'),null);
    assert.ok(button.querySelector('svg'));
  }
  assert.equal(h.query('[data-action=confirm-chapter]').getAttribute('aria-label'),'\u786e\u8ba4\u573a\u5730\u5e76\u67e5\u770b\u51c6\u5907');
  assert.equal(h.query('.shell-selection-footer').querySelectorAll('button').length,1);
  h.shutdown();
});

test('owner inline confirmation saves the selected chapter and opens preflight rather than desk',()=>{
  for(const id of ['opening','neon','encore']){
    const {e,h,v}=setup();
    e.profile.selectPublicPerformer('kai');
    v.render();
    const before=plain(e.profile.loadPublicProfile());
    h.click('[data-chapter='+id+']');
    h.click('[data-action=confirm-chapter]');
    assert.equal(v.page,'preflight');
    assert.equal(h.starts.length,0);
    const after=plain(e.profile.loadPublicProfile());
    assert.deepEqual(after,{...before,campaign:{...before.campaign,selectedChapterId:id}});
    assert.equal(h.query('.preflight-team').dataset.performerId,'kai');
    h.click('[data-action=start]');
    assert.equal(h.starts.at(-1)[1].campaignChapterId,id);
    assert.equal(h.starts.at(-1)[1].performerId,'kai');
    h.shutdown();
  }
});

test('direct TourRouteScene confirmation uses the existing preflight adapter and return context',()=>{
  const {e,h}=setup({scene:'TourRouteScene'});
  h.click('[data-chapter=neon]');
  h.click('[data-action=confirm-chapter]').click();
  assert.deepEqual(plain(h.starts),[['TitleScene',{suppressDebugAutoStart:true,openPage:'preflight',shellReturnPage:'tour'}]]);
  assert.equal(e.profile.loadPublicProfile().campaign.selectedChapterId,'neon');
  const data=h.starts[0][1];
  h.shutdown();
  const next=e.harness(e.TitleScene,data);next.scene.create();
  assert.equal(next.root.dataset.page,'preflight');
  assert.equal(next.query('[data-preflight-manifest]').dataset.chapterId,'neon');
  next.shutdown();
});

test('same-chapter confirmation preserves existing transient route and arrangement handoffs',()=>{
  const {e,h,v}=setup({scene:'TourRouteScene'});
  const context={stageId:1,performerId:'sakura',campaignChapterId:'opening'};
  v.routeSelection=e.loadRuntime('utils/publicRoutePlan.mjs').createPublicRoutePlan('east',context);
  v.arrangementPlan=e.loadRuntime('utils/publicArrangementPlan.mjs').createArrangementPlan(['wide_brush','echo'],context);
  const expected=plain(v.getArrangementHandoff());
  h.click('[data-action=confirm-chapter]');
  assert.deepEqual(plain(h.starts[0][1]),{suppressDebugAutoStart:true,openPage:'preflight',...expected,shellReturnPage:'tour'});
  h.shutdown();
});

test('owner goals remain a separate explicit save-and-goals command',()=>{
  for(const scene of ['TitleScene','TourRouteScene']){
    const {e,h,v}=setup({scene});
    h.click('[data-chapter=neon]');h.click('[data-action=chapter-goals]');
    assert.equal(e.profile.loadPublicProfile().campaign.selectedChapterId,'neon');
    if(scene==='TitleScene')assert.equal(v.page,'goals');
    else assert.equal(h.starts[0][1].openPage,'goals');
    h.shutdown();
  }
});

test('save failure or revoked unlock never navigates and retains visible failure status',()=>{
  for(const action of ['confirm-chapter','chapter-goals'])for(const fault of ['quota','reset']){
    const {e,h,v}=setup({scene:'TourRouteScene'});
    h.click('[data-chapter=neon]');
    if(fault==='quota')e.storage.setItem=()=>{throw Error('tour program quota fixture');};
    else e.storage.removeItem('starush.public-profile');
    const before=e.storage.getItem('starush.public-profile');
    h.click('[data-action='+action+']');
    assert.equal(v.page,'tour');assert.equal(h.starts.length,0);
    assert.equal(e.storage.getItem('starush.public-profile'),before);
    assert.match(h.query('.shell-selection-footer').querySelector('[role=status]').textContent,/\u573a\u5730\u672a\u80fd\u4fdd\u5b58\u6216\u5df2\u4e0d\u53ef\u7528/);
    assert.equal(v.selection.chapterId,e.model().chapter.id);
    h.shutdown();
  }
});

test('fresh locked previews and cancellation cannot unlock or write a chapter',()=>{
  const {e,h,v}=setup({unlocked:false}),before=e.storage.getItem('starush.public-profile');
  for(const id of ['neon','encore']){
    assert.equal(h.query('[data-chapter='+id+']').disabled,true);
    h.click('[data-chapter='+id+']');
    assert.equal(v.selection.previewChapter(id),false);
    assert.equal(v.selection.chapterId,'opening');
    assert.equal(e.storage.getItem('starush.public-profile'),before);
  }
  h.click('[data-action=back]');
  assert.equal(e.storage.getItem('starush.public-profile'),before);
  h.shutdown();
});

test('detached tour controls cannot mutate selection, save or navigate after rerender or shutdown',()=>{
  for(const transition of ['render','leave','shutdown']){
    const {e,h,v}=setup();
    const controls=['[data-chapter=neon]','[data-action=confirm-chapter]','[data-action=chapter-goals]'].map(s=>h.query(s));
    if(transition==='render')v.render();
    else if(transition==='leave')v.showPage('preflight');
    else h.shutdown();
    const before=e.storage.getItem('starush.public-profile'),page=v.page;
    let writes=0;const set=e.storage.setItem;e.storage.setItem=(...args)=>{writes++;set(...args);};
    for(const control of controls)control.click();
    assert.equal(v.selection.chapterId,'opening');
    assert.equal(v.page,page);assert.equal(h.starts.length,0);assert.equal(writes,0);
    assert.equal(e.storage.getItem('starush.public-profile'),before);
    if(transition!=='shutdown')h.shutdown();
  }
});

test('legacy confirmation preserves the original returnSelection scene contract',()=>{
  const {e,h}=setup({owner:false,scene:'TourRouteScene'});
  h.click('[data-chapter=neon]');h.click('[data-action=confirm-chapter]').click();
  assert.deepEqual(plain(h.starts),[['TitleScene',{suppressDebugAutoStart:true}]]);
  assert.equal(e.profile.loadPublicProfile().campaign.selectedChapterId,'neon');
  h.shutdown();
});
