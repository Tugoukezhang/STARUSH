import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {syncPublicObjectiveGuidance,destroyPublicObjectiveGuidance,resolvePublicObjectiveGuidanceTarget} from '../src/systems/PublicObjectiveGuidance.mjs';
import {createDocument} from './helpers/publicShellHarness.mjs';
const W=375,H=667;
const camera=({scrollX=0,scrollY=0,zoom=1}={})=>({scrollX,scrollY,width:W,height:H,zoom,
 // Phaser-style zoom about the viewport centre, applied after scroll.
 matrix:{transformPoint:(x,y,out)=>Object.assign(out,{x:(x-W/2)*zoom+W/2,y:(y-H/2)*zoom+H/2})}});
function fixture({devices,player={x:180,y:500},cam={},data={}}={}){
 const rows=devices||[{id:'a',sourceLabel:'配电箱',required:true,x:200,y:420,complete:false},{id:'b',sourceLabel:'霓虹\n招牌',required:true,x:220,y:-600,complete:false}];
 const listeners=new Map();
 return {_userCastPresentation:true,_isPublicStage1Round:()=>true,battleData:{stageId:1,performerId:'sakura',practiceMode:false,defenseMode:false,...data},
  player:{active:true,hp:100,...player},cameras:{main:camera(cam)},time:{now:1000},_joystickRest:{x:68,y:571},
  mobileControlHotspots:[{x:327,y:543,radius:32},{x:290,y:600,radius:21}],
  paintZone:{devices:rows,finaleMode:false,isComplete:()=>rows.every(d=>d.complete),
   getNearestObjective(x,y){return rows.filter(d=>!d.complete&&!d.chapterLocked).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0]||null;}},
  oldStreet:{config:{},finaleDestination:()=>({x:500,y:430})},
  publicStage1Finale:{state:{active:false},snapshot(){return {...this.state};}},
  events:{once:(n,f)=>listeners.set(n,f),off:(n,f)=>{if(listeners.get(n)===f)listeners.delete(n);}},listeners};
}
const root=doc=>doc.getElementById('public-objective-guidance');
const part=(doc,name)=>{const find=n=>n.dataset?.part===name?n:(n.children||[]).map(find).find(Boolean);return find(root(doc));};
const px=v=>Number.parseFloat(v);
const box=doc=>{const t=part(doc,'tag');return {x:px(t.style.left),y:px(t.style.top),w:px(t.style.width),h:px(t.style.height)};};
const hitsCircle=(b,c)=>{const cx=Math.max(b.x,Math.min(c.x,b.x+b.w)),cy=Math.max(b.y,Math.min(c.y,b.y+b.h));return Math.hypot(cx-c.x,cy-c.y)<c.radius;};
function assertSafe(doc,s){
 const b=box(doc);assert(b.y>=190,'tag clears top HUD and notice band');assert(b.x>=0&&b.x+b.w<=W&&b.y+b.h<=H,'tag stays inside 375x667 logical stage');
 assert(b.w<=140&&b.h<=40,'bounded tag geometry');
 for(const c of [...s.mobileControlHotspots,{...s._joystickRest,radius:64}])assert.equal(hitsCircle(b,c),false,'tag avoids control hit regions');
}
const centre=el=>({x:px(el.style.left)+px(el.style.width)/2,y:px(el.style.top)+px(el.style.height)/2});
test('ordinary locator clears active layered-heavy head, not just detailed Boss and calibration tags',()=>{const doc=createDocument(),s=fixture(),b={x:130,y:380,right:260,bottom:525};s.actorPresentation={userCastView:{heavyRig:{active:true},cueExclusionBounds:()=>b}};assert(syncPublicObjectiveGuidance(s,{doc}));const t=box(doc);assert(!(t.x<b.right&&t.x+t.w>b.x&&t.y<b.bottom&&t.y+t.h>b.y),'ordinary locator covers actual character');assertSafe(doc,s);assert.equal(root(doc).dataset.target,'a');assert.equal(part(doc,'label').textContent,'配电箱');});

test('nearest required objective stays guided even inside fire range, marker sits on camera-projected target',()=>{
 const doc=createDocument(),s=fixture();
 assert.equal(syncPublicObjectiveGuidance(s,{doc}),true);
 const r=root(doc);assert(r);assert.equal(r.hidden,false);assert.equal(r.dataset.mode,'target');
 assert.equal(part(doc,'label').textContent,'配电箱');
 const ring=part(doc,'ring');assert.equal(ring.hidden,false);assert.deepEqual(centre(ring),{x:200,y:420});
 assert.equal(ring.tagName,'IMG');assert.equal(ring.src,'art/battle-signals-b293/guidance.webp');
 assertSafe(doc,s);assert.equal(s._publicObjectiveGuidance.doc,doc);
});

test('offscreen target gives an edge bearing toward it; zoomed camera uses projected logical coordinates',()=>{
 const doc=createDocument(),s=fixture({devices:[{id:'n',sourceLabel:'北侧灯柱',required:true,x:190,y:-500}]});
 syncPublicObjectiveGuidance(s,{doc});
 assert.equal(root(doc).dataset.mode,'edge');assert.equal(part(doc,'ring').hidden,true);assert.equal(part(doc,'label').textContent,'北侧灯柱');
 const deg=Number(root(doc).dataset.bearing);assert(deg<-80&&deg>-100,'arrow points up toward the northern target: '+deg);
 assert.match(part(doc,'arrow').style.transform,/rotate\(-?\d+(\.\d+)?deg\)/);assertSafe(doc,s);
 // Same world point is offscreen at zoom 1 but visible after zooming out, so the marker follows the camera matrix.
 const row=()=>[{id:'z',sourceLabel:'远处喷口',required:true,x:470,y:330}];
 const rawDoc=createDocument();syncPublicObjectiveGuidance(fixture({devices:row()}),{doc:rawDoc});assert.equal(root(rawDoc).dataset.mode,'edge');
 const zoomDoc=createDocument();syncPublicObjectiveGuidance(fixture({devices:row(),cam:{zoom:.5}}),{doc:zoomDoc});assert.equal(root(zoomDoc).dataset.mode,'target');
 assert.deepEqual(centre(part(zoomDoc,'ring')),{x:(470-W/2)*.5+W/2,y:(330-H/2)*.5+H/2});
 for(const [x,y] of [[-400,900],[900,900],[200,2000],[-900,-900],[60,600],[330,560],[180,150],[20,300]]){
  const c=fixture({devices:[{id:'q',sourceLabel:'设施',required:true,x,y}]}),cd=createDocument();syncPublicObjectiveGuidance(c,{doc:cd});assert.equal(root(cd).hidden,false);assertSafe(cd,c);
  if(root(cd).dataset.mode==='edge'){const t=centre(part(cd,'tag')),b=Number(root(cd).dataset.bearing)*Math.PI/180;
   assert(Math.cos(b)*(x-t.x)+Math.sin(b)*(y-t.y)>0,'bearing points toward target '+x+','+y);}
 }
});

test('guide switches with completion, excludes completed/locked/suppressed, then points to real finale destination until Boss',()=>{
 const doc=createDocument(),s=fixture();const [a,b]=s.paintZone.devices;
 syncPublicObjectiveGuidance(s,{doc});assert.equal(part(doc,'label').textContent,'配电箱');assert.equal(root(doc).dataset.motion,'arrive');
 a.complete=true;syncPublicObjectiveGuidance(s,{doc});assert.equal(part(doc,'label').textContent,'霓虹 招牌');assert.equal(root(doc).dataset.target,'b');
 for(const change of [{publicStage1Suppressed:true},{chapterLocked:true},{complete:true}])
  assert.equal(resolvePublicObjectiveGuidanceTarget({...s,paintZone:{...s.paintZone,getNearestObjective:()=>({...b,...change}),isComplete:()=>false}}),null);
 b.complete=true;s.player.x=500;s.player.y=520;s.cameras.main.scrollX=500-W/2;s.cameras.main.scrollY=520-H/2;
 syncPublicObjectiveGuidance(s,{doc});assert.equal(root(doc).hidden,false);assert.equal(part(doc,'label').textContent,'前往露天剧场');assert.equal(root(doc).dataset.target,'finale-destination');assert.equal(root(doc).dataset.mode,'target');
 assert.deepEqual(centre(part(doc,'ring')),{x:500-s.cameras.main.scrollX,y:430-s.cameras.main.scrollY});
 s.oldStreet.config.finaleLabel='去北侧舞台';syncPublicObjectiveGuidance(s,{doc});assert.equal(part(doc,'label').textContent,'去北侧舞台');
 s.publicStage1Finale.state.active=true;syncPublicObjectiveGuidance(s,{doc});assert.equal(root(doc).hidden,true,'Boss active hides ordinary guide');
 s.publicStage1Finale.state={active:false,complete:true};syncPublicObjectiveGuidance(s,{doc});assert.equal(root(doc).hidden,true);
 const noStreet=fixture({devices:[{id:'x',complete:true,x:0,y:0}]});delete noStreet.oldStreet;assert.equal(resolvePublicObjectiveGuidanceTarget(noStreet),null,'no invented destination');
});

test('calibration target remains guided in range with its real calibration state',()=>{
 const doc=createDocument(),s=fixture({devices:[{id:'c',sourceLabel:'灯架',chapterSideSet:true,chapterAwaitingCalibration:true,chapterCalibrationRadius:90,x:185,y:470}]});
 syncPublicObjectiveGuidance(s,{doc});assert.equal(root(doc).hidden,false);assert.equal(root(doc).dataset.mode,'target');assert.equal(root(doc).dataset.state,'calibration');assert.equal(part(doc,'label').textContent,'校准 · 灯架');
 s.paintZone.devices[0].chapterAwaitingCalibration=false;syncPublicObjectiveGuidance(s,{doc});assert.equal(root(doc).dataset.state,'paint');assert.equal(part(doc,'label').textContent,'灯架');
});

test('completed facilities do not send the player to an unready arena while a real blocker is active',()=>{
 const s=fixture({devices:[{id:'done',x:0,y:0,complete:true}]});
 s.publicStage1Encounter={canEnterFinale:()=>false};s._publicStage1SpotlightCaptain={active:true,x:220,y:350};
 const t=resolvePublicObjectiveGuidanceTarget(s);assert.equal(t.state,'blocker');assert.equal(t.label,'击退领舞');assert.equal(t.x,220);assert.equal(t.y,350);
 s._publicStage1SpotlightCaptain.active=false;assert.equal(resolvePublicObjectiveGuidanceTarget(s).state,'destination');
 s._publicStage1SpotlightCaptain.active=true;s.publicStage1Encounter.canEnterFinale=()=>true;assert.equal(resolvePublicObjectiveGuidanceTarget(s).state,'destination');
});

test('read-only, lifecycle-gated, no replay on resume, exclusions and idempotent cleanup',()=>{
 const doc=createDocument();let globals=0;const add=doc.addEventListener;doc.addEventListener=(...a)=>{globals++;return add?.apply(doc,a);};
 const s=fixture(),snap=()=>JSON.stringify({d:s.paintZone.devices,p:s.player,c:[s.cameras.main.scrollX,s.cameras.main.scrollY,s.cameras.main.zoom],b:s.battleData}),before=snap();
 syncPublicObjectiveGuidance(s,{doc});assert.equal(root(doc).dataset.motion,'arrive');
 for(const [k,v] of [['_battlePaused',true],['_publicBattleDialog',{}],['publicPerformerRun',{choiceOpen:true,now:()=>1}],['_sessionExperience',{isBlocking:()=>true}]]){
  s[k]=v;assert.equal(syncPublicObjectiveGuidance(s,{doc}),false);assert.equal(root(doc).hidden,true);assert.equal(root(doc).dataset.motion,'steady');delete s[k];
  syncPublicObjectiveGuidance(s,{doc});assert.equal(root(doc).hidden,false);assert.equal(root(doc).dataset.motion,'steady','resumed baseline does not replay arrival');
 }
 s.player.active=false;syncPublicObjectiveGuidance(s,{doc});assert.equal(root(doc).hidden,true);s.player.active=true;
 s._battleEnded=true;syncPublicObjectiveGuidance(s,{doc});assert.equal(root(doc).hidden,true);delete s._battleEnded;
 assert.equal(snap(),before,'no gameplay writes');assert.equal(globals,0,'no global listeners');assert.equal(root(doc).getAttribute('aria-hidden'),'true');
 s.listeners.get('shutdown')();assert.equal(root(doc),null);assert.equal(s._publicObjectiveGuidance,undefined);assert.equal(s.listeners.size,0);
 destroyPublicObjectiveGuidance(s);destroyPublicObjectiveGuidance({});destroyPublicObjectiveGuidance(null);
 syncPublicObjectiveGuidance(s,{doc});assert(root(doc),'a restarted scene can own a fresh guide');destroyPublicObjectiveGuidance(s);assert.equal(root(doc),null);
 for(const data of [{practiceMode:true},{defenseMode:true},{publicFinaleTrial:{}},{p15ManualFocusExperiment:true}]){
  const d=createDocument(),x=fixture({data});assert.equal(syncPublicObjectiveGuidance(x,{doc:d}),false);assert.equal(root(d),null);
 }
 const d=createDocument(),x=fixture();x._userCastPresentation=false;syncPublicObjectiveGuidance(x,{doc:d});assert.equal(root(d),null);
 const late=fixture(),ld=createDocument();syncPublicObjectiveGuidance(late,{doc:ld});late.battleData.practiceMode=true;syncPublicObjectiveGuidance(late,{doc:ld});assert.equal(root(ld).hidden,true);
 assert.equal(syncPublicObjectiveGuidance(fixture(),{doc:{}}),false,'no DOM host is a safe no-op');
});

test('source and style stay timer-free, non-interactive, admitted art/font, readable and reduced-motion safe',()=>{
 const src=readFileSync(new URL('../src/systems/PublicObjectiveGuidance.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/setTimeout|setInterval|requestAnimationFrame|addEventListener|\.tweens|from 'phaser'/);
 const css=readFileSync(new URL('../src/styles/objectiveGuidance.css',import.meta.url),'utf8');
 assert.match(css,/#public-objective-guidance\s*\{[^}]*pointer-events:\s*none/);
 assert.match(css,/"Starush UI"/);
 for(const m of css.matchAll(/font-size:\s*(\d+)px/g))assert(Number(m[1])>=14,'label font >=14px');
 assert.match(css,/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*animation:\s*none/);
 const refs=[...css.matchAll(/url\('([^']+)'\)/g),...src.matchAll(/'(art\/[^']+)'/g)].map(m=>m[1].replace(/^\//,''));assert(refs.length>0);
 for(const p of refs){assert(existsSync(new URL('../public/'+p,import.meta.url)),'admitted asset exists: '+p);assert.match(p,/^art\/(formal-ui-20261016|playable-ui-20261018|battle-signals-b293|rooftop-supply-297)\//);}
});

test('an ordinary paint target keeps its ring with the caption below a nearby performer',()=>{
 const doc=createDocument(),s=fixture({devices:[{id:'lamp',sourceLabel:'灯',required:true,x:200,y:420}]});
 s.actorPresentation={userCastView:{cueExclusionBounds:()=>({x:183,y:350,right:218,bottom:376})}};
 syncPublicObjectiveGuidance(s,{doc});
 assert.equal(root(doc).dataset.mode,'target');
 assert.equal(root(doc).dataset.bearing,'-90');
 assert.equal(part(doc,'ring').hidden,false);
});
