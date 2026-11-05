import fs from 'node:fs';import assert from 'node:assert/strict';import {test} from 'node:test';
import {preloadVenusLayered,buildVenusPose} from '../src/systems/VenusLayeredPresentation.mjs';
import {preloadGenyaLayered,buildGenyaPose} from '../src/systems/GenyaLayeredPresentation.mjs';
import {preloadKaiLayered,buildKaiPose} from '../src/systems/KaiLayeredPresentation.mjs';
import {preloadEnjoLayered,buildEnjoPose} from '../src/systems/EnjoLayeredPresentation.mjs';
import {LayeredSeamMeshes,LayeredPoseTransition} from '../src/systems/LayeredPoseTransition.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const file=new URL('../src/systems/LayeredObliquePresentation.mjs',import.meta.url);
const h=fs.existsSync(file)?await import(file):null;
const helper=()=>{assert(h,'missing original-oblique consumer');return h;};
for(const [id,preload,build]of [['venus',preloadVenusLayered,buildVenusPose],['genya',preloadGenyaLayered,buildGenyaPose],['kai',preloadKaiLayered,buildKaiPose],['enjo',preloadEnjoLayered,buildEnjoPose]]){
 test(id+' preloads a separate own oblique atlas, never overwriting cardinal',()=>{
  const rows=[],scene={textures:{},cache:{json:{}},load:{atlas:(...a)=>rows.push(['atlas',...a]),json:(...a)=>rows.push(['json',...a])}};
  preload(scene);assert.equal(rows.length,4);assert.notEqual(rows[0][1],rows[2][1]);
  assert(rows[2][2].includes(id+'-oblique'));assert(rows[3][2].includes(id+'-oblique'));
 });
 test(id+' oblique guard fails closed for any missing expression or boot',()=>{
  const a=helper(),spec=a.obliqueArt(id),names=a.obliqueParts(id);
  const frames=Object.fromEntries(a.OBLIQUE_VIEWS.flatMap(d=>names.map(n=>[d+'/'+n,{}])));
  const data={frames,rig:{identity:id,views:a.OBLIQUE_VIEWS}},scene={textures:{exists:k=>k===spec.key},cache:{json:{get:()=>data}}};
  assert.equal(a.hasLayeredOblique(scene,id),true);delete frames['up-right/bootR'];
  assert.equal(a.hasLayeredOblique(scene,id),false);frames['up-right/bootR']={};delete frames['down-left/hurtFace'];
  assert.equal(a.hasLayeredOblique(scene,id),false);assert.equal(a.hasLayeredOblique(scene,'wrong'),false);
 });
 test(id+' original diagonal frames retain exact world foot geometry and semantic pose',()=>{
  const a=helper(),raw=build({root:{x:100,y:100},facing:'down',legFacing:'down',state:'walk',clock:100,phase:.2});
  const before=structuredClone(raw),p=a.applyObliquePose({...raw,visualFacing:'down-left',visualLegFacing:'up-right'},build,id);
  assert.equal(p.facing,raw.facing);assert.equal(p.legFacing,raw.legFacing);assert.deepEqual(raw,before);
  for(const q of p.parts){assert(q.textureKey===a.obliqueArt(id).key);assert(q.frame.startsWith(/^(boot|thigh|shin|skirt|pelvis)/.test(q.name)?'up-right/':'down-left/'));}
  for(const q of raw.parts.filter(q=>/^(boot|thigh|shin)/.test(q.name))){
   const changed=p.parts.find(n=>n.name===q.name);for(const f of ['x','y','height','angle','originY'])assert.equal(changed[f],q[f]);
  }assert.deepEqual(p.feet,raw.feet);assert.deepEqual(p.root,raw.root);
 });
 test(id+' cardinal draw remains byte-equivalent and unknown visual direction falls back',()=>{
  const a=helper(),raw=build({root:{x:100,y:100},facing:'left',legFacing:'up',state:'hurt',clock:0});
  assert.deepEqual(a.applyObliquePose(raw,build,id),raw);
  const p=a.applyObliquePose({...raw,visualFacing:'invalid',visualLegFacing:'invalid'},build,id);
  assert.deepEqual(p.parts,raw.parts);
 });
}
test('eight-way selection has angular hysteresis, zero/nonfinite retains previous',()=>{
 const a=helper(),directions=['right','down-right','down','down-left','left','up-left','up','up-right'];
 for(let i=0;i<8;i++)assert.equal(a.layeredEightDirection(Math.cos(i*Math.PI/4),Math.sin(i*Math.PI/4),'down'),directions[i]);
 assert.equal(a.layeredEightDirection(0,0,'up-left'),'up-left');assert.equal(a.layeredEightDirection(NaN,1,'left'),'left');
 assert.equal(a.layeredEightDirection(Math.cos(Math.PI/8+.03),Math.sin(Math.PI/8+.03),'right'),'right');
});
test('visual controller tracks own shot vector without altering authoritative facing or clocks',()=>{
 const a=helper(),c=new a.LayeredObliqueController(),p={clock:0,facing:'down',legFacing:'left',state:'walk'};
 c.beginShot(1,-1);let r=c.sample(p,-1,1);assert.equal(r.visualFacing,'up-right');assert.equal(r.visualLegFacing,'down-left');
 assert.equal(r.facing,'down');assert.equal(r.legFacing,'left');assert.equal(r.clock,0);
 r=c.sample({...p,clock:300},0,0);assert.equal(r.visualFacing,'down-left');
});

test('mesh atlas handoff reuses the three nodes and switches back to cardinal',()=>{
 const created=[],calls=[];
 const scene={textures:{getFrame:key=>({source:{width:1024,height:1024},cutX:key==='own-cardinal'?4:120,cutY:4,cutWidth:40,cutHeight:60})},
  add:{mesh(x,y,key){const n={width:256,height:256,texture:{key}};
   n.addVertices=(xy,uv,indices)=>{n.vertices=indices.map(i=>({x:xy[i*2],y:xy[i*2+1],setUVs(u,v){this.u=this.tu=u;this.v=this.tv=v;}}));};
   for(const method of ['setOrtho','setPosition','setDepth','setAlpha','setTint','setVisible','preUpdate'])n[method]=()=>n;
   n.setTexture=next=>{calls.push(next);n.texture={key:next};return n;};n.destroy=()=>{};created.push(n);return n;
  }}};
 const mesh=new LayeredSeamMeshes(scene,'own-cardinal'),pose=buildVenusPose({root:{x:100,y:100},facing:'down',state:'idle',clock:0});
 const images=new Map(pose.parts.map(p=>[p.name,{setVisible(){}}]));
 mesh.render(pose,images,10,1,0xffffff);
 const p=helper().applyObliquePose({...pose,visualFacing:'down-left',visualLegFacing:'down-left'},buildVenusPose,'venus');
 mesh.render(p,images,10,1,0xffffff);mesh.render(pose,images,10,1,0xffffff);
 assert.equal(created.length,3);assert.equal(calls.length,6);assert(calls.slice(0,3).every(k=>k==='venus-oblique-20261007'));
 assert(calls.slice(3).every(k=>k==='own-cardinal'));mesh.destroy();
});
test('a visual-only angle change starts turn transport without changing logical facing',()=>{
 const a=helper(),base=buildKaiPose({root:{x:100,y:100},facing:'down',legFacing:'down',state:'walk',clock:0}),turn=new LayeredPoseTransition();
 const first=a.applyObliquePose({...base,visualFacing:'down',visualLegFacing:'down'},buildKaiPose,'kai');turn.sample(first);
 const next=a.applyObliquePose({...base,clock:10,visualFacing:'down-left',visualLegFacing:'down-left'},buildKaiPose,'kai'),shown=turn.sample(next);
 assert.equal(shown.parts.find(p=>p.name==='torso').width,first.parts.find(p=>p.name==='torso').width);
 assert.equal(shown.facing,'down');assert(turn.from);
});
test('release payload includes exactly the eight reviewed exports, never raw sheets or previews',()=>{
 const actual=RUNTIME_PAYLOAD.filter(r=>/\/(venus|genya|kai|enjo)-oblique\.(webp|json)$/.test(r.file)).map(r=>r.file);
 const expected=['venus','genya','kai','enjo'].flatMap(id=>{const art=helper().obliqueArt(id);return [art.image,art.data];});
 assert.deepEqual(actual.sort(),expected.sort());
 for(const id of ['venus','genya','kai','enjo']){
  const data=JSON.parse(fs.readFileSync(new URL('../public/'+helper().obliqueArt(id).data,import.meta.url)));
  assert.equal(data.rig.identity,id);assert.deepEqual(data.rig.views,helper().OBLIQUE_VIEWS);
  assert.equal(Object.keys(data.frames).length,id==='genya'?72:64);
  for(const d of helper().OBLIQUE_VIEWS)for(const n of helper().obliqueParts(id))assert(data.frames[d+'/'+n]);
 }
});
