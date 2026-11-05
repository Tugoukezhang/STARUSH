import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';
import {NEON_STREET_CONFIG,NEON_STREET_DEVICES} from '../src/utils/neonStreetMap.mjs';
import {HARBOR_STAGE_CONFIG,HARBOR_STAGE_DEVICES} from '../src/utils/harborStageMap.mjs';
import {streetVisibleBounds} from '../src/systems/WorldGroundingPresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const cases=[
 {config:NEON_STREET_CONFIG,devices:NEON_STREET_DEVICES,count:4,ids:['west-entry','east-entry','west-middle','east-middle']},
 {config:HARBOR_STAGE_CONFIG,devices:HARBOR_STAGE_DEVICES,count:3,ids:['west-entry','east-entry','east-transfer']},
];
for(const {config,devices,count,ids}of cases){
 test(config.chapterId+' south-entry facades occupy readable width in the observed 375px camera',()=>{
  // Fresh browser evidence: spawn camera worldView is x=312, width=375.
  const camera={x:312,width:375};
  for(const p of config.props.filter(p=>p.id.endsWith('-entry')&&p.id.startsWith('frontage-'))){
   const left=p.x-p.width/2,right=p.x+p.width/2;
   const visible=Math.max(0,Math.min(right,camera.x+camera.width)-Math.max(left,camera.x));
   assert(visible/p.width>=.3,p.id+' is only a clipped sliver: '+visible/p.width);
  }
 });
 test(config.chapterId+' south camera has two-sided independently painted architecture with real blockers',()=>{
  const props=config.props.filter(p=>p.id.startsWith('frontage-'));assert.equal(props.length,count,'RED: south entry remains empty');
  assert.deepEqual(props.map(p=>p.id),ids.map(id=>'frontage-'+id));
  assert(props.some(p=>p.x<500&&p.y>1600)&&props.some(p=>p.x>500&&p.y>1600));
  for(const p of props){assert(p.restorable&&p.footprint);assert(devices.some(d=>d.restores===p.restorationId));
   assert(p.x-p.width/2>=0&&p.x+p.width/2<=1000&&p.y-p.height>=0&&p.y<=1778);
   const r=p.footprint;assert(r.x>=p.x-p.width/2&&r.x+r.width<=p.x+p.width/2&&r.y>=p.y-p.height&&r.y+r.height<=p.y);
  }
  assert.equal(devices.length,10);assert(config.progressiveRestoration);
 });
 test(config.chapterId+' footprints preserve every safe device and never overlap another blocker',()=>{
  const state=new OldStreetState(config.props,config.terrain);
  // Existing foldable panels cross the center; new frontages must not add a center blocker.
  const frontage=new OldStreetState(config.props.filter(p=>p.id.startsWith('frontage-')),config.terrain);
  assert(frontage.clearLine({x:500,y:1708},{x:500,y:960},16));
  for(const d of devices)assert(state.clearLine(d,d,12),'blocked existing facility '+d.id);
  const all=state.blockers();for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
   const a=all[i].footprint,b=all[j].footprint;
   assert(!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y),all[i].id+' overlaps '+all[j].id);
  }
 });
 test(config.chapterId+' closed/open paths retain all ten shootable facilities and the finale approach',()=>{
  for(const open of [false,true]){
   const state=new OldStreetState(config.props,config.terrain);if(open)for(const p of config.props.filter(p=>p.interaction))state.opened.add(p.id);
   const q=[{x:500,y:1700}],seen=new Set(['500,1700']);
   for(let i=0;i<q.length;i++)for(const [dx,dy]of [[20,0],[-20,0],[0,20],[0,-20]]){
    const n={x:q[i].x+dx,y:q[i].y+dy},key=n.x+','+n.y;
    if(n.x<20||n.x>980||n.y<20||n.y>1740||seen.has(key)||!state.clearLine(q[i],n,16))continue;
    seen.add(key);q.push(n);
   }
   for(const d of [...devices,{id:'finale-arrival',x:500,y:430}])assert(q.some(p=>Math.hypot(p.x-d.x,p.y-d.y)<65&&state.clearLine(p,d,4)),d.id+' inaccessible');
  }
 });
 test(config.chapterId+' new frontages block real movement/projectiles and release covered enemy spawns',()=>{
  const owner=Object.assign(Object.create(OldStreetScene.prototype),{state:new OldStreetState(config.props,config.terrain),lastPlayer:{x:500,y:1708},enemyPositions:new WeakMap(),scene:{_syncManualPhysicsBody(){}}});
  const props=config.props.filter(p=>p.id.startsWith('frontage-'));assert.equal(props.length,count);
  for(const p of props){const r=p.footprint,inside={x:r.x+r.width/2,y:r.y+r.height/2},from={x:r.x-20,y:inside.y};
   assert.equal(owner.clearLine(from,inside,4),false);const stopped=owner.slide(from,inside,8);assert.notDeepEqual(stopped,inside);assert(owner.clearLine(stopped,stopped,8));
   const enemy={...inside,active:true,drawRadius:12};enemy.body={reset(x,y){enemy.x=x;enemy.y=y;}};owner.settleEnemy(enemy);assert(owner.clearLine(enemy,enemy,12));
  }
 });
}
test('new original shop and shed exports retain explicit existing payload paths and measured silhouettes',()=>{
 const exports=[
 ['neon','shop','art/neon-cohesion-20261009/','2fee07a53801f17a06f2020e39b93cabe0780cc97a77fda52b57877630856d1e','9a2f418cc9d5550d867e7f61a029bccb736eab51696b7346a7e50f82d8d2bf36',[600,648,9,3,591,646]],
 ['encore','shed','art/harbor-cohesion-20261009/','b16c5c449f81ac45e2ca078ad6cec23c308c974f1ba04fd2753e44ce507957dc','371280ed199fb639da174d06f23e29da3f367bf057590cd257feaffb935152f3',[460,450,2,40,458,448]],
 ];
 for(const [chapter,id,base,color,muted,[w,h,l,t,r,b]]of exports){
  for(const [suffix,hash]of [['',color],['-muted',muted]]){const file=base+id+suffix+'.webp';assert.equal(RUNTIME_PAYLOAD.filter(a=>a.file===file).length,1);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../public/'+file,import.meta.url))).digest('hex'),hash);}
  const bounds=streetVisibleBounds(id,{x:0,y:0,width:w,height:h},chapter);assert.deepEqual(bounds,{x:l,y:t,width:r-l,height:b-t});
 }
 assert.equal(RUNTIME_PAYLOAD.filter(a=>!['owner-menu-portrait','owner-menu-motion','owner-equipment-art','owner-character-cast','owner-character-motion','owner-weapon-fx','owner-ui','owner-world-ground','owner-enemy-attack','owner-heavy-material','owner-dash-material','owner-dash-contrast-material','owner-character-gait','owner-character-hurt','owner-character-shoot','owner-character-idle','owner-character-walk','owner-facility-fx'].includes(a.group)&&!['fonts/NotoSansSC-UI.woff2','licenses/noto-sans-sc.txt'].includes(a.file)).length,163);assert(!RUNTIME_PAYLOAD.some(a=>/chapter-environments|raw|\.prompt\./.test(a.file)));
});
