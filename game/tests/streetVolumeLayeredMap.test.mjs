import assert from 'node:assert/strict';
import { OLD_STREET_ASSETS, OLD_STREET_PROPS, OLD_STREET_DEVICES, OldStreetState } from '../src/utils/oldStreetMap.mjs';
import { STREET_RESTORATION_ART } from '../src/systems/StreetRestorationSurface.mjs';
import { OldStreetScene } from '../src/systems/OldStreetScene.mjs';
import { RUNTIME_PAYLOAD } from '../scripts/runtime-payload.mjs';
import { oldStreetMaterialPath } from '../src/systems/StreetMaterialPresentation.mjs';

assert.equal(STREET_RESTORATION_ART,'art/street-perspective-20261009/','reviewed cohesive floor, not the retired textured street');
const restored=OLD_STREET_PROPS.filter(p=>p.restorable);
assert(restored.some(p=>p.art==='tree'&&p.restorationId==='record-shop'));
for(const p of restored){
  assert(OLD_STREET_ASSETS.includes(p.art+'-muted'),'independent authored gray volume: '+p.id);
  assert(p.y-p.height>=0&&p.x-p.width/2>=0&&p.x+p.width/2<=1000,'no cropped map props: '+p.id);
  const r=p.footprint;
  assert(r&&r.y>=p.y-p.height&&r.y+r.height<=p.y,'footprint belongs to the building base: '+p.id);
  assert(OLD_STREET_DEVICES.some(d=>d.restores===(p.restorationId||p.id)),'restoration has a real gameplay owner');
}
const state=new OldStreetState();
const gate=OLD_STREET_PROPS.find(p=>p.id==='loading-gate');
assert(gate.footprint.y-32>=960,'gate must leave a body-safe landing north of it inside the first zone');
for(const device of OLD_STREET_DEVICES)assert(state.clearLine(device,device,16),'contact cannot be inside a building: '+device.id);
for(const id of OLD_STREET_ASSETS)assert(RUNTIME_PAYLOAD.some(a=>a.file===oldStreetMaterialPath(id)));
assert.equal(RUNTIME_PAYLOAD.filter(a=>a.group==='oldstreet-scene').length,26);
assert(!RUNTIME_PAYLOAD.some(a=>a.file.includes('street-restoration-20260913/')||a.file.includes('dressed')));

const images=[];
function node(texture){return {texture,frame:{realWidth:560,realHeight:520},scene:true,body:{enable:true},
  setOrigin(){return this;},setDisplaySize(w,h){this.width=w;this.height=h;return this;},setDepth(d){this.depth=d;return this;},
  setVisible(v){this.visible=v;return this;},setAlpha(a){this.alpha=a;return this;},setCrop(...v){this.crop=v;return this;},
  setInteractive(){return this;},on(){return this;},setText(){return this;},setPosition(){return this;},destroy(){this.destroyed=true;}};}
const scene={player:{x:500,y:1708},add:{image(_x,_y,t){const n=node(t);images.push(n);return n;},zone(){return node();},text(){return node();}},
  physics:{add:{staticGroup(){return {add(){},scene:true,destroy(){}};},existing(){},collider(){return {};}}},
  input:{},paintZone:{devices:OLD_STREET_DEVICES.map(d=>({...d,paint:0}))},actorPresentation:{playerImage:node()}};
const owner=new OldStreetScene(scene);
assert.equal(owner.items.get('record-shop').image.texture,'oldstreet-shop-muted','no runtime grayscale filter masquerading as authored gray art');
const record=scene.paintZone.devices.find(d=>d.restores==='record-shop');record.paint=26;
owner.updateRestoration(record,scene.paintZone.devices);
const tree=[...owner.items.values()].find(i=>i.definition.restorationId==='record-shop');
for(const item of [owner.items.get('record-shop'),tree]){
  assert.equal(item.progress,.5);assert.equal(item.colorImage.visible,true);assert.deepEqual(item.colorImage.crop,[0,260,560,260]);
}
assert.equal(owner.items.get('repair-shop').progress,0,'one place does not restore the whole map');
record.paint=52;owner.restore(record);owner.sync();
assert(owner.state.isOpen('loading-gate'));
assert.equal(tree.image.visible,false,'completed gray layer is removed, not doubled');
scene.player={x:record.x,y:1300};owner.sync();
assert.equal(owner.items.get('record-shop').colorImage.alpha,.42,'actor behind a tall facade remains readable');
scene.player={x:record.x,y:1470};owner.sync();
assert.equal(owner.items.get('record-shop').colorImage.alpha,1,'facade returns to normal in front');
owner.destroy();assert(images.every(n=>n.destroyed),'all native and restored layers cleaned up');
console.log('street volume: native gray layers, grounded props, restoration ownership, occlusion and release boundary passed');
