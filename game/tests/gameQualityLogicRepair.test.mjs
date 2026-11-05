import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import * as result from '../src/utils/publicCampaignResult.mjs';
import { loadPublicProfile, PUBLIC_PERFORMERS } from '../src/utils/publicRunProgression.mjs';
import { getPreparationSnapshot, getPreparationEffects } from '../src/utils/publicPreparation.mjs';
import { getChapterBriefing } from '../src/utils/playerPreferences.mjs';
import { loadScenes } from './helpers/publicShellHarness.mjs';
import { playPublicAtmosphereFeedback } from '../src/utils/battleAtmosphereFeedback.mjs';

const fresh=()=>loadPublicProfile({getItem:()=>null,setItem(){}});
function trained(){const p=fresh();p.clears=3;p.attempts=3;
  p.campaign={version:1,selectedChapterId:'encore',clearedChapterIds:['opening','neon','encore'],chapterClears:{opening:1,neon:1,encore:1},completed:true};
  p.preparation.trainingLevels.sakura=3;p.preparation.equipmentByPerformer.sakura='focus_lens';return p;}
const oldData=()=>({stageId:1,practiceMode:false,performerId:'sakura',campaignChapterId:'opening',publicPreparation:getPreparationSnapshot(trained(),'sakura')});
test('next chapter uses restored preparation, not the previous entry snapshot',()=>{
  const p=fresh();p.clears=1;p.attempts=1;p.campaign.chapterClears.opening=1;p.campaign.clearedChapterIds=['opening'];
  const data=oldData(),before=structuredClone(data);
  const next=result.getNextCampaignBattleData({victory:true,recorded:true,chapterId:'opening'},data,p);
  assert.equal(next.campaignChapterId,'neon');
  assert.equal(getPreparationEffects(next.publicPreparation,'sakura').actionPower,1);
  assert.deepEqual(data,before,'running entry remains unchanged');
});
test('retry refreshes preparation and rechecks chapter unlock; diagnostic data remains identical',()=>{
  assert.equal(typeof result.getRetryCampaignBattleData,'function');
  const data={...oldData(),campaignChapterId:'encore'},reset=result.getRetryCampaignBattleData(data,fresh());
  assert.equal(reset.campaignChapterId,'opening');
  assert.equal(getPreparationEffects(reset.publicPreparation,'sakura').actionPower,1);
  const kept=result.getRetryCampaignBattleData(data,trained());
  assert.equal(kept.campaignChapterId,'encore');assert.equal(kept.performerId,'sakura');
  assert.equal(getPreparationEffects(kept.publicPreparation,'sakura').actionPower,1.38);
  for(const patch of [{practiceMode:true},{defenseMode:true},{stageId:2}]){
    const hidden={...data,...patch};assert.equal(result.getRetryCampaignBattleData(hidden,fresh()),hidden);
  }
});
test('actual base movement block normalizes eight keys but keeps analog magnitude',()=>{
  const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
  const start=source.indexOf('    let vx = 0, vy = 0;',source.indexOf('  update(time, delta)'));
  const end=source.indexOf('    const resolvedMovement',start);
  const move=Function('PLAYER','JOYSTICK_DEADZONE','JOYSTICK_RANGE',source.slice(start,end)+'return {vx,vy};');
  function resolve(x,y,stick){const down=isDown=>({isDown});const scene={cursors:{left:down(x<0),right:down(x>0),up:down(y<0),down:down(y>0)},wasd:Object.fromEntries(['A','D','W','S'].map(k=>[k,down(false)])),_touchMoveActive:!!stick,_touchStick:stick};return move.call(scene,{SPEED:250},4,52);}
  for(const x of [-1,0,1])for(const y of [-1,0,1]){const m=resolve(x,y);assert.ok(Math.abs(Math.hypot(m.vx,m.vy)-(x||y?250:0))<1e-9);}
  assert.deepEqual(resolve(0,0,{x:26,y:0}),{vx:125,vy:0});
  assert.deepEqual(resolve(0,0,{x:0,y:0}),{vx:0,vy:0});
});
test('shared rules are member-neutral; member action is still rendered from actual identity',()=>{
  assert.doesNotMatch(getChapterBriefing('opening').rule,/绯樱|扇击/);
  const env=loadScenes(),{PlayerSessionExperience}=env.loadRuntime('systems/PlayerSessionExperience.mjs');
  for(const member of PUBLIC_PERFORMERS){const s={battleData:{performerId:member.id,campaignChapterId:'opening'},_isPublicStage1Round:()=>true};
    const view=new PlayerSessionExperience(s);view.showBriefing(false);
    assert.ok(view.root.textContent.includes(member.name+' · '+member.actionName));
    assert.ok(view.root.textContent.includes(member.actionSummary));view.destroy();}
});
test('shared notice surface preempts guidance, resumes it after action, and uses frozen run time',()=>{
  const file=new URL('../src/systems/BattleNoticeView.mjs',import.meta.url);assert.ok(fs.existsSync(file),'shared notice surface is missing');
  const env=loadScenes(),{BattleNoticeView}=env.loadRuntime('systems/BattleNoticeView.mjs');
  const view=new BattleNoticeView(env.document);
  view.show('前往北街',{kind:'guidance',duration:5000},0);
  view.show('金星 · 释放安可',{kind:'action',duration:980},100);
  assert.equal(view.root.textContent,'金星 · 释放安可');assert.equal(view.pending.size,1);
  view.update(100);assert.equal(view.root.textContent,'金星 · 释放安可','same frozen clock cannot age action');
  view.show('压轴定线',{kind:'danger',duration:500},200);
  assert.equal(view.root.textContent,'压轴定线');
  view.update(701);assert.equal(view.root.textContent,'金星 · 释放安可');
  view.update(1582);assert.equal(view.root.textContent,'前往北街');
  view.clear('guidance');assert.equal(view.root.hidden,true);
  view.show('临时提示',{kind:'action'},2000);view.destroy();view.destroy();
  assert.equal(env.document.getElementById('battle-notice'),null);
  view.show('不得复活',{kind:'danger'},2001);assert.equal(env.document.getElementById('battle-notice'),null);
});
test('public Encore is actual member text-only, without borrowing hidden Sakura cut-in',()=>{
  const env=loadScenes(),{BattleScene}=env.loadRuntime('scenes/BattleScene.js');
  for(const member of PUBLIC_PERFORMERS){let sample;
    const image={src:'old-sakura',removeAttribute(name){if(name==='src')delete this.src;}};
    const s={_isPublicStage1Round:()=>true,publicPerformerRun:{member},time:{delayedCall(){}},ultCutinImg:image,ultCutinEl:{classList:{remove(){},add(){}}},_showPublicBattleNotice(text,options){sample={text,options};}};
    BattleScene.prototype._playPublicEncoreCutin.call(s);
    assert.equal(image.src,undefined);assert.match(sample.text,new RegExp(member.name));assert.equal(sample.options.kind,'action');
  }
});
test('integration owns notice lifetime and removes obsolete public HUD label/image source',()=>{
  const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(source.includes('getRetryCampaignBattleData(this.battleData)'));
  assert.ok(source.includes('this._battleNotices?.update(time)'));
  assert.ok(source.includes('this._battleNotices?.destroy()'));
  assert.ok(html.includes('id="wave-text">街区设施 0/10'));
  const cutin=html.slice(html.indexOf('<div id="ult-cutin">'),html.indexOf('<div id="combo-display"'));
  assert.equal(cutin.includes('src="art/sakura-redesign'),false);
  assert.ok(html.includes('#battle-notice'));
});

test('public atmosphere feedback joins the shared surface instead of overlapping canvas text',()=>{
  const node=()=>({alpha:1,setAlpha(value){this.alpha=value;return this;},setScale(){return this;},setText(){return this;},setColor(){return this;}});
  const scene={atmoLabel:node(),atmoRing:node(),tweens:{killTweensOf(){},add(){throw Error('Independent text tween must not run');}},
    _showPublicBattleNotice(text,options){this.notice={text,options};}};
  playPublicAtmosphereFeedback(scene,'应援叠加');
  assert.equal(scene.atmoLabel.alpha,0);assert.equal(scene.atmoRing.alpha,0);
  assert.equal(scene.notice.text,'应援叠加');assert.equal(scene.notice.options.kind,'phase');
});

test('all five member actions outrank phase labels',()=>{
  const env=loadScenes(),{BattleScene}=env.loadRuntime('scenes/BattleScene.js');
  for(const member of PUBLIC_PERFORMERS) {
    let call;const scene={battleData:{},_isPublicStage1Round:()=>true,publicPerformerRun:{member},_showPublicBattleNotice(text,options){call={text,options};}};
    BattleScene.prototype._showRoundBanner.call(scene,member.actionName);
    assert.equal(call.options.kind,'action',member.id);
  }
});
test('aged actions cannot resurrect after repeated danger',()=>{
  const env=loadScenes(),{BattleNoticeView}=env.loadRuntime('systems/BattleNoticeView.mjs');
  const view=new BattleNoticeView(env.document);
  view.show('金星 · 释放安可',{kind:'action',duration:980},0);
  for(let t=100;t<=10000;t+=900)view.show('危险接近',{kind:'danger',duration:900},t);
  view.update(10900);assert.equal(view.root.textContent.includes('释放安可'),false);
  view.destroy();
});

test('next chapter rejects defense',()=>{
  const profile=trained(),data={...oldData(),defenseMode:true};
  assert.equal(result.getNextCampaignBattleData({victory:true,recorded:true,chapterId:'opening'},data,profile),null);
});
test('defense and released scenes cannot recreate public notice DOM',()=>{
  const env=loadScenes(),{BattleScene}=env.loadRuntime('scenes/BattleScene.js');
  for(const state of [{battleData:{defenseMode:true}},{battleData:{},battleRuntimeReleaseFacade:{released:true}}]) {
    const scene={_isPublicStage1Round:()=>true,time:{now:100},...state};
    BattleScene.prototype._showPublicBattleNotice.call(scene,'不应出现',{kind:'phase'});
    assert.equal(env.document.getElementById('battle-notice'),null);
  }
});
