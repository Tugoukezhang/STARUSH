import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function setup(member='sakura',chapter='opening',owner=true) {
  const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(owner);
  e.seed(['opening','neon'],chapter);e.profile.selectPublicPerformer(member);
  const h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('preflight');
  return {e,h,v:h.scene._publicShell};
}

test('stage identity uses exact helper portraits and separate native performer rank and equipment labels',()=>{
  for(const member of ['sakura','kai','enjo'])for(const chapter of ['opening','neon','encore']){
    const {e,h}=setup(member,chapter),model=e.loadRuntime('systems/PublicShellView.mjs').getPublicShellModel();
    assert.equal(h.query('.preflight-performer-name')?.textContent,model.member.name);
    assert.equal(h.query('.preflight-performer-action')?.textContent,model.member.actionName);
    assert.equal(h.query('.preflight-loadout-rank')?.textContent,'阶位 '+model.preparation.trainingLevel);
    assert(h.query('.preflight-loadout-equipment'));
    assert(h.query('.preflight-portrait-stage').querySelector(member==='sakura'?'.home-portrait-rig':'.menu-portrait-image'));
    assert(h.query('.preflight-scene').querySelector('.chapter-venue-art'));
    h.shutdown();
  }
});

test('secondary tools and the only start command are native icon plus label without bitmap control skin',()=>{
  const {h}=setup();
  for(const button of [...h.query('.preflight-tools').querySelectorAll('button'),h.query('[data-action=start]')]){
    assert(button.querySelector('svg'),'native line icon missing: '+button.getAttribute('aria-label'));
    assert.equal(button.querySelector('.menu-art'),null);
    assert(button.querySelector('span').textContent);assert.equal(button.tagName,'BUTTON');
  }
  assert.equal(h.all('[data-action=start]').length,1);h.shutdown();
});

test('route and disclosures stay session only and start hands off real selected route and arrangement',()=>{
  const {e,h,v}=setup(),saved=e.storage.getItem('starush.public-profile');
  v.arrangementPlan=e.loadRuntime('utils/publicArrangementPlan.mjs').createArrangementPlan(['wide_brush','echo'],{stageId:1,performerId:'sakura',campaignChapterId:'opening'});v.render();
  const plan=JSON.stringify(v.arrangementPlan);
  for(const id of ['west','east','auto','east']){
    h.click('[data-route-choice='+id+']');
    assert.equal(h.all('[data-route-choice]').filter(b=>b.getAttribute('aria-pressed')==='true').length,1);
    assert.equal(e.document.activeElement,h.query('[data-route-choice='+id+']'));
    assert.equal(e.storage.getItem('starush.public-profile'),saved);
    assert.equal(JSON.stringify(v.arrangementPlan),plan);
  }
  assert(h.query('[data-preflight-section=build]').textContent.includes('行动涂染加成'));
  assert(h.query('[data-preflight-section=guide]'));assert(h.query('[data-arrangement-plan]'));
  h.click('[data-action=start]');assert.equal(h.starts.at(-1)[1].publicRoutePlan.id,'east');
  assert.deepEqual([...h.starts.at(-1)[1].publicArrangementPlan.choices],['wide_brush','echo']);h.shutdown();
});

test('all six secondary tools preserve real destinations and legacy remains unchanged',()=>{
  for(const [action,page] of [['member','roster'],['training','workshop'],['inventory','inventory'],['chapter','tour'],['goals','goals'],['library','library']]){
    const {e,h}=setup(),saved=e.storage.getItem('starush.public-profile');h.click('[data-action=preflight-'+action+']');
    assert.equal(h.root.dataset.page,page);assert.equal(e.storage.getItem('starush.public-profile'),saved);h.shutdown();
  }
  const {h}=setup('sakura','opening',false);assert.equal(h.query('.preflight-performer-name'),null);
  assert.equal(h.query('.preflight-route'),null);assert(h.query('[data-action=start]'));h.shutdown();
});

test('last-loaded stylesheet is strictly owner preflight scoped with stable responsive accessible controls',()=>{
  const url=new URL('../src/styles/preflightStageV2.css',import.meta.url);
  assert(fs.existsSync(url),'preflight stage stylesheet must exist');
  const css=fs.readFileSync(url,'utf8');
  const selectors=[...css.matchAll(/([^{}]+)\{/g)].map(m=>m[1].replace(/\/\*[\s\S]*?\*\//g,'').trim()).filter(s=>s&&!s.startsWith('@'));
  for(const selector of selectors){assert(selector.includes('[data-cast=owner-three]'));assert(selector.includes('[data-page=preflight]'));}
  assert.match(css,/object-fit:contain/);assert.match(css,/aspect-ratio:1152\s*\/\s*1664/);
  assert.match(css,/@media \(max-width:340px\)/);assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/:focus-visible/);assert.match(css,/flex-shrink:0/);assert.match(css,/border-image:none/);
  assert.doesNotMatch(css,/url\(|font-size:[^;]*vw|letter-spacing:\s*-/);
});
