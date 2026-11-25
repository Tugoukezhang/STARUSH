import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { beginSceneLoading } from '../src/systems/GameLoadRecovery.mjs';
import { resolvePublicChapterId } from '../src/utils/publicRunProgression.mjs';
import { GROUND_ECHO_ART } from '../src/systems/GroundEchoField278.mjs';
import { SWORD_ECHO_ART } from '../src/systems/SwordEchoField291.mjs';
const moduleUrl=new URL('../scripts/runtime-payload.mjs',import.meta.url);
assert.ok(fs.existsSync(moduleUrl),'release needs an explicit runtime payload boundary');
const {RUNTIME_PAYLOAD,validateRuntimePayload,runtimePayloadPlugin}=await import(moduleUrl.href);

test('release inventory is exact, categorized, unique and covers existing runtime consumers',()=>{
 const admitted=['art/rounded-ink-footprint-20261029/pool.png','art/heavy-pigment-contact-20261029/landing.webp','art/kai-comic-contact-20261024/contact.png','art/home-identity-family-20261024/plates.png','art/printed-floor-pigment-20261024/planes.png','art/kai-comic-projectile-20261024/projectile.png','art/comic-dense-pool-20261024/pool.png','art/ink-pocket-pigment-20261023/planes.png','fonts/NotoSansSC-UI.woff2','licenses/noto-sans-sc.txt','art/compact-pool-ground-20261023/pool.png','art/world-comic-pigment-20261023/planes.png','art/three-cast-comic-material-20261023/planes.png','art/comic-paint-directional-20261023/planes.png','art/comic-paint-material-20261023/planes.png','art/facility-ink-seal-20261029/pop.png','art/rifle-compact-muzzle-20261022/muzzle.png','art/command-state-family-20261022/ready.png','art/command-state-family-20261022/active.png','art/command-state-family-20261022/preparing.png','art/command-state-family-20261022/paused.png','art/command-state-family-20261022/ended.png',
  'art/hammer-comic-contact-20261022/burst.png','art/menu-lettering-20261021/titles.png','art/inner-screen-lettering-20261024/inventory.png','art/menu-portraits-20261024/kai.webp','art/menu-portraits-20261024/enjo.webp','art/harbor-ground-strike-20261016/warning.webp',
  'art/battle-reading-20261024/pause-title.png',
  'art/comic-ink-planes-20261029/body.png',
  'art/menu-identity-cast-20261026/kai.webp','art/menu-enjo-illustration-20261028/enjo.webp','art/menu-enjo-illustration-20261028/enjo-avatar.webp','art/menu-enjo-expression-20261028/eyes.png',
  'art/heavy-palette-impact-20261029/impact.png','art/kai-dash-20261021/dash.png','art/kai-dash-contrast-20261021/dash.png',
  'art/enjo-gait-20261021/walk.png','art/enjo-hurt-20261021/hurt.png','art/rifle-shoot-20261021/shoot.png','art/kai-hurt-20261021/hurt.png',
  'art/rifle-idle-20261021/idle.png','art/rifle-rest-20261022/idle.png','art/comic-ui-20261021/logo.png','art/comic-ui-20261021/encore.png','art/comic-ui-20261021/rifle.png','art/comic-ui-20261021/panel.png','art/comic-ui-20261021/lobby.webp',
  'art/rifle-ink-chain-20261022/muzzle.png','art/rifle-ink-chain-20261022/projectile.png','art/rifle-ink-chain-20261022/contact.png','art/rifle-pigment-deposition-20261023/deposition.png',
  'art/battle-header-20261022/frame.png','art/battle-header-20261022/icons.png','art/battle-comic-skin-20261021/status-idle.png','art/battle-comic-skin-20261021/status-ready.png','art/battle-comic-skin-20261021/status-active.png',
  'art/skill-command-20261022/encore.png','art/skill-command-20261022/rifle.png','art/skill-command-20261022/sword.png','art/skill-command-20261022/hammer.png',
  'art/home-lettering-20261022/start.png','art/home-lettering-20261022/rifle.png','art/home-lettering-20261022/sword.png','art/home-lettering-20261022/hammer.png',
  'art/home-lettering-20261022/preflight.png','art/home-lettering-20261022/training.png','art/home-lettering-20261022/journal.png','art/home-lettering-20261022/hub.png',
  'art/rifle-walk-volume-20261022/walk.png','art/briefing-reading-frame-20261022/frame.png','art/ready-lettering-20261022/ready.png','art/home-comic-backstage-20261022/backstage.webp',
  'art/home-portrait-demo-20261022/sakura-body.webp','art/home-portrait-demo-20261022/sakura-hair.webp','art/home-portrait-demo-20261022/sakura-tail.webp','art/home-portrait-demo-20261022/sakura-blink.webp','art/home-portrait-demo-20261022/backstage.webp',
  'art/home-transparent-components-20261024/components.png','art/home-surface-clean-20261025/components.png','art/home-selected-reference-20261023/chapters.png','art/enjo-rest-20261023/idle.png',
  'art/chapter-venues-20261024/opening.webp','art/chapter-venues-20261024/neon.webp','art/chapter-venues-20261024/encore.webp'];
 admitted.push('art/duo-comic-contact-20261025/contact.png','art/relay-ink-transfer-20261029/transfer.webp');
 for(const file of ['kai.webp','enjo.webp','kai-avatar.webp','enjo-avatar.webp'])admitted.push('art/menu-series-cast-20261031/'+file);
 for(const file of ['enjo-blink.webp','enjo-smile.webp','kai-blink.webp','kai-smile.webp'])admitted.push('art/menu-expression-20261031/'+file);
 admitted.push('art/roster-studio-20261031/stage.webp');
 for(const id of ['companion','venue','progress','history','training','play','primary','secondary','selected','tab','dialogue','ledger'])admitted.push('art/owner-ui-family-20261031/'+id+'.webp');
 for(const id of ['rifle','sword','hammer','encore'])admitted.push('art/battle-controls-20261031/'+id+'.webp');
 admitted.push('licenses/lucide-gameplay.txt');
 admitted.push('art/result-stage-20261031/complete.webp');
 admitted.push('art/companion-room-20261031/lounge.webp');
 admitted.push('art/companion-dialogue-20261031/dialogue.webp');
 admitted.push('rigs/companion-sakura-20261031/sakura.p2lrt','vendor/psd2live-3.6.6/p2l.js','vendor/psd2live-3.6.6/p2l_runtime.wasm','vendor/psd2live-3.6.6/LICENSE.txt');
 for(const id of ['tour-title','inventory-title','equipment-bay','tour-ticket'])admitted.push('art/inner-poster-family-20261025/'+id+'.png');
 admitted.push('art/menu-identity-cast-20261026/eyes.png');
 admitted.push('art/venue-shell-20261026/venue.webp','art/venue-shell-20261026/start.png');
 admitted.push('art/melee-authored-20261026/kai-attack.webp','art/melee-authored-20261026/enjo-attack.webp','art/melee-authored-20261026/melee-process.webp');
 admitted.push('art/melee-directional-20261026/kai-vertical-grid.webp','art/melee-directional-20261026/enjo-vertical-grid.webp');
 admitted.push('art/melee-heavy-bridge-20261028/enjo-20-grid.webp');
 admitted.push('art/heavy-pigment-swing-20261029/chain.png','art/enjo-continuous-rig-20261028/parts.webp','art/enjo-north-rig-20261029/parts.webp');
 for(const id of ['sakura','kai','enjo'])admitted.push('art/roster-lettering-20261028/'+id+'.png');
 for(const id of ['wide_nozzle','rhythm_sync','focus_lens','travelling_nozzle','return_edge','delayed_hammer'])admitted.push('art/equipment-identity-20261025/'+id+'.png');
 assert.deepEqual(RUNTIME_PAYLOAD.filter(a=>admitted.includes(a.file)).map(a=>a.file).sort(),[...admitted].sort());
 assert.deepEqual(RUNTIME_PAYLOAD.filter(a=>a.file.startsWith('art/portrait-base-20261101/')),[],'retired portraits must not ship');
 for(const file of ['portraits/enjo-286/source.png','portraits/kai-287/source.png',...['guidance','phase','action','danger'].map(n=>'art/battle-signals-b293/'+n+'.webp')])assert.ok(RUNTIME_PAYLOAD.some(a=>a.file===file),file);
 const printroomFiles=['primary.webp','paper.webp','ink.webp','motif.webp','dressing.webp','gear.webp',
  'records.webp','rehearsal.webp','chime-icon.png','book-icon.png',
  'item-sound.webp','item-pulse.webp','item-focus.webp','item-rain.webp','item-delay.webp','item-echo.webp','item-leaf.webp'].map(name=>'art/printroom/'+name);
 assert.deepEqual(RUNTIME_PAYLOAD.filter(a=>a.group==='printroom-surfaces').map(a=>a.file).sort(),printroomFiles.sort());
 const setDesignFiles=['foyer','wardrobe','route','workbench','archive','rehearsal','office','observatory',
  'card','note','monitor','dialog','strip','stub','avatar-sakura','avatar-kai','avatar-enjo','home-logo'].map(name=>'art/setdesign/'+name+'.webp');
 assert.deepEqual(RUNTIME_PAYLOAD.filter(a=>a.group==='setdesign-art').map(a=>a.file).sort(),setDesignFiles.sort());
 // The normal Vite build ships the separate home-space manifest alongside the main game.
 const homePayload=JSON.parse(fs.readFileSync(new URL('../home-payload.json',import.meta.url),'utf8'));
 const release=[...RUNTIME_PAYLOAD,...homePayload];
 assert.equal(RUNTIME_PAYLOAD.length,803);
 assert.equal(release.length,869);
 assert.equal(new Set(release.map(a=>a.file)).size,release.length);
 assert.deepEqual(RUNTIME_PAYLOAD.filter(a=>a.group==='mobile-lobby').map(a=>a.file),['art/mobile-lobby-20261014/home-background.webp']);
 assert.deepEqual(RUNTIME_PAYLOAD.filter(a=>a.group==='owner-character-walk').map(a=>a.file),['art/rifle-walk-volume-20261022/walk.png']);
  assert.deepEqual(RUNTIME_PAYLOAD.filter(a=>a.group==='ui-surface-art').map(a=>a.file),['art/ui-system-20261015/primary-action-sakura-stage.webp','art/ui-system-20261015/secondary-panel-clean-sakura.webp']);
 for(const id of ['kai','venus','genya','enjo'])assert.ok(RUNTIME_PAYLOAD.some(a=>a.file===`art/performer-turn-20260925/${id}-turn.webp`));
 for(const id of ['kai','venus','genya','enjo'])assert.ok(RUNTIME_PAYLOAD.some(a=>a.file===`art/performer-reactions-20260924/${id}-reactions.webp`));
 for(const id of ['kai','venus','genya','enjo'])assert.ok(RUNTIME_PAYLOAD.some(a=>a.file===`art/performer-footrig-20260924/${id}-legs.webp`));
 assert.ok(RUNTIME_PAYLOAD.some(a=>a.file==='art/sakura-conformance-20261004/rig.json'));
 assert.ok(RUNTIME_PAYLOAD.some(a=>a.file==='art/sakura-hand-art-20261005/front.webp'));
 for(const file of ['art/sakura-hand-art-20261005/directions.webp','art/sakura-details-20261004/views.json'])assert.ok(RUNTIME_PAYLOAD.some(a=>a.file===file));
 for(const file of ['art/sakura-hand-art-20261005/turns.webp','art/sakura-turn-native-20261004/views.json'])assert.ok(RUNTIME_PAYLOAD.some(a=>a.file===file));
 for(const file of ['parts.webp','views.json'])assert.ok(!RUNTIME_PAYLOAD.some(a=>a.file===`art/sakura-directions-20261004/${file}`));
 assert.ok(!RUNTIME_PAYLOAD.some(a=>a.file==='art/sakura-native-20261004/parts.png'));
 assert.ok(!RUNTIME_PAYLOAD.some(a=>/sakura-secondary-20260922|sakura-defeat-20260922|sakura-motion-20260921/.test(a.file)));
 assert.ok(!RUNTIME_PAYLOAD.some(a=>a.file==='art/sakura-chibi-20260915/lower.png'));
 assert.ok(!RUNTIME_PAYLOAD.some(a=>a.file==='art/sakura-chibi-20260915/upper.png'));
 assert.ok(!RUNTIME_PAYLOAD.some(a=>a.file.includes('sakura-layered-20260915/')));
 assert.ok(!RUNTIME_PAYLOAD.some(a=>/sakura-combat-20260913|sakura-redesign-20260913\/actions/.test(a.file)));
 assert.equal(RUNTIME_PAYLOAD.filter(a=>a.group==='neonstreet-scene').length,11);
 assert.equal(RUNTIME_PAYLOAD.filter(a=>a.group==='oldstreet-scene').length,26);
 assert.equal(RUNTIME_PAYLOAD.filter(a=>a.group==='public-actors').length,63);
 assert.equal(RUNTIME_PAYLOAD.filter(a=>a.group==='public-scenes').length,7);
 assert.equal(RUNTIME_PAYLOAD.filter(a=>a.group==='shared-audio').length,7);
 assert.ok(RUNTIME_PAYLOAD.every(a=>Object.isFrozen(a)));
 const rows=validateRuntimePayload(new URL('../public/',import.meta.url),release);assert.equal(rows.length,869);
 assert.ok(rows.every(a=>a.bytes>0&&/^[a-f0-9]{64}$/.test(a.sha256)));
 assert.ok(!rows.some(a=>/base-gray|gray-plaza|sakura-hud-portrait|art\/desk|art\/phase15/.test(a.file)));
});
test('unknown public files never ship; source bytes and generated bundle stay intact',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'starush-payload-'));
 try{
  fs.mkdirSync(root+'/public');fs.mkdirSync(root+'/dist');
  const rows=[Object.freeze({file:'valid.png',group:'fixture'})];
  for(const dir of ['public','dist']){fs.writeFileSync(root+'/'+dir+'/valid.png','image');fs.writeFileSync(root+'/'+dir+'/unreviewed.png','not approved');}
  fs.writeFileSync(root+'/dist/index.html','html');
  const plugin=runtimePayloadPlugin(rows);assert.equal(plugin.apply,'build');
  plugin.configResolved({root,publicDir:root+'/public',build:{outDir:'dist'}});
  plugin.writeBundle({}, {'index.html':{}});plugin.closeBundle();
  assert.ok(!fs.existsSync(root+'/dist/unreviewed.png'));
  assert.equal(fs.readFileSync(root+'/public/unreviewed.png','utf8'),'not approved');
  assert.equal(fs.readFileSync(root+'/dist/valid.png','utf8'),'image');
  const report=JSON.parse(fs.readFileSync(root+'/dist/runtime-payload.json'));
  assert.equal(report.files.length,2);assert.equal(report.publicBytes,5);assert.equal(report.files.find(f=>f.file==='valid.png').sha256.length,64);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('missing, duplicate, unsafe paths and output inside sources fail closed',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'starush-payload-'));
 try{
  fs.mkdirSync(root+'/public');fs.writeFileSync(root+'/public/ok.png','ok');
  for(const file of ['../secret','/absolute.png','a\\b.png','https://example.com/a'])assert.throws(()=>validateRuntimePayload(root+'/public',[{file,group:'fixture'}]),/path/);
  assert.throws(()=>validateRuntimePayload(root+'/public',[{file:'missing',group:'fixture'}]),/missing/i);
  assert.throws(()=>validateRuntimePayload(root+'/public',[{file:'ok.png',group:'fixture'},{file:'ok.png',group:'fixture'}]),/duplicate/i);
  for(const outDir of ['public','src','tests','scripts','.','../outside'])assert.throws(()=>runtimePayloadPlugin([]).configResolved({root,publicDir:root+'/public',build:{outDir}}),/output/i);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('public preload contains only current chapter, actor, UI and shared audio; hidden keeps legacy assets',()=>{
 const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const method=source.slice(source.indexOf('  preload() {'),source.indexOf('\n  create()',source.indexOf('  preload() {')));
 function run(data){
  const calls=[];
  const record=type=>(...args)=>calls.push([type,...args]);
  const scene={initialBattleData:data,events:new EventEmitter(),load:Object.assign(new EventEmitter(),{
   image:record('image'),atlas:record('atlas'),spritesheet:record('spritesheet'),
  })};
  const publicAssets=kind=>(target,entry)=>{
   assert.equal(target,scene);
   assert.equal(entry.performerId,data.performerId);
   calls.push([kind,entry.campaignChapterId]);
  };
  const deps={
   beginSceneLoading,resolvePublicChapterId,GROUND_ECHO_ART,SWORD_ECHO_ART,
   getBattleBackgroundConfig:()=>({key:'old-background',imagePath:'old.png'}),
   preloadP17AudioCues:loader=>{assert.equal(loader,scene.load);calls.push(['audio']);},
   preloadChapterScenePresentation:publicAssets('chapter'),preloadActorPresentation:publicAssets('actor'),
   preloadPublicBattleUi:publicAssets('ui'),preloadFacilityCompletionFx:publicAssets('facility'),
   isOptionalFacilityCompletionFile:()=>false,isOptionalQRebaseTrialFile:()=>false,
   preloadP48ResultReplayDecorAssets:()=>calls.push(['legacy-result']),
   NOTE_ART_ATLAS_KEY:'note',NOTE_ART_BASE_PATH:'legacy',
  };
  const preload=new Function(...Object.keys(deps),'return function() '+method.slice(method.indexOf('{')))(...Object.values(deps));
  preload.call(scene);
  scene._loadRecovery.dispose();
  return calls;
 }
 const chapterAssets=[['audio'],...['chapter','actor','ui','facility'].map(kind=>[kind,'opening'])];
 assert.deepEqual(run({stageId:1,performerId:'sakura'}),chapterAssets);
 for(const [performerId,art] of [['kai',SWORD_ECHO_ART],['enjo',GROUND_ECHO_ART]]){
  const sheet=['spritesheet',art.key,art.path,{frameWidth:art.frameWidth,frameHeight:art.frameHeight}];
  assert.deepEqual(run({stageId:1,campaignChapterId:'invalid',performerId}),[sheet,...chapterAssets]);
 }
 const legacyAssets=[['audio'],['atlas','particles-impact','particles-impact-atlas.png','particles-impact-atlas.json'],
  ['image','old-background','old.png'],
  ['atlas','note','legacy/bullet-note-vfx-v5-1-gameplay-512x256.png','legacy/bullet-note-vfx-v5-1-gameplay-512x256.json'],
  ['legacy-result']];
 assert.deepEqual(run({stageId:1,practiceMode:true}),legacyAssets);
 assert.deepEqual(run({stageId:2,performerId:'sakura'}),legacyAssets);
});
test('output junctions are rejected before the bundler can empty a source directory',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'starush-payload-link-'));
 try{
  fs.mkdirSync(root+'/public');fs.symlinkSync(root+'/public',root+'/redirect','junction');
  for(const outDir of ['redirect','redirect/nested'])assert.throws(()=>runtimePayloadPlugin([]).configResolved({root,publicDir:root+'/public',build:{outDir}}),/output/i);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
