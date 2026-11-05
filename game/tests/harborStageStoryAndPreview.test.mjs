import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const env=loadScenes();env.seed(['opening','neon']);env.profile.selectPublicChapter('encore');
const view=env.harness(env.TitleScene);view.scene.create();
const map=view.scene._publicShell.root.querySelector('.shell-map');
assert.match(map.querySelector('img').src,/map-presentation-20261018\/encore-neutral\.webp$/);
assert.equal(map.querySelectorAll('.shell-map-prop').length,10);
assert.ok([...map.querySelectorAll('.shell-map-prop')].every(i=>i.src.includes('harbor-cohesion-20261009/')));view.shutdown();
const fresh=loadScenes(),Session=fresh.loadRuntime('systems/PlayerSessionExperience.mjs').PlayerSessionExperience;
let ready=false;
const scene={battleData:{stageId:1,campaignChapterId:'encore',performerId:'sakura'},_isPublicStage1Round:()=>true,
  _setBattlePaused(v){this._battlePaused=v;},input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},
  player:{body:{setVelocity(){}}},oldStreet:{config:{chapterId:'encore'},storyReady:()=>ready},sound:{},_battleEnded:false};
const session=new Session(scene,true);scene._sessionExperience=session;
assert.equal(session.showStory('encore','midpoint',{live:true}),false);
ready=true;assert.equal(session.showStory('neon','midpoint',{live:true}),false);
assert.equal(session.showStory('encore','midpoint',{live:true}),true);
assert.equal(scene._battlePaused,true);assert.equal(scene.input.enabled,false);
assert.match(fresh.document.getElementById('player-session-dialog').textContent,/调音亭/);
session.close();assert.equal(scene._battlePaused,false);assert.equal(scene.input.enabled,true);
scene.battleData.practiceMode=true;assert.equal(session.showStory('encore','midpoint',{live:true}),false);
session.destroy();session.destroy();
console.log('Harbor preview and earned story pause/resume/isolation passed');
