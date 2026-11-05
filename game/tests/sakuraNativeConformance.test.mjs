import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {SAKURA_NATIVE_ART,renderNativeMeshNodes} from '../src/systems/SakuraNativePresentation.mjs';
import {nativeWorldMatrices,skinNativeMesh,sampleNativeClip,composeNativePose} from '../src/utils/sakuraNativePose.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../public/'+p,import.meta.url)));
const current=read(SAKURA_NATIVE_ART.data),old=read('art/sakura-native-20261004/rig.json');
const Vertex=createRequire(import.meta.url)('phaser/src/geom/mesh/Vertex.js');
test('front clothing is registered to the common multi-view extent instead of the old long skirt',()=>{
 const pose=sampleNativeClip(current.clips.idle,0),world=nativeWorldMatrices(current,pose);
 const ys=current.meshes.filter(m=>['torso','pelvis'].includes(m.name)).flatMap(m=>skinNativeMesh(current,m,pose,world).map(v=>v[1]));
 assert(Math.max(...ys)<=224,'Front garment should end near the other views at 223, not 246');
 assert.equal(SAKURA_NATIVE_ART.texture,'art/sakura-hand-art-20261005/front.webp');
 assert.equal(SAKURA_NATIVE_ART.data,'art/sakura-conformance-20261004/rig.json');
 for(const key of ['bones','clips','scale','anchor','fanBone'])assert.deepEqual(current[key],old[key],'Do not silently change motion or sockets: '+key);
 for(const name of ['leg.R','leg.L','fan.open']){const a=current.meshes.find(m=>m.name===name),b=old.meshes.find(m=>m.name===name);for(const key of ['vertices','weights','indices','fold'])assert.deepEqual(a[key],b[key]);}
 assert.equal(current.meshes.length,10);assert.equal(current.finalArt,false);
});
test('new front replaces old runtime pair, source is not released',()=>{
 for(const f of ['art/sakura-hand-art-20261005/front.webp','art/sakura-conformance-20261004/rig.json'])assert(RUNTIME_PAYLOAD.some(r=>r.file===f));
 for(const f of ['art/sakura-native-20261004/rig.json','art/sakura-directions-20261004/front-clean.png'])assert(!RUNTIME_PAYLOAD.some(r=>r.file===f));
 assert(!RUNTIME_PAYLOAD.some(r=>/conformance.*(raw|manifest|contact)/.test(r.file)));
 assert.equal(RUNTIME_PAYLOAD.filter(a=>!['owner-equipment-art','owner-menu-motion','owner-menu-portrait','owner-character-cast','owner-character-motion','owner-weapon-fx','owner-ui','owner-world-ground','owner-enemy-attack','owner-heavy-material','owner-dash-material','owner-dash-contrast-material','owner-character-gait','owner-character-hurt','owner-character-shoot','owner-character-idle','owner-character-walk','owner-facility-fx'].includes(a.group)&&!['fonts/NotoSansSC-UI.woff2','licenses/noto-sans-sc.txt'].includes(a.file)).length,205);
});
test('registered new meshes remain finite under locomotion and every attack phase',()=>{
 for(const t of [0,80,210,490,780,1000])for(const phase of ['windup','release','recovery']){
  const base=sampleNativeClip(current.clips.walk,t),pose=composeNativePose(current,base,{phase,progress:.7});
  const world=nativeWorldMatrices(current,pose);
  for(const mesh of current.meshes)assert(skinNativeMesh(current,mesh,pose,world).flat().every(Number.isFinite));
 }
});
test('expression switching updates the actual Phaser render UVs, not only authored UVs',()=>{
 const part=current.meshes.find(m=>m.name==='head'),[aw,ah]=current.atlasSize;
 const vertices=part.indices.map(i=>new Vertex(0,0,0,(part.region[0]+part.uv[i][0]*part.region[2])/aw,(part.region[1]+part.uv[i][1]*part.region[3])/ah));
 const node={vertices,setPosition(){return this;},setAlpha(){return this;},setTint(){return this;},preUpdate(){}};
 const base=sampleNativeClip(current.clips.idle,0),world=nativeWorldMatrices(current,base);
 for(const [expression,pose]of [['blink',{...base,blink:true}],['focus',{...base,focus:true}],['neutral',base]]){
  renderNativeMeshNodes([{part,node}],current,pose,world,[0,0],0,0);
  const region=expression==='neutral'?part.region:current.expressions[expression];
  for(const [i,v]of vertices.entries()){
   const uv=part.uv[part.indices[i]],expected=[(region[0]+uv[0]*region[2])/aw,(region[1]+uv[1]*region[3])/ah];
   assert.deepEqual([v.u,v.v],expected,expression+' authored UV');
   assert.deepEqual([v.tu,v.tv],expected,expression+' GPU UV');
  }
 }
});
