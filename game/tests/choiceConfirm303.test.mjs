import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScenes,plain,storageFixture} from './helpers/publicShellHarness.mjs';

// B303 owner-family inspect/confirm flow. Harness limits: selectors may not contain spaces, '>', ':', ',', '+' or '~';
// Element.click() skips disabled nodes, so guard tests also use dispatchEvent; there is no layout, so reserved height,
// visual hiding and the 44px target are left to the Edge screenshot pass.
const ROLES=['sakura','kai','enjo'];
const FIRST=Object.freeze({sakura:['wide_brush','relay','tempo','fanfire'],kai:['wide_brush','relay','tempo'],enjo:['wide_brush','relay','tempo']});
const SECOND=['echo','overdrive','recovery'];
const ROW_ART='art/choice-stage-b303/row.webp',CONFIRM_ART='art/choice-stage-b303/confirm.webp';
const OLD_TICKET='art/choice-studio-20261104/ticket.webp',HEADING='art/choice-studio-20261104/heading.webp';

function fixture(id='sakura',choices=[],{castEnabled=true,planned=null,build=true}={}){
  const storage=storageFixture(),sessionStorage=storageFixture();let writes=0;
  for(const target of [storage,sessionStorage])for(const method of ['setItem','removeItem','clear']){
    const original=target[method];target[method]=(...args)=>{writes++;return original(...args);};
  }
  const e=loadScenes({storage,sessionStorage}),images=[];
  // Same patch as choiceStudio290.test.mjs for the legacy descendant selector, plus capture of the detached
  // ticket probe and the Element.prepend the harness lacks (the ticket error path uses it).
  const create=e.document.createElement.bind(e.document);
  e.document.createElement=(...args)=>{
    const node=create(...args),query=node.querySelector.bind(node);
    node.querySelector=s=>s==='.battle-visual-copy span'?query('.battle-visual-copy')?.querySelector('span'):query(s);
    node.prepend=(...items)=>{for(const item of items.reverse())node.insertBefore(item,node.children[0]??null);};
    if(node.tagName==='IMG')images.push(node);
    return node;
  };
  const cast=e.loadRuntime('utils/userCast.mjs');cast.configureUserCast(castEnabled);
  const surface=e.loadRuntime('systems/BattleSurfaceView.mjs'),content=e.loadRuntime('utils/publicBuildContent.mjs');
  const model=()=>build?content.getPublicBuildModel(null,id,choices):null;
  const growth=new e.profile.PublicRunProgression({performerId:id,choices}),calls=[],state={accept:true,blocked:false};
  const scene={battleData:{campaignChapterId:'opening'},
    publicPerformerRun:{getBuildSnapshot:model,choose(){throw new Error('The view must not commit a run choice directly');}},
    _sessionExperience:{isBlocking:()=>state.blocked},
    input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},events:{once(){},off(){}},sound:null};
  const open=()=>new surface.BattleSurfaceView(scene,{mode:'choice',member:cast.getDisplayPerformer(id),number:choices.length+1,choices,
    options:growth.getOptions(),plannedChoice:planned,
    onChoice:choice=>{calls.push(choice);return state.accept;},onLeave:()=>{calls.push('leave');}},e.document);
  const view=open(),before=plain(e.profile.loadPublicProfile()),writesBefore=writes;
  return {e,scene,view,calls,state,images,open,surface,before,
    option:optionId=>content.getPublicBuildOption(model(),optionId),
    assertUntouched(){assert.equal(writes,writesBefore,'storage must not be written');assert.deepEqual(plain(e.profile.loadPublicProfile()),before);}};
}
const rowsOf=view=>view.root.querySelectorAll('[data-choice]');
const rowOf=(view,id)=>view.root.querySelector(`[data-choice=${id}]`);
const confirmOf=view=>view.root.querySelector('[data-action=confirm-choice]');
const exitOf=view=>view.root.querySelector('[data-action=leave-choice]');
const detailOf=view=>view.root.querySelector('.battle-choice-detail');
const pressedIds=view=>view.root.querySelectorAll('[aria-pressed=true]').map(row=>row.dataset.choice);
function assertNothingSelected(view){
  assert.deepEqual(pressedIds(view),[]);
  assert.equal(view.pendingChoice,null);
  assert.equal(detailOf(view).children.length,0);
  assert.equal(detailOf(view).textContent,'');
  assert.equal(confirmOf(view).disabled,true);
  assert.equal(view.root.querySelector('[data-chosen=true]'),null);
}
function tap(button,{button:mouseButton=0,moveTo=null,isPrimary=true}={}){
  const at={pointerId:1,clientX:10,clientY:10,isPrimary,button:mouseButton};
  button.dispatchEvent({type:'pointerdown',...at});
  const end=moveTo?{...at,clientX:moveTo,clientY:10}:at;
  if(moveTo)button.dispatchEvent({type:'pointermove',...end});
  button.dispatchEvent({type:'pointerup',...end});
  button.dispatchEvent({type:'click',detail:1,pointerId:1,bubbles:true});
}

test('all three roles expose every real option with nothing selected: rifle has four first options, others three',()=>{
  for(const id of ROLES)for(const [choices,expected] of [[[],FIRST[id]],[['relay'],SECOND]]){
    const f=fixture(id,choices),rows=rowsOf(f.view);
    assert.deepEqual(rows.map(row=>row.dataset.choice),expected,`${id} ${choices}`);
    assert.equal(f.view.root.dataset.choiceStudio,'303');
    assert.equal(f.view.root.dataset.choiceFamily,'true');
    for(const row of rows){
      assert.equal(row.getAttribute('aria-pressed'),'false');
      assert.ok(row.querySelector('strong').textContent);
      assert.ok(row.querySelector('.battle-choice-category').textContent);
      assert.ok(row.querySelector('.battle-choice-delta').textContent);
      // CSS hides it visually; the node must survive for accessibility and tests.
      assert.ok(row.querySelector('.battle-choice-limit').textContent);
      assert.ok(row.getAttribute('aria-label'));
    }
    assertNothingSelected(f.view);
    assert.equal(confirmOf(f.view).textContent,'确认编排');
    f.assertUntouched();f.view.destroy();
  }
});

test('the detail region is one stable, empty polite status section directly below the rows',()=>{
  const f=fixture(),detail=detailOf(f.view),list=f.view.root.querySelector('.battle-choice-list');
  assert.equal(f.view.root.querySelectorAll('.battle-choice-detail').length,1);
  assert.equal(detail.tagName,'SECTION');
  assert.equal(detail.getAttribute('role'),'status');
  assert.equal(detail.getAttribute('aria-live'),'polite');
  assert.equal(detail.textContent,'');
  assert.equal(detail.parentNode,list.parentNode);
  assert.equal(list.parentNode.children.indexOf(detail),list.parentNode.children.indexOf(list)+1);
  rowOf(f.view,'relay').click();
  assert.equal(detailOf(f.view),detail,'selection must update the region, not rebuild it');
  rowOf(f.view,'tempo').click();
  assert.equal(detailOf(f.view),detail);
  f.view.destroy();
});

test('selecting and changing rows previews one choice without callback, busy, chosen mark or storage write',()=>{
  const f=fixture();
  rowOf(f.view,'relay').click();
  assert.deepEqual(pressedIds(f.view),['relay']);
  assert.equal(f.view.pendingChoice,'relay');
  assert.equal(confirmOf(f.view).disabled,false);
  assert.equal(rowOf(f.view,'relay').querySelector('svg').style.visibility,'visible');
  assert.equal(rowOf(f.view,'tempo').querySelector('svg').style.visibility,'hidden');
  rowOf(f.view,'tempo').click();
  assert.deepEqual(pressedIds(f.view),['tempo']);
  assert.equal(f.view.pendingChoice,'tempo');
  assert.equal(rowOf(f.view,'relay').getAttribute('aria-pressed'),'false');
  assert.equal(rowOf(f.view,'relay').querySelector('svg').style.visibility,'hidden');
  assert.equal(rowOf(f.view,'tempo').querySelector('svg').style.visibility,'visible');
  assert.deepEqual(f.calls,[]);
  assert.equal(f.view.busy,false);
  assert.equal(f.view.root.querySelector('[data-chosen=true]'),null);
  f.assertUntouched();
  f.view.destroy();
});

test('re-pressing the selected row neither deselects nor rebuilds the live region',()=>{
  const f=fixture();
  rowOf(f.view,'relay').click();
  const announced=detailOf(f.view).querySelector('strong');
  rowOf(f.view,'relay').click();
  assert.deepEqual(pressedIds(f.view),['relay']);
  assert.equal(detailOf(f.view).querySelector('strong'),announced);
  assert.deepEqual(f.calls,[]);
  f.view.destroy();
});

test('a planned choice is only a marker and needs the same explicit selection and confirm',()=>{
  const f=fixture('kai',[],{planned:'relay'}),row=rowOf(f.view,'relay');
  assert.equal(row.dataset.plannedChoice,'true');
  assert.ok(row.querySelector('.battle-choice-plan-tag'));
  assert.match(row.getAttribute('aria-label'),/本场方案预选/);
  assert.equal(row.getAttribute('aria-pressed'),'false');
  assertNothingSelected(f.view);
  assert.deepEqual(f.calls,[]);
  row.click();
  assert.equal(detailOf(f.view).querySelector('strong').textContent,f.option('relay').label,'the detail shows the name, not the plan tag');
  assert.deepEqual(f.calls,[]);
  // The plan does not constrain the player either.
  rowOf(f.view,'tempo').click();
  confirmOf(f.view).click();
  assert.deepEqual(f.calls,['tempo']);
  f.view.destroy();
});

test('explicit confirm commits the canonical selected ID exactly once and marks only that row',()=>{
  const f=fixture();
  rowOf(f.view,'relay').click();rowOf(f.view,'fanfire').click();
  const confirm=confirmOf(f.view);
  confirm.click();confirm.click();
  tap(confirm);
  assert.deepEqual(f.calls,['fanfire']);
  assert.equal(f.view.busy,true);
  assert.equal(rowOf(f.view,'fanfire').dataset.chosen,'true');
  assert.deepEqual(f.view.root.querySelectorAll('[data-chosen=true]').map(row=>row.dataset.choice),['fanfire']);
  // A commit in flight freezes preview and exit as well.
  rowOf(f.view,'relay').click();exitOf(f.view).click();
  assert.deepEqual(pressedIds(f.view),['fanfire']);
  assert.deepEqual(f.calls,['fanfire']);
  f.view.destroy();
});

test('a disabled confirm cannot commit, even if a click event reaches it',()=>{
  const f=fixture(),confirm=confirmOf(f.view);
  confirm.click();
  confirm.dispatchEvent({type:'click',bubbles:true});
  assert.deepEqual(f.calls,[]);
  assert.equal(f.view.busy,false);
  assertNothingSelected(f.view);
  f.view.destroy();
});

test('onChoice false removes the chosen mark, clears busy and leaves the selection retryable or changeable',()=>{
  const f=fixture();f.state.accept=false;
  rowOf(f.view,'relay').click();
  confirmOf(f.view).click();
  assert.deepEqual(f.calls,['relay']);
  assert.equal(f.view.busy,false);
  assert.equal(rowOf(f.view,'relay').dataset.chosen,undefined);
  assert.deepEqual(pressedIds(f.view),['relay']);
  assert.equal(f.view.pendingChoice,'relay');
  assert.equal(confirmOf(f.view).disabled,false);
  assert.match(detailOf(f.view).textContent,/接力涂染/);
  confirmOf(f.view).click();
  assert.deepEqual(f.calls,['relay','relay']);
  rowOf(f.view,'tempo').click();
  assert.deepEqual(f.calls,['relay','relay']);
  f.state.accept=true;
  confirmOf(f.view).click();
  assert.deepEqual(f.calls,['relay','relay','tempo']);
  assert.equal(rowOf(f.view,'tempo').dataset.chosen,'true');
  assert.equal(rowOf(f.view,'relay').dataset.chosen,undefined);
  assert.equal(f.view.busy,true);
  f.view.destroy();
});

test('selection is local UI state and disappears on destroy and scene shutdown',()=>{
  const f=fixture();
  rowOf(f.view,'relay').click();
  const row=rowOf(f.view,'relay'),confirm=confirmOf(f.view);
  f.view.destroy();
  assert.equal(f.view.pendingChoice,null);
  assert.equal(f.e.document.getElementById('run-choice'),null);
  assert.equal(f.scene._publicBattleDialog,null);
  assert.equal(f.scene.input.enabled,true);
  assert.equal(f.scene.input.keyboard.enabled,true);
  row.click();confirm.click();
  assert.deepEqual(f.calls,[]);
  const reopened=f.open();
  assertNothingSelected(reopened);
  rowOf(reopened,'tempo').click();
  reopened.shutdown();
  assert.equal(reopened.pendingChoice,null);
  assert.deepEqual(f.calls,[]);
  f.assertUntouched();
});

test('each role sees its own labels, deltas, details and art in rows and the selected detail',()=>{
  const echo={sakura:{label:'回响追加',delta:'第3次有效命中后 200ms 补色',detail:/原落点/,art:'echo'},
    kai:{label:'回响回斩',delta:'每3次有效挥剑 → 延迟回斩',detail:/125范围/,art:'echo-kai',src:'art/green-windsong-20261123/weapon.png'},
    enjo:{label:'星页回响',delta:'每3次命中 → 扩散震波',detail:/150范围/,art:'echo-enjo',src:'art/blue-academy-20261123/weapon.png'}};
  const brush={sakura:/扫射覆盖/,kai:/突进轨迹/,enjo:/重锤覆盖/};
  for(const id of ROLES){
    const f=fixture(id,['relay']),row=rowOf(f.view,'echo'),expected=echo[id];
    assert.match(row.querySelector('strong').textContent,new RegExp(expected.label));
    assert.equal(row.querySelector('.battle-choice-delta').textContent,expected.delta);
    assert.match(row.querySelector('.battle-choice-limit').textContent,expected.detail);
    assert.equal(row.querySelector('.battle-choice-symbol').dataset.art,expected.art);
    if(expected.src)assert.equal(row.querySelector('.battle-choice-art').src,expected.src);
    row.click();
    const detail=detailOf(f.view);
    assert.equal(detail.querySelector('strong').textContent,expected.label);
    assert.equal(detail.querySelector('span').textContent,expected.delta);
    assert.match(detail.querySelector('small').textContent,expected.detail);
    confirmOf(f.view).click();
    assert.deepEqual(f.calls,['echo'],'the role label never replaces the canonical save ID');
    f.view.destroy();
    const first=fixture(id);
    for(const optionId of FIRST[id]){
      rowOf(first.view,optionId).click();
      const option=first.option(optionId),firstDetail=detailOf(first.view);
      assert.equal(firstDetail.querySelector('strong').textContent,option.label);
      assert.equal(firstDetail.querySelector('span').textContent,option.delta);
      assert.equal(firstDetail.querySelector('small').textContent,option.detail);
    }
    rowOf(first.view,'wide_brush').click();
    assert.match(detailOf(first.view).querySelector('small').textContent,brush[id]);
    first.view.destroy();
  }
});

test('without a build snapshot the detail uses getRunChoice copy and adds no empty condition',()=>{
  const f=fixture('enjo',['relay'],{build:false}),row=rowOf(f.view,'echo');
  assert.equal(row.querySelector('.battle-choice-limit'),null);
  row.click();
  const detail=detailOf(f.view),option=f.e.profile.getRunChoice('echo','enjo');
  assert.equal(detail.querySelector('strong').textContent,'星页回响');
  assert.equal(detail.querySelector('span').textContent,option.description);
  assert.equal(detail.querySelector('small'),null);
  confirmOf(f.view).click();
  assert.deepEqual(f.calls,['echo']);
  f.view.destroy();
});

test('art failures stay explicit, never pick for the player and leave the flow usable',()=>{
  const f=fixture(),row=rowOf(f.view,'fanfire');
  row.querySelector('img').dispatchEvent({type:'error'});
  assert.equal(row.querySelector('.battle-choice-symbol').dataset.artState,'unavailable');
  assert.match(row.textContent,/图标加载失败/);
  const ticket=f.images.find(image=>image.src===ROW_ART);
  assert.ok(ticket,'the row skin must be probed');
  assert.equal(f.view.root.dataset.choiceTicket,'pending');
  ticket.dispatchEvent({type:'error'});
  assert.equal(f.view.root.dataset.choiceTicket,'unavailable');
  const error=f.view.root.querySelector('.battle-choice-art-error');
  assert.equal(error.textContent,'编排底图加载失败');
  assert.equal(error.getAttribute('role'),'status');
  f.view.root.querySelector('.battle-choice-lettering').dispatchEvent({type:'error'});
  assert.match(f.view.root.textContent,/编排标题加载失败/);
  assertNothingSelected(f.view);
  assert.deepEqual(f.calls,[]);
  row.click();
  assert.deepEqual(f.calls,[]);
  confirmOf(f.view).click();
  assert.deepEqual(f.calls,['fanfire']);
  f.view.destroy();
});

test('a blocking session prevents preview, commit and exit until it clears',()=>{
  const f=fixture();
  f.state.blocked=true;
  rowOf(f.view,'relay').click();
  tap(rowOf(f.view,'relay'));
  assertNothingSelected(f.view);
  f.state.blocked=false;
  rowOf(f.view,'relay').click();
  f.state.blocked=true;
  rowOf(f.view,'tempo').click();
  assert.deepEqual(pressedIds(f.view),['relay'],'blocked preview keeps the prior selection');
  assert.match(detailOf(f.view).textContent,/接力涂染/);
  confirmOf(f.view).click();
  tap(confirmOf(f.view));
  exitOf(f.view).click();
  assert.deepEqual(f.calls,[]);
  assert.equal(f.view.busy,false);
  assert.equal(rowOf(f.view,'relay').dataset.chosen,undefined);
  f.state.blocked=false;
  confirmOf(f.view).click();
  assert.deepEqual(f.calls,['relay']);
  f.view.destroy();
});

test('rows and confirm both use the existing pointer gesture filter; keyboard activation still works',()=>{
  const f=fixture(),row=rowOf(f.view,'relay'),confirm=confirmOf(f.view);
  row.dispatchEvent({type:'click',detail:1,bubbles:true});
  tap(row,{moveTo:40});
  tap(row,{button:2});
  tap(row,{isPrimary:false});
  assertNothingSelected(f.view);
  tap(row);
  assert.deepEqual(pressedIds(f.view),['relay']);
  confirm.dispatchEvent({type:'click',detail:1,bubbles:true});
  tap(confirm,{moveTo:40});
  tap(confirm,{button:2});
  assert.deepEqual(f.calls,[]);
  assert.equal(f.view.busy,false);
  // detail 0 / absent: Enter or Space, which has no pointer gesture to validate.
  rowOf(f.view,'tempo').dispatchEvent({type:'click',detail:0,bubbles:true});
  assert.deepEqual(pressedIds(f.view),['tempo']);
  confirm.dispatchEvent({type:'click',detail:0,bubbles:true});
  assert.deepEqual(f.calls,['tempo']);
  f.view.destroy();
  const pointer=fixture();
  tap(rowOf(pointer.view,'tempo'));
  tap(confirmOf(pointer.view));
  assert.deepEqual(pointer.calls,['tempo']);
  pointer.view.destroy();
});

test('confirm joins the focus trap only once it is usable',()=>{
  const f=fixture(),focusable=()=>f.surface.getBattleFocusable(f.view.root);
  assert.equal(focusable().includes(confirmOf(f.view)),false);
  assert.equal(focusable().includes(exitOf(f.view)),true);
  rowOf(f.view,'relay').click();
  assert.equal(focusable().includes(confirmOf(f.view)),true);
  f.view.destroy();
});

test('exit is an icon-only named command that ends the run without committing the selection',()=>{
  const f=fixture(),exit=exitOf(f.view),footer=f.view.root.querySelector('.battle-surface-footer');
  assert.equal(exit.parentNode,footer);
  assert.equal(confirmOf(f.view).parentNode,footer);
  assert.ok(exit.classList.contains('battle-choice-exit'));
  assert.equal(exit.getAttribute('title'),'结束本次公演');
  assert.equal(exit.getAttribute('aria-label'),'结束本次公演');
  assert.equal(exit.textContent,'');
  assert.equal(exit.querySelector('span'),null);
  // BATTLE_ICONS has no log-out nodes: an unknown name would render an empty, invisible svg.
  const icon=exit.querySelector('svg');
  assert.ok(icon.children.length>0,'the icon must have drawn nodes');
  assert.equal(icon.children[0].getAttribute('d'),'m12 19-7-7 7-7');
  rowOf(f.view,'relay').click();
  exit.click();
  assert.deepEqual(f.calls,['leave']);
  assert.equal(rowOf(f.view,'relay').dataset.chosen,undefined);
  f.view.destroy();
});

test('B303 art is requested and preloaded in place of the old ticket; heading and role art stay',()=>{
  const f=fixture('kai');
  const sources=f.images.map(image=>image.src);
  assert.ok(sources.includes(ROW_ART));
  assert.ok(sources.includes(HEADING));
  assert.equal(sources.includes(OLD_TICKET),false);
  f.view.destroy();
  for(const id of ROLES){
    const paths=[];
    f.surface.preloadPublicBattleUi({textures:{exists:()=>false},load:{image(_key,path){paths.push(path);},spritesheet(){}}},{stageId:1,performerId:id});
    assert.ok(paths.includes(ROW_ART),id);
    assert.ok(paths.includes(CONFIRM_ART),id);
    assert.ok(paths.includes(HEADING),id);
    assert.equal(paths.includes(OLD_TICKET),false,id);
    if(id!=='sakura')assert.ok(paths.includes((id==='kai'?'art/green-windsong-20261123/weapon.png':'art/blue-academy-20261123/weapon.png')),id);
  }
});

test('nothing commits without a command: no timers in the choice path, no delayed fallback',async()=>{
  const source=fs.readFileSync(new URL('../src/systems/BattleSurfaceView.mjs',import.meta.url),'utf8');
  const path=source.slice(source.indexOf('  choice(o){'),source.indexOf('  result(m){'));
  assert.ok(path.length>0);
  assert.doesNotMatch(path,/setTimeout|setInterval|requestAnimationFrame|delayedCall/);
  const f=fixture('sakura',[],{planned:'relay'});
  rowOf(f.view,'tempo').click();
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.deepEqual(f.calls,[]);
  assert.equal(f.view.pendingChoice,'tempo');
  f.view.destroy();
});

test('legacy nonfamily choice stays an instant command with no B303 controls',()=>{
  for(const [id,options] of [['sakura',{castEnabled:false}],['venus',{castEnabled:true}]]){
    const f=fixture(id,[],{...options,planned:'relay'}),rows=rowsOf(f.view),exit=exitOf(f.view);
    assert.equal(f.view.root.dataset.choiceFamily,'false',id);
    assert.equal(f.view.root.dataset.choiceStudio,undefined,id);
    assert.equal(confirmOf(f.view),null,id);
    assert.equal(detailOf(f.view),null,id);
    assert.equal(f.view.root.querySelector('[aria-pressed]'),null,id);
    assert.equal(exit.textContent,'结束本次公演',id);
    assert.equal(exit.classList.contains('battle-choice-exit'),false,id);
    assert.equal(exit.getAttribute('title'),null,id);
    assert.equal(rowOf(f.view,'relay').dataset.plannedChoice,'true',id);
    f.state.accept=false;
    rows[0].click();
    assert.deepEqual(f.calls,[rows[0].dataset.choice],id);
    assert.equal(rows[0].dataset.chosen,undefined,id);
    assert.equal(f.view.busy,false,id);
    f.state.accept=true;
    rows[1].click();rows[2].click();
    assert.deepEqual(f.calls,[rows[0].dataset.choice,rows[1].dataset.choice],id);
    assert.equal(rows[1].dataset.chosen,'true',id);
    f.view.destroy();
  }
});
