import test from 'node:test';import assert from 'node:assert/strict';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {STAGE1_PAINT_FINALE_LAYER_ALPHA} from '../src/utils/stage1PaintRound.mjs';
const {PaintZoneSystem}=loadBattleScene({Phaser:{Scene:class{}},includeOwners:true});
function fixture({alpha=1,owned=true,legacy=false}={}){
 const calls=[],layer={alpha,setAlpha(v){calls.push(v);this.alpha=v;return this;}},nodes=[];
 const node=()=>{const n={visible:true,setVisible(v){this.visible=v;return this;}};nodes.push(n);return n;};
 const devices=[{sceneArt:true,gfx:node(),barBg:node(),barFill:node(),label:node(),sprite:node()},{sceneArt:false,gfx:node(),barBg:node(),barFill:node(),label:node(),sprite:node()}];
 const pixels=new Uint8ClampedArray([210,25,170,255,20,190,220,255]),owners=new Uint32Array([0xff69b4,0x00ced1]),surface={image:owned?layer:{alpha:.7},material:{image:{worldAnchored:true}},raster:{pixels,paintColors:owners}};
 const zone=Object.assign(Object.create(PaintZoneSystem.prototype),{tileLayer:layer,streetSurface:legacy?null:surface,devices,finaleMode:false,clearGate(){this.gateClears=(this.gateClears||0)+1;}});
 return {zone,layer,calls,devices,nodes,pixels,owners};
}
test('owned authored world pigment remains opaque through Boss phase entry',()=>{const f=fixture();f.zone.enterFinaleMode();assert.equal(f.layer.alpha,1);assert.deepEqual(f.calls,[]);});
test('phase entry preserves the owned surface alpha instead of forcing a new appearance',()=>{const f=fixture({alpha:.61});f.zone.enterFinaleMode();assert.equal(f.layer.alpha,.61);assert.deepEqual(f.calls,[]);});
test('repeated finale entry does not progressively fade or reset the owned surface',()=>{const f=fixture();for(let i=0;i<4;i++)f.zone.enterFinaleMode();assert.equal(f.layer.alpha,1);assert.deepEqual(f.calls,[]);});
test('legacy render-texture paint keeps its established finale readability cap',()=>{const f=fixture({legacy:true});f.zone.enterFinaleMode();assert.equal(f.layer.alpha,STAGE1_PAINT_FINALE_LAYER_ALPHA);assert.deepEqual(f.calls,[STAGE1_PAINT_FINALE_LAYER_ALPHA]);});
test('stale surface ownership cannot exempt a different tile layer from legacy treatment',()=>{const f=fixture({owned:false});f.zone.enterFinaleMode();assert.equal(f.layer.alpha,STAGE1_PAINT_FINALE_LAYER_ALPHA);assert.equal(f.zone.streetSurface.image.alpha,.7);});
test('completed objective UI exits, real fixture remains scenery and finale targeting closes',()=>{const f=fixture();assert.equal(f.zone.enterFinaleMode(),true);assert.equal(f.zone.finaleMode,true);assert.equal(f.zone.gateClears,1);for(const d of f.devices)for(const k of ['gfx','barBg','barFill','label'])assert.equal(d[k].visible,false);assert.equal(f.devices[0].sprite.visible,true);assert.equal(f.devices[1].sprite.visible,false);assert.equal(f.zone.hitTest(0,0),null);});
test('mode changes do not touch paint bytes or owners, create nodes, or replace image identity',()=>{const f=fixture(),pixels=[...f.pixels],owners=[...f.owners],surface=f.zone.streetSurface;f.zone.enterFinaleMode();assert.deepEqual([...f.pixels],pixels);assert.deepEqual([...f.owners],owners);assert.equal(f.zone.streetSurface,surface);assert.equal(f.zone.tileLayer,f.layer);assert.equal(f.nodes.length,10);});
test('missing layer remains a valid no-visual contract during fixture cleanup',()=>{const f=fixture({legacy:true});f.zone.tileLayer=null;assert.equal(f.zone.enterFinaleMode(),true);assert.equal(f.zone.gateClears,1);});
test('legacy street surface identity alone does not exempt its wash from the finale cap',()=>{const f=fixture();f.zone.streetSurface.material=null;f.zone.enterFinaleMode();assert.equal(f.layer.alpha,STAGE1_PAINT_FINALE_LAYER_ALPHA);});
test('a local imprint material is not an authored world layer exemption',()=>{const f=fixture();f.zone.streetSurface.material.image.worldAnchored=false;f.zone.enterFinaleMode();assert.equal(f.layer.alpha,STAGE1_PAINT_FINALE_LAYER_ALPHA);});
