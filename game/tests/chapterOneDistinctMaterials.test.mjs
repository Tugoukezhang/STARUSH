import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {OLD_STREET_PROPS,OLD_STREET_DEVICES,OLD_STREET_ASSETS} from '../src/utils/oldStreetMap.mjs';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';
import {oldStreetMaterialPath} from '../src/systems/StreetMaterialPresentation.mjs';
import {preloadChapterScenePresentation} from '../src/systems/ChapterScenePresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const sharp=createRequire(import.meta.url)('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/chapterOneDistinctMaterials.json',import.meta.url)));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
test('ordinary fronts choose distinct materials without changing collision or restoration semantics',()=>{
  for(const [id,name]of Object.entries(fixture.variants))assert.equal(OLD_STREET_PROPS.find(p=>p.id===id).materialVariant,name,'RED: repeated frontage still uses landmark material');
  assert.deepEqual(OLD_STREET_PROPS.map(p=>{const {materialVariant,...original}=p;return original;}),fixture.props);
  assert.deepEqual(OLD_STREET_DEVICES,fixture.devices);
});
test('runtime storefront layers and preview select material keys, not gameplay families',()=>{
  const node=texture=>({texture,body:{enable:true},setOrigin(){return this;},setDisplaySize(){return this;},setDepth(){return this;},setVisible(){return this;},setInteractive(){return this;},on(){return this;}});
  const scene={player:{x:500,y:1708},add:{image(_x,_y,t){return node(t);},zone(){return node();},text(){return node();}},physics:{add:{staticGroup(){return{add(){}};},existing(){},collider(){return {};}}},input:{}};
  const owner=new OldStreetScene(scene);
  for(const [id,name]of Object.entries(fixture.variants)){
    const item=owner.items.get(id);assert.equal(item.image.texture,'oldstreet-'+name+'-muted');assert.equal(item.colorImage.texture,'oldstreet-'+name);
  }
  const src=fs.readFileSync(new URL('../src/systems/PublicShellView.mjs',import.meta.url),'utf8');assert(src.includes('oldStreetMaterialPath(p.materialVariant||p.art)'));
});
test('only opening preloads the eight reviewed variants and payload permits no source sheets',()=>{
  for(const data of [{stageId:1,campaignChapterId:'opening'},{stageId:1,campaignChapterId:'neon'},{stageId:1,campaignChapterId:'encore'},{practiceMode:true}]){
    const calls=[];preloadChapterScenePresentation({load:{image:(...a)=>calls.push(a)}},data);
    for(const name of ['bookshop','cafe','tailor','rehearsal'])for(const suffix of ['','-muted']){
      const id=name+suffix,file='art/street-perspective-20261009/'+id+'.webp';assert(OLD_STREET_ASSETS.includes(id));assert.equal(oldStreetMaterialPath(id),file);
      assert.equal(calls.some(([key,path])=>key==='oldstreet-'+id&&path===file),!data.practiceMode&&data.campaignChapterId==='opening');
      assert.equal(RUNTIME_PAYLOAD.filter(a=>a.file===file&&a.group==='oldstreet-scene').length,1);
    }
  }
  assert(!RUNTIME_PAYLOAD.some(a=>/frontage-material|edit-sheet|fronts-candidate|equipment-candidate|registration/.test(a.file)));
});
test('thirteen material exports match reviewed bytes and preserve original alpha and exact neutral pairs',async()=>{
  for(const row of fixture.rows){
    const bytes=fs.readFileSync(new URL('../'+row.file,import.meta.url));assert.equal(hash(bytes),row.sha);assert.equal(bytes.length,row.bytes);
    const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,row.width);assert.equal(info.height,row.height);
    const alpha=Buffer.from(Array.from({length:info.width*info.height},(_,i)=>data[i*4+3]));assert.equal(hash(alpha),row.alphaSha);
    if(row.muted){
      const mutedBytes=fs.readFileSync(new URL('../'+row.muted.file,import.meta.url));assert.equal(hash(mutedBytes),row.muted.sha);
      const gray=await sharp(mutedBytes).ensureAlpha().raw().toBuffer();for(let i=0;i<data.length;i+=4){assert.equal(gray[i+3],data[i+3]);assert.equal(gray[i],gray[i+1]);assert.equal(gray[i],gray[i+2]);}
    }
  }
});
