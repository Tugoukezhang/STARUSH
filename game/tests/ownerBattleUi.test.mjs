import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';

test('image-backed pause decoration keeps the exact existing canvas hotspot and never intercepts input',()=>{
 const css=fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');
 const declaration=css.match(/#game-container\[data-battle-mode=public\] #hud::after\s*\{([^}]+)\}/)?.[1];
 assert(declaration,'missing authored pause face');
 assert.match(declaration,/left:326px/);assert.match(declaration,/top:57px/);
 assert.match(declaration,/width:42px/);assert.match(declaration,/height:42px/);
 assert.match(declaration,/pointer-events:none/);assert.match(declaration,/disc\.webp/);
});

test('exactly fifteen generated battle UI exports ship, with source hashes kept outside public',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../../01-美术/owner-battle-ui-20261015/manifest.json',import.meta.url)));
 const rows=RUNTIME_PAYLOAD.filter(row=>row.file.startsWith('art/owner-battle-ui-20261015/'));
 assert.equal(rows.length,15);assert.equal(manifest.assets.length,15);assert.equal(manifest.textBaked,false);
 for(const row of rows){const item=manifest.assets.find(a=>a.file===row.file);assert(item);assert.equal(item.alpha,true);
  const bytes=fs.readFileSync(new URL('../public/'+row.file,import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256);
 }
 assert(!rows.some(row=>/source|manifest|\.png/.test(row.file)));
});

test('all six choices use their authored item images while preserving real descriptions and commands',()=>{
 const e=loadScenes(),{BattleSurfaceView}=e.loadRuntime('systems/BattleSurfaceView.mjs');
 const ids=['wide_brush','relay','tempo','echo','overdrive','recovery'],calls=[];
 const scene={input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},events:{once(){},off(){}},sound:null};
 const view=new BattleSurfaceView(scene,{mode:'choice',number:1,member:e.profile.PUBLIC_PERFORMERS[0],choices:[],
  options:ids.map(id=>({id,label:id,description:'actual '+id})),onChoice:id=>calls.push(id),onLeave(){}},e.document);
 for(const id of ids){const b=view.root.querySelector(`[data-choice=${id}]`),img=b.querySelector('.battle-choice-art');
  assert(img,id+' must use the generated item icon');assert.equal(img.src,`art/formal-ui-20261016/${id==='wide_brush'?'nozzle':id}.webp`);
  assert.equal(img.alt,'');assert(b.textContent.includes('actual '+id));
 }
 view.root.querySelector('[data-choice=wide_brush]').click();assert.deepEqual(calls,['wide_brush']);
 view.destroy();assert.equal(scene.input.enabled,true);
});

test('current cast action icon follows owner identity and never changes the charge or action state',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const sync=e.loadRuntime('systems/BattleSurfaceView.mjs').syncPublicBattleHud,doc=e.document;
 for(const id of ['skill-special','skill-encore','special-label','special-state','encore-state']){const b=doc.createElement('button');b.id=id;doc.body.append(b);}
 const s={_userCastPresentation:true,_isPublicStage1Round:()=>true,player:{hp:3,maxHp:5},_specialCharge:37,_encoreCharge:20,
  publicPerformerRun:{member:{id:'kai',name:'机甲剑士'},canAct:()=>false}};
 sync(s,doc);sync(s,doc);
 const b=doc.getElementById('skill-special');assert.equal(b.querySelectorAll('img').length,1);
 assert.equal(b.querySelector('img').src,'art/formal-ui-20261016/action-kai.webp');
 assert.equal(b.getAttribute('data-charge-state'),'charging');assert.equal(s._specialCharge,37);
 s.publicPerformerRun.member={id:'enjo',name:'重锤手'};sync(s,doc);
 assert.equal(b.querySelector('img').src,'art/formal-ui-20261016/action-enjo.webp');
 assert.equal(doc.getElementById('special-label').textContent,'重锤');
});
