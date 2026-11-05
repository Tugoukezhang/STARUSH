import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';import {loadScenes} from './helpers/publicShellHarness.mjs';
const require=createRequire(import.meta.url),postcss=require('postcss'),sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const BASE='art/skill-command-20261022/',H='#game-container[data-battle-mode=public]',C=':is(#skill-encore,#skill-special[data-art=weapon])';
const expected=[
 ['encore.png',123577,'b6eadb257f033d5b9ee76e0987f865de6bfc7affff9de6995dcf68c88d385906'],
 ['rifle.png',111669,'ea9ef67eda2c922e45b0c6feaf4fb5407470f629510a03dc4667976c00a7b515'],
 ['sword.png',115746,'8d314d021e3fa75cd35247e4804269e44e773cf7b377fa9068a1d23ed27377e2'],
 ['hammer.png',139412,'931d64cc8dc36dfc2836139d0a1a45653ead3b616d4d9941e3044a584fe73e5d']
];
const ast=()=>postcss.parse(fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8'));
function rule(selector){const result={},found=[];ast().walkRules(r=>{if(!r.parent.name&&r.selector===selector){found.push(r);r.walkDecls(d=>result[d.prop]=d.value);}});assert(found.length,'missing '+selector);return result;}
test('the four admitted AI command exports are pinned transparent rasters with 12px safe edges',async()=>{
 for(const[name,bytes,hash]of expected){const b=fs.readFileSync(new URL('../public/'+BASE+name,import.meta.url));assert.equal(b.length,bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),hash);
  const{data,info}=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height,info.channels],[512,256,4]);let visible=0;
  for(let y=0;y<256;y++)for(let x=0;x<512;x++){const a=data[(y*512+x)*4+3];if(a>=32)visible++;if(x<12||x>=500||y<12||y>=244)assert.equal(a,0,name+' edge');}assert(visible>15000&&visible<85000,name+' ink area');}
});
test('only four explicit command paths enter the release, under the existing UI group',()=>{
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file.startsWith(BASE)).map(r=>({...r})),expected.map(([name])=>({file:BASE+name,group:'owner-ui'})));
 assert(!RUNTIME_PAYLOAD.some(r=>/skills-source|batch-51|commands-112/.test(r.file)));
 for(const name of ['encore.png','rifle.png'])assert(RUNTIME_PAYLOAD.some(r=>r.file==='art/comic-ui-20261021/'+name),'old compatibility source retained');
});
test('three owner weapons and Encore use distinct coordinated command art',()=>{
 assert(rule(H+' #skill-encore')['--comic-command-art'].includes(BASE+'encore.png'));
 assert(rule(H+' #skill-special[data-art=weapon]')['--comic-command-art'].includes(BASE+'rifle.png'));
 for(const[id,name]of [['kai','sword'],['enjo','hammer']])assert(rule(H+'[data-ui-performer='+id+'] #skill-special[data-art=weapon]')['--comic-command-art'].includes(BASE+name+'.png'));
});
test('all three weapon commands share a stable 112x74 slot and live 14px captions',()=>{
 const slot=rule(H+' '+C+'[data-charge-state]'),ink=rule(H+' '+C+'::before');
 assert.deepEqual([slot.width,slot.height,slot.background],['112px','74px','none']);assert.equal(ink.inset,'0 0 26px');assert.equal(ink['pointer-events'],'none');
 for(const s of [H+' #skill-encore #encore-state',H+' #skill-special[data-art=weapon] #special-state']){const d=rule(s);assert.deepEqual([d.top,d.height,d['font-size'],d['line-height'],d.padding],['46px','28px','14px','20px','4px']);}
 const outer=rule(H+' .mihoyo-skills:has(> [data-art=weapon]) .skill-orb[data-charge-state]');assert.deepEqual([outer.animation,outer.transform,outer.scale],['none','none','none']);
});
test('authored state plates remain shared and finite feedback animates ink only with reduce coverage',()=>{
 const state=' > :is(#encore-state,#special-state)',base='art/battle-comic-skin-20261021/';
 assert(rule(H+' '+C+'[data-charge-state]'+state).background.includes(base+'status-idle.png'));
 for(const s of ['ready','active'])assert(rule(H+' '+C+'[data-charge-state='+s+']'+state)['background-image'].includes(base+'status-'+s+'.png'));
 assert.match(rule(H+' '+C+'[data-charge-state=ready]::before').animation,/^comic-command-arrive 360ms /);
 assert.match(rule(H+' '+C+'[data-charge-state=active]::before').animation,/^comic-command-live 600ms /);
 let reduced=false;ast().walkAtRules('media',m=>{if(m.params==='(prefers-reduced-motion:reduce)')m.walkRules(r=>{if(r.selector===H+' .skill-orb::before'&&r.toString().includes('animation:none !important'))reduced=true;});});assert(reduced);
 ast().walkDecls('animation',d=>{if(d.parent.selector?.startsWith(H+' '+C))assert(!d.value.includes('infinite'));});
});
test('real HUD synchronization keeps three-member names, live charge, aria and action counters truthful',()=>{
 for(const id of ['sakura','kai','enjo']){
  const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const doc=e.document,sync=e.loadRuntime('systems/BattleSurfaceView.mjs').syncPublicBattleHud;
  if(!doc.getElementById('game-container')){const host=doc.createElement('div');host.id='game-container';doc.body.append(host);}
  for(const name of ['special-label','special-state','encore-state','special-fill','skill-special','skill-encore']){const n=doc.createElement(name.startsWith('skill-')?'button':'span');n.id=name;doc.body.append(n);}
  const s={time:{now:1000},battleData:{stageId:1,performerId:id},_userCastPresentation:true,_specialCharge:37.8,_encoreCharge:61.4,_isPublicStage1Round:()=>true,_battlePerformerContract:{publicActionOwnerId:id},player:{x:100,y:200,active:true,hp:5,maxHp:5},paintZone:{},publicStage1Round:{snapshot:()=>({phase:'active'}),getPerformerId:()=>id},_isPublicSakuraEncoreWindowActive:()=>false};
  s.publicPerformerRun=new(e.loadRuntime('systems/PublicStage1PerformerRun.mjs').PublicStage1PerformerRun)(s);
  sync(s,doc);assert.equal(doc.getElementById('special-state').textContent,'37%');assert.equal(doc.getElementById('encore-state').textContent,'61%');assert.equal(doc.getElementById('game-container').dataset.uiPerformer,id);
  const before=JSON.stringify([s.player,s._specialCharge,s._encoreCharge,s.publicPerformerRun.actions]);
  for(const flag of ['_battlePaused','_battleEnded']){s[flag]=true;sync(s,doc);for(const name of ['special','encore'])assert.equal(doc.getElementById('skill-'+name).getAttribute('aria-disabled'),'true');s[flag]=false;}
  assert.equal(JSON.stringify([s.player,s._specialCharge,s._encoreCharge,s.publicPerformerRun.actions]),before);
 }
});
