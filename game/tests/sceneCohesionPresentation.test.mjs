import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';
import {EventEmitter} from 'node:events';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {WorldGroundContacts} from '../src/systems/WorldGroundingPresentation.mjs';
const parse=name=>postcss.parse(fs.readFileSync(new URL('../src/styles/'+name,import.meta.url),'utf8'));
const declaration=(css,selector)=>{const result={};css.walkRules(selector,r=>{if(r.parent.type==='root')r.walkDecls(d=>result[d.prop]=d.value);});return result;};
test('choice gives five actual members a square face; result keeps the complete standing portrait',()=>{
 const env=loadScenes(),{BattleSurfaceView,getPublicResultSurfaceModel}=env.loadRuntime('systems/BattleSurfaceView.mjs');
 const {getUiPerformerArt}=env.loadRuntime('systems/UiPerformerArt.mjs');
 for(const member of env.profile.PUBLIC_PERFORMERS){
  const scene={events:new EventEmitter(),input:{enabled:true,keyboard:{enabled:true}},sound:{},battleData:{campaignChapterId:'opening'}},selected=[];
  const choice=new BattleSurfaceView(scene,{mode:'choice',member,number:1,choices:[],options:[env.profile.getRunChoice('echo')],onChoice:id=>selected.push(id),onLeave(){}},env.document);
  const image=choice.root.querySelector('.battle-performer-visual').querySelector('img'),art=getUiPerformerArt(member.id);
  assert.equal(image.src,art.avatar,'Choice thumbnail must not shrink a whole standing figure');
  assert.equal(image.width,128);assert.equal(image.height,128);
  assert.equal(choice.root.querySelector('.battle-visual-copy').querySelector('strong').textContent,member.name);
  choice.root.querySelector('[data-choice=echo]').click();choice.root.querySelector('[data-choice=echo]').click();assert.deepEqual(selected,['echo']);choice.destroy();
  const model=getPublicResultSurfaceModel({buttons:[{label:'Retry',action:'retry'}]},{performerId:member.id,chapterId:'opening',victory:true,persisted:true});
  const result=new BattleSurfaceView(scene,{mode:'result',model,onAction(){}},env.document),full=result.root.querySelector('.battle-performance-header').querySelector('img');
  assert.equal(full.src,art.victory);assert.equal(full.width,232);assert.equal(full.height,290);result.destroy();
  assert.equal(scene.events.listenerCount('shutdown'),0);assert.equal(scene.input.enabled,true);
 }
});
test('public HUD uses a light backing and dark readable ink without moving input or pause cutout',()=>{
 const css=parse('battleSurface.css'),scope='#game-container[data-battle-mode="public"]';
 assert.match(declaration(css,scope+' #hud::before').background,/#f7faf8/,'HUD may not darken the whole top street');
 assert.equal(declaration(css,scope+' #wave-text').color,'#263840');
 assert.equal(declaration(css,scope+' .mihoyo-name').color,'#263840');
 assert.equal(declaration(css,scope+' #hp-value').color,'#354d57');
 assert.equal(declaration(css,scope+' #battle-chapter').color,'#354d57');
 assert.equal(declaration(css,scope+' .mihoyo-skills').bottom,'109px');
 assert.match(declaration(css,scope+' #hud::before')['mask-image'],/circle 22px at 347px 78px/);
 const fresh=parse('freshExperience.css'),face=declaration(fresh,'#game-container #run-choice .battle-performer-visual img');
 assert.equal(face.width,'56px');assert.equal(face.height,'56px');assert.equal(face['object-fit'],'cover');
 assert.equal(declaration(fresh,'#game-container #run-choice .battle-performer-visual')['min-height'],'64px');
 assert.equal(declaration(fresh,'#game-container #run-choice h2')['font-size'],'24px');
 assert.equal(declaration(fresh,'#game-container #run-choice .battle-lead')['margin-bottom'],'6px');
});
test('floor contact increases readable volume but keeps exact feet, one node, pause/end and alpha caps',()=>{
 const g={commands:[],setDepth(d){this.depth=d;return this;},clear(){this.commands=[];return this;},fillStyle(...args){this.commands.push(['style',...args]);return this;},fillEllipse(...args){this.commands.push(['ellipse',...args]);return this;},destroy(){this.destroyed=true;}};
 const scene={add:{graphics:()=>g}},owner=new WorldGroundContacts(scene),player={x:100,y:200,hp:5,active:true},feet=[{x:97,y:226},{x:103,y:226}],input={player,feet,alpha:1,enemies:[]},before=JSON.stringify(input);
 owner.update(input);assert(g.commands.some(c=>c[0]==='ellipse'&&c[1]===100&&c[2]===226&&c[3]===18&&c[4]===5.8),'Body shadow must read as a grounded volume, not a fine floor line');
 assert.equal(g.commands[0][2],.18);assert(g.commands.filter(c=>c[0]==='style').every(c=>c[2]<=.2));
 assert.deepEqual(g.commands.filter(c=>c[0]==='ellipse'&&c[3]===4.8).map(c=>({x:c[1],y:c[2]})),feet);
 const saved=JSON.stringify(g.commands);scene._battlePaused=true;owner.update({...input,player:{...player,x:900}});assert.equal(JSON.stringify(g.commands),saved);
 scene._battlePaused=false;owner.update({...input,alpha:0});assert.equal(g.commands.length,0);owner.update(input);scene._battleEnded=true;owner.update(input);assert.equal(g.commands.length,0);
 owner.destroy();owner.destroy();assert.equal(g.destroyed,true);assert.equal(JSON.stringify(input),before);
});
