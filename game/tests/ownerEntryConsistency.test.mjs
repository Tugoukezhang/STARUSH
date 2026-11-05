import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EventEmitter} from 'node:events';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {beginSceneLoading,finishSceneLoading} from '../src/systems/GameLoadRecovery.mjs';

const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
function fixture(){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const doc=e.document;
 for(const [tag,id,cls]of [['div','game-container'],['b','','mihoyo-name'],['div','','mihoyo-portrait'],
  ['button','skill-special'],['button','skill-encore'],['span','special-label'],['span','special-state']]){
  const el=doc.createElement(tag);el.id=id||'';el.className=cls||'';doc.body.append(el);
 }
 return {...e,doc,surface:e.loadRuntime('systems/BattleSurfaceView.mjs')};
}
test('every actual cast sync ends with the current identity, image, action and accessible label during countdown',()=>{
 const e=fixture(),body=source.match(/  _syncPublicCastHud\(member\) \{([\s\S]*?)\n  \}\n\n  _freezePublicPaintRound/)[1];
 const call=new Function('document','getPublicPerformer','performerPortraitCss','syncPublicBattleHud',`return function(member){${body}}`)(e.doc,e.profile.getPublicPerformer,()=> 'legacy portrait',e.surface.syncPublicBattleHud);
 for(const [id,name,label]of [['sakura','步枪手','扫射'],['kai','机甲剑士','突进'],['enjo','重锤手','重锤']]){
  const member=e.loadRuntime('utils/userCast.mjs').getPlayablePerformer(id);
  const scene={_userCastPresentation:true,_isPublicStage1Round:()=>true,battleData:{performerId:id},
   publicPerformerRun:{member,canAct:()=>false},publicStage1Round:{snapshot:()=>({phase:'idle'})}};
  call.call(scene,e.profile.getPublicPerformer(id));
  assert.equal(e.doc.querySelector('.mihoyo-name').textContent,name);
  assert.equal(e.doc.getElementById('special-label').textContent,label);
  assert.equal(e.doc.querySelector('.mihoyo-portrait').textContent,'');
  assert.match(e.doc.querySelector('.mihoyo-portrait').style.backgroundImage,/user-cast-20261015/);
  assert.match(e.doc.getElementById('skill-special').getAttribute('aria-label'),new RegExp(name+'.*待开演'));
  assert.equal(e.doc.getElementById('skill-special').getAttribute('aria-disabled'),'true');
 }
});
test('legacy cast sync retains its original identity and does not enable current HUD semantics',()=>{
 const e=fixture(),body=source.match(/  _syncPublicCastHud\(member\) \{([\s\S]*?)\n  \}\n\n  _freezePublicPaintRound/)[1];
 let calls=0;const call=new Function('document','getPublicPerformer','performerPortraitCss','syncPublicBattleHud',`return function(member){${body}}`)(e.doc,e.profile.getPublicPerformer,()=> 'legacy portrait',()=>calls++);
 call.call({battleData:{performerId:'sakura'}},e.profile.getPublicPerformer('sakura'));
 assert.equal(e.doc.querySelector('.mihoyo-name').textContent,'绯樱');assert.equal(calls,0);
});
test('current public UI queues required bitmap images in the same scene loader and restores loader mode',()=>{
 const e=fixture(),preload=e.surface.preloadPublicBattleUi;
 assert.equal(typeof preload,'function');
 const rows=[],scene={load:{imageLoadType:'XHR',image(key,path){rows.push({key,path,mode:this.imageLoadType});}},textures:{exists:()=>false}};
 preload(scene,{stageId:1,performerId:'kai'});
 assert.equal(rows.length,16);assert(rows.every(row=>row.mode==='HTMLImageElement'));
 assert.equal(scene.load.imageLoadType,'XHR');assert.equal(new Set(rows.map(row=>row.key)).size,16);
 for(const path of ['panel','title','primary','secondary','disc','disc-ready','nozzle','relay','tempo','echo','overdrive','recovery','action-kai'])assert(rows.some(row=>row.path.endsWith('/'+path+'.webp')),path);
 assert(rows.some(row=>row.path.endsWith('/mecha-sword-avatar.webp')));assert(rows.some(row=>row.path.endsWith('/mecha-sword.webp')));
 assert(rows.some(row=>row.path==='art/formal-ui-20261016/disc.webp'));
 assert.match(source,/preloadPublicBattleUi\(this, this\.initialBattleData\)/);
});
test('cached UI, hidden practice and non-public routes do not queue duplicate or current-cast UI',()=>{
 const e=fixture(),preload=e.surface.preloadPublicBattleUi;assert.equal(typeof preload,'function');
 const scene={load:{image(){assert.fail('unexpected UI file');}},textures:{exists:()=>true}};
 preload(scene,{stageId:1,performerId:'sakura'});assert(!Object.hasOwn(scene.load,'imageLoadType'));
 scene.textures.exists=()=>false;
 for(const data of [{stageId:2},{stageId:1,practiceMode:true}])preload(scene,data);
 e.loadRuntime('utils/userCast.mjs').configureUserCast(false);preload(scene,{stageId:1,performerId:'sakura'});
});
test('UI load failure blocks creation and retries the exact original scene once through the existing recovery owner',()=>{
 const e=fixture(),preload=e.surface.preloadPublicBattleUi;assert.equal(typeof preload,'function');
 let retry,ready=0;const restarts=[],rows=[],data={stageId:1,performerId:'enjo'};
 const scene={initialBattleData:data,events:new EventEmitter(),load:Object.assign(new EventEmitter(),{image(key,path){rows.push({key,path});}}),
  textures:{exists:()=>false},scene:{pause(){},restart(d){restarts.push(d);}}};
 scene._loadRecovery=beginSceneLoading(scene,{start(){},fail(fn){if(fn)retry=fn;},ready(){ready++;}});
 preload(scene,data);scene.load.emit('loaderror',rows.find(row=>row.path.endsWith('/panel.webp')));
 assert.equal(finishSceneLoading(scene),false);assert.equal(ready,0);assert.equal(retry(),true);assert.equal(retry(),false);assert.deepEqual(restarts,[data]);
});
