import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getBattleChapter, resolveChapterPaintHit } from '../src/utils/publicCampaign.mjs';
import { OldStreetState, OLD_STREET_DEVICES, isOldStreetChapter } from '../src/utils/oldStreetMap.mjs';
import { OldStreetScene } from '../src/systems/OldStreetScene.mjs';
import { getChapterScenePresentation, getDevicePresentation, preloadChapterScenePresentation } from '../src/systems/ChapterScenePresentation.mjs';

const data={stageId:1,campaignChapterId:'neon'};
const chapter=getBattleChapter(data);
assert.equal(chapter.devices.filter(d=>d.id.startsWith('neonstreet-')).length,10,'Chapter 2 must use authored district places, not mirrored legacy fixtures');
const {NEON_STREET_DEVICES,NEON_STREET_PROPS,NEON_STREET_CONFIG,isNeonStreetChapter,NEON_STREET_ASSETS}=await import('../src/utils/neonStreetMap.mjs');
assert.equal(chapter.devices,NEON_STREET_DEVICES);
assert.equal(chapter.flipX,false);
assert.equal(isNeonStreetChapter(data),true);
for(const invalid of [{}, {...data,practiceMode:true},{...data,defenseMode:true},{...data,stageId:2},{...data,campaignChapterId:'opening'}])assert.equal(isNeonStreetChapter(invalid),false);
assert.equal(isOldStreetChapter(data),false);
assert.equal(NEON_STREET_DEVICES.length,10);
assert.equal(new Set(NEON_STREET_DEVICES.map(d=>d.id)).size,10);
for(const zone of [0,1])assert.deepEqual(NEON_STREET_DEVICES.filter(d=>d.zone===zone).map(d=>d.colorSequence[0]).sort(),['pink','blue','yellow','purple','orange'].sort());
for(const d of NEON_STREET_DEVICES){
  assert.ok(d.required&&d.purpose&&d.sceneArt==='signal');
  assert.equal(d.paintMax,52);
  assert.equal(d.scenePrefix,'neonstreet');
  assert.equal(OLD_STREET_DEVICES.some(old=>old.x===d.x&&old.y===d.y),false);
  assert.equal(resolveChapterPaintHit({...d,paint:0},52,d.colorSequence[0]).complete,true);
  assert.equal(resolveChapterPaintHit({...d,paint:0},52,d.colorSequence[0]==='pink'?'blue':'pink').accepted,true);
}
const state=new OldStreetState(NEON_STREET_PROPS);
assert.equal(state.blockers().length,NEON_STREET_PROPS.length);
assert.equal(state.clearLine({x:225,y:1180},{x:225,y:980}),false);
assert.equal(state.interact('south-screen',{x:530,y:1280}),true);
assert.equal(state.clearLine({x:530,y:1280},{x:530,y:1160}),true);
assert.equal(state.interact('south-screen',{x:530,y:1280}),false);
assert.equal(new OldStreetState(NEON_STREET_PROPS).interact('south-screen',{x:50,y:1600}),false);
assert.equal(new OldStreetState().blockers().some(p=>p.id==='record-shop'),true);

// Reachability uses the same Phaser intersection primitive as runtime, including the closed-panel state.
for(const zone of [0,1]){
  const map=new OldStreetState(NEON_STREET_PROPS),step=20,queue=[{x:500,y:1700}],seen=new Set(['500,1700']);
  for(let i=0;i<queue.length;i++)for(const [dx,dy]of [[step,0],[-step,0],[0,step],[0,-step]]){
    const p={x:queue[i].x+dx,y:queue[i].y+dy},key=`${p.x},${p.y}`;
    if(p.x<20||p.x>980||p.y<(zone?40:980)||p.y>1740||seen.has(key)||!map.clearLine(queue[i],p,8))continue;
    seen.add(key);queue.push(p);
  }
  for(const target of NEON_STREET_DEVICES.filter(d=>d.zone<=zone))assert.ok(queue.some(p=>Math.hypot(p.x-target.x,p.y-target.y)<90&&map.clearLine(p,target)),`${target.id} must be reachable and shootable`);
  if(zone)assert.ok(queue.some(p=>Math.hypot(p.x-500,p.y-430)<30),'Finale entrance reachable without mandatory screen interaction');
}
const street=Object.create(OldStreetScene.prototype);
street.config=NEON_STREET_CONFIG;street.state=new OldStreetState(NEON_STREET_PROPS);
street.state.restore('north-listening');street.state.restore('north-cafe');
assert.equal(street.storyReady(),false,'Unrelated two stores do not count as south street story');
street.state.restore('listening-store');assert.equal(street.storyReady(),false);
street.state.restore('night-cafe');assert.equal(street.storyReady(),true);
street.items=new Map();street.scene={player:{x:500,y:800},publicPerformerRun:{choiceOpen:false},_sessionExperience:{isBlocking:()=>false,showStory:(id,phase,opt)=>{assert.equal(id,'neon');assert.equal(phase,'midpoint');assert.equal(opt.live,true);return true;}}};
street.sync();assert.equal(street.storyOffered,true);
assert.equal(street.atTheater({x:500,y:430}),true);
assert.equal(street.atTheater({x:780,y:430}),false);

assert.equal(getChapterScenePresentation(data).groundPath,'art/map-presentation-20261018/neon-neutral.webp');
assert.equal(getDevicePresentation(NEON_STREET_DEVICES[0]).texture,'neonstreet-signal');
assert.equal(getChapterScenePresentation({...data,practiceMode:true}),null);
const loads=[];preloadChapterScenePresentation({load:{image:(key,url)=>loads.push({key,url})}},data);
assert.equal(loads.length,NEON_STREET_ASSETS.length+2);
assert.ok(loads.every(v=>(v.key.startsWith('chapter-ground-')?v.url===`art/map-presentation-20261018/neon-${v.key.includes('color-')?'color':'neutral'}.webp`:v.url.startsWith('art/neon-cohesion-20261009/')||v.url==='art/harbor-cohesion-20261009/barrier.webp')&&!v.url.includes('preview')));
const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
assert.match(source,/isNeonStreetChapter\(this\.battleData\)/);
assert.match(source,/new OldStreetScene\(this,\s*NEON_STREET_CONFIG\)/);
console.log('Neon district: independent places, colors, cover, paths, story, preload and isolated route passed');
