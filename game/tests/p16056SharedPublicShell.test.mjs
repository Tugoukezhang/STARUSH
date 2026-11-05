import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadPublicProfile, recordPublicRun, selectPublicPerformer, selectPublicChapter } from '../src/utils/publicRunProgression.mjs';
import { SessionPauseLease } from '../src/systems/PlayerSessionExperience.mjs';
import * as sessionExperience from '../src/systems/PlayerSessionExperience.mjs';
import { loadScenes } from './helpers/publicShellHarness.mjs';

const moduleUrl = new URL('../src/systems/PublicShellView.mjs', import.meta.url);
assert.ok(existsSync(moduleUrl), 'The three public scenes require a real shared shell, not the retired layered canvas desk');
const { getPublicShellModel, PublicShellSelection } = await import(moduleUrl);
const storage = () => { const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)}; };

test('vendored icons retain a distributable license notice through minification', () => {
  const icons=readFileSync(new URL('../src/vendor/shellIcons.mjs',import.meta.url),'utf8');
  assert.match(icons,/\/\*!\s+@license/);
  assert.match(icons,/Copyright \(c\) 2026 Lucide Icons and Contributors/);
  assert.match(icons,/Copyright \(c\) 2013-present Cole Bemis/);
  assert.match(icons,/Permission to use, copy, modify/);
});

test('isolated DOM gestures resume WebAudio and notify the existing Phaser unlock lifecycle', async () => {
  assert.equal(typeof sessionExperience.resumePlayerAudioFromGesture,'function');
  const resume=sessionExperience.resumePlayerAudioFromGesture;
  let calls=0;const context={state:'suspended',resume(){calls++;this.state='running';return Promise.resolve();}};
  const sound={context,locked:true,unlocked:false};await resume(sound);
  assert.equal(calls,1);assert.equal(sound.unlocked,true);
  await resume(sound);assert.equal(calls,1,'Running context is not repeatedly resumed');
  const denied={context:{state:'suspended',resume:()=>Promise.reject(new Error('denied'))},locked:true,unlocked:false};
  await resume(denied);assert.equal(denied.unlocked,false,'Failed resume must not claim unlocked');
  await resume({});await resume({context:{state:'closed'}});
  const loaded=loadScenes();const view=loaded.harness(loaded.TitleScene);view.scene.sound.context={state:'suspended',resume(){calls++;return Promise.resolve();}};
  view.scene.create();assert.equal(calls,1,'Mount does not manufacture a user gesture');
  view.click('[data-action=settings]');assert.equal(calls,2,'Real shell command has an audio unlock path');
  view.shutdown();
});

test('settings makes the underlying DOM shell inert and restores the exact previous state', () => {
  for(const prior of [false,true]) {
    const root={inert:prior};const scene={_publicShell:{root},input:{enabled:false}};
    const lease=new SessionPauseLease(scene);lease.acquire();
    assert.equal(root.inert,true,'settings must exclude background shell controls from keyboard/accessibility');
    lease.release();assert.equal(root.inert,prior);assert.equal(scene.input.enabled,false);
  }
});
test('DOM menu owns native scrolling only during its scene lifetime', () => {
  const loaded=loadScenes();const host=loaded.document.getElementById('game-container');host.style.touchAction='none';
  const view=loaded.harness(loaded.TitleScene);view.scene.create();
  assert.equal(host.style.touchAction,'pan-y');assert.equal(view.scene.input.enabled,false);
  view.shutdown();assert.equal(host.style.touchAction,'none');assert.equal(view.scene.input.enabled,true);
  assert.equal(loaded.document.getElementById('public-shell'),null);
});
test('failed first-session member save is explicitly carried back to the desk', () => {
  const loaded=loadScenes();const view=loaded.harness(loaded.IdolRosterScene);view.scene.create();
  view.click('[data-member=kai]');loaded.storage.setItem=()=>{throw new Error('denied');};
  view.click('[data-action=confirm-member]');
  assert.equal(view.starts[0][1].selectionSaveFailed,true);
  view.shutdown();const desk=loaded.harness(loaded.TitleScene,view.starts[0][1]);desk.scene.create();
  assert.match(desk.text,/选择暂存于本次打开期间/);
});

test('fresh shell uses real member/action and chapter lock states, without a fourth chapter', () => {
  const model=getPublicShellModel(loadPublicProfile(storage()));
  assert.equal(model.member.id,'sakura');assert.equal(model.member.actionName,'领唱扇奏');
  assert.equal(model.chapter.id,'opening');assert.equal(model.clearedCount,0);
  assert.deepEqual(model.chapters.map(c=>[c.id,c.unlocked,c.cleared,c.selected]),[
    ['opening',true,false,true],['neon',false,false,false],['encore',false,false,false],
  ]);
});
test('previewing or abandoning a different member does not mutate selection; confirmation does', () => {
  const s=storage();const selection=new PublicShellSelection(s);
  assert.equal(selection.previewMember('kai'),true);
  assert.equal(selection.memberId,'kai');assert.equal(loadPublicProfile(s).selectedId,'sakura');
  assert.equal(selection.previewMember('unknown'),false);
  assert.equal(selection.confirmMember().selectedId,'kai');
  assert.equal(loadPublicProfile(s).selectedId,'kai');
});
test('chapter confirmation rechecks the latest unlocks rather than trusting stale preview', () => {
  const s=storage();recordPublicRun({runId:'earned',chapterId:'opening',performerId:'sakura',victory:true},s);
  const selection=new PublicShellSelection(s);
  assert.equal(selection.previewChapter('neon'),true);
  s.removeItem('starush.public-profile');
  assert.equal(selection.confirmChapter(),null);
  assert.equal(loadPublicProfile(s).campaign.selectedChapterId,'opening');
  assert.equal(selection.previewChapter('encore'),false);
});
test('selecting chapters and performers preserves earned progress and reports failed persistence', () => {
  const s=storage();for(const id of ['opening','neon','encore'])recordPublicRun({runId:id,chapterId:id,performerId:'sakura',victory:true},s);
  selectPublicChapter('opening',s);selectPublicPerformer('enjo',s);
  const model=getPublicShellModel(loadPublicProfile(s));assert.equal(model.completed,true);assert.equal(model.clearedCount,3);
  assert.equal(model.member.id,'enjo');assert.ok(model.chapters.every(c=>c.unlocked&&c.cleared));
  const selection=new PublicShellSelection(s);selection.previewMember('venus');
  s.setItem=()=>{throw new Error('denied');};
  const result=selection.confirmMember();assert.equal(result.selectedId,'venus');assert.equal(result.persisted,false);
  assert.equal(loadPublicProfile(s).clears,3);
});
test('shell scene adapters keep disposal and preserve debug-route battle builder', () => {
  for(const file of ['TitleScene','IdolRosterScene','TourRouteScene']) {
    const src=readFileSync(new URL(`../src/scenes/${file}.js`,import.meta.url),'utf8');
    assert.match(src,/new PublicShellView\(/);assert.match(src,/_publicShell\?\.destroy\(/);
    assert.match(src,/keepBattleHudHiddenForScene\(this\)/);
  }
  const src=readFileSync(new URL('../src/scenes/TitleScene.js',import.meta.url),'utf8');
  assert.doesNotMatch(src,/舞台练习正在准备中|addP15CallSheetCardFrame\(this|desk-cta/);
});
