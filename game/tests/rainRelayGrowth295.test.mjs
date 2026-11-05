import test from 'node:test';import assert from 'node:assert/strict';import {loadScenes} from './helpers/publicShellHarness.mjs';
import {PUBLIC_MENU_ART,EQUIPMENT_MENU_ART} from '../src/systems/PublicMenuArt.mjs';
import {getEquipmentIconArt} from '../src/systems/EquipmentIconArt.mjs';
test('reward and legacy equipment controls resolve the same original relay icon as inventory',()=>{
 assert.equal(PUBLIC_MENU_ART[EQUIPMENT_MENU_ART.rain_relay],getEquipmentIconArt('rain_relay').src);
});
test('growth comparison displays a non-stat chapter behavior and retains its chapter source',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.seed(['opening','neon','encore','raincheck']);
 const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'growth'});h.scene.create();
 try{const view=h.scene._publicShell;view.growthEquipmentId='rain_relay';view.render();
  assert.match(h.query('.inventory-impact').textContent,/最近.*至多20点/);assert(h.query('[data-action=growth-source]'));}
 finally{h.shutdown();}
});
