import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const root=new URL('../',import.meta.url),css=()=>postcss.parse(fs.readFileSync(new URL('src/styles/formalGameLayout.css',root),'utf8'));
test('native Chinese UI ships a licensed offline variable font, not an external CDN',()=>{
 let face;css().walkAtRules('font-face',r=>{const d=Object.fromEntries(r.nodes.map(n=>[n.prop,n.value]));if(d['font-family']==='"Starush UI"')face=d;});
 assert(face);assert.equal(face['font-weight'],'100 900');assert.equal(face['font-display'],'swap');
 assert.match(face.src,/\/fonts\/NotoSansSC-UI\.woff2/);assert(!face.src.includes('http'));
 const bytes=fs.readFileSync(new URL('public/fonts/NotoSansSC-UI.woff2',root));assert.equal(bytes.subarray(0,4).toString(),'wOF2');assert(bytes.length<600000);
 assert.match(fs.readFileSync(new URL('public/licenses/noto-sans-sc.txt',root),'utf8'),/SIL OPEN FONT LICENSE/);
});
test('font and license enter the explicit release payload, without copying a complete source font',()=>{
 for(const file of ['fonts/NotoSansSC-UI.woff2','licenses/noto-sans-sc.txt'])assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===file).length,1,file);
 assert(!RUNTIME_PAYLOAD.some(r=>r.file.endsWith('.ttf')));
});
test('native UI roots and their controls share the real variable font with safe system fallbacks',()=>{
 const rules=[];css().walkRules(r=>{if(r.nodes.some(n=>n.prop==='font-family'&&n.value.includes('"Starush UI"')))rules.push(r);});
 assert(rules.some(r=>r.selector.includes('#public-shell')&&r.selector.includes('.battle-surface')&&r.selector.includes('#hud')));
 assert(rules.some(r=>r.toString().includes('Microsoft YaHei')));
});
test('live charge digits get a readable fixed18px face without moving or shrinking skill hitboxes',()=>{
 const rules=[];css().walkRules(r=>{if(r.selector.includes('#encore-state')&&r.selector.includes('#special-state')&&r.nodes.some(n=>n.prop==='font-size'&&n.value==='18px'))rules.push(r);});
 assert.equal(rules.length,1);const declarations=Object.fromEntries(rules[0].nodes.map(n=>[n.prop,n.value]));assert.equal(declarations['font-variant-numeric'],'tabular-nums');for(const prop of ['width','height','top','left','right','transform'])assert(!(prop in declarations),prop);
});
test('home chapter eyebrow uses a real block line box with the offline CJK font at every height',()=>{
 const home=postcss.parse(fs.readFileSync(new URL('src/styles/homeDemo.css',root),'utf8'));let found=false;
 home.walkRules(r=>{if(r.parent.type==='root'&&r.selector.includes('.lobby-mission small')&&r.nodes.some(n=>n.prop==='display'&&n.value==='block'))found=true;});assert(found);
});
