import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';
import {StreetPaintSurface} from '../src/systems/StreetRestorationSurface.mjs';

function node(kind,args){
 const n=Object.assign(new EventEmitter(),{kind,args,active:true});
 for(const method of ['setOrigin','setDisplaySize','setDepth','setScrollFactor','setStrokeStyle','setFillStyle','setInteractive','setPosition','setScale','setRadius','setAlpha','setText','setColor','setFontSize','setStyle','setVisible','setBlendMode'])n[method]=function(...v){this[method.slice(3)]=v;return this;};
 n.destroy=function(){this.active=false;};return n;
}
const {BattleScene,PaintZoneSystem}=loadBattleScene({Phaser:{Scene:class{}},includeOwners:true});
function scene(publicMode=true){
 const s=Object.create(BattleScene.prototype),nodes=[];
 s._isPublicStage1Round=()=>publicMode;s._pinHud=n=>n;
 s.add=Object.fromEntries(['circle','text','rectangle','image','graphics'].map(kind=>[kind,(...args)=>{const n=node(kind,args);nodes.push(n);return n;}]));
 s._battleEnded=false;return {s,nodes};
}
test('public joystick reduces drawn weight without changing input origin; diagnostic presentation stays intact',()=>{
 const {s}=scene();s._createMoveJoystick();
 assert.equal(s._joystickBase.args[2],44,'public base must not draw the oversized 58px ring');
 assert.equal(s._joystickKnob.args[2],20);
 assert.deepEqual({...s._joystickRest},{x:68,y:571});
 assert.equal(s._joystickHint.args[2],'','no redundant instruction over the control band');
 s._hideMobileControlsForResult();assert.deepEqual(s._joystickBase.Visible,[false]);
 const hidden=scene(false).s;hidden._createMoveJoystick();assert.equal(hidden._joystickBase.args[2],58);assert.equal(hidden._joystickHint.args[2],'拖动');
});
test('obsolete colour-palette backing is absent and actor cleanup remains idempotent',()=>{
 const {s}=scene();s.battleData={stageId:1,performerId:'sakura'};s.textures={exists:()=>false};
 const view=new ActorPresentation(s);assert.equal(view.controlBand,null,'No whole-width backing remains after palette removal');
 view.destroy();view.destroy();assert.equal(view.controlBand,null);
 s.battleData.practiceMode=true;assert.equal(new ActorPresentation(s).controlBand,null);
});
test('public paint remains one bounded layer with strong visible pigment; hidden route stays muted',()=>{
 const {s}=scene();const context={setTransform(){},createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData(){}};s.textures={createCanvas:()=>({context}),exists:()=>false};
 const surface=new StreetPaintSurface(s,()=>[]);assert.deepEqual(surface.image.Alpha,[0.9]);assert.deepEqual(surface.image.Depth,[0.4]);surface.destroy();
 s._isPublicStage1Round=()=>false;const hidden=new StreetPaintSurface(s,()=>[]);assert.deepEqual(hidden.image.Alpha,[0.5]);hidden.destroy();
});
test('five swatches retain real color selection, same hotspots, and a non-white selected edge',()=>{
 const {s}=scene();s.mobileControlButtons=[];s.mobileControlHotspots=[];s.currentColor='pink';let chosen=null,stopped=0;
 s._selectPublicStage1Color=id=>{chosen=id;s.currentColor=id;s._syncPublicStage1ColorPalette();};s._createPublicStage1ColorPalette();
 assert.deepEqual(s.mobileControlHotspots.map(p=>[p.x,p.y,p.radius]),[[145,637,21],[189,637,21],[233,637,21],[277,637,21],[321,637,21]]);
 assert.equal(s._publicStage1ColorPalette[0].bg.StrokeStyle[1],0x293B44);
 const blue=s._publicStage1ColorPalette[1];blue.bg.emit('pointerdown',{},0,0,{stopPropagation(){stopped++;}});
 assert.equal(chosen,'blue');assert.equal(stopped,1);assert.equal(blue.label.args[3].strokeThickness,0);
 blue.bg.emit('pointerup');assert.deepEqual(blue.bg.Scale,[1]);assert.equal(blue.bg.StrokeStyle[1],0x293B44);
});
test('scene labels remain readable even when the sprite is unavailable',()=>{
 const {s}=scene();s.battleData={stageId:1,campaignChapterId:'opening'};s.currentColor='pink';s.textures={exists:()=>false};
 const zone=new PaintZoneSystem(s);zone._drawKindShape=()=>{};const redraw=zone._redrawDevice;zone._redrawDevice=()=>{};zone._spawnDevice({id:'test',x:100,y:300,kind:'speaker',required:true,label:'唱片店灯箱',sceneArt:'speaker'});
 const style=zone.devices[0].label.args[3];assert.equal(style.fontSize,'12px');assert.equal(style.strokeThickness,0);assert.equal(style.backgroundColor,'#26383C');
 const source=readFileSync(new URL('../src/systems/ChapterScenePresentation.mjs',import.meta.url),'utf8');assert.match(source,/#293B44/);
 const device=zone.devices[0];for(const method of ['clear','fillStyle','lineStyle'])device.gfx[method]=()=>{};
 redraw.call(zone,device);assert.deepEqual(device.label.Color,['#F6F9F8'],'missing sprite must retain the same light ink on the compact dark label');
});
test('public HUD owns one coherent style, while action icons preserve actual readiness and accessible names',()=>{
 const css=readFileSync(new URL('../src/styles/battleSurface.css',import.meta.url),'utf8');
 assert.match(css,/#hud::before/);assert.match(css,/\.skill-orb svg/);
 assert.match(css,/mask-image: radial-gradient\(circle 22px at 347px 78px/,'DOM backing must not wash out the canvas-owned pause control');
 const fresh=readFileSync(new URL('../src/styles/freshExperience.css',import.meta.url),'utf8');assert.doesNotMatch(fresh,/data-battle-mode=public/,'public HUD must not be re-overridden by later shell CSS');
 const env=loadScenes(),doc=env.document,{syncPublicBattleHud}=env.loadRuntime('systems/BattleSurfaceView.mjs');
 for(const id of ['skill-special','skill-encore','special-state','encore-state']){const el=doc.createElement('button');el.id=id;doc.body.append(el);}
 const state={_isPublicStage1Round:()=>true,_specialCharge:42,_encoreCharge:100,publicPerformerRun:{member:env.profile.PUBLIC_PERFORMERS[0],canAct:()=>false}};
 syncPublicBattleHud(state,doc);syncPublicBattleHud(state,doc);
 for(const id of ['skill-special','skill-encore']){const b=doc.getElementById(id);assert.equal(b.querySelectorAll('svg').length,1);assert.equal(b.getAttribute('title'),b.getAttribute('aria-label'));}
 assert.equal(doc.getElementById('skill-special').getAttribute('aria-disabled'),'true');assert.equal(doc.getElementById('special-state').textContent,'42%');
 assert.equal(doc.getElementById('skill-encore').getAttribute('aria-disabled'),'false');
});
