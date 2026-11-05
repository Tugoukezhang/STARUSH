import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const url=new URL('../src/systems/EnjoVisualStudy.mjs',import.meta.url);
const api=fs.existsSync(url)?await import(url):{};
const href='https://example.com/game/?qRebaseTrial=1&enjoVisualStudy=1';
test('visual study requires build and two unique explicit flags; only public Enjo can use the body',()=>{
 assert.equal(typeof api.visualStudyEnabled,'function');assert(api.visualStudyEnabled(href,true));
 for(const u of ['https://example.com/','https://example.com/?enjoVisualStudy=1','https://example.com/?qRebaseTrial=1',href+'&enjoVisualStudy=0','bad'])assert.equal(api.visualStudyEnabled(u,true),false,u);
 assert.equal(api.visualStudyEnabled(href,false),false);
 for(const d of [{performerId:'kai'},{performerId:'enjo',practiceMode:true},{performerId:'enjo',stageId:2},{}])assert.equal(api.enjoVisualStudyRequested(d,href,true),false);
 assert(api.enjoVisualStudyRequested({performerId:'enjo',stageId:1},href,true));
});
test('new UI art is finite and never silently replaces another performer or default release',()=>{
 assert.equal(typeof api.studyUiArt,'function');assert.equal(api.studyUiArt('enjo',href,false),null);assert.equal(api.studyUiArt('sakura',href,true),null);
 const art=api.studyUiArt('enjo',href,true);assert.equal(art.visualStudy,true);
 for(const kind of ['avatar','portrait','victory','defeat'])assert.equal(art[kind],`art/enjo-visual-study-20261014/${kind}.webp`);
});
test('frame selection preserves four actual views and existing release semantics instead of inventing windup',()=>{
 assert.equal(typeof api.selectEnjoCelFrame,'function');
 for(const [i,facing]of ['down','left','right','up'].entries())for(let n=0;n<4;n++)assert.equal(api.selectEnjoCelFrame({state:'walk',facing,phase:n/4}),['down','up'].includes(facing)?`gait-${facing}-${n}`:`run-${i*4+n}`);
 assert.equal(api.selectEnjoCelFrame({state:'action',actionProgress:0}),'attack-0');
 assert.equal(api.selectEnjoCelFrame({state:'action',actionProgress:.5}),'attack-1');
 assert.equal(api.selectEnjoCelFrame({state:'action',actionProgress:.99}),'attack-3');
 assert.equal(api.selectEnjoCelFrame({state:'hurt',hurtProgress:0}),'recoil-down-0');
 assert.equal(api.selectEnjoCelFrame({state:'hurt',hurtProgress:.9}),'recoil-down-2');
 assert.equal(api.selectEnjoCelFrame({state:'idle',clock:2750}),'idle-2');
 assert.equal(api.selectEnjoCelFrame({state:'walk',phase:NaN}),'gait-down-0');
});
function fixture(complete=true){
 const registrations=new Map(),fallback={groundY:173,bounds:{x:44,y:21,width:104,height:152},feet:[{x:84,y:173},{x:108,y:173}],hand:null};
 const created=[],events=new EventEmitter(),textures={removed:[],exists:()=>true,get:()=>({has:()=>complete,get:f=>({customData:{registration:registrations.get(f)??fallback}})}),remove:k=>textures.removed.push(k)};
 const node=()=>{const n={active:true,visible:true};for(const m of ['setTexture','setPosition','setDisplaySize','setOrigin','setAngle','setDepth','setAlpha'])n[m]=function(...args){this[m+'Args']=args;return this;};n.setVisible=v=>{n.visible=v;return n;};n.destroy=()=>{n.active=false;};created.push(n);return n;};
 const legacy={nodes:new Map([['body',node()]]),seams:{nodes:new Map([['joint',node()]])},pose:{state:'idle',clock:0,phase:0,facing:'down',legFacing:'down'},motion:{shot:null}};
 const scene={player:{x:187.5,y:250,hp:5,active:true},playerGfx:{alpha:1},textures,events,add:{image:node}};
 const actor={scene,state:'idle',hurtUntil:180,enjoView:legacy};return {actor,scene,legacy,created,registrations};
}
test('whole-cell view consumes actual state, anchors to existing ground, freezes and never writes physics',()=>{
 assert.equal(typeof api.EnjoCelStudyView,'function');const f=fixture(),v=new api.EnjoCelStudyView(f.actor),before=JSON.stringify(f.scene.player);
 v.update(0,null,false);assert.equal(JSON.stringify(f.scene.player),before);assert.equal(f.legacy.nodes.get('body').visible,false);
 assert.deepEqual(v.upper.setPositionArgs,[187.5,276]);assert.deepEqual(v.upper.setOriginArgs,[.5,173/192]);
 const idle=JSON.stringify(v.rows);f.legacy.pose={...f.legacy.pose,state:'walk',clock:100,phase:.5,legFacing:'left'};v.update(100,null,true);assert.equal(JSON.stringify(v.rows),idle);
 v.restoreLegacy();assert.equal(f.legacy.nodes.get('body').visible,true);v.update(100,null,false);assert.equal(v.rows[0].part,'run-6');
 f.legacy.pose.state='action';f.legacy.pose.actionProgress=0;v.update(110,null,false);assert.equal(v.rows[0].part,'attack-0');
 f.legacy.pose.state='hurt';v.update(120,null,false);assert(v.rows[0].part.startsWith('recoil-'));
 assert.equal(JSON.stringify(f.scene.player),before);v.setWorldDepth(7.2);assert.equal(v.upper.setDepthArgs[0],7.2);
 v.destroy();v.destroy();assert.equal(v.upper.active,false);assert.equal(f.scene.events.listenerCount('shutdown'),1);f.scene.events.emit('shutdown');assert.equal(f.scene.textures.removed.length,1);
});
test('incomplete study atlas fails before hiding old presentation or leaving listeners',()=>{
 assert.equal(typeof api.EnjoCelStudyView,'function');const f=fixture(false);assert.throws(()=>new api.EnjoCelStudyView(f.actor),/complete study atlas/);
 assert.equal(f.legacy.nodes.get('body').visible,true);assert.equal(f.scene.events.listenerCount('shutdown'),0);assert.equal(f.scene.textures.removed.length,1);
});
test('ordinary firing while moving cannot replace a genuine directional run with a frontal standing cel',()=>{
 const f=fixture(),v=new api.EnjoCelStudyView(f.actor);v.update(0,null,false);
 f.scene.player.y-=4;f.legacy.pose={state:'attack',facing:'down',legFacing:'up',clock:100,phase:.5};
 f.legacy.motion.shot={duration:120,remaining:100};v.update(100,null,false);
 assert.equal(v.rows[0].part,'gait-up-2');
 f.legacy.pose.state='action';f.legacy.pose.actionProgress=0;v.update(110,null,false);assert.equal(v.rows[0].part,'attack-0');v.destroy();
});
test('study resources get their own exact trial payload, not the default or previous ten-file list',async()=>{
 const p=await import('../scripts/runtime-payload.mjs');assert(Array.isArray(p.ENJO_VISUAL_STUDY_PAYLOAD),'Missing finite study payload');
 assert.equal(p.Q_REBASE_TRIAL_PAYLOAD.length,10);assert(!p.RUNTIME_PAYLOAD.some(r=>r.file.includes('enjo-visual-study')));
 assert.equal(new Set(p.ENJO_VISUAL_STUDY_PAYLOAD.map(r=>r.file)).size,p.ENJO_VISUAL_STUDY_PAYLOAD.length);
 for(const row of p.ENJO_VISUAL_STUDY_PAYLOAD){assert(row.file.startsWith('art/enjo-visual-study-20261014/'));assert(!row.file.endsWith('.png'));assert(fs.existsSync(new URL('../public/'+row.file,import.meta.url)));}
 const cfg=fs.readFileSync(new URL('../vite.config.js',import.meta.url),'utf8');assert(cfg.includes('...ENJO_VISUAL_STUDY_PAYLOAD'));
});
test('four surfaces use scoped study state, retain existing commands, and never change canvas input sizing',()=>{
 const shell=fs.readFileSync(new URL('../src/systems/PublicShellView.mjs',import.meta.url),'utf8'),surface=fs.readFileSync(new URL('../src/systems/BattleSurfaceView.mjs',import.meta.url),'utf8');
 assert(shell.includes('visualStudyEnabled'));assert(surface.includes('visualStudyEnabled'));
 const css=fs.readFileSync(new URL('../src/styles/mobileGameScreens.css',import.meta.url),'utf8');assert(css.includes('[data-visual-study=enjo]'));assert(!css.includes('#game-container > canvas'));
});
test('light study result overrides inherited pale labels and choice selectors match actual DOM',()=>{
 const css=fs.readFileSync(new URL('../src/styles/mobileGameScreens.css',import.meta.url),'utf8');
 for(const selector of ['.battle-result-chapter','.battle-visual-copy strong','.battle-visual-copy span','.battle-performance-header > .battle-eyebrow'])assert(css.includes('#battle-result[data-visual-study=enjo] '+selector),selector);
 assert(css.includes('#run-choice[data-visual-study=enjo] .battle-choice-symbol'));
 assert(!css.includes('#run-choice[data-visual-study=enjo] .battle-choice-icon'));
});
test('directional idle and release use actual side and rear drawings, not a frontal fallback',()=>{
 for(const facing of ['left','right','up']){
  assert.equal(api.selectEnjoCelFrame({state:'idle',facing,clock:0}),`idle-${facing}-0`);
  assert.equal(api.selectEnjoCelFrame({state:'action',facing,actionProgress:0}),`attack-${facing}-0`);
  assert.equal(api.selectEnjoCelFrame({state:'action',facing,actionProgress:.99}),`attack-${facing}-3`);
  assert.equal(api.selectEnjoCelFrame({state:'hurt',facing,hurtProgress:0}),`recoil-${facing}-0`);
 }
});
test('stopping retains visible locomotion facing; pause cannot advance it; a real stationary release owns facing',()=>{
 const f=fixture(),v=new api.EnjoCelStudyView(f.actor);v.update(0,null,false);
 f.scene.player.x+=4;f.legacy.pose={state:'walk',facing:'up',legFacing:'right',phase:0,clock:50};v.update(50,null,false);assert.equal(v.rows[0].part,'run-8');
 f.legacy.pose={state:'idle',facing:'up',phase:0,clock:60};v.update(60,null,false);assert.equal(v.rows[0].part,'idle-right-0');
 f.legacy.pose={state:'action',facing:'left',actionProgress:0};v.update(70,null,true);assert.equal(v.rows[0].part,'idle-right-0');
 v.update(70,null,false);assert.equal(v.rows[0].part,'attack-left-0');v.destroy();
});
test('registered cel points transform from real origin and absent points never guess a palm',()=>{
 assert.equal(typeof api.enjoCelWorldPoint,'function');
 const row={x:200,y:300,width:80,height:80,origin:[.5,173/192]};
 assert.deepEqual(api.enjoCelWorldPoint(row,{x:96,y:173}),{x:200,y:300});
 assert.equal(api.enjoCelWorldPoint(row,null),null);assert.equal(api.enjoCelWorldPoint(row,{x:NaN,y:173}),null);
 const f=fixture(),v=new api.EnjoCelStudyView(f.actor);v.update(0,null,false);assert.equal(v.handWorld(),null,'No registration must not create a fixed offset palm');v.destroy();
});
test('installed Phaser parser retains cel registration and visible feet stay on their own measured baseline',()=>{
 const atlas=JSON.parse(fs.readFileSync(new URL('../public/art/enjo-visual-study-20261014/atlas-gait.json',import.meta.url)));
 const parse=createRequire(import.meta.url)('../node_modules/phaser/src/textures/parsers/JSONHash.js'),parsed=new Map();
 const texture={customData:{},source:[{width:1536,height:1728}],add:name=>{const f={};parsed.set(name,f);return f;}};parse(texture,0,atlas);
 assert.equal(parsed.size,73);assert(parsed.has('__BASE'));
 for(const name of api.ENJO_STUDY_FRAMES){const r=parsed.get(name).customData.registration;assert(r.groundY>0&&r.groundY<192);assert(r.bounds.height>0&&r.bounds.height<=160,name+' size');if(name!=='hurt-2')assert(r.bounds.height>=120,name+' non-crouching size');for(const foot of r.feet)assert(Math.abs(foot.y-r.groundY)<=2);if(r.hand)assert(r.hand.x>=r.bounds.x&&r.hand.x<=r.bounds.x+r.bounds.width&&r.hand.y>=r.bounds.y&&r.hand.y<=r.bounds.y+r.bounds.height);}
 const f=fixture();f.registrations.set('idle-0',{groundY:168,feet:[{x:80,y:168},{x:111,y:168}],hand:{x:122,y:124},bounds:{x:50,y:25,width:94,height:143}});
 const v=new api.EnjoCelStudyView(f.actor);v.update(0,null,false);assert.deepEqual(v.upper.setOriginArgs,[.5,168/192]);assert(v.feetWorld().every(p=>p.y===276));assert.equal(v.handWorld().x,187.5+(122/192-.5)*80);assert(v.cueExclusionBounds().right-v.cueExclusionBounds().x<80);v.destroy();
});
test('moving attacks and specials preserve actual action ownership and existing gait phase without standing freeze',()=>{
 for(const state of ['attack','action'])for(const [i,facing]of ['down','left','right','up'].entries()){
  const f=fixture(),v=new api.EnjoCelStudyView(f.actor);v.update(0,null,false);
  for(const phase of [.1,.35,.6,.85]){
   f.scene.player.x+=4;f.legacy.pose={state,facing:'down',legFacing:facing,phase,actionProgress:.5};
   v.update(100,null,false);const n=Math.floor(phase*4);assert.equal(v.rows[0].part,['down','up'].includes(facing)?`gait-${facing}-${n}`:`run-${i*4+n}`);
   assert.equal(v.pose.state,state,'Render cel must not suppress the real action owner');assert.equal(v.pose.phase,phase);
  }
  const paused=JSON.stringify(v.rows);v.update(300,null,true);assert.equal(JSON.stringify(v.rows),paused);
  v.destroy();
 }
});
test('all real hurt directions have three registered recoil stages and never select an idle blink',()=>{
 for(const facing of ['down','left','right','up'])for(let i=0;i<3;i++)assert.equal(api.selectEnjoCelFrame({state:'hurt',facing,hurtProgress:i/3}),`recoil-${facing}-${i}`);
 assert.equal(api.selectEnjoCelFrame({state:'hurt',facing:'invalid',hurtProgress:NaN}),'recoil-down-0');
 assert.equal(api.ENJO_STUDY_FRAMES.length,72);
});
test('front and rear gait registers alternating support shoes, not hashes masquerading as new poses',()=>{
 const atlas=JSON.parse(fs.readFileSync(new URL('../public/art/enjo-visual-study-20261014/atlas-gait.json',import.meta.url)));
 for(const facing of ['down','up'])for(let i=0;i<4;i++){
  const r=atlas.frames[`gait-${facing}-${i}`].registration;
  assert.equal(r.gait.supportSide,i<2?'left':'right');assert.equal(r.gait.phase,i);
  const [support,lifted]=r.gait.supportSide==='left'?r.gait.shoeBottoms:[...r.gait.shoeBottoms].reverse();
  assert.equal(support,r.groundY);assert(support-lifted>=6,'Raised shoe must not falsely contact the floor');
  assert(r.feet.length===1);assert(r.gait.supportSide==='left'?r.feet[0].x<96:r.feet[0].x>96);
  assert(Math.abs(r.feet[0].y-r.groundY)<=2);
 }
});
test('gait loops wrap safely and stationary releases and freeze do not get a separate gait clock',()=>{
 for(const facing of ['down','up']){assert.equal(api.selectEnjoCelFrame({state:'walk',facing,phase:.999999}),`gait-${facing}-3`);assert.equal(api.selectEnjoCelFrame({state:'walk',facing,phase:0}),`gait-${facing}-0`);}
 const f=fixture(),v=new api.EnjoCelStudyView(f.actor);v.update(0,null,false);
 f.scene.player.y+=4;f.legacy.pose={state:'action',legFacing:'down',facing:'left',phase:.7,actionProgress:.5};v.update(100,null,false);assert.equal(v.rows[0].part,'gait-down-2');assert.equal(v.pose.state,'action');
 const frame=v.rows[0].part;f.legacy.pose.phase=.9;v.update(200,null,true);assert.equal(v.rows[0].part,frame);
 v.update(200,null,false);assert.equal(v.rows[0].part,'attack-left-1');v.destroy();
});
