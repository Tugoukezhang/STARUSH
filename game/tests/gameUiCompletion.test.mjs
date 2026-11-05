import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { loadScenes, plain } from './helpers/publicShellHarness.mjs';
const ids=['sakura','venus','genya','kai','enjo'];
const system=await import('../src/systems/UiPerformerArt.mjs').catch(()=>({}));

test('five original UI identities have finite neutral, victory, defeat and avatar exports',()=>{
  assert.equal(typeof system.getUiPerformerArt,'function','Missing shared original Q UI art contract');
  for(const id of ids){const art=system.getUiPerformerArt(id);assert.equal(art.id,id);for(const kind of ['avatar','portrait','victory','defeat']){assert.equal(art[kind],`art/five-q-ui-20261013/${id}-${kind}.webp`);assert(fs.existsSync(new URL('../public/'+art[kind],import.meta.url)));}}
  assert.equal(system.getUiPerformerArt('unknown'),null);
});
test('UI exports are explicit payload rows, without publishing source parts or changing trial permission',async()=>{
  const {RUNTIME_PAYLOAD,Q_REBASE_TRIAL_PAYLOAD}=await import('../scripts/runtime-payload.mjs');
  const rows=RUNTIME_PAYLOAD.filter(r=>r.group==='five-q-ui');assert.equal(rows.length,20);assert.equal(new Set(rows.map(r=>r.file)).size,20);
  assert.equal(Q_REBASE_TRIAL_PAYLOAD.length,10);assert(!RUNTIME_PAYLOAD.some(r=>r.group==='five-q-trial'));
  let bytes=0;for(const row of rows)bytes+=fs.statSync(new URL('../public/'+row.file,import.meta.url)).size;assert(bytes<650_000,'UI export budget is 650KB total');
});
test('all actual shell pages share new Q portraits and never change selection during rendering',()=>{
  const env=loadScenes(),before=plain(env.profile.loadPublicProfile());
  const h=env.harness(env.IdolRosterScene);h.scene.create();
  for(const id of ids){h.click(`[data-member=${id}]`);assert.equal(h.query('.member-mark-full').querySelector('img').src,`art/five-q-ui-20261013/${id}-portrait.webp`);}
  assert.deepEqual(plain(env.profile.loadPublicProfile()),before);h.shutdown();
});
test('victory and defeat use their own original character state and preserve result input ownership',()=>{
  const env=loadScenes(),{BattleSurfaceView,getPublicResultSurfaceModel}=env.loadRuntime('systems/BattleSurfaceView.mjs');
  for(const id of ids)for(const victory of [true,false]){
    const scene={input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},player:{body:{setVelocity(){}}},events:{once(){},off(){}},sound:null};
    const m=getPublicResultSurfaceModel({buttons:[{label:'再演',action:'retry'}]},{performerId:id,chapterId:'opening',victory,durationMs:1200,choices:[],recorded:true,persisted:true});
    const view=new BattleSurfaceView(scene,{mode:'result',model:m,onAction(){}},env.document);
    assert.equal(view.root.querySelector('.battle-performer-visual').querySelector('img').src,`art/five-q-ui-20261013/${id}-${victory?'victory':'defeat'}.webp`);
    assert.equal(scene.input.enabled,false);view.destroy();assert.equal(scene.input.enabled,true);
  }
});
test('shared game theme covers public surfaces while boot keeps its independent fallback owner',()=>{
  const cssFile=new URL('../src/styles/gameUiTheme.css',import.meta.url);assert(fs.existsSync(cssFile),'Missing shared UI skin');
  const css=fs.readFileSync(cssFile,'utf8');
  for(const selector of ['#public-shell','.shell-navigation','.shell-member-option','.shell-chapter-option','.workshop-equipment','#run-choice','#battle-result','#battle-pause','#player-session-dialog','#portrait-protection','.skill-orb','prefers-reduced-motion'])assert(css.includes(selector),selector);
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');assert(html.includes('/src/styles/gameUiTheme.css'));
  const bootCss=html.match(/<style>([\s\S]*?)<\/style>/)?.[1];assert(bootCss?.includes('#game-loading'));assert(!css.includes('#game-loading'),'External game theme must not override standalone boot recovery');
  assert(!css.includes('letter-spacing:-'));assert(!css.includes('font-size: clamp('));
});
test('HUD avatar follows actual identity without mutating charge or requiring UI-only hooks in legacy fixtures',()=>{
  const env=loadScenes(),{syncPublicBattleHud}=env.loadRuntime('systems/BattleSurfaceView.mjs');
  const scene={_isPublicStage1Round:()=>true,publicPerformerRun:{member:env.profile.getPublicPerformer('kai'),canAct:()=>true},_specialCharge:100,_encoreCharge:100};
  syncPublicBattleHud(scene,env.document);const host=env.document.getElementById('game-container');
  assert.equal(host.dataset.uiPerformer,'kai');assert.match(host.style['--ui-actor-avatar'],/kai-avatar.webp/);assert.equal(scene._specialCharge,100);assert.equal(scene._encoreCharge,100);
  delete host.dataset;delete host.style.setProperty;syncPublicBattleHud(scene,env.document);assert.equal(scene._specialCharge,100);
});
test('readable story pages carry the actual Q identity and do not grant unseen story or progress',()=>{
  const env=loadScenes(),{PlayerSessionExperience}=env.loadRuntime('systems/PlayerSessionExperience.mjs');
  const scene={battleData:{performerId:'kai',campaignChapterId:'opening'},input:{enabled:true,keyboard:{enabled:true}},sound:{setVolume(){},setMute(){}},events:{once(){},off(){}}};
  const view=new PlayerSessionExperience(scene);const before=plain(env.profile.loadPublicProfile());
  assert.equal(view.showStory('opening','intro'),true);
  const image=view.root.querySelector('.session-performer')?.querySelector('img');assert(image,'Story identity is missing');assert.equal(image.src,'art/five-q-ui-20261013/kai-avatar.webp');
  view.close();assert.equal(view.showStory('encore','outro'),false);assert.deepEqual(plain(env.profile.loadPublicProfile()),before);view.destroy();
});
test('HUD CSS uses document-absolute asset URLs, including a nested deployment, never CSS-relative assets/art',()=>{
  assert.equal(typeof system.uiPerformerAvatarCss,'function','Missing absolute UI avatar URL contract');
  assert.equal(system.uiPerformerAvatarCss('sakura','https://example.com/game/?build=ui'),'url("https://example.com/game/art/five-q-ui-20261013/sakura-avatar.webp")');
  assert.equal(system.uiPerformerAvatarCss('kai','https://example.com/'),'url("https://example.com/art/five-q-ui-20261013/kai-avatar.webp")');
  assert.equal(system.uiPerformerAvatarCss('unknown','https://example.com/'),'none');
});
test('battle dialogs reflow like public menus on small phones, without shrinking their text or changing canvas input',()=>{
  const css=fs.readFileSync(new URL('../src/styles/gameUiTheme.css',import.meta.url),'utf8');
  assert.match(css,/#game-container \.battle-surface\s*\{[^}]*width:var\(--public-shell-width/);
  assert.match(css,/#game-container \.battle-surface\s*\{[^}]*transform:scale\(var\(--public-shell-compensation/);
  assert(!css.includes('#game-container > canvas'),'A UI reflow must not change the accepted game canvas');
});
