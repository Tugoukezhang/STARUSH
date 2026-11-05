import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import {MOBILE_LOBBY_BACKGROUND,HOME_DEMO_BACKGROUND} from '../src/systems/MobileGameScreens.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const require=createRequire(import.meta.url),postcss=require('postcss');
const BACKDROP='art/home-comic-backstage-20261022/backstage.webp',OLD='art/comic-ui-20261021/lobby.webp',REJECTED='94c4d9059aa41fad5e9c922d0f9fa8a9d619ed8efde9f90c301857196639a102';
const STAGE='#game-container #public-shell[data-core-journey=true][data-page=desk] .lobby-stage';
const file=path=>new URL('../public/'+path,import.meta.url),sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const decls=rule=>Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));

test('home backdrop is the one admitted owner-ui runtime file; old record shop stays exact',()=>{
 assert.equal(MOBILE_LOBBY_BACKGROUND,BACKDROP);
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file.startsWith('art/home-comic-backstage-20261022/')),[{file:BACKDROP,group:'owner-ui'}]);
 // B252 adds four exact portrait-base files, without changing either backdrop.
 assert.equal(RUNTIME_PAYLOAD.length,419);assert.equal(new Set(RUNTIME_PAYLOAD.map(r=>r.file)).size,419);
 assert(RUNTIME_PAYLOAD.some(r=>r.file===OLD));
 assert.equal(sha(fs.readFileSync(file(OLD))),'a88e1b1d069834312deedc403300d4ef8938b717fa0efeda33ab47319e82c0bf');
});

test('admitted backdrop decodes as the exact 768x1280 candidate and no rejected cleanplate ships',async()=>{
 const bytes=fs.readFileSync(file(BACKDROP));assert.equal(bytes.length,189254);
 assert.equal(sha(bytes),'473ab8fb31c88456899bd7fbe73798653b68a244e85348940f6c6d710a11841e');
 const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
 const meta=await sharp(bytes).metadata();assert.equal(meta.format,'webp');assert.equal(meta.width,768);assert.equal(meta.height,1280);
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width*info.height*info.channels,3932160);assert.equal(data.length,3932160);
 assert.deepEqual(fs.readdirSync(new URL('../public/art/home-comic-backstage-20261022/',import.meta.url)),['backstage.webp']);
 assert.notEqual(sha(bytes),REJECTED);
 for(const source of ['../src/systems/MobileGameScreens.mjs','../src/styles/formalGameLayout.css','../scripts/runtime-payload.mjs'])
  assert.doesNotMatch(fs.readFileSync(new URL(source,import.meta.url),'utf8'),/cleanplate|batch-62|art\/[^'"\s]*rejected/i,source);
 assert(!RUNTIME_PAYLOAD.some(r=>/cleanplate|rejected/i.test(r.file)));
});

test('home renders the new backdrop over unchanged original portraits and keeps the override and error fallback',()=>{
 const source=fs.readFileSync(new URL('../src/systems/MobileGameScreens.mjs',import.meta.url),'utf8');
 assert(source.includes("bg.src=studyLobbyBackground()||(isUserCastEnabled()?'art/venue-shell-20261026/venue.webp':MOBILE_LOBBY_BACKGROUND);"));
 assert(source.includes("bg.addEventListener('error',()=>{bg.hidden=true;main.dataset.backgroundState='unavailable';});"));
 for(const [member,design] of [['sakura','cat-rifle'],['kai','mecha-sword'],['enjo','hammer-cat']]){
  const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.profile.selectPublicPerformer(member);
  const h=e.harness(e.TitleScene);h.scene.create();
  const bg=h.query('.lobby-background');assert.equal(bg.src,'art/venue-shell-20261026/venue.webp');assert.equal(bg.alt,'公演后台');assert.equal(bg.draggable,false);
  assert.equal(h.query('.lobby-character').src,'art/user-cast-20261015/'+design+'.webp',member);
  bg.dispatchEvent({type:'error'});assert.equal(bg.hidden,true);assert.equal(bg.parentNode.dataset.backgroundState,'unavailable');
  assert.equal(h.query('.lobby-character').src,'art/user-cast-20261015/'+design+'.webp');assert(h.query('[data-action=start]'));
  h.click('[data-action=preflight]');assert.equal(h.root.dataset.page,'preflight');h.shutdown();
 }
});

test('desk stage grows through the two existing rules while the name row matches its real 44px plate',()=>{
 const text=fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8'),rules=[];
 postcss.parse(text).walkRules(rule=>{if(rule.selector===STAGE)rules.push(rule);});
 assert.equal(rules.length,2,'no duplicate desk stage selector');
 const [base,short]=rules;assert.equal(base.parent.type,'root');
 assert.equal(short.parent.type,'atrule');assert.equal(short.parent.params,'(max-height:620px)');
 assert.deepEqual(decls(base),{'flex-basis':'336px','min-height':'336px','grid-template-columns':'minmax(0,1fr)','grid-template-rows':'minmax(284px,1fr) 44px',gap:'0',padding:'4px 10px 4px 58px'});
 assert.deepEqual(decls(short),{'flex-basis':'262px','min-height':'262px','grid-template-rows':'minmax(210px,1fr) 44px'});
 assert(!text.includes('home-comic-backstage'),'backdrop source stays in the JS constant');
 assert(text.includes(STAGE+' .lobby-member-visual[data-performer=kai] {width:340px;max-width:none;transform:translateX(-18px);}'));
 assert(text.includes(' '+STAGE+' .lobby-member-visual[data-performer=kai] {width:306px;}'));
 assert(text.includes('#game-container #public-shell .lobby-character {width:100%; height:100%; object-fit:contain; object-position:center bottom;'));
});

test('short-home progress disclosure keeps a full touch target and clears the first-fold text sliver',()=>{
 const css=postcss.parse(fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8'));let short;
 css.walkRules(r=>{if(r.selector==='#game-container #public-shell[data-core-journey=true][data-page=desk] .lobby-details > summary'&&r.parent.params==='(max-height:620px)')short=decls(r);});
 assert.deepEqual(short,{'min-height':'44px','padding-block':'10px 0','line-height':'20px'});
 assert(!('display' in short)&&!('visibility' in short),'disclosure remains accessible by scrolling');
});
