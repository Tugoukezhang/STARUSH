import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {HARBOR_STAGE_CONFIG as config,HARBOR_STAGE_DEVICES as devices,HARBOR_STAGE_PROPS as props} from '../src/utils/harborStageMap.mjs';
import {restorationProgress} from '../src/systems/StreetRestorationSurface.mjs';
import {resolveChapterPaintHit} from '../src/utils/publicCampaign.mjs';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
import {getChapterScenePresentation} from '../src/systems/ChapterScenePresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
const {PaintZoneSystem}=loadBattleScene({Phaser:{Scene:class{}},includeOwners:true});

test('two-color fixtures keep earned restoration when advancing to the next color',()=>{
 const d={...devices.find(d=>d.restores==='equipment-shed'),paint:0,sequenceIndex:0,complete:false};
 assert.equal(restorationProgress(d.restores,[d]),0);
 Object.assign(d,resolveChapterPaintHit(d,13,d.colorSequence[0]));assert.equal(restorationProgress(d.restores,[d]),.25);
 Object.assign(d,resolveChapterPaintHit(d,13,d.colorSequence[0]));assert.equal(d.sequenceIndex,1);
 assert.equal(restorationProgress(d.restores,[d]),.5,'first color earns half, never resets the facade');
 Object.assign(d,resolveChapterPaintHit(d,13,d.colorSequence[1]));assert.equal(restorationProgress(d.restores,[d]),.75);
 Object.assign(d,resolveChapterPaintHit(d,13,d.colorSequence[1]));assert.equal(restorationProgress(d.restores,[d]),1);
 const pair=devices.filter(d=>d.restores==='sail-stage').map(d=>({...d,paint:0,sequenceIndex:0}));
 pair[0].complete=true;pair[1].sequenceIndex=1;assert.equal(restorationProgress('sail-stage',pair),.75);
});
test('harbor keeps authored topology and opts into independent gray/color volume layers',()=>{
 assert.equal(config.progressiveRestoration,true);
 assert.equal(getChapterScenePresentation({stageId:1,campaignChapterId:'encore'}).groundPath,'art/map-presentation-20261018/encore-neutral.webp');
 assert.equal(devices.length,10);assert.equal(props.filter(p=>p.restorable).length,8);
 const state=new OldStreetState(props,config.terrain);for(const d of devices)assert(state.clearLine(d,d,16),d.id);
 assert.deepEqual(config.terrain.map(t=>[t.footprint.x,t.footprint.width]),[[0,124],[876,124]]);
 for(const name of ['ground','shed','shed-muted','control','control-muted','mixer','mixer-muted','stage','stage-muted','barrier','signal'])assert(RUNTIME_PAYLOAD.some(a=>a.file===`art/harbor-cohesion-20261009/${name}.webp`));
 assert(!RUNTIME_PAYLOAD.some(a=>a.file.startsWith('art/fresh-harbor/')));
});
test('road gates exclude roofs and water, tile full open spans and share existing cleanup',async()=>{
 const {getStreetGateSegments,createStreetZoneGate}=await import('../src/systems/StreetZoneGate.mjs');
 const state=new OldStreetState(props,config.terrain),segments=getStreetGateSegments(state,930,1000);
 assert.deepEqual(segments,[[124,632.5],[827.5,876]]);
 const synthetic={props:[{x:300,y:940,width:200,height:150},{x:420,y:950,width:120,height:100}],terrain:[],isOpen:()=>false};
 assert.deepEqual(getStreetGateSegments(synthetic,930,1000),[[0,200],[480,1000]],'overlapping roofs form a union');
 const nodes=[],scene={oldStreet:{state,config},add:{container(){return {children:[],add(n){this.children.push(n);},setDepth(){return this;},destroy(){this.children.forEach(n=>n.destroy());}};},image(x,y,key){const n={x,y,key,setOrigin(){return this;},setDisplaySize(w,h){this.w=w;this.h=h;return this;},destroy(){this.destroyed=true;}};nodes.push(n);return n;}}};
 const gate=createStreetZoneGate(scene,930,1000);assert(nodes.length>2);assert(nodes.every(n=>n.key==='harbor-barrier'&&n.y===931&&n.w<=140));
 for(const [start,end] of segments){const children=nodes.filter(n=>n.x>=start&&n.x<end);assert(Math.abs(children.reduce((v,n)=>v+n.w,0)-(end-start))<1e-6);}
 gate.destroy();assert(nodes.every(n=>n.destroyed));
 const src=fs.readFileSync(new URL('../src/systems/PaintZoneSystem.js',import.meta.url),'utf8');
 assert.match(src,/if\s*\(this\.scene\.oldStreet\)[\s\S]*createStreetZoneGate/);
 assert.match(src,/this\.gateGfx\?\.destroy\(\)/);assert.match(src,/Math\.max\(STAGE1_PAINT_GATE_Y \+ 18, y\)/);
});
test('ending a still-locked street removes gate once without erasing the map',()=>{
 const zone=new PaintZoneSystem({}),calls={gate:0,map:0,alpha:[]};
 zone.gateGfx={destroy(){calls.gate++;}};
 // freeze() restores occlusion-faded art to full alpha; the fixture records it instead of swallowing it.
 const layer=name=>({scene:false,alpha:.42,setAlpha(v){this.alpha=v;calls.alpha.push([name,v]);return this;},destroy(){calls.map++;}});
 const item={image:layer('image'),colorImage:layer('color')};
 const street=Object.assign(Object.create(OldStreetScene.prototype),{disposed:false,scene:{paintZone:zone},items:new Map([['shed',item]])});
 street.freeze();street.freeze();assert.equal(calls.gate,1);assert.equal(zone.gateGfx,null);
 assert.equal(item.image.alpha,1);assert.equal(item.colorImage.alpha,1);
 assert.deepEqual(calls.alpha,[['image',1],['color',1],['image',1],['color',1]]);
 assert.equal(street.chaseFrozen,true);assert.equal(street.items.get('shed'),item);
 assert.equal(calls.map,0);zone.destroy();zone.destroy();assert.equal(calls.gate,1);
});
