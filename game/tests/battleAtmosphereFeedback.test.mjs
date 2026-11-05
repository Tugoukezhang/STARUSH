import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const url=new URL('../src/utils/battleAtmosphereFeedback.mjs',import.meta.url);
const api=fs.existsSync(url)?await import(url):{};
function fixture(){const nodes=[],tweens=[],killed=[];function node(type,x,y,style){const n={type,x,y,style};for(const method of ['setOrigin','setDepth','setAlpha','setScale','setScrollFactor','setText','setColor'])n[method]=function(value){this[method.slice(3).toLowerCase()]=value;return this;};nodes.push(n);return n;}const scene={add:{text:(x,y,text,style)=>node('text',x,y,style),circle:(x,y)=>node('ring',x,y)},tweens:{add:t=>tweens.push(t),killTweensOf:n=>killed.push(n)}};return {scene,nodes,tweens,killed};}
test('public atmosphere feedback is a small screen-local note, not world-sized text or an expanding ring',()=>{
  assert.equal(typeof api.createAtmosphereFeedback,'function');
  const f=fixture(),feedback=api.createAtmosphereFeedback(f.scene,true);
  assert.equal(feedback.label.style.fontSize,'14px');assert.equal(feedback.label.scrollfactor,0);
  assert.equal(feedback.label.y,168);assert.equal(feedback.label.x,187.5);
  assert.equal(feedback.label.scale,1);assert.equal(feedback.ring.alpha,0);assert.equal(feedback.ring.scrollfactor,0);
  Object.assign(f.scene,{atmoLabel:feedback.label,atmoRing:feedback.ring});
  api.playPublicAtmosphereFeedback(f.scene,'甜蜜');
  assert.equal(feedback.label.text,'甜蜜');assert.equal(feedback.label.color,'#314951');
  assert.equal(f.tweens.length,1);assert.equal(f.tweens[0].targets,feedback.label);
  assert.equal(f.tweens[0].alpha,.9);assert.ok(!('scaleX'in f.tweens[0]));assert.ok(!('scaleY'in f.tweens[0]));
  f.tweens[0].onComplete();assert.equal(feedback.label.alpha,0);assert.equal(feedback.label.scale,1);
});
test('hidden legacy retains its established feedback and integration does not change atmosphere state or rewards',()=>{
  assert.equal(typeof api.createAtmosphereFeedback,'function');const f=fixture(),feedback=api.createAtmosphereFeedback(f.scene,false);
  assert.equal(feedback.label.style.fontSize,'36px');assert.equal(feedback.label.scrollfactor,undefined);
  const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
  assert.match(source,/createAtmosphereFeedback\(this,\s*this\._isPublicStage1Round\(\)\)/);
  const a=source.indexOf('  _showAtmoName(color)'),b=source.indexOf('  _showComboBreak()',a),method=source.slice(a,b);
  assert.match(method,/if\s*\(this\._isPublicStage1Round\(\)\)/);assert.match(method,/playPublicAtmosphereFeedback/);
  assert.doesNotMatch(method,/gain|damage|support|score|heat/);
});
