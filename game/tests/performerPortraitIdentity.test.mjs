import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getPerformerArt, performerPortraitCss} from '../src/systems/ActorPresentation.mjs';
import {PublicShellView} from '../src/systems/PublicShellView.mjs';
import {getUiPerformerArt} from '../src/systems/UiPerformerArt.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import {STAGE1_PUBLIC_CAST} from '../src/utils/stage1PaintRound.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

const ids = ['sakura','venus','genya','kai','enjo'];
const base = 'art/performer-portraits-20260925/';
const portraitFile=(id,kind)=>id==='sakura'?`art/sakura-native-20261004/${kind}.webp`:`${base}${id}-${kind}.webp`;
test('all five have distinct matching portrait/avatar pairs without changing battle sheets',()=>{
  for(const id of ids) {
    const art = getPerformerArt(id);
    assert.equal(art.fullPortrait, portraitFile(id,'portrait'), `${id} needs a real roster illustration`);
    assert.equal(art.portrait, portraitFile(id,'avatar'));
    assert.equal(performerPortraitCss(id,'https://example.com/game/'), `url("https://example.com/game/${portraitFile(id,'avatar')}")`);
    assert.ok(!art.path.includes('portraits-'), 'a roster image must never replace a battle sheet');
    if(id!=='sakura') { assert.equal(art.path,`art/performer-motion-20260922/${id}-walk.webp`);assert.equal(art.frameCount,48); }
  }
  assert.equal(getPerformerArt('unknown'),null);
  assert.equal(performerPortraitCss('unknown','https://example.com'),'none');
});

test('roster uses each approved stage body while the desk keeps its compact avatar',()=>{
  const view = {element(tag,className,text,parent){
    const node={tag,className,text,children:[],dataset:{},attributes:{},style:{setProperty(){}},setAttribute(k,v){this.attributes[k]=v;}};
    parent?.children.push(node);return node;
  }};
  const classes=[];
  for(const id of ids) {
    const member={id,identityMark:'X',colorHex:0x123456};
    const large=PublicShellView.prototype.mark.call(view,null,member,true);
    assert.match(large.className,/member-mark-full/);classes.push(large.className);
    const image=id==='sakura'||id==='venus'||id==='genya'||id==='kai'||id==='enjo'?large.children[0]:large.children[0].children[0];
    assert.equal(large.text,undefined);assert.equal(image.src,getUiPerformerArt(id).portrait);
    assert.equal(image.width,232);assert.equal(image.height,290);
    const small=PublicShellView.prototype.mark.call(view,null,member);
    assert.equal(small.children[0].src,getUiPerformerArt(id).avatar);
    assert.equal(small.children[0].width,128);assert.equal(small.children[0].height,128);
  }
  assert.equal(new Set(classes).size,1);
});

test('exactly ten reviewed exports ship; low-resolution portrait sources no longer ship',()=>{
  const rows=RUNTIME_PAYLOAD.filter(row=>row.file.startsWith(base)||/^art\/sakura-native-20261004\/(avatar|portrait)\.webp$/.test(row.file));
  assert.equal(rows.length,10);
  let bytes=0;
  for(const row of rows){
    const buffer=fs.readFileSync(new URL('../public/'+row.file,import.meta.url));
    assert.equal(buffer.toString('ascii',0,4),'RIFF');assert.equal(buffer.toString('ascii',8,12),'WEBP');
    bytes+=buffer.length;
  }
  assert.ok(bytes<400_000,'five portrait/avatar pairs fit a bounded mobile budget');
  assert.ok(!RUNTIME_PAYLOAD.some(row=>/performer-motion-20260922\/.*-portrait|sakura-redesign-20260913\/avatar/.test(row.file)));
  assert.equal(STAGE1_PUBLIC_CAST[0].avatar,getPerformerArt('sakura').portrait);
  assert.equal(STAGE1_PUBLIC_CAST[0].cutin,'art/sakura-redesign-20260913/portrait.webp',
    'opaque roster illustrations must not replace the existing transparent battle cut-in');
  assert.ok(RUNTIME_PAYLOAD.some(row=>row.file===STAGE1_PUBLIC_CAST[0].cutin));
});

test('victory and failure results keep the actual performer portrait, never Sakura-only',()=>{
  const env=loadScenes();
  const {BattleSurfaceView,getPublicResultSurfaceModel}=env.loadRuntime('systems/BattleSurfaceView.mjs');
  for(const id of ids) for(const victory of [false,true]) {
    const scene={input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},
      player:{body:{setVelocity(){}}},events:{once(){},off(){}},sound:null};
    const model=getPublicResultSurfaceModel({buttons:[{label:'Retry',action:'retry'}]},
      {performerId:id,chapterId:'opening',victory,durationMs:1000,choices:[],persisted:true,recorded:true});
    const view=new BattleSurfaceView(scene,{mode:'result',model,onAction(){}},env.document);
    const mark=view.root.querySelector('.battle-member-mark');
    assert.match(mark.className,/has-portrait/,`${id} ${victory?'victory':'failure'} needs the actual member avatar`);
    assert.equal(mark.querySelector('img').src,getUiPerformerArt(id).avatar);
    view.destroy();assert.equal(env.document.getElementById('battle-result'),null);
  }
});
