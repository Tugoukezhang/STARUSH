import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';

function setup(member='sakura',chapter='opening',owner=true) {
  const e=loadScenes();
  e.loadRuntime('utils/userCast.mjs').configureUserCast(owner);
  e.profile.selectPublicPerformer(member);
  e.seed(['opening','neon','encore'],chapter);
  const h=e.harness(e.TitleScene);
  h.scene.create();
  const v=h.scene._publicShell;
  v.showPage('preflight');
  return {e,h,v};
}

function selectPlan(h,first='tempo',second='overdrive') {
  h.click('[data-action=preflight-library]');
  h.click('[data-library-stage=first]');
  assert.equal(h.query('#library-panel-first').hidden,false);
  h.click('[data-arrangement='+first+']');
  h.click('[data-library-stage=second]');
  assert.equal(h.query('#library-panel-second').hidden,false);
  h.click('[data-arrangement='+second+']');
  h.click('[data-action=plan-use]');
}

test('production marker belongs only to owner preflight with actual chapter and preparation identity',()=>{
  for(const member of ['sakura','kai','enjo'])for(const chapter of ['opening','neon','encore']) {
    const {e,h,v}=setup(member,chapter);
    const prep=e.loadRuntime('utils/publicPreparation.mjs');
    const equipmentId={sakura:'travelling_nozzle',kai:'return_edge',enjo:'delayed_hammer'}[member];
    const expected=prep.getPreparationSnapshot(e.profile.loadPublicProfile(),member);
    assert.equal(e.profile.applyPublicPreparationPlan(expected,{trainingLevel:2,equipmentId}).preparationStatus,'planned');
    const saved=e.storage.getItem('starush.public-profile');
    v.render();
    const model=e.model(),copy=h.query('.preflight-hero-copy');
    assert.equal(h.query('.shell-content').dataset.preflightPresentation,'stage-v3');
    assert.equal(copy.querySelector('h2').textContent,model.chapter.name);
    assert.equal(copy.querySelector('p').textContent,model.chapter.subtitle);
    assert.equal(h.query('.preflight-performer-name').textContent,model.member.name);
    assert.equal(h.query('.preflight-performer-action').textContent,model.member.actionName);
    assert.equal(h.query('.preflight-loadout-rank').textContent,'阶位 2');
    assert.equal(h.query('.preflight-loadout-equipment').textContent,prep.PUBLIC_EQUIPMENT.find(row=>row.id===equipmentId).name);
    v.showPage('library');
    assert.equal(h.query('.shell-content').dataset.preflightPresentation,undefined);
    assert.equal(e.storage.getItem('starush.public-profile'),saved);
    h.shutdown();
  }
});

test('all three owner portraits request animation with the existing scene artwork as background',()=>{
  for(const member of ['sakura','kai','enjo']) {
    const {e,h,v}=setup(member),calls=[],mark=v.mark;
    v.mark=function(...args){calls.push(args);return mark.apply(this,args);};
    const saved=e.storage.getItem('starush.public-profile');
    v.render();
    const large=calls.filter(args=>args[2]===true);
    assert.equal(large.length,1);
    assert.equal(large[0][0],h.query('.preflight-portrait-stage'));
    assert.equal(large[0][1].id,member);
    assert.equal(large[0][3]?.animate,true);
    assert.equal(large[0][3].background,h.query('.preflight-scene').querySelector('.chapter-venue-art'));
    assert.equal(calls.filter(args=>args[3]?.animate).length,1);
    assert.equal(h.query('.preflight-figure'),null);
    assert.equal(e.storage.getItem('starush.public-profile'),saved);
    h.shutdown();
  }
});

test('absent or invalid plans show an honest empty state and an explicit native library command',()=>{
  const {e,h,v}=setup(),saved=e.storage.getItem('starush.public-profile');
  const {createArrangementPlan}=e.loadRuntime('utils/publicArrangementPlan.mjs');
  for(const plan of [null,{},createArrangementPlan(['wide_brush','echo'],{stageId:1,performerId:'kai',campaignChapterId:'opening'})]) {
    v.arrangementPlan=plan;
    v.render();
    const empty=h.query('.preflight-plan-empty'),main=h.query('.shell-content');
    assert(empty);
    assert.equal(empty.querySelector('h3').textContent,'未预选编排');
    assert(main.children.indexOf(h.query('.preflight-route'))<main.children.indexOf(empty));
    assert(main.children.indexOf(empty)<main.children.indexOf(h.query('[data-preflight-section=guide]')));
    assert.equal(h.query('[data-arrangement-plan]'),null);
    assert.equal(h.query('.preflight-plan-effects'),null);
    assert.equal(h.all('[data-plan-effect]').length,0);
    const select=empty.querySelector('[data-action=preflight-select-plan]');
    assert(select.querySelector('svg'));
    assert.equal(select.querySelector('.menu-art'),null);
    h.click('[data-action=preflight-select-plan]');
    assert.equal(h.root.dataset.page,'library');
    assert.equal(v.arrangementPlan,null,'library defaults must not become a selected plan');
    h.click('[data-action=back]');
    assert(h.query('.preflight-plan-empty'));
    assert.equal(e.storage.getItem('starush.public-profile'),saved);
  }
  h.click('[data-action=start]');
  assert.equal(h.starts.at(-1)[1].publicArrangementPlan,undefined);
  h.shutdown();
});

test('actual explicit pairs replace empty state with their own choices and computed preview only',()=>{
  const {e,h,v}=setup(),saved=e.storage.getItem('starush.public-profile');
  const {getPublicBuildModel}=e.loadRuntime('utils/publicBuildContent.mjs');
  for(const first of ['wide_brush','relay','tempo'])for(const second of ['echo','overdrive','recovery']) {
    selectPlan(h,first,second);
    const plan=h.query('[data-arrangement-plan]'),model=e.model();
    assert(plan);
    assert.equal(h.query('.preflight-plan-empty'),null);
    assert.deepEqual(plain(v.arrangementPlan.choices),[first,second]);
    assert.deepEqual(plan.querySelectorAll('.preflight-plan-choice').map(row=>row.querySelector('strong').textContent),
      [first,second].map(id=>e.profile.getRunChoice(id).label));
    const build=getPublicBuildModel(model.preparation,model.member.id,[first,second]);
    assert.deepEqual(plan.querySelectorAll('dd').map(row=>row.textContent),plain(build.rows.map(row=>row.value)));
    assert(plan.textContent.includes('局内按段确认后生效，仍可临场改选。'));
    for(const action of ['plan-adjust','plan-clear']) {
      const button=h.query('[data-action='+action+']');
      assert(button.querySelector('svg'));
      assert.equal(button.querySelector('.menu-art'),null);
    }
    assert.equal(e.storage.getItem('starush.public-profile'),saved);
  }
  h.shutdown();
});

test('successful plan renderer returns its section without changing plan and gates native icons by owner mode',()=>{
  for(const owner of [true,false]) {
    const {e,h,v}=setup('sakura','opening',owner),main=e.document.createElement('main'),model=e.model();
    const {renderArrangementPlan}=e.loadRuntime('systems/ArrangementPlanView.mjs');
    v.arrangementPlan=e.loadRuntime('utils/publicArrangementPlan.mjs').createArrangementPlan(['relay','recovery'],
      {stageId:1,performerId:'sakura',campaignChapterId:'opening'});
    const before=JSON.stringify(v.arrangementPlan),options=[],button=v.button;
    v.button=function(...args){options.push(args[3]);return button.apply(this,args);};
    const section=renderArrangementPlan(v,main,model);
    assert(section,'successful rendering must return the plan section');
    assert.equal(section,main.querySelector('[data-arrangement-plan]'));
    assert.equal(section.parentNode,main);
    assert.equal(JSON.stringify(v.arrangementPlan),before);
    assert.equal(options.length,2);
    for(const option of options)assert.equal(option.lineIcon,owner);
    v.arrangementPlan=null;
    assert.equal(renderArrangementPlan(v,main,model),undefined);
    h.shutdown();
  }
});

test('adjust and clear keep their native behavior and clear returns to no-plan without granting defaults',()=>{
  const {e,h,v}=setup(),saved=e.storage.getItem('starush.public-profile');
  selectPlan(h);
  h.click('[data-route-choice=west]');
  h.click('[data-action=plan-adjust]');
  assert.equal(h.root.dataset.page,'library');
  assert.equal(v.arrangementFirst,'tempo');
  assert.equal(v.arrangementSecond,'overdrive');
  h.click('[data-library-stage=first]');
  h.click('[data-arrangement=relay]');
  h.click('[data-library-stage=second]');
  h.click('[data-arrangement=recovery]');
  h.click('[data-action=plan-use]');
  assert.deepEqual(plain(v.arrangementPlan.choices),['relay','recovery']);
  h.click('[data-action=plan-clear]');
  assert.equal(v.arrangementPlan,null);
  assert(h.query('.preflight-plan-empty'));
  assert.equal(h.query('[data-arrangement-plan]'),null);
  assert.equal(h.query('.preflight-plan-effects'),null);
  assert.equal(v.routeSelection.id,'west');
  assert.equal(e.storage.getItem('starush.public-profile'),saved);
  h.click('[data-action=start]');
  assert.equal(h.starts.at(-1)[1].publicArrangementPlan,undefined);
  assert.equal(h.starts.at(-1)[1].publicRoutePlan.id,'west');
  h.shutdown();
});

test('route, disclosures and all six configuration trips preserve selected plan and uncommitted drafts',()=>{
  const {e,h,v}=setup(),saved=e.storage.getItem('starush.public-profile');
  selectPlan(h);
  const plan=JSON.stringify(v.arrangementPlan);
  h.click('[data-action=plan-adjust]');
  h.click('[data-library-stage=first]');
  h.click('[data-arrangement=relay]');
  h.click('[data-library-stage=second]');
  h.click('[data-arrangement=recovery]');
  h.click('[data-action=back]');
  for(const id of ['west','east','auto','east']) {
    h.click('[data-route-choice='+id+']');
    assert.equal(h.all('[data-route-choice]').filter(button=>button.getAttribute('aria-pressed')==='true').length,1);
    assert.equal(e.document.activeElement,h.query('[data-route-choice='+id+']'));
    assert.equal(JSON.stringify(v.arrangementPlan),plan);
    assert.equal(v.arrangementFirst,'relay');
    assert.equal(v.arrangementSecond,'recovery');
  }
  for(const section of ['guide','build']) {
    const details=h.query('[data-preflight-section='+section+']');
    assert.equal(details.open,false);
    details.open=true;details.dispatchEvent({type:'toggle'});
  }
  const commands=[['member','roster'],['training','workshop'],['inventory','inventory'],['chapter','tour'],['goals','goals'],['library','library']];
  assert.equal(h.query('.preflight-tools').querySelectorAll('button').length,6);
  for(const [action,page]of commands) {
    h.click('[data-action=preflight-'+action+']');
    assert.equal(h.root.dataset.page,page);
    if(page==='roster')h.click('[data-member=kai]');
    if(page==='tour')h.click('[data-chapter=neon]');
    h.click('[data-action=back]');
    assert.equal(h.root.dataset.page,'preflight');
    assert.equal(JSON.stringify(v.arrangementPlan),plan);
    assert.equal(v.routeSelection.id,'east');
    assert.equal(v.arrangementFirst,'relay');
    assert.equal(v.arrangementSecond,'recovery');
    assert.equal(h.query('[data-preflight-section=guide]').open,true);
    assert.equal(h.query('[data-preflight-section=build]').open,true);
    assert.equal(e.storage.getItem('starush.public-profile'),saved);
  }
  assert.equal(h.all('[data-action=start]').length,1);
  h.click('[data-action=start]');
  const [scene,data]=h.starts.at(-1);
  assert.equal(scene,'BattleScene');
  assert.equal(data.performerId,'sakura');
  assert.equal(data.campaignChapterId,'opening');
  assert.equal(data.publicRoutePlan.id,'east');
  assert.deepEqual(plain(data.publicArrangementPlan),JSON.parse(plan));
  assert.deepEqual(plain(data.publicPreparation),plain(e.model().preparation));
  assert.equal(data.stageId,1);
  assert.equal(data.practiceMode,false);
  assert.equal(data.defenseMode,false);
  assert.equal(e.storage.getItem('starush.public-profile'),saved);
  h.shutdown();
});

test('legacy preflight keeps its route-free commands and DTO without owner presentation or empty-plan state',()=>{
  const {e,h,v}=setup('sakura','opening',false),saved=e.storage.getItem('starush.public-profile'),calls=[],mark=v.mark;
  v.mark=function(...args){calls.push(args);return mark.apply(this,args);};
  v.render();
  assert.equal(h.query('.shell-content').dataset.preflightPresentation,undefined);
  for(const selector of ['.preflight-hero','.preflight-plan-empty','[data-action=preflight-select-plan]','[data-arrangement-plan]','.preflight-route','[data-preflight-section=guide]'])assert.equal(h.query(selector),null);
  assert.equal(calls.some(args=>args[3]?.animate),false);
  for(const action of ['member','training','inventory','chapter','goals','library'])assert.equal(h.all('[data-action=preflight-'+action+']').length,1);
  assert(h.text.includes('行动涂染加成'));
  assert(h.text.includes('开演前确认'));
  h.click('[data-action=start]');
  assert.equal(h.starts.at(-1)[0],'BattleScene');
  assert.equal(h.starts.at(-1)[1].publicRoutePlan,undefined);
  assert.equal(h.starts.at(-1)[1].publicArrangementPlan,undefined);
  assert.equal(e.storage.getItem('starush.public-profile'),saved);
  h.shutdown();
});
