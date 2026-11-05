import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import postcss from 'postcss';
function rules(){const result=new Map();postcss.parse(fs.readFileSync(new URL('../src/styles/battleSurface.css',import.meta.url),'utf8')).walkRules(r=>{if(r.parent.type==='root'&&r.selector.startsWith('.public-boss-'))result.set(r.selector,Object.fromEntries(r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value])));});return result;}
test('boss status, count and tag retain14px minimum rather than adding another12px information layer',()=>{
 for(const name of ['title','tag','status','count'])assert(parseFloat(rules().get('.public-boss-'+name)['font-size'])>=14,name);
});
test('boss strip belongs to the white ink cyan magenta UI family rather than a pink gradient panel',()=>{
 const row=rules().get('.public-boss-strip');assert(!row.background.includes('gradient'));assert.equal(row.color,'#101c22');
 assert.equal(row.background,'#fffffff2');assert.equal(row['border-left'],'3px solid #ff2bd6');
});
test('status has a full second line so the true recovery paint value is not squeezed by the breakpoint count',()=>{
 assert.equal(rules().get('.public-boss-status')['grid-column'],'1 / -1');
 assert.equal(rules().get('.public-boss-count')['grid-row'],'1');
});
