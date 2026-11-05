import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as actors from '../src/systems/ActorPresentation.mjs';
import {getUiPerformerArt} from '../src/systems/UiPerformerArt.mjs';
import * as viewport from '../src/utils/gameViewport.mjs';
import {formatPaintObjectiveLine} from '../src/utils/stage1PaintRound.mjs';
import {getRunChoice} from '../src/utils/publicRunProgression.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

const ids=['sakura','venus','genya','kai','enjo'];
test('five roster identities use reviewed Q presentation, not the adult illustration slot',()=>{
  assert.equal(typeof actors.getPerformerRosterVisual,'function');
  for(const id of ids){
    const visual=actors.getPerformerRosterVisual(id);
    assert.equal(visual.id,id);
    if(id==='sakura'||id==='venus'||id==='genya'||id==='kai'||id==='enjo')assert.equal(visual.source,actors.getPerformerArt(id).fullPortrait);
    else{
      assert.equal(visual.source,actors.getPerformerArt(id).path);
      assert.deepEqual([visual.frame,visual.columns,visual.rows,visual.frameSize],[16,4,16,128]);
      assert.equal(visual.kind,'cel');
    }
  }
  assert.equal(actors.getPerformerRosterVisual('unknown'),null);
});

test('the actual roster consumer clips exactly one front idle frame and keeps confirmation unchanged',()=>{
  const env=loadScenes(),view=env.harness(env.IdolRosterScene);view.scene.create();
  for(const id of ids){
    view.click(`[data-member=${id}]`);
    const mark=view.query('.member-mark-large');assert.equal(mark.dataset.performer,id);
    const image=mark.querySelector('.member-portrait');
    assert.equal(image.src,getUiPerformerArt(id).portrait);
    if(id!=='sakura'&&id!=='venus'&&id!=='genya'&&id!=='kai'&&id!=='enjo'){
      assert.ok(mark.querySelector('.member-cel-frame'));
      assert.equal(mark.style['--cel-row'],'4');
      assert.equal(mark.style['--cel-column'],'0');
    }
  }
  assert.equal(env.profile.loadPublicProfile().selectedId,'sakura','previews must not write selection');
  view.click('[data-action=confirm-member]');assert.equal(env.profile.loadPublicProfile().selectedId,'enjo');
  view.shutdown();assert.equal(view.root,null);
});

test('DOM shell reflows at real display size below one scale without altering the canvas fit',()=>{
  assert.equal(typeof viewport.getPublicShellViewport,'function');
  for(const [w,h] of [[320,667],[320,568],[375,667],[430,932],[1440,900]]){
    const f=viewport.calculateGameViewport({width:w,height:h}),before={...f};
    const s=viewport.getPublicShellViewport(f),visibleScale=f.scale*s.compensation;
    assert.ok(visibleScale>=1);
    assert.ok(Math.abs(s.width*visibleScale-f.width)<1e-8);
    assert.ok(Math.abs(s.height*visibleScale-f.height)<1e-8);
    assert.ok(44*visibleScale>=44);assert.ok(12*visibleScale>=12);
    assert.deepEqual(f,before);
  }
  for(const f of [null,{}, {scale:0,width:0,height:0},{scale:NaN,width:320,height:500}])assert.equal(viewport.getPublicShellViewport(f),null);
});

test('viewport binding publishes shell dimensions on resize before refreshing unchanged Phaser bounds',()=>{
  const properties={},style={setProperty:(k,v)=>{properties[k]=v;}};
  const listeners=new Map(),host={innerWidth:320,innerHeight:667,document:{getElementById:id=>id==='game-container'?{style}:null},
    addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
  let n=0;const dispose=viewport.bindGameViewport({config:{width:375,height:667},scale:{refresh(){n++;}}},host);
  assert.equal(properties['--public-shell-width'],'320px');
  assert.ok(Number(properties['--public-shell-compensation'])>1);
  host.innerWidth=375;listeners.get('resize')();
  assert.equal(properties['--public-shell-width'],'375px');assert.equal(properties['--public-shell-compensation'],'1');
  assert.equal(style.transform,'scale(1)');assert.equal(n,2);dispose();assert.equal(listeners.size,0);
});

test('desk start is outside scrollable main and the original callbacks and navigation survive',()=>{
  const env=loadScenes(),view=env.harness(env.TitleScene);view.scene.create();
  const start=view.query('[data-action=start]');
  assert.equal(start.parentNode.className,'lobby-primary-actions');
  assert.equal(start.parentNode.parentNode.parentNode,view.root);
  assert.equal(start.parentNode.parentNode.tagName,'FOOTER');
  assert.equal(view.all('[data-nav]').length,6);
  view.click('[data-action=start]');assert.equal(view.starts.length,1);view.shutdown();
});

test('facility copy agrees before and during play without changing the recovery id',()=>{
  assert.equal(formatPaintObjectiveLine(0),'街区设施 0/10');
  assert.equal(formatPaintObjectiveLine(100),'街区设施 10/10');
  const c=getRunChoice('recovery');assert.equal(c.id,'recovery');
  assert.equal(c.label,'设施回响');assert.equal(c.description,'恢复必需设施时恢复1生命，上限5');
});

test('public shell rules retain screen-sized controls and static cel cropping, not fake motion',()=>{
  const css=fs.readFileSync(new URL('../src/styles/freshExperience.css',import.meta.url),'utf8');
  assert.match(css,/width:\s*var\(--public-shell-width/);
  assert.match(css,/transform:\s*scale\(var\(--public-shell-compensation/);
  assert.match(css,/\.member-cel-frame/);
  assert.match(css,/min-height:\s*44px/);
  assert.doesNotMatch(css,/animation:\s*.*(?:roster|cel)|font-size:\s*.*vw/);
});

test('fullscreen session dialogs share menu reflow instead of shrinking their rule and journal commands',()=>{
  const css=fs.readFileSync(new URL('../src/styles/freshExperience.css',import.meta.url),'utf8');
  assert.match(css,/#game-container #player-session-dialog\s*\{[^}]*width:\s*var\(--public-shell-width/s);
  assert.match(css,/#game-container #player-session-dialog\s*\{[^}]*transform:\s*scale\(var\(--public-shell-compensation/s);
});
