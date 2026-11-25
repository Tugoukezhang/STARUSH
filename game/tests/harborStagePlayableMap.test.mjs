import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getBattleChapter,resolveChapterPaintHit} from '../src/utils/publicCampaign.mjs';
import {OldStreetState,OLD_STREET_PROPS} from '../src/utils/oldStreetMap.mjs';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';
import {getChapterScenePresentation,preloadChapterScenePresentation} from '../src/systems/ChapterScenePresentation.mjs';

const water=[{id:'sea',footprint:{x:0,y:0,width:124,height:1778}}];
assert.equal(new OldStreetState([],water).clearLine({x:80,y:1400},{x:80,y:1500}),false,'Water terrain must block actual movement');
const data={stageId:1,campaignChapterId:'encore'},chapter=getBattleChapter(data);
assert.equal(chapter.devices.filter(d=>d.id.startsWith('harbor-')).length,10,'Third chapter requires its own harbor places');
const {HARBOR_STAGE_DEVICES:devices,HARBOR_STAGE_PROPS:props,HARBOR_STAGE_CONFIG:config,HARBOR_STAGE_ASSETS:assets,isHarborStageChapter}=await import('../src/utils/harborStageMap.mjs');
assert.equal(chapter.devices,devices);
assert.equal(new Set(devices.map(d=>`${d.x},${d.y}`)).size,10);
assert.equal(isHarborStageChapter(data),true);
for(const invalid of [{},{...data,practiceMode:true},{...data,defenseMode:true},{...data,stageId:2},{...data,campaignChapterId:'neon'}])assert.equal(isHarborStageChapter(invalid),false);
for(const d of devices){
  assert.equal(d.paintMax,26);assert.equal(d.colorSequence.length,2);assert.notEqual(...d.colorSequence);
  assert.ok(d.required&&d.purpose&&d.scenePrefix==='harbor');
  assert.equal(resolveChapterPaintHit({...d,paint:0},1000,'wrong').accepted,false);
  const first=resolveChapterPaintHit({...d,paint:0},1000,d.colorSequence[0]);
  assert.deepEqual(first,{accepted:true,paint:0,sequenceIndex:1,complete:false});
  assert.equal(resolveChapterPaintHit({...d,...first},26,d.colorSequence[0]).complete,true,'same performer can finish both cumulative phases');
  assert.equal(resolveChapterPaintHit({...d,...first},26,d.colorSequence[1]).complete,true);
}
const map=new OldStreetState(props,config.terrain);
assert.equal(map.blockers().length,12);
assert.equal(new OldStreetState().blockers().length,OLD_STREET_PROPS.filter(p=>p.footprint).length);
assert.equal(map.clearLine({x:170,y:1500},{x:80,y:1500},8),false);
assert.equal(map.clearLine({x:820,y:1500},{x:920,y:1500},8),false);
assert.equal(map.clearLine({x:280,y:1240},{x:280,y:1050}),false);
assert.equal(map.interact('south-transport',{x:500,y:1310}),true);
assert.equal(map.clearLine({x:500,y:1310},{x:500,y:1190}),true);
assert.equal(map.interact('south-transport',{x:500,y:1310}),false);
assert.equal(map.interact('west-water',{x:130,y:1300}),false);
for(const zone of [0,1]){
  const state=new OldStreetState(props,config.terrain),queue=[{x:500,y:1700}],seen=new Set(['500,1700']);
  for(let i=0;i<queue.length;i++)for(const[dx,dy]of[[20,0],[-20,0],[0,20],[0,-20]]){
    const p={x:queue[i].x+dx,y:queue[i].y+dy},key=`${p.x},${p.y}`;
    if(p.x<20||p.x>980||p.y<(zone?40:980)||p.y>1740||seen.has(key)||!state.clearLine(queue[i],p,8))continue;
    seen.add(key);queue.push(p);
  }
  for(const d of devices.filter(d=>d.zone<=zone))assert.ok(queue.some(p=>Math.hypot(p.x-d.x,p.y-d.y)<75&&state.clearLine(p,d)),`${d.id} reachable with both barriers closed`);
  if(zone)assert.ok(queue.some(p=>Math.hypot(p.x-500,p.y-430)<30));
}
const scene=Object.create(OldStreetScene.prototype);scene.config=config;scene.state=map;
map.restore('equipment-shed');map.restore('control-cabin');assert.equal(scene.storyReady(),false);
map.restore('west-relay');assert.equal(scene.storyReady(),false);
map.restore('east-relay');assert.equal(scene.storyReady(),true);
scene.lastPlayer={x:500,y:1600};
assert.ok(scene.freePoint({x:25,y:1500},20).x>144);
assert.ok(scene.freePoint({x:975,y:1500},20).x<856);
for(const x of [350,400,450,500,550,600,650])for(const y of [360,370,400,430,480]){
  const player={x,y},boss=scene.freePoint(config.finaleOrigin,20);
  assert.ok(scene.clearLine(player,boss),`Finale must face the player, not stage rear: ${x},${y}`);
  for(const [dx,dy]of[[-62,30],[0,58],[62,30]]){
    const weak=scene.freePoint({x:boss.x+dx,y:boss.y+dy},10);
    assert.ok(scene.clearLine(player,weak),`Weak point must remain in forecourt: ${x},${y}/${dx}`);
  }
}
assert.equal(getChapterScenePresentation(data).groundPath,'art/map-presentation-20261018/encore-neutral.webp');
const loads=[];preloadChapterScenePresentation({load:{image:(key,url)=>loads.push({key,url})}},data);
assert.deepEqual(loads.filter(x=>x.key.startsWith('chapter-sign-')).map(x=>x.url),['art/chapter-landmarks/sail-left.webp','art/chapter-landmarks/sail-right.webp']);
assert.equal(loads.length,assets.length+3);assert.equal(assets.length,11);
assert.ok(loads.filter(x=>!x.key.startsWith('chapter-sign-')).every(x=>(x.key.startsWith('chapter-ground-')?x.url===`art/map-presentation-20261018/encore-${x.key.includes('color-')?'color':'neutral'}.webp`:x.url.startsWith('art/harbor-cohesion-20261009/'))&&x.url.endsWith('.webp')));
const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
assert.match(source,/new OldStreetScene\(this,this\.battleData\.campaignChapterId==='homecoming'\?HOMECOMING_STAGE_CONFIG:HARBOR_STAGE_CONFIG\)/);
assert.deepEqual(scene.finaleOrigin(),config.finaleOrigin,'Harbor keeps its authored forecourt origin');
assert.match(source,/streetOrigin = this\.oldStreet\?\.finaleOrigin\?\.\(\) \?\? this\.oldStreet\?\.config\?\.finaleOrigin/);
assert.match(source,/preferredX = streetOrigin\?\.x \?\? this\.player\.x/);
assert.match(source,/preferredY = streetOrigin\?\.y \?\? this\.player\.y - P16_027_FINALE_BOSS_VERTICAL_OFFSET/);
console.log('Harbor geometry, shore, color phases, reachability, story and preload passed');
