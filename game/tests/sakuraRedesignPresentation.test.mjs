import assert from 'node:assert/strict';
import test from 'node:test';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {ActorPresentation,getPerformerArt,preloadActorPresentation,framePublicActorCamera} from '../src/systems/ActorPresentation.mjs';
import {STAGE1_PUBLIC_CAST} from '../src/utils/stage1PaintRound.mjs';
import {createChapterGround} from '../src/systems/ChapterScenePresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';

function node(){const n=new EventEmitter();Object.assign(n,{active:true,alpha:1,commands:[],destroy(){this.active=false;this.emit('destroy');}});
 for(const [method,keys] of Object.entries({setScale:['scaleX','scaleY'],setRotation:['rotation'],setPosition:['x','y'],setFrame:['frame'],setAlpha:['alpha'],setAngle:['angle'],setTint:['tint'],setDisplaySize:['displayWidth','displayHeight'],setDepth:['depth'],setOrigin:['originX','originY'],setScrollFactor:['scrollFactor']}))n[method]=function(...args){keys.forEach((k,i)=>this[k]=args[i]);return this;};
 n.setTexture=function(key,frame){this.key=key;this.frame=frame;return this;};
 for(const method of ['fillStyle','fillCircle','lineStyle','strokeCircle'])n[method]=function(...args){this.commands.push([method,...args]);return this;};return n;}
function fixture(){const scene={battleData:{stageId:1,performerId:'sakura'},textures:{exists:()=>true},
 add:{rectangle:()=>node(),image:(x,y,key,frame)=>Object.assign(node(),{x,y,key,frame})},
 player:{active:true,x:300,y:500,hp:5,body:{halfWidth:4,velocity:{x:0,y:0}}},playerGfx:node(),
 publicPerformerRun:{member:{id:'sakura'},actions:0}};return {scene,presenter:new ActorPresentation(scene)};}

test('Sakura native preload replaces historical layered material and preserves portrait mapping',()=>{
 const art=getPerformerArt('sakura');assert.equal(art.frameWidth,256,'Sakura layers use registered 256px cells');
 assert.equal(art.frameHeight,256);assert.match(art.path,/sakura-secondary-20260922\/attack-base.png$/);
 assert.match(art.portrait,/sakura-native-20261004\/avatar.webp$/);
 assert.match(art.fullPortrait,/sakura-native-20261004\/portrait.webp$/);
 const calls=[],scene={load:{spritesheet:(...a)=>calls.push(a),image:(...a)=>calls.push(a),json:(...a)=>calls.push(a)}};
 preloadActorPresentation(scene,{stageId:1,performerId:'sakura'});
 assert.equal(scene._sakuraNativePresentationRequested,true);
 assert.equal(scene._sakuraRefinedPresentationRequested,true);
 assert.match(calls[0][1],/sakura-refined-20261006\/parts.webp$/);
 assert.match(calls[1][1],/sakura-refined-20261006\/views.json$/);
 assert.ok(!calls.some(call=>/sakura-secondary|sakura-motion|sakura-defeat/.test(call[1])));
 const paths=RUNTIME_PAYLOAD.map(e=>e.file);
 for(const f of [art.portrait,art.fullPortrait,...calls.slice(0,2).map(c=>c[1])])assert.ok(paths.includes(f));
 assert.ok(!paths.includes(art.path));
 assert.ok(!paths.includes('art/phase16/p16-074-actors/sakura-walk.webp'));
 assert.ok(!paths.includes('art/phase16/p16-074-actors/sakura-portrait.webp'));
 assert.match(getPerformerArt('kai').path,/performer-motion-20260922\/kai-walk.webp$/);
});
test('four-way gait follows actual displacement, not intent; real actions and damage retain feedback',()=>{
 const {scene:s,presenter:p}=fixture();const physics=JSON.stringify(s.player.body);
 p.drawPlayer(0,false,0xff69b4);assert.equal(p.state,'idle');assert.ok(p.playerImage.frame<4);
 const directions=[['down',0,10,0],['left',-10,0,4],['right',10,0,8],['up',0,-10,12]];
 let time=100;
 for(const [direction,dx,dy] of directions){
  s.player.x+=dx;s.player.y+=dy;p.drawPlayer(time,true,0xff69b4);assert.equal(p.direction,direction);assert.equal(p.sakuraView.state.upperDirection,direction);
  const diagonal=p.playerImage.key==='sakura-turn-upper-20260922';
  const start=diagonal?0:{down:0,left:4,right:8,up:12}[p.sakuraView.state.visualDirection];
  assert.ok(diagonal||p.playerImage.key==='sakura-idle-20260921');
  assert.ok(p.playerImage.frame>=start&&p.playerImage.frame<start+4);time+=100;
 }
 const upFrame=p.playerImage.frame;s.player.body.velocity={x:250,y:0};p.drawPlayer(time,true,0xff69b4);assert.equal(p.direction,'up');assert.equal(p.state,'idle','blocked movement must not animate running');
 s.publicPerformerRun.actions++;p.drawPlayer(600,false,0xff69b4);assert.equal(p.state,'action');assert.equal(p.sakuraView.state.upperDirection,'up');
 p.drawPlayer(730,false,0xff69b4);assert.equal(p.sakuraView.state.upperDirection,'up');
 s.player.hp=4;p.drawPlayer(740,false,0xff69b4);assert.equal(p.state,'hurt');assert.equal(p.playerImage.tint,0xFFD1D9);
 p.drawPlayer(830,false,0xff69b4);assert.equal(p.sakuraView.upper.tint,0xFFD1D9);
 p.drawPlayer(1000,false,0xff69b4);assert.equal(p.state,'idle');
 s.player.body.velocity={x:0,y:0};assert.equal(JSON.stringify(s.player.body),physics);
 assert.equal(p.playerImage.displayHeight,88);
 assert.ok(Math.abs((245/256-p.playerImage.originY)*88-26)<1e-8,'new feet align with existing world foot anchor');
 assert.equal(p.playerImage.x,s.player.x);assert.equal(p.playerImage.y,s.player.y);
 assert.ok(s.playerGfx.commands.some(c=>c[0]==='fillCircle'&&c[3]===4));
});
test('pause, dialog and result freeze new body animation; disposal is idempotent',()=>{
 const {scene:s,presenter:p}=fixture();s.publicPerformerRun.actions++;p.drawPlayer(0,false,0xffffff);
 const frame=p.playerImage.frame;s._battlePaused=true;p.drawPlayer(150,false,0xffffff);assert.equal(p.playerImage.frame,frame);
 s._battlePaused=false;s._publicBattleDialog={};p.drawPlayer(180,false,0xffffff);assert.equal(p.playerImage.frame,frame);
 s._publicBattleDialog=null;s._battleEnded=true;p.drawPlayer(300,false,0xffffff);assert.equal(p.playerImage.frame,frame);
 const image=p.playerImage;p.destroy();p.destroy();assert.equal(image.active,false);assert.equal(p.drawPlayer(400,true,0xffffff),false);
});
test('retired Sakura cut-in cannot ship or load through a dormant DOM or legacy metadata',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),art=getPerformerArt('sakura');
 assert.doesNotMatch(html,/encore-cutin-sakura\.jpg/);
 assert.equal(STAGE1_PUBLIC_CAST[0].avatar,art.portrait);
 assert.equal(STAGE1_PUBLIC_CAST[0].cutin,'art/sakura-redesign-20260913/portrait.webp','transparent cut-in is not the opaque roster portrait');
 assert.ok(!RUNTIME_PAYLOAD.some(e=>e.file.endsWith('encore-cutin-sakura.jpg')));
 assert.ok(html.includes('#ult-cutin img { display: none; }'),'do not re-enable the obsolete portrait cut-in');
});
test('the southern physical boundary still leaves the complete actor above touch controls',()=>{
 let bounds;const physics={width:1000,height:1778};framePublicActorCamera({cameras:{main:{setBounds:(...v)=>bounds=v}},physics:{world:{bounds:physics}}},1000,1778);
 const bottomPlayer=1778-4,feetY=bottomPlayer+26-(bounds[1]+bounds[3]-667);
 assert.ok(feetY<=529,'bottommost physical player and shoes must remain above the 539px controls band');
 assert.deepEqual(physics,{width:1000,height:1778});
});
test('camera overscan reuses native ground edge frames, adds no physical area and shares ground disposal',()=>{
 const images=[],frames=new Map(),texture={getSourceImage:()=>({width:1000,height:1778}),has:name=>frames.has(name),add(name,_index,x,y,width,height){frames.set(name,{x,y,width,height});}};
 const scene={textures:{exists:()=>true,get:()=>texture},add:{image:(x,y,key,frame)=>{const image=Object.assign(node(),{x,y,key,frame,setFlip(x,y){this.flipX=x;this.flipY=y;return this;}});images.push(image);return image;}}};
 const ground=createChapterGround(scene,{stageId:1,campaignChapterId:'opening'},-12);
 assert.equal(images.length,9,'all four sides and corners need nonphysical ground coverage');
 const apron=ground.southApron;assert.equal(apron.key,ground.key);assert.deepEqual(frames.get(apron.frame),{x:0,y:1617,width:1000,height:161});assert.ok(apron.depth<ground.depth,'Canvas half-texel expansion cannot overpaint the original floor');
 assert.equal(apron.y,1778,'reflected native paving begins exactly at physical map end');
 assert.equal(apron.displayHeight,161,'paving includes one pixel of camera rounding bleed');assert.equal(apron.flipY,true);assert.equal(apron.flipX,false);
 assert.equal(ground.displayHeight,1778,'actual map must not stretch');assert.equal(apron.body,undefined);
 ground.destroy();assert.ok(ground.cameraAprons.every(item=>item.active===false));
});
