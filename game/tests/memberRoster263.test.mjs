import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';

const performers=[
  {id:'sakura',name:'战术女武神',art:'red-valkyrie-20261123'},
  {id:'kai',name:'翡翠风歌',art:'green-windsong-20261123'},
  {id:'enjo',name:'蔚蓝魔法师',art:'blue-academy-20261123'},
];
function ownerSession(){
  const e=loadScenes();
  e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  e.seed([]);
  return e;
}

test('growth member picker shows each confirmed name and thumbnail, and previews without saving',()=>{
  const e=ownerSession();
  const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'growth'});
  h.scene.create();
  const profile=e.storage.getItem('starush.public-profile');
  for(const chosen of performers){
    h.click('[data-action=actor-switch]');
    const dialog=h.query('dialog');
    const buttons=dialog.querySelectorAll('[data-growth-member]');
    assert.deepEqual(buttons.map(button=>button.dataset.growthMember),performers.map(p=>p.id));
    for(const [i,button] of buttons.entries()){
      const performer=performers[i],avatar=button.querySelector('img');
      assert.equal(button.querySelector('.ui-actor-name').textContent,performer.name);
      assert.equal(avatar.srcset,'art/setdesign/avatar-'+performer.id+'.webp 1x');
      assert.equal(avatar.src,'art/'+performer.art+'/avatar.png');
    }
    buttons.find(button=>button.dataset.growthMember===chosen.id).click();
    assert.equal(h.query('dialog'),null);
    assert.equal(h.scene._publicShell.selection.memberId,chosen.id);
    assert.equal(e.storage.getItem('starush.public-profile'),profile);
  }
  h.shutdown();
});

test('roster ability shows the confirmed weapon and training opens for the previewed member without changing the deployed member',()=>{
  for(const performer of performers){
    const e=ownerSession(),h=e.harness(e.IdolRosterScene);
    h.scene.create();
    const profile=e.storage.getItem('starush.public-profile');
    h.click('[data-action=actor-switch]');
    h.click('[data-member='+performer.id+']');
    assert.equal(h.query('.shell-content').dataset.memberStudio,'roster');
    h.click('[data-action=roster-reference]');
    const directory=h.query('dialog');
    const ability=directory.querySelector('[data-action=roster-sheet-ability]');
    assert.equal(ability.querySelector('.ui-glyph').src,'art/'+performer.art+'/weapon.png');
    ability.click();
    assert.equal(h.query('dialog').dataset.member,performer.id);
    h.click('[data-action=sheet-close]');
    const training=h.query('[data-action=roster-sheet-preparation]');
    assert.equal(training.dataset.uiIcon,'train');
    assert.equal(training.getAttribute('aria-label'),'成员训练与配件');
    training.click();
    assert.equal(h.root.dataset.page,'workshop');
    assert.equal(h.scene._publicShell.selection.memberId,performer.id);
    assert.equal(e.storage.getItem('starush.public-profile'),profile);
    h.shutdown();
  }
});
