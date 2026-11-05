// Install as tests/mobile-tour.test.mjs in a tree carrying mobile-TourJourneyView.mjs and mobile-shell.patch.
// The DOM double has no layout, so geometry is injected from qa/mobile-before/probe.json (phone375x812).
// This covers placement logic only; real layout and pixels still need the browser probe in mobile-production-notes.md.
import test from'node:test';import assert from'node:assert/strict';import{loadScenes}from'./helpers/publicShellHarness.mjs';

const PHONE={width:375,viewport:664,content:1105,rowHeight:268,rows:{raincheck:22,encore:290,neon:559,opening:827}};
// Landmarks not decoded yet: fr rows share the viewport, so nothing can scroll.
const COLD={width:375,viewport:664,content:664,rowHeight:158,rows:{raincheck:22,encore:180,neon:338,opening:496}};

function setup(cleared=[],chapter='opening'){
 const s=loadScenes(),observers=[];
 s.window.ResizeObserver=class{
  constructor(callback){this.callback=callback;this.live=true;this.targets=[];observers.push(this);}
  observe(target){this.targets.push(target);}
  disconnect(){this.live=false;this.targets=[];}
 };
 s.loadRuntime('utils/userCast.mjs').configureUserCast(true);s.seed(cleared,chapter);
 const h=s.harness(s.TourRouteScene,{suppressDebugAutoStart:true});h.scene.create();
 return{s,h,observers,view:h.scene._publicShell};
}
function layout(h,geometry=PHONE){
 const map=h.query('.journey-map');let scroll=map.scrollTop||0;
 Object.defineProperty(map,'scrollTop',{configurable:true,get:()=>scroll,set(value){scroll=Math.max(0,Math.min(geometry.content-geometry.viewport,value));}});
 map.clientWidth=geometry.width;map.clientHeight=geometry.viewport;map.scrollHeight=geometry.content;
 h.query('.journey-route').offsetTop=0;
 for(const row of h.all('.journey-chapter')){row.offsetTop=geometry.rows[row.dataset.chapter];row.offsetHeight=geometry.rowHeight;}
 return map;
}
const fire=observers=>{for(const observer of observers)if(observer.live)observer.callback([]);};
const liveCount=observers=>observers.filter(observer=>observer.live).length;
function userScroll(map,top){map.dispatchEvent({type:'wheel'});map.scrollTop=top;map.dispatchEvent({type:'scroll'});}

test('phone entry brings the selected opening chapter inside the map viewport without resizing rows',()=>{
 const{s,h,observers}=setup();const before=JSON.stringify([...s.storage.values]);
 const map=layout(h);assert.equal(map.scrollTop,0);fire(observers);
 assert.equal(map.scrollTop,441);
 const rowTop=48+PHONE.rows.opening-map.scrollTop;
 assert(rowTop>=48&&rowTop+PHONE.rowHeight<=712,`opening rect ${rowTop}..${rowTop+PHONE.rowHeight} is outside 48..712`);
 assert.equal(h.query('[data-chapter=opening]').getAttribute('aria-pressed'),'true');
 assert.equal(h.query('[data-chapter=neon]').disabled,true);
 assert.equal(JSON.stringify([...s.storage.values]),before);h.shutdown();
});
test('entry centres whichever playable chapter is selected',()=>{
 for(const[cleared,chapter,expected]of [[['opening'],'neon',361],[['opening','neon'],'encore',92]]){
  const{h,observers}=setup(cleared,chapter),map=layout(h);fire(observers);
  assert.equal(map.scrollTop,expected,chapter);h.shutdown();
 }
});
test('landmarks loading after the first placement still end on the selected chapter',()=>{
 const{h,observers}=setup();let map=layout(h,COLD);fire(observers);assert.equal(map.scrollTop,0);
 map.dispatchEvent({type:'scroll'});
 map=layout(h);fire(observers);assert.equal(map.scrollTop,441);h.shutdown();
});
test('our own placement does not count as player scrolling',()=>{
 const{h,observers}=setup();let map=layout(h);fire(observers);map.dispatchEvent({type:'scroll'});
 map=layout(h,{...PHONE,viewport:600});fire(observers);assert.equal(map.scrollTop,505);h.shutdown();
});

test('browser scroll anchoring after image decode does not disable initial chapter placement',()=>{
 const{h,observers}=setup();let map=layout(h);fire(observers);
 map.scrollTop=360;map.dispatchEvent({type:'scroll'});
 map=layout(h,{...PHONE,viewport:519,content:962,rowHeight:232,rows:{raincheck:22,encore:254,neon:487,opening:719}});
 fire(observers);assert.equal(map.scrollTop,443);h.shutdown();
});
test('player scrolling survives later layout changes that keep the width',()=>{
 const{h,observers}=setup();let map=layout(h);fire(observers);userScroll(map,100);
 fire(observers);assert.equal(map.scrollTop,100);
 map=layout(h,{...PHONE,viewport:600});fire(observers);assert.equal(map.scrollTop,100);h.shutdown();
});
test('a width change always re-centres, even after player scrolling',()=>{
 const{h,observers}=setup();let map=layout(h);fire(observers);userScroll(map,100);
 map=layout(h,{...PHONE,width:667});fire(observers);assert.equal(map.scrollTop,441);h.shutdown();
});
test('previewing a chapter keeps the scroll position and does not confirm or unlock anything',()=>{
 const{s,h,observers}=setup(['opening']);const before=JSON.stringify([...s.storage.values]);
 const oldMap=layout(h);fire(observers);userScroll(oldMap,300);
 h.click('[data-chapter=neon]');
 assert.notEqual(h.query('.journey-map'),oldMap);assert.equal(liveCount(observers),1);assert.equal(h.query('dialog').dataset.sheetKind,'chapter');
 const map=layout(h);assert.equal(map.scrollTop,0);fire(observers);assert.equal(map.scrollTop,300);
 assert.equal(h.query('[data-chapter=neon]').getAttribute('aria-pressed'),'true');
 assert.equal(s.profile.getPublicCampaignProgress().selectedChapterId,'opening');
 assert.equal(h.query('[data-chapter=encore]').disabled,true);
 assert.equal(JSON.stringify([...s.storage.values]),before);
 h.click('[data-action=sheet-close]');assert.equal(map.scrollTop,300);h.shutdown();
});
test('returning to the tour page re-centres deterministically and leaves nothing on the page in between',()=>{
 const{h,observers}=setup();const first=layout(h);fire(observers);userScroll(first,100);
 h.click('[data-action=tour-records]');
 assert.equal(h.query('.journey-map'),null);assert.equal(liveCount(observers),0);
 h.click('[data-action=back]');
 assert.equal(liveCount(observers),1);
 const map=layout(h);fire(observers);assert.equal(map.scrollTop,441);h.shutdown();
});
test('a stale locked preview does not take focus; the resolved playable chapter does',()=>{
 const{h,observers,view}=setup();layout(h);fire(observers);
 h.click('[data-action=tour-records]');view.selection.chapterId='raincheck';h.click('[data-action=back]');
 assert.equal(h.query('[data-chapter=raincheck]').disabled,true);
 const map=layout(h);fire(observers);assert.equal(map.scrollTop,441);h.shutdown();
});
test('shutdown disconnects the observer',()=>{
 const{h,observers,view}=setup();layout(h);fire(observers);
 h.shutdown();assert.equal(liveCount(observers),0);assert.equal(view.journeyFocusDispose,null);
});

