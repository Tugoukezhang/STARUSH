import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EventEmitter} from 'node:events';
import {SakuraRefinedPresentation,SAKURA_REFINED_ART} from '../src/systems/SakuraRefinedPresentation.mjs';
import * as cues from '../src/systems/EnemyAttackPresentation.mjs';
import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../public/'+SAKURA_REFINED_ART.data,import.meta.url)));
function node(){return {active:true,visible:false,width:375,height:667,vertices:[],alpha:1,
 addVertices(v,_uv,indices){this.vertices=indices.map(i=>({x:v[i*2],y:v[i*2+1],setUVs(){}}));return this;},setOrtho(){return this;},preUpdate(){},
 setPosition(x,y){this.x=x;this.y=y;return this;},setDepth(v){this.depth=v;return this;},setAlpha(v){this.alpha=v;return this;},setTint(){return this;},setVisible(v){this.visible=v;return this;},destroy(){this.active=false;}};}
function fixture(){const scene={player:{active:true,x:500,y:600,hp:5,invulnerable:false},playerGfx:{alpha:1},
 game:{renderer:{}},textures:{exists:()=>true,get:()=>({})},cache:{json:{get:()=>data}},add:{mesh:()=>node(),ellipse:()=>node()}};
 return {scene,view:new SakuraRefinedPresentation(scene)};}
const graphics=()=>{const g={calls:[],active:true};for(const method of ['clear','setDepth','fillStyle','fillCircle','fillTriangle','lineStyle','lineBetween'])g[method]=(...a)=>{g.calls.push([method,...a]);return g;};return g;};
const path=()=>cues.resolveCapturedAttackPath({origin:{x:500,y:310},capture:{capturedX:500,capturedY:430},distance:900,width:1000,height:1778});
const box={x:480,y:450,right:520,bottom:530};
test('real refined meshes preserve a readable nonlethal invulnerability flicker without rewriting its owner',()=>{
 const {scene,view}=fixture();scene.player.invulnerable=true;scene.playerGfx.alpha=.3;view.update(0,0,0,null,false,true,1);
 assert(view.nodes.filter(n=>n.node.visible).every(n=>n.node.alpha===.75),'Actual mesh, not proxy alpha, needs the visibility floor');
 assert.equal(scene.playerGfx.alpha,.3);assert.equal(scene.player.invulnerable,true);assert.equal(scene.player.hp,5);
 scene.playerGfx.alpha=.85;view.update(16,0,0,null,false,true,1);assert(view.nodes.filter(n=>n.node.visible).every(n=>n.node.alpha===.85));
 scene.player.invulnerable=false;scene.playerGfx.alpha=.2;view.update(32,0,0,null,false,false,1);assert(view.nodes.filter(n=>n.node.visible).every(n=>n.node.alpha===.2));
 scene.player.invulnerable=true;scene.player.hp=0;scene.playerGfx.alpha=.3;view.update(48,0,0,null,false,true,2);assert(view.nodes.filter(n=>n.node.visible).every(n=>n.node.alpha===.3));
 view.destroy();
});
test('cue exclusion reads only finite currently visible body meshes at their submitted world coordinates',()=>{
 const {view,scene}=fixture();assert.equal(typeof view.cueExclusionBounds,'function');assert.equal(view.cueExclusionBounds(),null);
 view.update(0,0,0,null,false,false,0);const bounds=view.cueExclusionBounds();assert(bounds&&bounds.x<bounds.right&&bounds.y<bounds.bottom);
 const points=view.nodes.filter(n=>n.node.visible&&!n.part.name.startsWith('fan')).flatMap(n=>n.node.vertices.map(v=>({x:n.node.x+v.x,y:n.node.y-v.y})));
 assert.deepEqual(bounds,{x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))});
 const previous=JSON.stringify(scene.player);view.cueExclusionBounds();assert.equal(JSON.stringify(scene.player),previous);
 scene.player.x+=40;view.update(16,40,0,null,false,false,0);assert(view.cueExclusionBounds().x>bounds.x+30);
 view.destroy();assert.equal(view.cueExclusionBounds(),null);
});
test('local visual spans leave the captured attack immutable, including diagonal and nonintersecting cases',()=>{
 assert.equal(typeof cues.resolveAttackCueSpans,'function');const p=path(),before=JSON.stringify(p);
 assert.deepEqual(cues.resolveAttackCueSpans(p,box),[[0,131],[229,900]]);
 assert.deepEqual(cues.resolveAttackCueSpans(p,null),[[0,900]]);
 assert.deepEqual(cues.resolveAttackCueSpans(p,{...box,x:700,right:730}),[[0,900]]);
 assert.deepEqual(cues.resolveAttackCueSpans(p,{...box,x:NaN}),[[0,900]]);
 const d=cues.resolveCapturedAttackPath({origin:{x:100,y:100},capture:{capturedX:200,capturedY:200},distance:900,width:1000,height:1778});
 const spans=cues.resolveAttackCueSpans(d,{x:200,y:200,right:260,bottom:260});assert.equal(spans.length,2);assert(spans[0][1]<spans[1][0]);assert.equal(spans[1][1],d.length);
 assert.equal(JSON.stringify(p),before);assert.deepEqual(cues.resolveAttackCueSpans(p,{x:490,y:300,right:510,bottom:400}),[[99,900]]);
});
test('actual graphics draws both sides without a band or chevron over the body and keeps the source cue',()=>{
 const g=graphics(),p=path();cues.drawCapturedAttackCue(g,p,{x:350,y:390,width:300,height:500},box);
 const triangles=g.calls.filter(c=>c[0]==='fillTriangle');assert.equal(triangles.length,4,'Two local spans, not a whole-lane disappearance');
 assert(triangles.every(c=>[c[2],c[4],c[6]].every(y=>y<=441)||[c[2],c[4],c[6]].every(y=>y>=539)));
 const lines=g.calls.filter(c=>c[0]==='lineBetween');assert(lines.some(c=>c[2]<450));assert(lines.some(c=>c[4]>530));
 for(const c of lines)assert(!(Math.min(c[1],c[3])<box.right&&Math.max(c[1],c[3])>box.x&&Math.min(c[2],c[4])<box.bottom&&Math.max(c[2],c[4])>box.y),'A visible line crosses the protected body');
 assert(g.calls.some(c=>c[0]==='lineStyle'&&c[1]===4),'Offscreen source remains explicit');
 const zero=path();zero.length=0;zero.end=zero.origin;const local=graphics();cues.drawCapturedAttackCue(local,zero,null,box);assert(local.calls.some(c=>c[0]==='fillCircle'));
});
test('existing scene defers refined cue draw until the body and world have submitted their final frame',()=>{
 const {BattleScene}=loadScenes().loadRuntime('scenes/BattleScene.js');const g=graphics();let draws=0;
 const scene={_battleEnded:false,_battlePaused:false,actorPresentation:{sakuraView:{state:{refined:true},cueExclusionBounds:()=>box}},cameras:{main:{scrollX:350,scrollY:200}},
 _publicStage1StageCueEmitter:{active:true,publicStage1CueLine:g},_drawPublicStage1AttackCue(){draws++;}};
 BattleScene.prototype._updatePublicStage1AttackCues.call(scene);assert.equal(draws,0);
 BattleScene.prototype._updatePublicStage1AttackCues.call(scene,true);assert.equal(draws,1);
 scene._drawPublicStage1AttackCue=BattleScene.prototype._drawPublicStage1AttackCue;
 const enemy={x:500,y:310,publicStage1CueCapture:{capturedX:500,capturedY:430}};
 scene._drawPublicStage1AttackCue(g,enemy);assert.deepEqual(plain(g.publicAttackExclusion),box);
 const order=[],s={player:{active:true},playerGfx:{clear(){}},oldStreet:{sync(){order.push('world');}},_updatePublicStage1AttackCues(ready){assert.equal(ready,true);order.push('cue');}};
 const actor=Object.assign(Object.create(ActorPresentation.prototype),{scene:s,sakuraView:{state:{refined:true}},playerImage:{active:true},pendingPlayerFrame:{now:1,moving:false,bulletColor:1},drawPlayerFrame(){order.push('actor');}});
 actor.flushPlayerFrame();assert.deepEqual(order,['actor','world','cue']);
 order.length=0;actor.sakuraView=null;actor.pendingPlayerFrame={now:2,moving:false,bulletColor:1};actor.flushPlayerFrame();assert.deepEqual(order,['actor','world']);
});
