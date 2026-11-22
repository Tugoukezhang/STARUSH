import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {NIGHTLINE_SCENE_ART as props,NIGHTLINE_PLATFORM_ART as floor,NIGHTLINE_PROP_FRAMES as frames,hasNightlineSceneArt,preloadNightlineSceneArt,NightlineSceneArt} from '../src/systems/NightlineSceneArt382.mjs';
import {NIGHTLINE_OPENING} from '../src/utils/nightlineOpening.mjs';
import {nightlineBodyMap} from '../src/utils/nightlineBody.mjs';
import {NIGHTLINE_FINALE} from '../src/utils/nightlineFinale.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';

function fixture(map=NIGHTLINE_OPENING,extra={}){
 const images=[],queued=[],removed=[],cache=new Map();
 const scene={map,...extra,textures:{exists:k=>cache.has(k),get:k=>cache.get(k),remove(k){removed.push(k);cache.delete(k);}},load:{atlas:(...args)=>queued.push(['atlas',...args]),image:(...args)=>queued.push(['image',...args])},add:{image(x,y,key,frame){const node={x,y,key,frame,writes:0,destroys:0,setOrigin(...v){this.origin=v;return this;},setDisplaySize(w,h){this.width=w;this.height=h;return this;},setDepth(d){this.depth=d;return this;},setTint(t){this.tint=t;this.writes++;return this;},setAlpha(a){this.alpha=a;return this;},destroy(){this.destroys++;}};images.push(node);return node;}}};
 const valid=()=>{for(const a of [props,floor])cache.set(a.key,{getSourceImage:()=>({width:a.width,height:a.height}),has:k=>Object.hasOwn(frames,k)});};
 return{scene,images,queued,removed,cache,valid};
}

test('authored PNG dimensions/hash, frame bounds and explicit release payload agree with provenance',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../../docs/NIGHTLINE_SCENE_B382.json',import.meta.url)));
 for(const [asset,record]of [[props,manifest],[floor,manifest.platform]]){
  const data=fs.readFileSync(new URL('../public/'+asset.path,import.meta.url));
  assert.equal(data.readUInt32BE(16),asset.width);assert.equal(data.readUInt32BE(20),asset.height);
  assert.equal(data.length,record.bytes);assert.equal(crypto.createHash('sha256').update(data).digest('hex'),record.sha256);
  assert.equal(RUNTIME_PAYLOAD.filter(a=>a.file===asset.path).length,1);
 }
 assert.deepEqual(manifest.frames,frames);assert.equal(manifest.artAccepted,false);assert.equal(manifest.contentComplete,false);
 for(const [x,y,w,h]of Object.values(frames)){assert(x>=0&&y>=0&&w>0&&h>0&&x+w<=props.width&&y+h<=props.height);}
});

test('both required textures load, cached complete textures skip, wrong dimensions and missing frames retry separately',()=>{
 const f=fixture();assert.equal(hasNightlineSceneArt(f.scene),false);preloadNightlineSceneArt(f.scene);assert.deepEqual(f.queued.map(q=>q[0]),['atlas','image']);
 assert.deepEqual(Object.keys(f.queued[0][3].frames),Object.keys(frames));f.valid();f.queued.length=0;
 assert.equal(hasNightlineSceneArt(f.scene),true);preloadNightlineSceneArt(f.scene);assert.equal(f.queued.length,0);
 f.cache.set(props.key,{getSourceImage:()=>({width:1254,height:1254}),has:k=>k!=='dispatcher'});
 assert.equal(hasNightlineSceneArt(f.scene),false);preloadNightlineSceneArt(f.scene);assert.deepEqual(f.removed,[props.key]);assert.equal(f.queued.length,1);assert.match(f.queued[0][2],/\?nightlineRetry=1$/);
 f.valid();f.queued.length=0;f.cache.set(floor.key,{getSourceImage:()=>({width:1,height:1})});preloadNightlineSceneArt(f.scene);
 assert.equal(f.queued.length,1);assert.equal(f.queued[0][0],'image');assert.match(f.queued[0][2],/\?nightlineRetry=2$/);
});

test('opening, both routes and finale artwork follows actual geometry below gameplay and does not mutate maps',()=>{
 for(const [map,extra,wallFrame]of [[NIGHTLINE_OPENING,{},'freight'],[nightlineBodyMap('canopy'),{bodyMode:true,routeId:'canopy'},'canopy'],[nightlineBodyMap('freight'),{bodyMode:true,routeId:'freight'},'freight'],[NIGHTLINE_FINALE,{finaleMode:true},'freight']]){
  const before=JSON.stringify(map),f=fixture(map,extra),art=new NightlineSceneArt(f.scene);
  assert(f.images.every(n=>n.depth<3));assert.equal(f.images.filter(n=>n.key===floor.key).length,1);
  for(const wall of map.walls)assert(f.images.some(n=>n.frame===wallFrame&&n.x===wall.x+wall.width/2&&n.y===wall.y+wall.height));
  assert.deepEqual(art.stations.map(r=>[r.id,r.node.x,r.node.y]),map.stations.map(d=>[d.id,d.x,d.y+10]));
  assert.equal(!!art.boss,!!extra.finaleMode);if(art.boss){assert.equal(art.boss.x,map.boss.x);assert.equal(art.boss.y,map.boss.y+27);}
  assert.equal(JSON.stringify(map),before);art.destroy();art.destroy();assert(f.images.every(n=>n.destroys===1));assert.equal(art.scene,null);
 }
});

test('actual station delivery/paint and boss exposure control appearance without changing owner state',()=>{
 const f=fixture(NIGHTLINE_FINALE,{finaleMode:true}),art=new NightlineSceneArt(f.scene),stations=f.scene.map.stations.map(d=>({...d,paint:0,delivered:false})),snapshot={time:100,boss:{exposed:false,flashUntil:0},phase:'playing'};
 const before=JSON.stringify({stations,snapshot});art.update(stations,snapshot);assert.equal(JSON.stringify({stations,snapshot}),before);
 assert(art.stations.every(r=>r.node.alpha===.72));const writes=art.stations[0].node.writes;art.update(stations,snapshot);assert.equal(art.stations[0].node.writes,writes);
 stations[0].delivered=true;stations[0].paint=100;art.update(stations,snapshot);assert.equal(art.stations[0].node.tint,0xffffff);assert.equal(art.stations[0].node.alpha,1);assert.equal(art.boss.tint,0xb4ccd0);
 snapshot.boss.exposed=true;art.update(stations,snapshot);assert.equal(art.boss.tint,0xffffff);snapshot.phase='complete';art.update(stations,snapshot);assert.equal(art.boss.alpha,.6);
 art.destroy();assert.doesNotThrow(()=>art.update(null,null));
});
