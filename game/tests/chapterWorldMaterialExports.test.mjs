import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {streetVisibleBounds} from '../src/systems/WorldGroundingPresentation.mjs';
import {preloadChapterScenePresentation} from '../src/systems/ChapterScenePresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const hashes={
  "art/neon-cohesion-20261009/shop.webp": "2fee07a53801f17a06f2020e39b93cabe0780cc97a77fda52b57877630856d1e",
  "art/neon-cohesion-20261009/shop-muted.webp": "9a2f418cc9d5550d867e7f61a029bccb736eab51696b7346a7e50f82d8d2bf36",
  "art/neon-cohesion-20261009/cafe.webp": "3d7ea0d20e7aa4ed46e66859c80cbc1bd73172f04e749dc427b2151b2afba00f",
  "art/neon-cohesion-20261009/cafe-muted.webp": "fb821250db5eba92a1b4388e4ca4c7376d6729f62e53a8b755d80732c91bed82",
  "art/neon-cohesion-20261009/pavilion.webp": "f8253b77594728ec062f69a81089e6e7abd23241977f4fa11ed0135bae09795f",
  "art/neon-cohesion-20261009/pavilion-muted.webp": "ad858617aec612587703bdcb6330939efd06f088e562272497f017a1e50511ec",
  "art/harbor-cohesion-20261009/shed.webp": "b16c5c449f81ac45e2ca078ad6cec23c308c974f1ba04fd2753e44ce507957dc",
  "art/harbor-cohesion-20261009/shed-muted.webp": "371280ed199fb639da174d06f23e29da3f367bf057590cd257feaffb935152f3",
  "art/harbor-cohesion-20261009/control.webp": "02cfdc9a08aebede78b40532a4b58ce84089030cba27b31df9645a2764746ce0",
  "art/harbor-cohesion-20261009/control-muted.webp": "f591dba66741fc097942c1fb76c55a7c8b13edcaf0afb4a54ef2aeff54cae184",
  "art/harbor-cohesion-20261009/mixer.webp": "26b86e9a145a3a2faac5a0e48af528f4f76c8ea0c9c1f5be0981c7c655a4302f",
  "art/harbor-cohesion-20261009/mixer-muted.webp": "44a1e340a2ec81a8c4ecea7772002d5f4aae83ff36cf51594a405e9132facb45",
  "art/harbor-cohesion-20261009/stage.webp": "5469f9506b30d2fc4309a72e016dc064981c92036e5c0a2adb878bf3e31bfd90",
  "art/harbor-cohesion-20261009/stage-muted.webp": "1012ecf93f773df429dc03c2a4336ade0e0938861fb1c66763f42f0cbca2b58e",
  "art/neon-cohesion-20261009/ground.webp": "325f985190b26d5439ed1c87e0da6498e0fe1f41587dd75c00c367ae378d293c",
  "art/harbor-cohesion-20261009/ground.webp": "71bc9f2d1bebfca007aa7eb3021cbc1be640201d5570c07849380ccae74333b8",
  "art/neon-cohesion-20261009/panel.webp": "cdbae787959e3a21c64b61a831723d26761203759a88198a68ff161ac8e58274",
  "art/neon-cohesion-20261009/signal.webp": "60280d26997d681d7752d462104b49df0192fe3975ceefeda23bf1b14e2e05c6",
  "art/neon-cohesion-20261009/tree.webp": "b679702a509b773eb1199ca29be81cc71f99cdf65a85f08b3e82a28db8ddb80d",
  "art/neon-cohesion-20261009/tree-muted.webp": "d9785c987021d101a4557ba066d4811050808ddf06d233734c7930bfc9ea4dad",
  "art/harbor-cohesion-20261009/barrier.webp": "842e5ace7e685af038f34345cf76ed3cd7ae94460d9f991117170e57ac04d13d",
  "art/harbor-cohesion-20261009/signal.webp": "60280d26997d681d7752d462104b49df0192fe3975ceefeda23bf1b14e2e05c6"
};
const registrations={"neon-shop":[600,648,9,3,591,646],"neon-cafe":[500,484,2,140,498,482],"neon-pavilion":[660,460,2,99,658,458],"harbor-shed":[460,450,2,40,458,448],"harbor-control":[390,430,2,85,388,428],"harbor-mixer":[270,320,2,53,268,318],"harbor-stage":[700,450,2,56,698,448]};
test('22 individually reviewed chapter exports are hash-locked and ship without retired sets or sources',()=>{
 for(const [file,hash]of Object.entries(hashes)){
  assert(RUNTIME_PAYLOAD.some(r=>r.file===file),file);
  const bytes=fs.readFileSync(new URL('../public/'+file,import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash);
 }
 assert.equal(Object.keys(hashes).length,22);
 assert(!RUNTIME_PAYLOAD.some(r=>/neon-volume-20260913|harbor-volume-20260913|game-quality-neon-harbor/.test(r.file)));
});
test('two actual chapter preloads use their reviewed directories',()=>{
 for(const [chapter,prefix]of [['neon','neonstreet'],['encore','harbor']]){
  const calls=[];preloadChapterScenePresentation({load:{image:(key,path)=>calls.push({key,path})}},{stageId:1,campaignChapterId:chapter});
  assert.equal(calls.filter(c=>c.key.startsWith(prefix+'-')).length,10);
  assert(calls.every(c=>c.key.startsWith('chapter-ground-')
    ? c.path===`art/map-presentation-20261018/${chapter}-${c.key.includes('color-')?'color':'neutral'}.webp` : Object.hasOwn(hashes,c.path)));
 }
});
test('same art name cannot reuse another chapter opaque registration',()=>{
 for(const [name,[w,h,l,t,r,b]]of Object.entries(registrations)){
  const [chapter,art]=name.split('-'),outer={x:10,y:20,width:w,height:h};
  const actual=streetVisibleBounds(art,outer,chapter==='harbor'?'encore':'neon'),expected={x:10+l,y:20+t,width:r-l,height:b-t};
  for(const key of Object.keys(expected))assert(Math.abs(actual[key]-expected[key])<1e-9,key+' measured bounds');
 }
 const unknown={x:10,y:20,width:50,height:80};
 assert.equal(streetVisibleBounds('shop',unknown,'unknown'),unknown);
 assert.notDeepEqual(streetVisibleBounds('shop',unknown,'neon'),streetVisibleBounds('shop',unknown));
});

