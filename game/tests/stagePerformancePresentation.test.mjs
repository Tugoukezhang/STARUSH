import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import postcss from 'postcss';
import {StreetPaintSurface} from '../src/systems/StreetRestorationSurface.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function surface(publicRound){
 const image={setOrigin(){return this;},setDisplaySize(){return this;},setDepth(){return this;},setAlpha(a){this.alpha=a;return this;},setBlendMode(){return this;},destroy(){}};
 const scene={_isPublicStage1Round:()=>publicRound,textures:{createCanvas(){return {context:{createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}},refresh(){}};},exists:()=>true,remove(){}},add:{image:()=>image}};
 return {image,owner:new StreetPaintSurface(scene,()=>[],64,64)};
}
test('public pigment is stronger without changing its contact geometry or legacy behavior',()=>{
 const legacy=surface(false),live=surface(true);
 assert.equal(live.image.alpha,.9,'Owner-requested public recoloring has strong coverage');
 assert.equal(legacy.image.alpha,.5);
 for(const f of [legacy,live])f.owner.stamp(24,24,12,0xFF69B4);
 const a=legacy.owner.raster.pixels,b=live.owner.raster.pixels;
 for(let i=3;i<a.length;i+=4)assert.equal(a[i],b[i],'Coverage/hit geometry cannot expand with color strength');
 const offset=(12*32+12)*4;
 assert(a[offset+1]-b[offset+1]>=35,'Public pigment must retain more actual performer color');
 for(const channel of b.slice(offset,offset+3))assert(1-.9*(1-channel/255)>=.18,'Multiply keeps authored ground detail under saturated pigment');
 const before=b.slice();live.owner.raster.consumeDirty();live.owner.stamp(24,24,12,0xFF69B4);assert.deepEqual(b,before,'Repeated contacts cannot darken pigment');
 legacy.owner.destroy();live.owner.destroy();
});
test('all five result identities share an outcome header and retain actual commands',()=>{
 const env=loadScenes(),{BattleSurfaceView,getPublicResultSurfaceModel}=env.loadRuntime('systems/BattleSurfaceView.mjs');
 for(const member of env.profile.PUBLIC_PERFORMERS)for(const victory of [true,false]){
  const actions=[],scene={events:new EventEmitter(),input:{enabled:true,keyboard:{enabled:true}},sound:{}};
  const model=getPublicResultSurfaceModel({buttons:[{label:'再演本站',action:'retry'}]},{performerId:member.id,chapterId:'opening',victory,durationMs:32000,actions:4,choices:['wide_brush','echo'],persisted:true});
  const view=new BattleSurfaceView(scene,{mode:'result',model,onAction:id=>actions.push(id)},env.document);
  assert.equal(view.root.dataset.outcome,victory?'victory':'defeat');assert.equal(view.root.dataset.performer,member.id);
  const header=view.root.querySelector('.battle-performance-header');assert(header,'Result is still a list of disconnected table bands');
  assert(header.querySelector('h2'));assert.equal(header.querySelector('.battle-performer-visual').dataset.performer,member.id);
  assert.equal(header.querySelector('img').width,232);assert.equal(header.querySelector('img').height,290);
  assert.equal(view.root.querySelector('.battle-result-stats').children.length,3);
  view.root.querySelector('[data-result-action=retry]').click();view.root.querySelector('[data-result-action=retry]').click();assert.deepEqual(actions,['retry']);
  view.destroy();assert.equal(scene.input.enabled,true);assert.equal(env.document.getElementById('battle-result'),null);
 }
});
test('choice uses member palette without touching selection effects or losing descriptions',()=>{
 const env=loadScenes(),{BattleSurfaceView}=env.loadRuntime('systems/BattleSurfaceView.mjs'),member=env.profile.PUBLIC_PERFORMERS.find(m=>m.id==='kai'),chosen=[];
 const scene={events:new EventEmitter(),input:{enabled:true,keyboard:{enabled:true}},sound:{},battleData:{campaignChapterId:'neon'}};
 const options=['wide_brush','relay','tempo'].map(id=>env.profile.getRunChoice(id));
 const view=new BattleSurfaceView(scene,{mode:'choice',member,number:1,choices:[],options,onChoice:id=>chosen.push(id),onLeave(){}},env.document);
 assert.equal(view.root.dataset.performer,'kai');assert.equal(view.root.style['--performer-color'],'#00ced1');
 assert.equal(view.root.querySelector('.battle-choice-context').textContent,'霓虹街口');
 for(const option of options)assert(view.root.querySelector('[data-choice='+option.id+']').textContent.includes(option.description));
 view.root.querySelector('[data-choice=relay]').click();view.root.querySelector('[data-choice=tempo]').click();assert.deepEqual(chosen,['relay']);view.destroy();
});
test('stage layout defines bounded portrait and compact nonoverlapping footer tracks',()=>{
 const css=postcss.parse(['freshExperience.css','gameUiTheme.css'].map(name=>fs.readFileSync(new URL('../src/styles/'+name,import.meta.url),'utf8')).join('\n'));
 const decl=selector=>{const values={};css.walkRules(selector,r=>r.walkDecls(d=>values[d.prop]=d.value));return values;};
 assert.equal(decl('#game-container #battle-result .battle-performance-header')['min-height'],'204px');
 assert.equal(decl('#game-container #battle-result .battle-surface-footer')['grid-template-columns'],'repeat(2,minmax(0,1fr))');
 assert.equal(decl('#game-container #battle-result .battle-surface-footer .battle-primary')['grid-column'],'1 / -1');
 assert.equal(decl('#game-container #run-choice .battle-choice-symbol')['background'],'var(--game-yellow)');
 assert.equal(decl('#game-container #run-choice.battle-surface .battle-choice-row .battle-choice-symbol svg')['color'],'#162622');
 assert.equal(decl('#game-container #battle-result .battle-performance-header .battle-performer-visual img')['height'],'205px');
});
