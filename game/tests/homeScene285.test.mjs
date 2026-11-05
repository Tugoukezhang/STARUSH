import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {bindGameViewport} from '../src/utils/gameViewport.mjs';

test('home owns exactly one full-viewport scene, removed on navigation and destruction',()=>{
  const s=loadScenes();s.loadRuntime('utils/userCast.mjs').configureUserCast(true);s.seed();
  const h=s.harness(s.TitleScene);h.scene.create();const view=h.scene._publicShell;
  const scenes=()=>s.document.querySelectorAll('.ui-home-scene');
  assert.equal(scenes().length,1);
  assert.equal(scenes()[0].parentNode,view.root.parentNode);
  assert.equal(scenes()[0].getAttribute('aria-hidden'),'true');
  assert.equal(view.root.querySelector('.ui-room-background'),null);
  view.render();assert.equal(scenes().length,1);
  h.click('[data-action=start]');assert.equal(scenes().length,0);
  view.showPage('desk');assert.equal(scenes().length,1);
  h.shutdown();assert.equal(scenes().length,0);
});

for(const [width,height,top,bottom] of [[393,852,59,34],[320,667,0,0],[1280,900,0,0]]){
  test(`scene covers viewport without changing safe controls: ${width}x${height}`,()=>{
    const values={},style={setProperty:(k,v)=>values[k]=v},container={style};
    const host={innerWidth:width,innerHeight:height,addEventListener(){},removeEventListener(){},
      document:{getElementById:id=>id==='game-container'?container:{}},
      getComputedStyle:()=>({paddingTop:String(top),paddingBottom:String(bottom),paddingLeft:'0',paddingRight:'0'})};
    const dispose=bindGameViewport({config:{width:375,height:667},scale:{refresh(){}}},host);
    const scale=Number(values['--menu-shell-compensation']);
    assert.equal(parseFloat(values['--menu-scene-height']),height);
    assert.equal(parseFloat(values['--menu-safe-bottom']),bottom);
    assert.equal(parseFloat(values['--menu-shell-height']),height-top-bottom);
    assert.ok(Math.abs((parseFloat(values['--menu-shell-top'])-parseFloat(values['--menu-scene-top']))/scale-top)<1e-8);
    assert.equal(parseFloat(values['--menu-shell-width']),Math.min(width,480));dispose();
  });
}
