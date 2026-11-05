import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {PUBLIC_EQUIPMENT} from '../src/utils/publicPreparation.mjs';
import {shellIcons} from '../src/vendor/shellIcons.mjs';

const ids=PUBLIC_EQUIPMENT.map(item=>item.id);
const raw=e=>e.storage.getItem('starush.public-profile');
function setup({owner=true,cleared=['opening','neon','encore'],allOwned=false}={}) {
  const e=loadScenes();
  e.loadRuntime('utils/userCast.mjs').configureUserCast(owner);
  e.seed(cleared);
  if(allOwned)for(const performerId of ['kai','enjo'])
    e.profile.recordPublicRun({runId:'studio-fixture-'+performerId,chapterId:'opening',performerId,victory:true});
  const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'inventory'});
  h.scene.create();
  return {e,h,v:h.scene._publicShell};
}
function officialIcon(node,name) {
  assert.ok(node,'native icon exists');
  assert.equal(node.tagName,'SVG');
  assert.equal(node.getAttribute('aria-hidden'),'true');
  assert.deepEqual(node.children.map(child=>[
    child.tagName.toLowerCase(),
    Object.fromEntries(Object.keys(shellIcons[name][node.children.indexOf(child)][1]).map(key=>[key,child.getAttribute(key)])),
  ]),shellIcons[name]);
}

test('showcase layout is enabled only for the current owner inventory',()=>{
  for(const owner of [true,false]) {
    const {h}=setup({owner});
    try{assert.equal(h.root.dataset.inventoryLayout,owner?'showcase':undefined);}
    finally{h.shutdown();}
  }
});

for(const fixture of [
  {cleared:[],count:0},
  {cleared:['opening'],count:2},
  {allOwned:true,count:6},
])test('native directory reports real owned count '+fixture.count+' of six, not the selected preview',()=>{
  const {e,h}=setup(fixture),before=raw(e);
  let writes=0;const set=e.storage.setItem;
  e.storage.setItem=(...args)=>{writes++;return set(...args);};
  try {
    for(const id of ids) {
      h.click('[data-inventory-item='+id+']');
      const summary=h.query('[data-action=inventory-chooser]');
      assert.equal(summary.tagName,'SUMMARY');
      assert.equal(summary.querySelector('.inventory-chooser-title')?.textContent,'配件目录');
      assert.equal(summary.querySelector('.inventory-chooser-count')?.textContent,'已拥有 '+fixture.count+' / 6');
      assert.equal(summary.querySelector('img'),null);
      officialIcon(summary.querySelector('.equipment-art-slot').querySelector('svg'),'backpack');
      officialIcon(summary.children.at(-1),'arrow-right');
      assert.deepEqual(h.all('[data-inventory-item]').map(button=>button.dataset.inventoryItem),ids);
    }
    assert.equal(raw(e),before);
    assert.equal(writes,0);
  } finally{h.shutdown();}
});

test('native directory toggle survives preview rerenders and ignores detached/disposed toggle events',()=>{
  const {e,h,v}=setup(),before=raw(e);
  try {
    const old=h.query('.inventory-chooser');
    assert.equal(old.open,true);
    old.open=false;old.dispatchEvent({type:'toggle'});
    h.click('[data-inventory-item=rhythm_sync]');
    assert.equal(h.query('.inventory-chooser').open,false);
    old.open=true;old.dispatchEvent({type:'toggle'});
    assert.equal(v.inventoryChooserOpen,false);
    const current=h.query('.inventory-chooser');
    current.open=true;current.dispatchEvent({type:'toggle'});
    h.click('[data-inventory-item=focus_lens]');
    assert.equal(h.query('.inventory-chooser').open,true);
    assert.equal(raw(e),before);
    h.shutdown();
    current.open=false;current.dispatchEvent({type:'toggle'});
    assert.equal(v.inventoryChooserOpen,true);
  } finally{h.shutdown();}
});

test('all three members and six previews retain canonical native identity, role, effects and no-write behavior',()=>{
  const {e,h}=setup({allOwned:true}),before=raw(e);
  let writes=0;const set=e.storage.setItem;
  e.storage.setItem=(...args)=>{writes++;return set(...args);};
  const inventory=e.loadRuntime('utils/publicEquipmentInventory.mjs');
  const build=e.loadRuntime('utils/publicBuildContent.mjs');
  const effectIcons={'涂染半径加成':'settings-2','事件行动充能':'clapperboard','主动涂染倍率':'play'};
  try {
    for(const member of ['sakura','kai','enjo']) {
      h.click('[data-member='+member+']');
      const model=inventory.getPublicEquipmentInventory(e.profile.loadPublicProfile(),member);
      for(const item of model.items) {
        h.click('[data-inventory-item='+item.id+']');
        const detail=h.query('.inventory-detail'),copy=h.query('.inventory-selection-copy');
        assert.equal(detail.dataset.item,item.id);
        assert.equal(detail.dataset.state,item.state);
        assert.equal(detail.dataset.compatible,String(item.compatible));
        assert.equal(copy.querySelector('.inventory-selection-name')?.textContent,item.name);
        assert.equal(copy.querySelector('.inventory-selection-name').tagName,'H2');
        assert.equal(copy.querySelector('.inventory-selection-status')?.textContent,'已拥有');
        assert.equal(copy.querySelector('.inventory-role').textContent,item.performerId?item.ownerName+'专用':'通用配件');
        assert.equal(copy.querySelector('img'),null);
        assert.ok(h.query('.inventory-object-stage').querySelector('.equipment-art').src.endsWith('/'+item.id+'.png'));
        assert.equal(h.query('[data-inventory-item='+item.id+']').querySelector('.inventory-item-name').textContent,item.name);
        assert.equal(h.query('[data-inventory-item='+item.id+']').querySelector('.inventory-item-state').textContent,'已拥有');
        const candidate=build.getPublicBuildModel({...model.preparation,equipmentId:item.id},member);
        const effects=h.query('.inventory-effects');
        if(!candidate){assert.equal(effects,null);continue;}
        assert.equal(effects.children.length,3);
        for(const [index,row] of candidate.rows.entries()) {
          const entry=effects.children[index];
          assert.ok(entry.classList.contains('inventory-effect-row'));
          assert.equal(entry.dataset.effectIndex,String(index));
          assert.equal(entry.querySelector('.inventory-effect-label').textContent,row.label);
          assert.equal(entry.querySelector('.inventory-effect-value').textContent,row.value);
          officialIcon(entry.querySelector('.inventory-effect-icon'),effectIcons[row.label]);
          assert.equal(entry.querySelector('img'),null);
        }
      }
    }
    assert.equal(raw(e),before);
    assert.equal(e.profile.loadPublicProfile().selectedId,'sakura');
    assert.equal(writes,0);
  } finally{h.shutdown();}
});

test('locked, owned, equipped and incompatible remain distinct in availability and existing equip policy',()=>{
  const {e,h,v}=setup({cleared:['opening']});
  const inventory=e.loadRuntime('utils/publicEquipmentInventory.mjs');
  try {
    const before=raw(e);
    for(const id of ids) {
      h.click('[data-inventory-item='+id+']');
      const item=inventory.getPublicEquipmentInventory(e.profile.loadPublicProfile(),'sakura').items.find(row=>row.id===id);
      assert.equal(h.query('.inventory-detail').dataset.state,item.state);
      assert.equal(h.query('.inventory-detail').dataset.compatible,String(item.compatible));
      assert.equal(h.query('[data-action=equip-selected]').disabled,!item.canEquip);
      assert.equal(h.query('[data-action=inventory-catalog]').disabled,!item.compatible);
      assert.equal(h.query('.inventory-availability')?.textContent,item.owned?'已拥有 · 可装备':item.unlock);
      assert.equal(h.query('.inventory-selection-status').textContent,item.owned?'已拥有':'未解锁');
    }
    assert.equal(raw(e),before);
    h.click('[data-inventory-item=wide_nozzle]');
    h.click('[data-action=equip-selected]');
    assert.equal(h.query('.inventory-detail').dataset.state,'equipped');
    assert.equal(h.query('.inventory-selection-status').textContent,'已装备');
    assert.equal(h.query('.inventory-availability').textContent,'已拥有 · 本成员已装备');
    assert.equal(h.query('[data-inventory-item=wide_nozzle]').dataset.state,'owned');
    assert.equal(h.query('[data-inventory-item=wide_nozzle]').dataset.equipped,'true');
    h.click('[data-action=equip-selected]');
    assert.equal(e.profile.loadPublicProfile().preparation.equipmentByPerformer.sakura,null);
    e.profile.recordPublicRun({runId:'studio-owned-incompatible',chapterId:'opening',performerId:'kai',victory:true});
    v.render();
    h.click('[data-inventory-item=return_edge]');
    assert.equal(h.query('.inventory-detail').dataset.state,'owned');
    assert.equal(h.query('.inventory-detail').dataset.compatible,'false');
    assert.equal(h.query('.inventory-selection-status').textContent,'已拥有');
    assert.equal(h.query('.inventory-availability').textContent,'已拥有 · 请切换至机甲剑士');
    assert.equal(h.query('[data-action=equip-selected]').disabled,true);
    assert.match(h.query('.inventory-status').textContent,/请切换至机甲剑士/);
  } finally{h.shutdown();}
});

test('owner equip and catalog commands use existing native line icons with real accessible labels',()=>{
  const {h}=setup();
  try {
    for(const [action,icon,label] of [
      ['inventory-catalog','book-open','配件对比与获取途径'],
      ['equip-selected','check','装备给步枪手'],
    ]) {
      const button=h.query('[data-action='+action+']');
      assert.equal(button.getAttribute('aria-label'),label);
      assert.equal(button.querySelector('span').textContent,label);
      officialIcon(button.querySelector('svg'),icon);
      assert.equal(button.querySelector('img'),null);
    }
  } finally{h.shutdown();}
});

test('comparison/back and prepared navigation preserve the selected item and saved loadout',()=>{
  const {e,h,v}=setup();
  try {
    h.click('[data-action=equip-selected]');
    const saved=raw(e);
    h.click('[data-inventory-item=rhythm_sync]');
    h.click('[data-action=inventory-catalog]');
    assert.equal(v.page,'growth');
    assert.equal(v.growthContext,'sakura');
    assert.equal(v.growthEquipmentId,'rhythm_sync');
    assert.equal(v.growthExpected.equipmentId,'wide_nozzle');
    assert.equal(raw(e),saved);
    h.click('[data-action=back]');
    assert.equal(v.page,'inventory');
    assert.equal(h.query('.inventory-detail').dataset.item,'rhythm_sync');
    assert.equal(h.query('.inventory-loadout').dataset.equipment,'wide_nozzle');
    h.click('[data-action=prepared-preflight]');
    assert.equal(v.page,'preflight');
    assert.equal(raw(e),saved);
    h.click('[data-action=back]');
    assert.equal(h.starts.at(-1)[0],'TourRouteScene');
    assert.equal(v.inventoryId,'rhythm_sync');
    assert.equal(raw(e),saved);
  } finally{h.shutdown();}
});

function snapshot(node) {
  return {tag:node.tagName,class:node.className,id:node.id,data:node.dataset,
    text:node.children.length?null:node.textContent,disabled:node.disabled,
    open:node.open??null,title:node.title??null,src:node.src??null,
    aria:['aria-label','aria-pressed','aria-controls','aria-describedby','aria-live','role'].map(key=>[key,node.getAttribute(key)]),
    children:node.children.map(snapshot)};
}
test('legacy five-member six-item DOM stays identical to the pre-B241 markup baseline',()=>{
  const {e,h}=setup({owner:false}),before=raw(e),rows=[];
  try {
    for(const member of ['sakura','kai','venus','genya','enjo']) {
      h.click('[data-member='+member+']');
      for(const id of ids) {
        h.click('[data-inventory-item='+id+']');
        rows.push(snapshot(h.root));
      }
    }
    assert.equal(createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
      'f7328a3ab6540daefbd4241b86681447e5aef256e3e463608bc804a240b8d7e9');
    assert.equal(raw(e),before);
  } finally{h.shutdown();}
});
