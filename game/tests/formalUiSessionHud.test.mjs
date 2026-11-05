import assert from 'node:assert/strict';import test from 'node:test';
import {loadScenes} from './helpers/publicShellHarness.mjs';

test('settings keep heading and primary return outside the scrollable content',()=>{
 const e=loadScenes(),h=e.harness(e.TitleScene);h.scene.create();h.click('[data-action=settings]');
 const root=e.document.getElementById('player-session-dialog');assert(root.querySelector('.session-header'),'missing fixed session header');assert(root.querySelector('.session-content'),'missing scroll region');
 const footer=root.querySelector('.session-footer');assert(footer,'missing pinned return region');assert(footer.querySelector('.session-primary'));
 assert.equal(root.querySelector('.session-content').querySelector('.session-primary'),null);assert(root.querySelector('.session-content').querySelector('#player-volume'));h.shutdown();
});
test('long first briefing focuses its shared heading, retaining the existing pause lease',()=>{
 const e=loadScenes(),Session=e.loadRuntime('systems/PlayerSessionExperience.mjs').PlayerSessionExperience;
 const s={battleData:{stageId:1,campaignChapterId:'opening',performerId:'sakura'},_isPublicStage1Round:()=>true,input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},_setBattlePaused(v){this._battlePaused=v;},player:{body:{setVelocity(){}}},sound:{}};
 const ui=new Session(s,true);ui.showBriefing(true);assert.equal(e.document.activeElement?.id,'player-session-heading');
 assert(ui.root.querySelector('.session-footer'),'first briefing has no pinned primary command');assert.equal(s._battlePaused,true);ui.close();assert.equal(s._battlePaused,false);assert.equal(s.input.enabled,true);ui.destroy();
});
test('HUD exposes actual HP and charges without changing readiness or model fields',()=>{
 const e=loadScenes(),sync=e.loadRuntime('systems/BattleSurfaceView.mjs').syncPublicBattleHud,doc=e.document;
 for(const id of ['public-hp-meter','hp-value','special-state','encore-state','special-fill','skill-special','skill-encore']){const el=doc.createElement('span');el.id=id;doc.body.append(el);}
 const s={battleData:{performerId:'sakura'},player:{hp:3,maxHp:5},publicStage1Round:{snapshot:()=>({phase:'active'})},_specialCharge:42,_encoreCharge:99.8,_isPublicStage1Round:()=>true,publicPerformerRun:{member:e.profile.PUBLIC_PERFORMERS[0],canAct:()=>false}};
 sync(s,doc);assert.equal(doc.getElementById('public-hp-meter').getAttribute('aria-valuenow'),'3');assert.equal(doc.getElementById('public-hp-meter').getAttribute('aria-valuemax'),'5');
 assert.equal(doc.getElementById('skill-special').getAttribute('data-charge-state'),'charging');assert.equal(doc.getElementById('skill-encore').getAttribute('data-charge-state'),'charging');
 assert.equal(s._specialCharge,42);assert.equal(s._encoreCharge,99.8);assert.equal(s.player.hp,3);
 s.publicStage1Round.snapshot=()=>({phase:'idle'});sync(s,doc);assert.equal(doc.getElementById('skill-special').getAttribute('data-charge-state'),'preparing');
});
test('defeat and pending save stay honest, and rejected next chapter carries a visible blocked state',()=>{
 const e=loadScenes(),{BattleSurfaceView,getPublicResultSurfaceModel}=e.loadRuntime('systems/BattleSurfaceView.mjs');
 const scene={input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},player:{body:{setVelocity(){}}},events:{once(){},off(){}}};
 const model=getPublicResultSurfaceModel({buttons:[{label:'再演本站',action:'retry'}]}, {performerId:'sakura',chapterId:'opening',victory:false,durationMs:10000,choices:[],actions:0,recorded:true,persisted:false});
 const view=new BattleSurfaceView(scene,{mode:'result',model,onAction(){}},e.document);assert.equal(view.root.dataset.outcome,'defeat');assert.equal(view.resultStatus.dataset.saveState,'pending');assert.equal(view.root.querySelector('.battle-result-reward'),null);
 view.rejectNextChapter();assert.equal(view.resultStatus.dataset.saveState,'blocked');view.destroy();
});
