import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {OLD_STREET_PROPS,OLD_STREET_DEVICES,OldStreetState,isOldStreetChapter} from '../src/utils/oldStreetMap.mjs';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';
import {oldStreetMaterialPath} from '../src/systems/StreetMaterialPresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const ids=['east-entry','east-records','east-middle','west-middle','west-entry','east-forecourt'].map(id=>'frontage-'+id);
const added=()=>ids.map(id=>OLD_STREET_PROPS.find(p=>p.id===id));

test('two-sided street frontage is real independently restored collision, not background-painted fake buildings',()=>{
  assert(added().every(Boolean),'RED: coherent frontage instances have not been installed');
  assert.equal(OLD_STREET_PROPS.length,21);
  for(const p of added()){
    assert(p.restorable&&p.footprint);
    assert(OLD_STREET_DEVICES.some(d=>d.restores===p.restorationId));
    for(const suffix of ['','-muted'])assert(RUNTIME_PAYLOAD.some(a=>a.file===oldStreetMaterialPath(p.art+suffix)));
    assert(p.x-p.width/2>=0&&p.x+p.width/2<=1000&&p.y-p.height>=0&&p.y<=1778);
    const r=p.footprint;assert(r.x>=p.x-p.width/2&&r.x+r.width<=p.x+p.width/2&&r.y>=p.y-p.height&&r.y+r.height<=p.y);
  }
});

test('original facility coordinates, requirements and central street contract are preserved',()=>{
  assert.deepEqual(OLD_STREET_DEVICES.map(d=>[d.id.replace('oldstreet-',''),d.x,d.y,d.zone,d.required,d.paintMax]),[
    ['welcome',510,1635,0,true,52],['records',350,1460,0,true,52],['tickets',820,1100,0,true,52],
    ['repair',350,1120,0,true,52],['crossing',550,970,0,true,52],['north',490,820,1,true,52],
    ['garden',184,520,1,true,52],['mix',735,580,1,true,52],['stage-left',370,270,1,true,52],['stage-right',630,270,1,true,52],
  ]);
  const state=new OldStreetState();assert(state.clearLine({x:600,y:1708},{x:600,y:960},16));
  for(const d of OLD_STREET_DEVICES)assert(state.clearLine(d,d,16),'body-safe facility: '+d.id);
});

test('storefront footprints do not overlap existing buildings, trees or each other',()=>{
  assert(added().every(Boolean),'RED: frontage footprints missing');
  const all=OLD_STREET_PROPS.filter(p=>p.footprint);
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
    const a=all[i].footprint,b=all[j].footprint;
    assert(!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y),all[i].id+' overlaps '+all[j].id);
  }
  const tree=all.find(p=>p.id==='south-tree');assert.equal(tree.x,945);assert.equal(tree.footprint.x,933);
});

test('closed and opened street interactions retain reachable facility contacts and theater approach',()=>{
  for(const open of [false,true]){
    const state=new OldStreetState();if(open){state.opened.add('loading-gate');state.opened.add('acoustic-panel');}
    const queue=[{x:500,y:1700}],visited=new Set(['500,1700']);
    for(let i=0;i<queue.length;i++){
      const p=queue[i];for(const [dx,dy]of [[20,0],[-20,0],[0,20],[0,-20]]){
        const n={x:p.x+dx,y:p.y+dy},key=n.x+','+n.y;
        if(n.x<20||n.x>980||n.y<20||n.y>1740||visited.has(key)||!state.clearLine(p,n,16))continue;
        visited.add(key);queue.push(n);
      }
    }
    for(const point of [...OLD_STREET_DEVICES,{id:'theater-arrival',x:500,y:430}]){
      assert(queue.some(p=>Math.hypot(p.x-point.x,p.y-point.y)<65&&state.clearLine(p,point,4)),point.id+' unreachable');
    }
  }
});

test('each new facade blocks direct movement and projectiles while an enemy can escape a covered spawn',()=>{
  assert(added().every(Boolean),'RED: no real frontage to exercise');
  const owner=Object.create(OldStreetScene.prototype);owner.state=new OldStreetState();owner.lastPlayer={x:500,y:1708};
  owner.enemyPositions=new WeakMap();let syncs=0;owner.scene={_syncManualPhysicsBody(){syncs++;}};
  for(const p of added()){
    const r=p.footprint,inside={x:r.x+r.width/2,y:r.y+r.height/2},from={x:r.x-20,y:inside.y};
    assert.equal(owner.clearLine(from,inside,4),false,'bullet cover '+p.id);
    const stopped=owner.slide(from,inside,8);assert.notDeepEqual(stopped,inside);assert(owner.clearLine(stopped,stopped,8));
    const enemy={...inside,active:true,drawRadius:12};enemy.body={reset(x,y){enemy.x=x;enemy.y=y;}};
    owner.settleEnemy(enemy);assert(owner.clearLine(enemy,enemy,12),'covered spawn remains trapped '+p.id);
    assert.notDeepEqual({x:enemy.x,y:enemy.y},inside);
  }
  assert.equal(syncs,6);
});

test('new ground replaces the rejected island layout without adding a new release path',()=>{
  const file='art/street-perspective-20261009/ground.webp',bytes=fs.readFileSync(new URL('../public/'+file,import.meta.url));
  assert.notEqual(crypto.createHash('sha256').update(bytes).digest('hex'),'07bb0e540ba3ca297b14de21a1697bdd18a861b4a1ac1db951b084101eb73ae4','RED: old isolated pavement is still installed');
  assert.equal(RUNTIME_PAYLOAD.filter(a=>a.file===file).length,1);
  assert.equal(RUNTIME_PAYLOAD.filter(a=>a.group==='oldstreet-scene').length,26);
  assert(!RUNTIME_PAYLOAD.some(a=>/frontage.*\.(png|json|md)$/.test(a.file)));
});

test('new storefronts belong only to the existing first-chapter owner',()=>{
  assert(isOldStreetChapter({stageId:1,campaignChapterId:'opening'}));
  for(const data of [{stageId:1,campaignChapterId:'neon'},{stageId:1,campaignChapterId:'encore'},{practiceMode:true},{defenseMode:true}])assert.equal(isOldStreetChapter(data),false);
});
