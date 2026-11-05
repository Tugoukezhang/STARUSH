import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {preloadSakuraRefined,preloadSakuraOblique,SAKURA_REFINED_ART,SAKURA_OBLIQUE_ART} from '../src/systems/SakuraRefinedPresentation.mjs';
const ImageFile=createRequire(import.meta.url)('phaser/src/loader/filetypes/ImageFile.js');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const id='first-visit-preview-preload';
const script=html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`))?.[1];
const paths=['sakura-refined-20261006','sakura-oblique-20261006'].flatMap(bank=>['parts.webp','views.json'].map(file=>`art/${bank}/${file}`));
function execute({profile=null,search='',saveData=false,storageThrows=false,appendThrows=false,page='desk',ready=true,cancel=false,broken=false}={}){
 const links=[],reads=[],writes=[];
 const window={};const context={window,URLSearchParams,location:{search},navigator:{connection:{saveData}},
  localStorage:{getItem(key){reads.push(key);if(storageThrows)throw Error('blocked');return profile;},setItem(...v){writes.push(v);}},
  document:{createElement(tag){assert.equal(tag,'link');return {};},head:{append(link){if(appendThrows)throw Error('blocked DOM');links.push(link);}}}};
 assert.doesNotThrow(()=>vm.runInNewContext(script,context));assert.deepEqual(writes,[]);
 assert.deepEqual(links,[],'never compete with the initial module and first shell');
 const listeners=new Map(),images=[{complete:false,naturalWidth:0},{complete:false,naturalWidth:0}];
 const root={isConnected:true,dataset:{page},querySelector(selector){assert.equal(selector,'[data-action="start"]');return ready?{}:null;},
  querySelectorAll(selector){assert.equal(selector,'img');return images;},addEventListener(type,callback,capture){assert.equal(capture,true);listeners.set(type,callback);},
  removeEventListener(type,callback,capture){assert.equal(capture,true);if(listeners.get(type)===callback)listeners.delete(type);}};
 let dispose;assert.doesNotThrow(()=>{dispose=window.starushFirstBattlePreload?.(root);});
 assert.deepEqual(links,[],'do not delay visible desk images to speed up the battle');
 assert.doesNotThrow(()=>window.starushFirstBattlePreload?.(root));
 if(cancel){dispose?.();root.isConnected=false;}
 for(const image of images){image.complete=true;image.naturalWidth=broken?0:10;listeners.get(broken?'error':'load')?.();}
 assert.equal(listeners.size,0,'no waiting callbacks survive completion or shutdown');
 assert.deepEqual(writes,[]);
 return {links,reads};
}
test('first visit waits for the real desk before hinting only its complete Sakura banks',()=>{
 assert.ok(script,'missing first-visit preview preload bootstrap');
 assert.ok(html.indexOf(`id="${id}"`)<html.indexOf('type="module"'));
 const result=execute();assert.deepEqual(result.links.map(l=>l.href),paths);
 for(const link of result.links){const image=link.href.endsWith('.webp');assert.equal(link.rel,'preload');assert.equal(link.as,image?'image':'fetch');assert.equal(link.crossOrigin,image?undefined:'anonymous');assert.equal(link.fetchPriority,'low');}
 assert.deepEqual(result.reads,['starush.public-profile','starush.public-profile']);
 for(const file of paths)assert.ok(fs.existsSync(new URL('../public/'+file,import.meta.url)));
 const actor=fs.readFileSync(new URL('../src/systems/SakuraRefinedPresentation.mjs',import.meta.url),'utf8');
 for(const path of paths)assert.ok(actor.includes(`'${path}'`));
 const title=fs.readFileSync(new URL('../src/scenes/TitleScene.js',import.meta.url),'utf8');
 const hook=title.indexOf('starushFirstBattlePreload?.(this._publicShell.root)');
 assert.ok(hook>title.indexOf('this._publicShell = new PublicShellView'));
 assert.ok(hook<title.indexOf("this.events.once('shutdown'"));
});
test('build tag is allowed but every route/experiment query suppresses speculation',()=>{
 assert.equal(execute({search:'?build=sample'}).links.length,4);
 for(const search of ['?debug=','?p88Stage15Practice=1','?sakuraTrial=1','?performerId=kai','?build=x&debug=','?unknown='])assert.equal(execute({search}).links.length,0,search);
});
test('existing, malformed and inaccessible saves never trigger default scene downloads',()=>{
 for(const profile of ['', '{}', 'invalid', '{"selectedId":"kai"}'])assert.equal(execute({profile}).links.length,0);
 assert.equal(execute({storageThrows:true}).links.length,0);
 assert.equal(execute({saveData:true}).links.length,0);
 assert.doesNotThrow(()=>execute({appendThrows:true}));
 assert.equal(execute({page:'workshop'}).links.length,0);
 assert.equal(execute({ready:false}).links.length,0);
 assert.equal(execute({cancel:true}).links.length,0);
 assert.equal(execute({broken:true}).links.length,0);
 assert.ok(html.includes("root.removeEventListener('load', check, true)"));
 assert.ok(html.includes("root.removeEventListener('error', check, true)"));
 const title=fs.readFileSync(new URL('../src/scenes/TitleScene.js',import.meta.url),'utf8');
 assert.ok(title.includes('disposeFirstBattlePreload?.();'));
});

test('installed Phaser queues exactly the two hinted atlases as images, restoring the loader mode',()=>{
 for(const original of ['XHR',undefined]){
  const queued=[],json=[],load={path:'',prefix:'',baseURL:'',textureManager:{},
   image(key,url){queued.push(new ImageFile(this,key,url));},json(...args){json.push(args);}};
  if(original!==undefined)load.imageLoadType=original;
  for(const [preload,art]of [[preloadSakuraRefined,SAKURA_REFINED_ART],[preloadSakuraOblique,SAKURA_OBLIQUE_ART]]){
   preload({load});const file=queued.at(-1);
   assert.equal(file.key,art.key);assert.equal(file.url,art.texture);
   assert.equal(file.useImageElementLoad,true,'blob XHR does not consume image preloads');
   assert.equal(file.load,file.loadImage);assert.equal(file.onProcess,file.onProcessImage);
   assert.equal(load.imageLoadType,original);assert.equal(Object.hasOwn(load,'imageLoadType'),original!==undefined);
  }
  assert.deepEqual(json,[[SAKURA_REFINED_ART.dataKey,SAKURA_REFINED_ART.data],[SAKURA_OBLIQUE_ART.dataKey,SAKURA_OBLIQUE_ART.data]]);
  load.image('unrelated','art/unrelated.webp');assert.equal(queued.at(-1).useImageElementLoad,false);
 }
 for(const preload of [preloadSakuraRefined,preloadSakuraOblique]){
  const load={imageLoadType:'XHR',image(){throw Error('queue failed');},json(){assert.fail('never queue JSON after image failure');}};
  assert.throws(()=>preload({load}),/queue failed/);assert.equal(load.imageLoadType,'XHR');
 }
});

test('installed Phaser image-element failures still reach the normal loader error path',()=>{
 const prior=Object.getOwnPropertyDescriptor(globalThis,'Image'),results=[];
 try{
  globalThis.Image=class {};
  const load={imageLoadType:'HTMLImageElement',path:'',prefix:'',baseURL:'',textureManager:{},nextFile(file,ok){results.push({file,ok});}};
  for(const ok of [true,false]){
   const file=new ImageFile(load,'sakura','art/sakura.webp');file.crossOrigin='anonymous';file.load();
   assert.equal(file.data.src,'art/sakura.webp');assert.equal(file.data.crossOrigin,'anonymous');
   file.data[ok?'onload':'onerror']();assert.deepEqual(results.at(-1),{file,ok});
  }
 }finally{if(prior)Object.defineProperty(globalThis,'Image',prior);else delete globalThis.Image;}
});
