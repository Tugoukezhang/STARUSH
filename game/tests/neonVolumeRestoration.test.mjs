import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {NEON_STREET_CONFIG,NEON_STREET_PROPS,NEON_STREET_DEVICES,NEON_STREET_ASSETS} from '../src/utils/neonStreetMap.mjs';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
import {getChapterScenePresentation} from '../src/systems/ChapterScenePresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
function node(texture){return {texture,frame:{realWidth:600,realHeight:640},scene:true,body:{enable:true},
 setOrigin(){return this;},setDisplaySize(w,h){this.width=w;this.height=h;return this;},setDepth(d){this.depth=d;return this;},
 setVisible(v){this.visible=v;return this;},setAlpha(a){this.alpha=a;return this;},setCrop(...v){this.crop=v;return this;},
 setInteractive(){return this;},on(){return this;},setText(){return this;},setPosition(){return this;},setTexture(t){this.texture=t;return this;},destroy(){this.destroyed=true;}};}
function fixture(){const images=[];const scene={player:{x:500,y:1708},add:{image(_x,_y,t){const n=node(t);images.push(n);return n;},zone(){return node();},text(){return node();}},
 physics:{add:{staticGroup(){return {add(){},scene:true,destroy(){}};},existing(){},collider(){return {};}}},input:{},
 paintZone:{devices:NEON_STREET_DEVICES.map(d=>({...d,paint:0,complete:false}))},actorPresentation:{playerImage:node()}};
 return {scene,images,owner:new OldStreetScene(scene,NEON_STREET_CONFIG)};}
test('second chapter opts into native gray volumes and local progressive restoration',()=>{
 assert.equal(NEON_STREET_CONFIG.progressiveRestoration,true,'Neon must not use instant whole-building texture swaps');
 assert.equal(getChapterScenePresentation({stageId:1,campaignChapterId:'neon'}).groundPath,'art/map-presentation-20261018/neon-neutral.webp');
 assert.equal(NEON_STREET_PROPS.filter(p=>p.art==='tree').length,6);
 for(const p of NEON_STREET_PROPS.filter(p=>p.restorable)){
  assert(NEON_STREET_ASSETS.includes(p.art+'-muted'));
  assert(p.x-p.width/2>=0&&p.x+p.width/2<=1000&&p.y-p.height>=0&&p.y<=1778,p.id+' fits world');
  assert(NEON_STREET_DEVICES.some(d=>d.restores===(p.restorationId||p.id)),p.id+' needs actual progress owner');
  const r=p.footprint;assert(r&&r.y>=p.y-p.height&&r.y+r.height<=p.y);
 }
 const map=new OldStreetState(NEON_STREET_PROPS);
 for(const d of NEON_STREET_DEVICES)assert(map.clearLine(d,d,16),d.id+' contact stays out of solids');
});
test('painting a store reveals its own volume and linked trees only',()=>{
 const {scene,owner,images}=fixture(),d=scene.paintZone.devices.find(d=>d.restores==='listening-store');
 const building=owner.items.get('listening-store'),trees=[...owner.items.values()].filter(i=>i.definition.restorationId===d.restores);
 assert(building.colorImage,'native gray and color pair must be independently cropped');
 assert(trees.length);d.paint=26;owner.updateRestoration(d,scene.paintZone.devices);
 for(const item of [building,...trees]){assert.equal(item.progress,.5);assert.deepEqual(item.colorImage.crop,[0,320,600,320]);}
 assert.equal(owner.items.get('night-cafe').progress,0);
 owner.restore(d);assert.equal(owner.state.restored.has('listening-store'),false);
 d.paint=52;d.complete=true;owner.restore(d);owner.sync();
 assert(owner.state.restored.has('listening-store'));assert.equal(building.image.visible,false);
 scene.player={x:225,y:760};owner.sync();assert.equal(building.colorImage.alpha,1,'Transparent top margin is not a roof');
 scene.player={x:225,y:1000};owner.sync();assert.equal(building.colorImage.alpha,.42);assert.equal(building.image.alpha,.42);
 scene.player={x:225,y:1240};owner.sync();assert.equal(building.colorImage.alpha,1);
 owner.destroy();owner.destroy();assert(images.every(n=>n.destroyed));
 assert.equal(new OldStreetState(NEON_STREET_PROPS).restored.size,0);
});
test('pavilion needs both fixtures: no premature complete facade after first contact',()=>{
 const {scene,owner}=fixture(),d=scene.paintZone.devices.filter(d=>d.restores==='listening-pavilion'),p=owner.items.get('listening-pavilion');
 assert(p.colorImage);d[0].paint=52;d[0].complete=true;owner.updateRestoration(d[0],scene.paintZone.devices);owner.restore(d[0]);
 assert.equal(p.progress,.5);assert.equal(owner.state.restored.has('listening-pavilion'),false);
 d[1].paint=26;owner.updateRestoration(d[1],scene.paintZone.devices);assert.equal(p.progress,.75);
 d[1].paint=52;d[1].complete=true;owner.restore(d[1]);owner.sync();assert.equal(p.progress,1);assert.equal(p.image.visible,false);
 assert(owner.state.restored.has('listening-pavilion'));owner.destroy();
});
test('new map survives explicit payload, retired files and concepts cannot ship',()=>{
 for(const id of NEON_STREET_ASSETS)assert(RUNTIME_PAYLOAD.some(a=>a.file===`art/neon-cohesion-20261009/${id}.webp`));
 assert(!RUNTIME_PAYLOAD.some(a=>a.file.startsWith('art/fresh-neonstreet/')||/dressed-reference|pair\.png/.test(a.file)));
 const src=fs.readFileSync(new URL('../src/systems/PaintZoneSystem.js',import.meta.url),'utf8');
 assert.match(src,/oldStreet\.config\?\.progressiveRestoration/,'neon uses bounded low-noise street pigment, not accumulating stamp render texture');
});
