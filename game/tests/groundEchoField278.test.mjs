import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GroundEchoField,GROUND_ECHO_ART} from '../src/systems/GroundEchoField278.mjs';
test('battle preload and publication use the same real ground echo asset',()=>{
 const scene=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 assert(scene.includes('this.load.image(GROUND_ECHO_ART.key,GROUND_ECHO_ART.path)'));
 const payload=JSON.parse(fs.readFileSync(new URL('../home-payload.json',import.meta.url),'utf8'));
 assert(payload.some(row=>row.file===GROUND_ECHO_ART.path));
 assert(fs.statSync(new URL('../public/'+GROUND_ECHO_ART.path,import.meta.url)).size>0);
});
function fixture(){
 const calls={paint:[],hit:[],fans:[]},nodes=[];
 const node=()=>{const n={active:true,setDepth(){return this;},setVisible(){return this;},setMask(){return this;},setDisplaySize(){return this;},setAlpha(){return this;},destroy(){this.active=false;},clear(){return this;},fillStyle(){return this;},fillPoints(){return this;},createGeometryMask(){return{destroy(){}};}};nodes.push(n);return n;};
 const target={x:80,y:0,active:true,publicStage1EnemyRole:'unlit-chaser'},device={x:120,y:0,zone:0,complete:false};
 const scene={_battlePaused:false,_battleEnded:false,_userCastPresentation:true,player:{hp:5,active:true},oldStreet:{clearLine:()=>true},
  textures:{exists:()=>true},add:{image:node},make:{graphics:node},enemies:{getChildren:()=>[target]},
  paintZone:{currentZone:0,finaleMode:false,devices:[device],canReceivePaint:()=>true,applyPaint:(d,n,c)=>{calls.paint.push([d,n,c]);return true;},paintAttackFan:f=>calls.fans.push(f)},
  _paintPublicStage1TargetsAt:(x,y,n,r,c,t)=>{calls.hit.push([t,n]);return true;}};
 let alive=true;const run={scene,alive:()=>alive,choiceEffects:{echo:0}};
 return {scene,run,target,device,calls,nodes,field:new GroundEchoField(run),die:()=>alive=false};
}
test('one release paints both half-fans, hits each target once and counts once',()=>{
 const f=fixture();f.field.queue(0,0,'orange',0);f.field.update(400);f.field.update(500);f.field.update(620);f.field.update(800);
 assert.equal(f.calls.hit.length,1);assert.equal(f.calls.paint.length,1);assert.equal(f.calls.hit[0][1],14);
 assert.equal(f.run.choiceEffects.echo,1);assert(f.calls.fans.length>=2);assert(f.calls.fans.every(x=>x.radius<=150));
 assert.equal(f.field.rows.length,0);assert(f.nodes.every(n=>!n.active));
});
test('wall and pause prevent hits and paint, pause does not consume the wave',()=>{
 const f=fixture();f.field.queue(0,0,'orange',0);f.scene._battlePaused=true;f.field.update(400);
 assert.equal(f.calls.fans.length,0);f.scene._battlePaused=false;f.scene.oldStreet.clearLine=()=>false;f.field.update(620);
 assert.equal(f.calls.hit.length,0);assert.equal(f.calls.paint.length,0);
});
test('death cancels pending release and display',()=>{
 const f=fixture();f.field.queue(0,0,'orange',0);f.die();f.field.update(400);
 assert.equal(f.calls.hit.length,0);assert.equal(f.calls.fans.length,0);assert.equal(f.run.choiceEffects.echo,0);assert.equal(f.field.rows.length,0);
});
test('a late first update applies the complete sweep without relying on visible sample',()=>{
 const f=fixture();f.field.queue(0,0,'orange',0);f.field.update(900);
 assert.equal(f.calls.hit.length,1);assert.equal(f.calls.paint.length,1);assert.equal(f.field.rows.length,0);
});
