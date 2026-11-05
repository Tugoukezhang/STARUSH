import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const env=loadScenes();env.seed(['opening']);env.profile.selectPublicChapter('neon');
const view=env.harness(env.TitleScene);view.scene.create();
const map=view.scene._publicShell.root.querySelector('.shell-map');
assert.match(map.querySelector('img').src,/map-presentation-20261018\/neon-neutral\.webp$/,'Selected Chapter 2 preview must show the same independent map as gameplay');
assert.equal(map.querySelectorAll('.shell-map-prop').length,17);
assert.ok([...map.querySelectorAll('.shell-map-prop')].every(i=>i.src.includes('neon-cohesion-20261009/')));
view.shutdown();
const fresh=loadScenes();const Session=fresh.loadRuntime('systems/PlayerSessionExperience.mjs').PlayerSessionExperience;
let ready=false;
const scene={battleData:{stageId:1,campaignChapterId:'neon',performerId:'genya'},_isPublicStage1Round:()=>true,
  _setBattlePaused(value){this._battlePaused=value;},input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},
  player:{body:{setVelocity(){}}},oldStreet:{config:{chapterId:'neon'},storyReady:()=>ready},sound:{},_battleEnded:false};
const session=new Session(scene,true);scene._sessionExperience=session;
assert.equal(session.showStory('neon','midpoint',{live:true}),false,'No spoiler before both actual places restore');
ready=true;assert.equal(session.showStory('opening','midpoint',{live:true}),false,'Live map cannot authorize another chapter');
assert.equal(session.showStory('neon','midpoint',{live:true}),true);
assert.equal(scene._battlePaused,true);assert.equal(scene.input.enabled,false);
assert.match(fresh.document.getElementById('player-session-dialog').textContent,/不同的声音/);
session.close();assert.equal(scene._battlePaused,false);assert.equal(scene.input.enabled,true);
scene.battleData.practiceMode=true;assert.equal(session.showStory('neon','midpoint',{live:true}),false);
session.destroy();session.destroy();
console.log('Neon map preview and witnessed story pause/resume/isolation passed');
