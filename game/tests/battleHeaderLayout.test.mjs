import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),postcss=require('postcss'),H='#game-container[data-battle-mode=public]';
function rule(s){const c=postcss.parse(fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8')),r={};c.walkRules(n=>{if(!n.parent.name&&n.selector===H+' '+s)for(const d of n.nodes)if(d.type==='decl')r[d.prop]=d.value;});return r;}
test('current header reserves fixed larger portrait, name art and tabular live HP without overlap',()=>{
 const p=rule('.mihoyo-player'),a=rule('.mihoyo-player .mihoyo-portrait'),m=rule('.mihoyo-player-meta'),hp=rule('#hp-value'),name=rule('.battle-header-name');
 assert.equal(p.left,'16px');assert.equal(p.top,'16px');assert.equal(p.padding,'0');assert.equal(a.width,'44px');assert.equal(a.height,'44px');
 assert.equal(m.width,'154px');assert.equal(m.height,'44px');assert.equal(hp['font-size'],'16px');assert.equal(hp.width,'54px');assert.equal(name.width,'96px');assert.equal(name.height,'24px');
 assert(96+4+54<=154);assert(16+44+8+154<=234,'member area leaves support gap');
});
test('support icon, full live level and meter stay above objective and left of the clock',()=>{
 const h=rule('.heat-card'),level=rule('#heat-level'),bar=rule('#heat-gauge');assert.equal(h.left,'234px');assert.equal(h.width,'110px');assert.equal(level['font-size'],'14px');assert.equal(level['line-height'],'20px');assert.equal(bar.width,'70px');assert(234+70+6<311);assert(234+parseFloat(level.left)+parseFloat(level.width)<=340,'live level clears top-right authored spike');
});
test('clean authored header frame retains the exact canvas-owned pause hole and fallback white surface',()=>{
 const r=rule('#hud::before');assert(r['border-image'].includes('/art/battle-header-20261022/frame.png'));assert.equal(r.background,'#fff');assert.equal(r['mask-image'],'radial-gradient(circle 23px at 341px 75px,transparent 99%,#000 100%)');assert.equal(r['pointer-events'],'none');assert.equal(r.height,'110px');
});
test('name clip is load-gated; icon sprite never creates layout or pointer geometry',()=>{
 const r=rule('.mihoyo-player-meta[data-header-lettering=loaded] .mihoyo-name'),icon=rule('.battle-header-icon'),img=rule('.battle-header-icon img');assert.equal(r['clip-path'],'inset(50%)');assert.equal(icon['pointer-events'],'none');assert.equal(icon.width,'20px');assert.equal(icon.height,'20px');assert.equal(img.width,'40px');assert.equal(img.height,'20px');
});
test('chapter and configuration text stay inside the authored ink safe area and pause clearance',()=>{
 for(const s of ['#battle-chapter','#run-build']){const r=rule(s);assert.equal(r.top,'80px');assert.equal(r['font-size'],'14px');assert.equal(r['line-height'],'18px');assert.equal(r['white-space'],'nowrap');assert.equal(r['text-overflow'],'ellipsis');}
 assert(parseFloat(rule('#battle-chapter').left)>=30,'chapter clears actual 24px left slice plus backing x6');
});

test('primary objective is larger than secondary metadata and clears the portrait, footer and pause',()=>{
 const o=rule('.cw-objective'),w=rule('#wave-text'),c=rule('#battle-chapter');
 assert.equal(w['font-size'],'16px');assert.equal(w['line-height'],'20px');assert.equal(o.height,'20px');assert.equal(o.top,'60px');
 assert.equal(o.left,'30px');assert.equal(o.width,'276px');assert(parseFloat(w['font-size'])>parseFloat(c['font-size']));
 assert(parseFloat(o.top)>=16+44);assert(parseFloat(o.top)+parseFloat(o.height)<=parseFloat(c.top));assert(parseFloat(o.left)+parseFloat(o.width)<326);
});

test('critical HP and low timer use stable colors without changing any hit box or typography size',()=>{
 for(const selector of ['.mihoyo-player-meta[data-health=critical] #hp-value','#round-clock[data-urgency=low]']){
  const r=rule(selector);assert.equal(r.color,'#a31538');assert.equal(r['font-weight'],'900');assert.equal(r.width,undefined);assert.equal(r.transform,undefined);assert.equal(r.animation,undefined);
 }
 assert.equal(rule('.mihoyo-player-meta[data-health=critical] #hp-fill').background,'#d12b55');
});
test('admitted authored frame and two emblems retain exact PNG bytes, geometry and unclipped alpha',async()=>{
 const crypto=await import('node:crypto'),sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
 for(const [name,w,h,hash]of [['frame',1024,320,'d1e0d404ad0d934645a34b941f8f7e1ad72efc7e08079c9bdbc7024b2d5cbd03'],['icons',256,128,'2caaeafad4c30ce6bcdcc889a2df246cc59f726c6799986d0325d5578df3e728']]){
  const png=fs.readFileSync(new URL('../public/art/battle-header-20261022/'+name+'.png',import.meta.url));assert.equal(crypto.createHash('sha256').update(png).digest('hex'),hash);
  const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height,info.channels],[w,h,4]);
  if(name==='frame'){let white=0,total=0;for(let y=60;y<260;y++)for(let x=100;x<924;x++){const i=(y*w+x)*4;total++;if(data[i+3]>=240&&Math.min(data[i],data[i+1],data[i+2])>=230)white++;}assert(white/total>.99,'live information stays on near-opaque clean white paper');}
  else for(let f=0;f<2;f++){let visible=0;for(let y=0;y<128;y++)for(let x=0;x<128;x++){const a=data[(y*w+f*128+x)*4+3];if(x<6||x>121||y<6||y>121)assert.equal(a,0);if(a>32)visible++;}assert(visible>2500&&visible<13000);}
 }
});
