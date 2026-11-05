import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
import {EventEmitter} from 'node:events';
const url=new URL('../src/systems/ActorPresentation.mjs',import.meta.url);
const art=existsSync(url)?await import(url):{};
function node(){const n=new EventEmitter();Object.assign(n,{active:true,x:0,y:0,depth:3,alpha:1,visible:true,
  destroy(){if(!this.active)return;this.active=false;this.emit('destroy');},
  setPosition(x,y){this.x=x;this.y=y;return this;},setFrame(v){this.frame=v;return this;},
  setCrop(...v){this.crop=v;return this;},
  setScale(x,y=x){this.scaleX=x;this.scaleY=y;return this;},setRotation(v){this.rotation=v;return this;},
  setAlpha(v){this.alpha=v;return this;},setAngle(v){this.angle=v;return this;},setTint(v){this.tint=v;return this;},
  setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},setDepth(v){this.depth=v;return this;},
  setOrigin(x,y){this.originX=x;this.originY=y;return this;},setVisible(v){this.visible=v;return this;},
  setScrollFactor(v){this.scrollFactor=v;return this;},
  clear(){this.commands=[];return this;},lineStyle(...a){this.commands.push(['line',...a]);return this;},
  fillStyle(...a){this.commands.push(['fill',...a]);return this;},fillCircle(...a){this.commands.push(['circle',...a]);return this;},
  lineBetween(...a){this.commands.push(['segment',...a]);return this;},strokeCircle(...a){this.commands.push(['ring',...a]);return this;},commands:[]});return n;}
function fixture(){const images=[],scene={battleData:{stageId:1,performerId:'kai'},textures:{exists:()=>true},
  add:{rectangle:(x,y,w,h)=>Object.assign(node(),{x,y,width:w,height:h}),image:(x,y,key,frame)=>{const n=node();Object.assign(n,{x,y,key,frame});images.push(n);return n;}},
  player:{x:500,y:1708,hp:5,active:true,body:{velocity:{x:0,y:0},halfWidth:4}},
  playerGfx:node(),publicPerformerRun:{member:{id:'kai'},actions:0,now:()=>0}};return {scene,images};}
test('reviewed actors load selected public performer only; hidden and unknown identities fail closed',()=>{
  assert.equal(typeof art.preloadActorPresentation,'function','public battle must use an actual actor pipeline');
  const calls=[],scene={load:{spritesheet:(...a)=>calls.push(a),image:(...a)=>calls.push(a)}};
  art.preloadActorPresentation(scene,{stageId:1,performerId:'kai'});assert.equal(calls.length,11);
  assert.match(calls[0][1],/kai-walk/);assert.deepEqual(calls[0][2],{frameWidth:128,frameHeight:128,endFrame:47});
  for(const data of [{practiceMode:true,performerId:'kai'},{stageId:2},{performerId:'unknown'}])art.preloadActorPresentation(scene,data);
  assert.equal(calls.length,11);assert.equal(art.getPerformerArt('unknown'),null);
  assert.equal(new Set(['sakura','venus','genya','kai','enjo'].map(id=>art.getPerformerArt(id).key)).size,5);
});
test('walk frames follow real motion, action count and damage; physics host never changes',()=>{
  assert.equal(typeof art.ActorPresentation,'function');const {scene}=fixture();
  const presenter=new art.ActorPresentation(scene);assert.ok(presenter.playerImage);
  const draw=(...args)=>{
    const host=scene.player,original=JSON.stringify(host);
    presenter.drawPlayer(...args);
    assert.equal(scene.player,host,'presentation must preserve the physics host');
    assert.equal(JSON.stringify(scene.player),original,'presentation must not rewrite the physics host');
  };
  assert.equal(presenter.playerImage.originY,0.5,'processed feet align with existing y+26 ground marker');
  draw(0,false,0xff69b4);const idle=presenter.playerImage.frame;
  draw(60,false,0x00ced1);assert.equal(presenter.playerImage.frame,idle);
  scene.player.x+=24;draw(120,true,0xff69b4);const frame=presenter.playerImage.frame;
  scene.player.x+=24;draw(240,true,0xff69b4);assert.notEqual(presenter.playerImage.frame,frame);
  assert.equal(presenter.playerImage.key,'performer-kai-walk');
  scene.publicPerformerRun.actions++;draw(300,false,0xff69b4);assert.equal(presenter.state,'action');
  draw(700,false,0xff69b4);assert.equal(presenter.state,'idle');
  scene.player.hp=4;draw(710,false,0xff69b4);assert.equal(presenter.state,'hurt');
  scene.playerGfx.alpha=0.3;draw(730,false,0xff69b4);assert.equal(presenter.playerImage.alpha,0.3);
  assert.equal(scene.player.body.halfWidth,4);assert.ok(scene.playerGfx.commands.some(c=>c[0]==='circle'&&c[3]===4));
  presenter.destroy();presenter.destroy();assert.equal(presenter.playerImage,null);
});

test('enemy sprites follow original graphics and actual state, then share its destroy owner',()=>{
  const {scene,images}=fixture();const presenter=new art.ActorPresentation(scene);const gfx=node();gfx.setPosition(88,108);
  assert.equal(presenter.drawEnemy(gfx,'unlit-chaser','recovery',0.5,'pink'),true);
  presenter.syncEnemies();const enemy=images.at(-1);assert.equal(enemy.x,100);assert.equal(enemy.y,120);
  const roleKeys=new Set();for(const role of ['unlit-chaser','stage-cue-emitter','objective-disruptor','spotlight-captain','finale-boss','finale-weak-point'])roleKeys.add(art.getEnemyArt(role).key);
  assert.equal(roleKeys.size,6);assert.equal(presenter.enemies.size,1);
  presenter.drawEnemy(gfx,'unlit-chaser','recovery',1,'blue');assert.equal(presenter.enemies.size,1);
  gfx.setPosition(188,208);presenter.syncEnemies();assert.equal(enemy.x,200);assert.equal(enemy.y,220);
  gfx.destroy();assert.equal(enemy.active,false);assert.equal(presenter.enemies.size,0);
  const another=node();presenter.drawEnemy(another,'stage-cue-emitter','windup',0,'blue');presenter.destroy();
  assert.equal(presenter.enemies.size,0);assert.equal(another.listenerCount('destroy'),0);
});
test('missing media keeps legacy graphics fallback rather than invisible actors',()=>{
  const {scene}=fixture();scene.textures.exists=()=>false;const presenter=new art.ActorPresentation(scene);
  assert.equal(presenter.drawPlayer(0,false,0xffffff),false);assert.equal(presenter.drawEnemy(node(),'unlit-chaser','recovery',0,'pink'),false);
});
test('framing moves only camera bounds, keeping start actor above fixed controls',()=>{
  const calls=[],scene={cameras:{main:{setBounds:(...a)=>calls.push(a)}},physics:{world:{bounds:{width:1000,height:1778}}}};
  art.framePublicActorCamera(scene,1000,1778);assert.deepEqual(calls,[[-64,-240,1176,2178]]);
  assert.equal(scene.physics.world.bounds.height,1778);const screenY=1708-(1938-667);assert.ok(screenY<500);
});
test('real scene owns preload, update and release; old source atlas remains quarantined',()=>{
  const source=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
  assert.match(source,/preloadActorPresentation\(this, this.initialBattleData\)/);
  assert.match(source,/this.actorPresentation = new ActorPresentation\(this\)/);
  assert.match(source,/this.actorPresentation\?\.syncEnemies\(\)/);
  assert.match(source,/this.actorPresentation\?\.destroy\(\)/);
  assert.match(source,/_isP15PerformerSpriteRuntimeEnabled\(\)\s*\{\s*return false/);
});

test('portrait URL resolves against the page, not bundled CSS; obsolete control band is absent',()=>{
  assert.equal(typeof art.performerPortraitCss,'function');
  assert.equal(art.performerPortraitCss('kai','https://example.com/game/?chapter=1'), 'url("https://example.com/game/art/performer-portraits-20260925/kai-avatar.webp")');
  const {scene}=fixture(),presenter=new art.ActorPresentation(scene),band=presenter.controlBand;
  assert.equal(band,null,'the removed colour palette must not retain a full-width backing');
  presenter.destroy();presenter.destroy();assert.equal(presenter.controlBand,null);
  const css=readFileSync(new URL('../src/styles/battleSurface.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/\[data-battle-mode="public"\]::before/,'DOM overlay must not darken all canvas controls');
});
