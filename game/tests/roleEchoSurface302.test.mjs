import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';

function fixture(id){
 const e=loadScenes(),cast=e.loadRuntime('utils/userCast.mjs');cast.configureUserCast(true);
 const {BattleSurfaceView}=e.loadRuntime('systems/BattleSurfaceView.mjs');
 const {getPublicBuildModel}=e.loadRuntime('utils/publicBuildContent.mjs');
 const build=getPublicBuildModel(null,id,['relay']),calls=[];
 const scene={battleData:{campaignChapterId:'opening'},publicPerformerRun:{getBuildSnapshot:()=>build},input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},events:{once(){},off(){}},sound:null};
 const view=new BattleSurfaceView(scene,{mode:'choice',member:cast.getDisplayPerformer(id),number:2,choices:['relay'],options:new e.profile.PublicRunProgression({performerId:id,choices:['relay']}).getOptions(),onChoice:id=>calls.push(id),onLeave:()=>calls.push('leave')},e.document);
 return {e,view,scene,calls};
}

for(const [id,label,category] of [['kai','回响回斩','风铃回响'],['enjo','星页回响','星页回响']]){
 test(id+' choice conveys its actual melee echo and keeps the canonical echo command',()=>{
  const f=fixture(id),row=f.view.root.querySelector('[data-choice=echo]'),image=row.querySelector('img.battle-choice-art');
  assert.equal(image.src,(id==='kai'?'art/green-windsong-20261123/weapon.png':'art/blue-academy-20261123/weapon.png'));assert.equal(image.width,256);assert.equal(image.height,256);
  assert.equal(row.querySelector('strong').textContent,label);assert.equal(row.querySelector('.battle-choice-category').textContent,category);
  assert(row.getAttribute('aria-label').startsWith(label+'。'));assert.equal(row.querySelector('.battle-choice-symbol').querySelector('svg'),null);
  const before=plain(f.e.profile.loadPublicProfile());row.click();row.click();assert.deepEqual(f.calls,[]);f.view.root.querySelector('[data-action=confirm-choice]').click();assert.deepEqual(f.calls,['echo']);
  assert.deepEqual(plain(f.e.profile.loadPublicProfile()),before);f.view.destroy();assert(f.scene.input.enabled);
 });
 test(id+' preload loads its specific image before displaying the choice',()=>{
  const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const {preloadPublicBattleUi}=e.loadRuntime('systems/BattleSurfaceView.mjs'),paths=[];
  preloadPublicBattleUi({load:{image:(key,path)=>paths.push(path),spritesheet(){}},textures:{exists:()=>false}},{stageId:1,performerId:id});
  assert(paths.includes((id==='kai'?'art/green-windsong-20261123/weapon.png':'art/blue-academy-20261123/weapon.png')));
 });
}
test('rifle echo remains its existing delayed paint identity',()=>{
 const f=fixture('sakura'),row=f.view.root.querySelector('[data-choice=echo]');
 assert.equal(row.querySelector('strong').textContent,'回响追加');assert.equal(row.querySelector('.battle-choice-category').textContent,'延迟补色');
 assert.equal(row.querySelector('img').src,'art/formal-ui-20261016/echo.webp');f.view.destroy();
});
test('failed melee artwork is explicit and does not disable the actual choice',()=>{
 const f=fixture('kai'),row=f.view.root.querySelector('[data-choice=echo]');row.querySelector('img').dispatchEvent({type:'error'});
 assert.match(row.textContent,/图标加载失败/);row.click();f.view.root.querySelector('[data-action=confirm-choice]').click();assert.deepEqual(f.calls,['echo']);f.view.destroy();
});
