import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const require=createRequire(import.meta.url),postcss=require('postcss');
const css=postcss.parse(fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8'));
const H='#game-container[data-battle-mode=public]',C=':is(#skill-encore,#skill-special[data-art=weapon])';
const SKIN='/art/battle-comic-skin-20261021/',STATE=' > :is(#encore-state,#special-state)';
const top=()=>{const rows=[];css.walkRules(r=>{if(!r.parent.name)rows.push(r);});return rows;};
const decls=r=>Object.fromEntries(r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));
function rule(selector){const rows=top().filter(r=>r.selector===selector);assert(rows.length,selector);return Object.assign({},...rows.map(decls));}
const px=v=>{assert.match(String(v),/^-?\d+(\.\d+)?px$/,String(v));return parseFloat(v);};
const urls=v=>[...String(v).matchAll(/url\('([^']+)'\)/g)].map(m=>m[1]);
// Equal-specificity state rules resolve by source order, exactly like the browser cascade.
function skin(state){let found=null;for(const r of top())if(r.selector===H+' '+C+'[data-charge-state]'+STATE||r.selector===H+' '+C+'[data-charge-state='+state+']'+STATE){
  const d=decls(r);for(const p of ['background','background-image'])if(d[p]&&urls(d[p]).length)found=urls(d[p])[0];}return found;}

test('the authored hud raster is the single nine-slice header backing, visible 6..369 x 3..113, keeping the canvas pause hole',()=>{
  const b=rule(H+' #hud::before');assert.equal(b['box-sizing'],'border-box');assert.equal(px(b.top),3);assert.equal(px(b.height),110);
  const m=b['border-image'].match(/^url\('\/art\/battle-header-20261022\/frame\.png'\) (\d+) (\d+) (\d+) (\d+) fill \/ (\d+)px (\d+)px (\d+)px (\d+)px \/ 0 stretch$/);
  assert(m,b['border-image']);const [st,sr,sb,sl,wt,wr,wb,wl]=m.slice(1).map(Number);
  assert.equal(b['border-width'],`${wt}px ${wr}px ${wb}px ${wl}px`);assert.equal(b['border-style'],'solid');assert.equal(b['border-color'],'transparent');
  for(const [w,s] of [[wt,st],[wr,sr],[wb,sb],[wl,sl]])assert(Math.abs(w/s-.3)<.01,'one uniform corner scale keeps ink undistorted');
  const left=px(b.left),right=375-px(b.right);assert.equal(left,6);assert.equal(right,369);
  assert.deepEqual([st,sr,sb,sl],[40,80,40,80],'second source has nine-slice registered corners and no huge transparent side margin');
  assert(left>=0&&right<=375,'the authored backing does not extend off the game surface');
  assert.equal(b.background,'#fff');assert.equal(b['pointer-events'],'none');
  assert.equal(b['mask-image'],`radial-gradient(circle 23px at ${347-left}px ${78-3}px,transparent 99%,#000 100%)`,'pause hole stays at canvas (347,78)');
  const pause=rule(H+' #hud::after');assert.equal(pause.left,'326px');assert.equal(pause.top,'57px');assert.equal(pause['pointer-events'],'none');
  const p=rule(H+' .mihoyo-player');assert.equal(p.border,'0');assert.equal(p['border-image'],'none');assert.equal(p.background,'none');
  assert.equal(p.padding,'0','explicit larger portrait and member tracks own the content box');
  for(const s of [' .mihoyo-player .mihoyo-portrait',' .mihoyo-name',' #hp-value',' .hp-track'])rule(H+s);
});

test('objective, chapter and build rows sit on exact non-wrapping safe bounds inside the header',()=>{
  const o=rule(H+' .cw-objective');assert.equal(px(o.top),60);assert.equal(px(o.height),20);
  const ch=rule(H+' #battle-chapter'),rb=rule(H+' #run-build');
  for(const r of [ch,rb]){assert.equal(px(r.top),80);assert.equal(r['font-size'],'14px');assert.equal(r['line-height'],'18px');
    assert.equal(r['white-space'],'nowrap');assert.equal(r.overflow,'hidden');assert.equal(r['text-overflow'],'ellipsis');}
  assert(px(o.top)+px(o.height)<=px(ch.top));assert(px(ch.left)+px(ch['max-width'])<=px(rb.left),'chapter cannot overlap build');
  assert(px(rb.left)+px(rb['max-width'])<=347-23,'build stays clear of the pause hole');assert(80+18<=98,'chapter clears bottom ink');
});

test('clock sits below the support label and alongside the objective without entering either row',()=>{
 const c=rule(H+' #round-clock'),o=rule(H+' .cw-objective');
 assert.equal(c.top,'-20px');assert.equal(c.right,'-50px');
 assert.equal(60+px(c.top),40);assert.equal(c.width,'46px');
 const objectiveRight=px(o.left)+px(o.width),clockRight=objectiveRight-px(c.right);assert(clockRight-px(c.width)>=objectiveRight+4,'clock and objective stay horizontally separated');
 assert.equal(c['font-size'],'16px');
});

test('run-goal variant expands the same backing to 136px with goal and notice below it',()=>{
  const b=rule(H+' #hud[data-run-goal=true]::before'),g=rule(H+' #run-goal'),n=rule(H+' #hud[data-run-goal=true] ~ #battle-notice');
  assert.equal(px(b.height),136);assert.equal(px(g.top),104);assert.equal(g['line-height'],'20px');assert.equal(g['white-space'],'nowrap');
  assert(104+20<=3+136-10);assert.equal(px(n.top),158);assert(px(n.top)>=3+136);
});

test('Encore and all three owner weapon commands keep a fixed 112x74 slot over an authored status plate',()=>{
  const c=rule(H+' '+C+'[data-charge-state]');assert.equal(c.width,'112px');assert.equal(c.height,'74px');assert.equal(c.background,'none');
  const title=rule(H+' '+C+'::before');assert.equal(title.inset,'0 0 26px');assert.match(title.background,/var\(--comic-command-art\)/);
  assert.match(rule(H+' #skill-encore')['--comic-command-art'],/skill-command-20261022\/encore\.png/);
  assert.match(rule(H+' #skill-special[data-art=weapon]')['--comic-command-art'],/skill-command-20261022\/rifle\.png/);
  for(const s of [H+' #skill-encore #encore-state',H+' #skill-special[data-art=weapon] #special-state']){
    const r=rule(s);assert.equal(r.top,'46px');assert.equal(r.height,'28px');assert.equal(r['line-height'],'20px');assert.equal(r.padding,'4px');
    assert.equal(r['box-sizing'],'border-box');assert.equal(r.border,'0');assert.equal(r.background,undefined);assert.equal(r['font-size'],'14px');
    assert(px(r.top)+px(r.height)<=74&&px(r.top)>=74-26-2,'status plate begins where the title slot ends');
  }
  const plate=rule(H+' '+C+'[data-charge-state]'+STATE);assert.equal(plate.background,`transparent url('${SKIN}status-idle.png') center / 100% 100% no-repeat`);
  for(const state of ['preparing','charging','paused','ended'])assert.equal(skin(state),SKIN+'status-idle.png',state);
  assert.equal(skin('ready'),SKIN+'status-ready.png');assert.equal(skin('active'),SKIN+'status-active.png');
  const active=rule(H+' '+C+'[data-charge-state=active]');assert.equal(active.background,'none');assert.equal(active.filter,'none');
});

test('no rectangular white card, nested disc or program-drawn text remains behind the selected command states',()=>{
  for(const r of top()){if(!/#(encore|special)-state/.test(r.selector))continue;const d=decls(r);
    assert(!/1px solid|#fff\b/.test(d.border??''),r.selector);assert(!/^#fff/.test(d.background??''),r.selector);
    // B64 admits only this empty image-only family overlay; native text remains underneath.
    if(r.selector===H+' '+C+'[data-charge-state]:not([data-charge-state=charging]) > :is(#encore-state,#special-state)::after'){assert.equal(d.content,"''");assert.equal(d.background,'var(--command-caption-art) center / contain no-repeat');assert.equal(d['pointer-events'],'none');continue;}
    assert.equal(d.content,undefined,r.selector);
    if(/background/.test(Object.keys(d).join()))assert(r.selector.startsWith(H+' '+C),'only the selected command states are re-skinned: '+r.selector);}
  for(const r of top())if(/battle-comic-skin-20261021\/status-/.test(r.toString()))assert(r.selector.startsWith(H+' '+C),r.selector);
  for(const r of top())if(/battle-header-20261022\/frame\.png/.test(r.toString()))assert.equal(r.selector,H+' #hud::before');
});

test('legacy fallback disc declarations remain; current commands keep finite ready feedback and a reduce path',()=>{
  assert.match(rule(H+' .skill-orb[data-charge-state]').background,/^transparent url\('\/art\/formal-ui-20261016\/disc\.webp'\) center \/ contain no-repeat$/);
  assert.match(rule(H+' .skill-orb.active[data-charge-state=active]').background,/formal-ui-20261016\/disc\.webp/);
  assert.match(top().find(r=>r.selector===H+' .skill-orb[data-charge-state=ready]'&&decls(r)['background-image']).toString(),/disc-ready\.webp/);
  const ready=rule(H+' '+C+'[data-charge-state=ready]::before');assert.match(ready.animation,/^comic-command-arrive 360ms /);assert.doesNotMatch(ready.animation,/infinite/);
  let reduced=false;css.walkAtRules('media',m=>{if(m.params==='(prefers-reduced-motion:reduce)')m.walkRules(r=>{if(r.selector===H+' .skill-orb::before'&&/animation:none !important/.test(r.toString()))reduced=true;});});assert(reduced);
  css.walkDecls('animation',d=>{if(/infinite/.test(d.value))assert(!/#skill-|#hud|state/.test(d.parent.selector),d.parent.selector);});
});

function hud(){
  const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const doc=e.document;
  const sync=e.loadRuntime('systems/BattleSurfaceView.mjs').syncPublicBattleHud;
  for(const id of ['special-label','special-state','encore-state','special-fill','skill-special','skill-encore']){const n=doc.createElement(id.startsWith('skill-')?'button':'span');n.id=id;doc.body.append(n);}
  const s={time:{now:1000},battleData:{stageId:1,performerId:'sakura'},_userCastPresentation:true,_specialCharge:100,_encoreCharge:100,
    _isPublicStage1Round:()=>true,_battlePerformerContract:{publicActionOwnerId:'sakura'},player:{x:100,y:200,active:true,hp:5,maxHp:5},paintZone:{},
    publicStage1Round:{snapshot:()=>({phase:'active'}),getPerformerId:()=> 'sakura'},_isPublicSakuraEncoreWindowActive:()=>false};
  s.publicPerformerRun=new (e.loadRuntime('systems/PublicStage1PerformerRun.mjs').PublicStage1PerformerRun)(s);
  return {s,doc,sync,special:doc.getElementById('skill-special'),encore:doc.getElementById('skill-encore')};
}

test('every live charge state produced by the real HUD sync maps onto an authored plate while text and aria stay DOM',()=>{
  const {s,doc,sync,special,encore}=hud(),seen=[];
  const record=()=>{for(const [b,id] of [[special,'special-state'],[encore,'encore-state']]){
    assert(doc.getElementById(id).textContent.length>0,id);assert(b.getAttribute('aria-label'),id);
    assert.equal(b.getAttribute('aria-disabled'),b.dataset.chargeState==='ready'?'false':'true');seen.push(b.dataset.chargeState);}};
  s.publicStage1Round.snapshot=()=>({phase:'idle'});sync(s,doc);record();
  s.publicStage1Round.snapshot=()=>({phase:'active'});s._specialCharge=40;s._encoreCharge=40;sync(s,doc);record();
  s._specialCharge=100;s._encoreCharge=100;sync(s,doc);record();
  s._isPublicSakuraEncoreWindowActive=()=>true;sync(s,doc);record();
  s._battlePaused=true;s.publicPerformerRun.pauseClock();sync(s,doc);record();
  s._battleEnded=true;sync(s,doc);record();
  assert.deepEqual([...new Set(seen)].sort(),['active','charging','ended','paused','preparing','ready']);
  const expected={preparing:'idle',charging:'idle',paused:'idle',ended:'idle',ready:'ready',active:'active'};
  for(const state of new Set(seen))assert.equal(skin(state),SKIN+'status-'+expected[state]+'.png',state);
});
