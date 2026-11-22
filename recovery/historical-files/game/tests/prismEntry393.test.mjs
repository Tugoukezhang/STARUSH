import test from 'node:test';import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
test('native play-hub preview uses selected role without writing rewards or extending formal unlock catalog',()=>{
 for(const member of ['sakura','kai','enjo']){const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.seed([]);const progression=e.loadRuntime('utils/publicRunProgression.mjs');progression.selectPublicPerformer(member);
 const h=e.harness(e.TitleScene,{openPage:'playhub'});h.scene.create();const raw=e.storage.getItem('starush.public-profile');const b=h.query('[data-action=prism-preview]');assert(b);h.click('[data-action=prism-preview]');assert.equal(h.starts.at(-1)[0],'PrismGardenScene');assert.equal(h.starts.at(-1)[1].performerId,member);assert.equal(h.starts.at(-1)[1].official,undefined);assert.equal(e.storage.getItem('starush.public-profile'),raw);assert(!e.loadRuntime('utils/publicChapterContent.mjs').PUBLIC_CHAPTER_IDS.includes('prism-garden'));h.shutdown();}
});
