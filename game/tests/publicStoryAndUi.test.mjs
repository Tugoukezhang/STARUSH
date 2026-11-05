import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { loadScenes, plain } from './helpers/publicShellHarness.mjs';

const source=new URL('../src/utils/publicStory.mjs',import.meta.url);
assert(existsSync(source),'An authored campaign/character story module must exist');
const {getCharacterDossier,getChapterStory,getReadableStoryEntries,canReadStoryBeat}=await import(source);
for(const id of ['sakura','kai','venus','genya','enjo']) {
  const d=getCharacterDossier(id);assert.equal(d.id,id);assert(d.motive.length>12);assert(d.relationship.length>12);
  for(const chapter of ['opening','neon','encore']) {
    const beat=getChapterStory(chapter,'intro',id);assert(beat.lines.length>=2);assert(beat.lines.some(l=>l.speaker===d.name));
  }
}
assert.equal(getCharacterDossier('unknown'),null);assert.equal(getChapterStory('unknown','outro','sakura'),null);
assert.equal(getChapterStory('opening','unknown','sakura'),null);
const env=loadScenes();const empty=env.profile.loadPublicProfile();
assert.deepEqual(plain(getReadableStoryEntries(empty).map(e=>e.id)),['opening:intro']);
assert.equal(canReadStoryBeat(empty,'opening','outro'),false);
env.seed(['opening']);const cleared=env.profile.loadPublicProfile();
assert(getReadableStoryEntries(cleared).some(e=>e.id==='opening:outro'));
assert(getReadableStoryEntries(cleared).some(e=>e.id==='neon:intro'));
assert(!getReadableStoryEntries(cleared).some(e=>e.id==='encore:outro'));

const view=env.harness(env.TitleScene);view.scene.create();
assert.match(view.scene._publicShell.root.querySelector('.shell-map').querySelector('img').src,/map-presentation-20261018\/opening-neutral\.webp$/);
assert(view.scene._publicShell.root.querySelector('[data-action=story-journal]'),'A real story readback entry is accessible');
view.click('[data-action=story-journal]');
assert.equal(env.document.getElementById('player-session-dialog').dataset.mode,'story-journal');
const outcome=env.document.querySelector('[data-story-id="opening:outro"]');assert(outcome);outcome.click();
assert.equal(env.document.getElementById('player-session-dialog').dataset.mode,'story');
assert.match(env.document.getElementById('player-session-dialog').textContent,/第一排/);
env.document.querySelector('[data-action=story-close]').click();
assert.equal(env.document.getElementById('player-session-dialog'),null);
assert.equal(view.scene.input.enabled,false,'Shell input ownership is restored, not handed to canvas');
view.shutdown();

for(const Scene of [env.IdolRosterScene,env.TourRouteScene]) {
  const screen=env.harness(Scene);screen.scene.create();
  const shell=screen.scene._publicShell.root;
  assert(shell.querySelector('.shell-selection-footer')?.querySelector('.shell-confirm'),'Selection stays in a dedicated footer');
  assert.equal(shell.querySelector('.shell-content').querySelector('.shell-confirm'),null,'Confirmation must not overlay the scrollable dossier');
  screen.shutdown();
}

const loaded=loadScenes();const Session=loaded.loadRuntime('systems/PlayerSessionExperience.mjs').PlayerSessionExperience;
let paused=false;
const s={battleData:{stageId:1,campaignChapterId:'opening',performerId:'kai'},_isPublicStage1Round:()=>true,
  _setBattlePaused(value){paused=value;this._battlePaused=value;},input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},
  player:{body:{setVelocity(){}}},oldStreet:{storyReady:()=>true},sound:{},_battleEnded:false};
const session=new Session(s,true);s._sessionExperience=session;
assert.equal(session.showStory('opening','midpoint',{live:true}),true);
assert.equal(paused,true);assert.equal(s.input.enabled,false);
assert.match(loaded.document.getElementById('player-session-dialog').textContent,/苍海/);
loaded.document.querySelector('[data-action=story-close]').click();
assert.equal(paused,false);assert.equal(s.input.enabled,true);
s._battlePaused=true;paused=true;session.showStory('opening','midpoint',{live:true});session.close();assert.equal(paused,true,'Borrowed pause remains paused');
s.battleData.practiceMode=true;assert.equal(session.showStory('opening','midpoint',{live:true}),false,'No public story on diagnostic routes');
session.destroy();session.destroy();
console.log('public story and shared UI contract: all assertions passed');
