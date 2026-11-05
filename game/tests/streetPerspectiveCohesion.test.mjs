import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {oldStreetMaterialPath} from '../src/systems/StreetMaterialPresentation.mjs';
import {STREET_RESTORATION_ART} from '../src/systems/StreetRestorationSurface.mjs';
import {getChapterScenePresentation,preloadChapterScenePresentation} from '../src/systems/ChapterScenePresentation.mjs';
import {streetVisibleBounds} from '../src/systems/WorldGroundingPresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const prefix='art/street-perspective-20261009/';
const registrations={shop:[560,520,2,143,558,518],repair:[480,402,19,117,461,400],
 garden:[340,328,2,121,338,326],kiosk:[344,368,21,56,323,366],canopy:[704,332,23,33,681,330],tree:[180,240,11,2,168,238]};

test('opening floor, independently restored props and actual preload resolve the reviewed shared collection',()=>{
 assert.equal(STREET_RESTORATION_ART,prefix,'RED: old floor still belongs to the mixed material set');
 assert.equal(getChapterScenePresentation({stageId:1}).groundPath,'art/map-presentation-20261018/opening-neutral.webp');
 assert.equal(oldStreetMaterialPath('ground'),prefix+'ground.webp');
 for(const id of Object.keys(registrations))for(const suffix of ['','-muted'])assert.equal(oldStreetMaterialPath(id+suffix),prefix+id+suffix+'.webp');
 const calls=[];preloadChapterScenePresentation({load:{image:(key,path)=>calls.push({key,path})}},{stageId:1});
 for(const id of Object.keys(registrations))for(const suffix of ['','-muted'])assert(calls.some(c=>c.key==='oldstreet-'+id+suffix&&c.path===prefix+id+suffix+'.webp'));
 assert.equal(getChapterScenePresentation({practiceMode:true}),null);
 assert.equal(getChapterScenePresentation({stageId:1,campaignChapterId:'neon'}).groundPath,'art/map-presentation-20261018/neon-neutral.webp');
 assert.equal(getChapterScenePresentation({stageId:1,campaignChapterId:'encore'}).groundPath,'art/map-presentation-20261018/encore-neutral.webp');
});

test('new roof and foliage silhouette bounds, not obsolete transparent padding, drive existing occlusion',()=>{
 for(const [id,[w,h,l,t,r,b]] of Object.entries(registrations)){
  const outer={x:90,y:200,width:w/2,height:h/2},before=JSON.stringify(outer);
  assert.deepEqual(streetVisibleBounds(id,outer),{x:90+l/2,y:200+t/2,width:(r-l)/2,height:(b-t)/2});
  assert.equal(JSON.stringify(outer),before);
 }
 const b={x:0,y:0,width:10,height:20};assert.equal(streetVisibleBounds('gate',b),b);
});

test('release ships exactly the reviewed 21 images, not retired source, duplicate sets or prompts',()=>{
 const rows=RUNTIME_PAYLOAD.filter(r=>r.file.startsWith(prefix));
 assert.equal(rows.length,21);assert.equal(new Set(rows.map(r=>r.file)).size,21);
 assert(!RUNTIME_PAYLOAD.some(r=>r.file.startsWith('art/street-material-20261009/')));
 assert(!RUNTIME_PAYLOAD.some(r=>/^art\/street-volume-20260913\/(ground|tree)(-muted)?\.webp$/.test(r.file)));
 for(const row of rows){const data=fs.readFileSync(new URL('../public/'+row.file,import.meta.url));
  assert.equal(data.subarray(0,4).toString(),'RIFF');assert.equal(data.subarray(8,12).toString(),'WEBP');}
 for(const id of ['../shop','shop-muted-muted','ground-muted','tree-extra'])assert.equal(oldStreetMaterialPath(id),null);
});

test('all 13 accepted exports, including reviewed exact-alpha gray pairs, remain byte-identical',()=>{
 const hashes={ground:'4d8c637ed1a507854ae4eb465b9c5c853a1562a98ba31a567a22a0b1e12c8057',shop:'c017dacd2cd87ba0a43f76288c240423f8f4405bfc22e59760b31bc73dbbfd53',
  repair:'b3fe339076fb2fc2296b746f62cbfbec1851033c68ee150593ced7eea416aade',garden:'be20f80d9597389bddd09c4023b22ab55e6a7d62c941208976919595aecf5398',
  kiosk:'e2b17179026ae6ae1267437d42f827f9ea7f221b82be22fa212f00fca8b33660',canopy:'0ad24d4b2f0dd3ce7bd14bffbbcf98f36c707f3b6eb590c0b21fbb47cb7f29ed',tree:'069fb48a1368db7b8521fef7f3439cac36e4f3a369f54b4195be659c08a3d2cb',
  'shop-muted':'37810db662df813e659e2f472259691246b260a235d2cebc85884b16ba9c9a20',
  'repair-muted':'df92ac6cd3802f8cab08a1a17cd595b0de3a31e6ca82b14fc0643efbaa7987c7',
  'garden-muted':'5f752bb3124f5af8fce3a005cc6aaabb6a2ee52cf6b87eaa5ded87ab1a29b7a6',
  'kiosk-muted':'a4ed846dcaed5c28b4e6d594c8024b726620e46325e0dc44c8c352d89364c171',
  'canopy-muted':'f55637fa7c79c715a1e774407fc2a327fc3b24c260c393f782e9904f33c59fc3',
  'tree-muted':'8ce5b43aef682a9a9e03b80b5f85ecf617a575ff757ac19e23feab621e203bef'};
 for(const [id,sha] of Object.entries(hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../public/'+prefix+id+'.webp',import.meta.url))).digest('hex'),sha);
});
