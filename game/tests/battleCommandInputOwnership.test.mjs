import test from 'node:test';import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const env=loadScenes(),doc=env.document,{BattleScene}=env.loadRuntime('scenes/BattleScene.js');
const query=doc.querySelector.bind(doc);doc.querySelector=s=>s.includes(' ')?null:query(s);
function fixture(){
 const root=doc.createElement('div');doc.body.replaceChildren(root);const nodes={};
 for(const id of ['skill-special','skill-encore','ult-prompt']){const n=doc.createElement('button');n.id=id;root.append(n);nodes[id]=n;}
 const calls={special:0,encore:0},bubbled=[],s={_touchStick:{x:20,y:0},publicPerformerRun:{triggerAction(){calls.special++;}},_triggerPublicRelightBurst(){calls.encore++;}};
 root.addEventListener('keydown',e=>{bubbled.push('down:'+e.key);if(e.key===' '){if(e.repeat!==true)calls.encore++;e.preventDefault();}});
 root.addEventListener('keyup',e=>{bubbled.push('up:'+e.key);if(e.key===' ')e.preventDefault();});
 BattleScene.prototype._setupHUD.call(s);
 const send=(id,type,values={})=>{const event={type,bubbles:true,...values};nodes[id].dispatchEvent(event);return event;};
 return {nodes,calls,bubbled,s,send};
}
for(const id of ['skill-special','skill-encore','ult-prompt']){
 for(const key of [' ','Enter'])test(id+' owns native '+JSON.stringify(key)+' down/up without cancelling its browser activation',()=>{
  const f=fixture(),down=f.send(id,'keydown',{key}),up=f.send(id,'keyup',{key});
  assert.deepEqual(f.bubbled,[]);assert.notEqual(down.defaultPrevented,true);assert.notEqual(up.defaultPrevented,true);
  assert.equal(f.calls.encore,0);assert.equal(f.calls.special,0);
  f.send(id,'click',{detail:0});assert.equal(f.calls[id==='skill-special'?'special':'encore'],1);
 });
 test(id+' ignores non-primary mouse/stylus buttons but keeps a second touch finger',()=>{
  const f=fixture();for(const button of [1,2,5])f.send(id,'pointerdown',{button,pointerType:'mouse'});
  for(const button of [2,5])f.send(id,'pointerdown',{button,pointerType:'pen'});
  assert.deepEqual(f.calls,{special:0,encore:0});
  const touch=f.send(id,'pointerdown',{button:0,pointerType:'touch',isPrimary:false});assert.equal(touch.defaultPrevented,true);assert.equal(touch.cancelBubble,true);
  f.send(id,'click',{detail:1});assert.equal(f.calls[id==='skill-special'?'special':'encore'],1);
  assert.deepEqual(f.s._touchStick,{x:20,y:0});
 });
 test(id+' leaves other keys and orphan releases to the existing global keyboard owner',()=>{
  const f=fixture();for(const key of ['Tab','Escape','p','w']){f.send(id,'keydown',{key});f.send(id,'keyup',{key});}
  assert.equal(f.bubbled.length,8);f.send(id,'keyup',{key:' '});assert.equal(f.bubbled.at(-1),'up: ');
  f.send(id,'keydown',{key:' '});f.send(id,'blur');f.send(id,'keyup',{key:' '});assert.equal(f.bubbled.at(-1),'up: ');
 });
 test(id+' keeps primary pointer and assistive click single activation after repeated HUD setup',()=>{
  const f=fixture();BattleScene.prototype._setupHUD.call(f.s);f.send(id,'pointerdown',{button:0});f.send(id,'click',{detail:1});
  f.send(id,'click',{detail:0});assert.equal(f.calls[id==='skill-special'?'special':'encore'],2);
 });
}
test('both activation keys can be owned together and scene run lookup remains current',()=>{
 const f=fixture();for(const key of [' ','Enter'])f.send('skill-special','keydown',{key});
 for(const key of [' ','Enter'])f.send('skill-special','keyup',{key});assert.deepEqual(f.bubbled,[]);
 let latest=0;f.s.publicPerformerRun={triggerAction(){latest++;}};f.send('skill-special','click',{detail:0});assert.equal(latest,1);assert.equal(f.calls.special,0);
});
test('auto-repeat arriving after focus handoff cannot take ownership of a global held key',()=>{
 const f=fixture();const down=f.send('skill-special','keydown',{key:' ',repeat:true}),up=f.send('skill-special','keyup',{key:' '});
 assert.deepEqual(f.bubbled,['down: ','up: ']);assert.equal(down.defaultPrevented,true);assert.equal(up.defaultPrevented,true);assert.deepEqual(f.calls,{special:0,encore:0});
});
test('auto-repeat belonging to an existing button press stays local through native release',()=>{
 const f=fixture();f.send('skill-special','keydown',{key:' ',repeat:false});f.send('skill-special','keydown',{key:' ',repeat:true});
 const up=f.send('skill-special','keyup',{key:' '});assert.deepEqual(f.bubbled,[]);assert.notEqual(up.defaultPrevented,true);
 f.send('skill-special','click',{detail:0});assert.deepEqual(f.calls,{special:1,encore:0});
});
test('a fresh focus clears an abandoned press even if removal or hiding omitted blur',()=>{
 const f=fixture();f.send('skill-special','keydown',{key:' '});f.send('skill-special','focus');
 f.send('skill-special','keydown',{key:' ',repeat:true});f.send('skill-special','keyup',{key:' '});
 assert.deepEqual(f.bubbled,['down: ','up: ']);assert.deepEqual(f.calls,{special:0,encore:0});
});
