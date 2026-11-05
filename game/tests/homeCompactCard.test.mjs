import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';
const prefix='#game-container #public-shell[data-core-journey=true][data-home-demo=true][data-page=desk]';
function compact(suffix,media='(max-height:620px)'){let found={};postcss.parse(fs.readFileSync(new URL('../src/styles/homeDemo.css',import.meta.url),'utf8')).walkRules(r=>{if(r.parent.params===media&&r.selector===prefix+' '+suffix)found=Object.fromEntries(r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));});return found;}
test('compact chapter card explicitly fits its map and text inside comic ink safe area',()=>{
 assert.equal(compact('.lobby-mission .shell-main-map').width,'48px');
 assert.equal(compact('.lobby-mission .shell-main-map').height,'48px');
 assert.equal(compact('.lobby-mission h2')['font-size'],'22px');
 assert.equal(compact('.lobby-mission h2')['line-height'],'28px');
 assert.equal(compact('.lobby-mission small')['line-height'],'18px');
 assert.equal(compact('.lobby-mission small').display,'block');
 assert.equal(compact('.lobby-mission').height,'74px');
});
test('540px saved-run home keeps all three shortcuts above the observed237px nameplate',()=>{
 const media='(max-height:550px)',height=parseFloat(compact('.lobby-shortcut',media).height);
 assert.equal(height,48);assert(height>=44);
 assert.equal(compact('.lobby-shortcut[data-action=prepare]',media).top,'130px');
 const top=parseFloat(compact('.lobby-shortcut[data-action=story-journal]',media).top);
 assert(top+height<=230,'reserve7px before the actual saved-run nameplate');
 assert.equal(compact('.lobby-shortcut .menu-art',media).height,'28px');
 assert.equal(compact('.lobby-shortcut-copy > .home-lettering',media).height,'20px');
});
