import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createDocument,loadScenes} from './helpers/publicShellHarness.mjs';
import {configureUserCast,getActiveUserCastArt} from '../src/utils/userCast.mjs';
import {getMenuAvatarArt,mountMenuAvatar} from '../src/systems/MenuPortraitAvatar.mjs';
import {mountHomePortrait} from '../src/systems/HomePortraitPresentation.mjs';
import {getMenuPortraitArt} from '../src/systems/MenuPortraitPresentation.mjs';

const members = [
  {id:'sakura',folder:'red-valkyrie-20261123',width:1070,height:1470},
  {id:'kai',folder:'green-windsong-20261123',width:1086,height:1448},
  {id:'enjo',folder:'blue-academy-20261123',width:1085,height:1450},
];
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function pendingImage(node,hasDecoder) {
  let resolve,reject,calls=0;
  const pending=new Promise((yes,no)=>{resolve=yes;reject=no;});
  if(hasDecoder)node.decode=()=>{calls++;return pending;};
  return {node,resolve,reject,get calls(){return calls;}};
}
function load(image,width,height) {
  image.naturalWidth=width;image.naturalHeight=height;image.dispatchEvent({type:'load'});
}
function bodyFixture(member,{cached=false,hasDecoder=true}={}) {
  configureUserCast(true);
  const doc=createDocument(),parent=doc.createElement('span'),node=doc.createElement('img');
  doc.body.append(parent);parent.append(node);
  const view={doc},image=pendingImage(node,hasDecoder);
  if(cached){node.complete=true;node.naturalWidth=member.width;node.naturalHeight=member.height;}
  const dispose=mountHomePortrait(view,parent,member.id,node);
  return {doc,parent,view,image,dispose};
}

test('three official full portraits and their square avatar sources match their native PNG dimensions',()=>{
  configureUserCast(true);
  for(const member of members){
    const art=getActiveUserCastArt(member.id),avatar=getMenuAvatarArt(member.id);
    assert(Object.isFrozen(art)&&Object.isFrozen(avatar));
    const entries=[
      [art.portrait,'portrait.png',art.width,art.height,member.width,member.height],
      [avatar.src,'avatar.png',avatar.naturalWidth,avatar.naturalHeight,1254,1254],
    ];
    for(const [file,name,width,height,expectedWidth,expectedHeight] of entries){
      assert.equal(file,'art/'+member.folder+'/'+name);
      const bytes=fs.readFileSync(new URL('../public/'+file,import.meta.url));
      assert.equal(bytes.readUInt32BE(12),0x49484452,'PNG header');
      assert.deepEqual([width,height,bytes.readUInt32BE(16),bytes.readUInt32BE(20)],
        [expectedWidth,expectedHeight,expectedWidth,expectedHeight]);
    }
  }
  for(const id of ['bogus',null,'toString'])assert.equal(getMenuAvatarArt(id),null);
  assert.equal(getMenuPortraitArt('sakura'),null,'the historical two-candidate registry is separate');
  assert.equal(getMenuPortraitArt('kai').src,'portraits/kai-287/source.png');
  assert.equal(getMenuPortraitArt('enjo').src,'portraits/enjo-286/source.png');
});

test('all three full portraits stay hidden until one successful decode, including cached bodies',async()=>{
  for(const member of members)for(const cached of [false,true]){
    const {image,parent,dispose}=bodyFixture(member,{cached});
    assert.equal(parent.dataset.portraitState,'loading');assert(image.node.hidden);
    load(image.node,member.width,member.height);load(image.node,member.width,member.height);
    assert.equal(image.calls,1);assert(image.node.hidden);
    image.resolve();await tick();
    assert.equal(parent.dataset.portraitState,'static');assert.equal(image.node.hidden,false);
    dispose();assert.equal(parent.dataset.portraitState,undefined);
  }
});

test('thumbnail errors retry the official full avatar; only a valid decoded fallback becomes visible',async()=>{
  for(const member of members)for(const mode of ['decode','wrong-size','network']){
    const doc=createDocument(),parent=doc.createElement('span'),fallback=doc.createElement('img');
    doc.body.append(parent);parent.append(fallback);
    const view={doc,root:parent,element(tag,cls,text,host){const node=doc.createElement(tag);node.className=cls;host.append(node);return node;}};
    const avatar=mountMenuAvatar(view,parent,member.id,fallback);
    assert.equal(avatar.srcset,'art/setdesign/avatar-'+member.id+'.webp 1x');assert(avatar.hidden);
    const compact=pendingImage(avatar,true);
    if(mode==='network')avatar.dispatchEvent({type:'error'});
    else if(mode==='wrong-size')load(avatar,160,160);
    else{load(avatar,180,180);assert.equal(compact.calls,1);compact.reject(new DOMException('bad thumbnail','EncodingError'));await tick();}
    assert.equal(avatar.src,'art/'+member.folder+'/avatar.png');
    assert.equal(parent.dataset.avatarState,'loading');assert(avatar.hidden);
    const original=pendingImage(avatar,true);
    load(avatar,1254,1254);assert.equal(original.calls,1);assert(avatar.hidden);
    original.resolve();await tick();assert.equal(parent.dataset.avatarState,'ready');assert.equal(avatar.hidden,false);assert(fallback.hidden);
  }
});

test('a pending body decode cannot revive an invalid, detached, disposed or shut down portrait',async()=>{
  const member=members[1];
  for(const mode of ['network','wrong-size','decode','move','dispose','shutdown']){
    const {doc,parent,view,image,dispose}=bodyFixture(member);
    if(mode==='wrong-size')load(image.node,100,100);
    else load(image.node,member.width,member.height);
    if(mode==='network')image.node.dispatchEvent({type:'error'});
    if(mode==='decode')image.reject(new DOMException('bad portrait','EncodingError'));
    if(mode==='move')doc.body.append(image.node);
    if(mode==='dispose')dispose();
    if(mode==='shutdown')view.disposed=true;
    if(mode!=='decode')image.resolve();
    await tick();
    if(['network','wrong-size','decode'].includes(mode))assert.equal(parent.dataset.portraitState,'unavailable',mode);
    assert.notEqual(parent.dataset.portraitState,'static',mode);assert(image.node.hidden,mode);
    dispose();
  }
});

test('without an image decoder only the exact-size loaded official full portrait is shown',async()=>{
  for(const member of members)for(const valid of [true,false]){
    const {parent,image,dispose}=bodyFixture(member,{hasDecoder:false});
    assert(image.node.hidden);load(image.node,valid?member.width:128,valid?member.height:128);await tick();
    assert.equal(parent.dataset.portraitState,valid?'static':'unavailable');
    assert.equal(image.node.hidden,!valid);dispose();
  }
});

test('home and roster use the selected full portrait, while the real picker uses three compact sources',()=>{
  for(const member of members){
    const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
    e.profile.selectPublicPerformer(member.id);
    const desk=e.harness(e.TitleScene);desk.scene.create();
    const src='art/'+member.folder+'/portrait.png';
    assert.equal(desk.query('.ui-home-portrait').querySelector('.member-portrait').src,src);
    desk.click('[data-nav=roster]');
    const [scene,parameters]=desk.starts.at(-1);assert.equal(scene,'IdolRosterScene');desk.shutdown();
    const h=e.harness(e.IdolRosterScene,parameters);h.scene.create();
    assert.equal(h.query('.roster-portrait-stage').querySelector('.member-portrait').src,src);
    const switcher=h.click('[data-action=actor-switch]'), dialog=h.query('dialog');
    for(const candidate of members){
      const button=dialog.querySelector('[data-member='+candidate.id+']'),icon=button.querySelector('img');
      assert(!button.disabled&&button.getAttribute('aria-label'));
      assert.equal(icon.src,'art/'+candidate.folder+'/avatar.png');
      assert.equal(icon.srcset,'art/setdesign/avatar-'+candidate.id+'.webp 1x');
    }
    h.click('[data-action=sheet-close]');assert.equal(e.document.activeElement,switcher);
    const art=h.query('.roster-portrait-stage').querySelector('.member-portrait');
    h.shutdown();art.dispatchEvent({type:'load'});assert.equal(art.parentNode.dataset.portraitState,undefined);
  }
});
