import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import postcss from 'postcss';
import {getPerformerRosterVisual} from '../src/systems/ActorPresentation.mjs';

const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const css=postcss.parse(fs.readFileSync(new URL('../src/styles/freshExperience.css',import.meta.url),'utf8'));
const shellCss=postcss.parse(fs.readFileSync(new URL('../src/styles/publicShell.css',import.meta.url),'utf8'));
function rule(selector,tree=css,media=null) {
 const matches=[];tree.walkRules(selector,r=>{if((r.parent.type==='atrule'?r.parent.params:null)===media)matches.push(r);});assert(matches.length>0,selector);
 return Object.fromEntries(matches.flatMap(r=>r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value])));
}
const shadow=rule('#public-shell .member-mark-full::after');
const portrait=rule('#public-shell .member-mark-full > .member-portrait');
const ids=['sakura','venus','genya','kai','enjo'];

function assertPositioning(tree) {
 const mark={...rule('.member-mark',shellCss),...rule('#public-shell .member-mark.member-mark-full',shellCss),...rule('#public-shell .member-mark.member-mark-full',tree)};
 const image={...rule('.member-portrait',shellCss),...rule('#public-shell .member-mark-full > .member-portrait',tree)};
 const ground=rule('#public-shell .member-mark-full::after',tree);
 assert.equal(mark.position,'relative');assert.equal(mark.overflow,'hidden');assert.equal(mark.border,'0');
 assert.equal(ground.position,'absolute','Contact shadow positioning');assert.equal(ground.left,'50%','Contact shadow horizontal center');assert.equal(ground.transform,'translateX(-50%)');
 assert.equal(image.position,'absolute');assert.equal(image.inset,'0');assert.equal(image.width,'100%');assert.equal(image.height,'100%');
 assert(!image.transform||image.transform==='none','Portrait must not move away from the decoded sole');
 for(const prop of ['top','right','bottom','left'])assert(!image[prop]||image[prop]==='0','Portrait cannot override its common inset');
 assert.deepEqual([mark.width,mark.height],['160px','240px']);
 const small=rule('#public-shell[data-page=roster] .member-mark.member-mark-full',tree,'(max-width:340px)');
 assert.deepEqual([small.width,small.height],['144px','216px'],'Responsive portrait dimensions');
}

test('all reviewed full portraits share an actual decoded sole and transparent bottom margin',async()=>{
 for(const id of ids) {
  const visual=getPerformerRosterVisual(id);
  const {data,info}=await sharp(fs.readFileSync(new URL('../public/'+visual.source,import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([info.width,info.height],[512,768]);
  let bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8)bottom=y;
  assert.equal(bottom,741,id+' changed the common export floor; re-review grounding before replacing this portrait');
 }
});

test('the shadow midpoint scales with the export floor on both roster sizes',()=>{
 const match=/^calc\((\d+(?:\.\d+)?)% - (\d+(?:\.\d+)?)px\)$/.exec(shadow.bottom);
 assert(match,'Fixed bottom:25px places the shadow across the ankles instead of at the sole');
 const percent=Number(match[1])/100,halfHeight=Number(match[2]);
 assert.equal(shadow.height,'9px');assert.equal(halfHeight,4.5);
 for(const height of [216,240]) {
  const center=height-(height*percent-halfHeight)-halfHeight,sole=height*742/768;
  assert(Math.abs(center-sole)<0.01,'Shadow must sit at the reviewed figure floor, not a fixed ankle height');
 }
});

test('portrait covers the contact shadow without stealing input or altering containment',()=>{
 assert.equal(shadow['z-index'],'0','Shadow must be behind the figure');
 assert.equal(portrait['z-index'],'1');assert.equal(shadow['pointer-events'],'none');
 assert.equal(portrait['object-fit'],'contain');assert.equal(portrait.background,'transparent');
 assert.equal(shadow.width,'72px');assert.equal(shadow.background,'#56707724');
});

test('positioning and responsive dimensions keep the decoded figure floor registered',()=>assertPositioning(css));

for(const [name,selector,prop,value,reason] of [
 ['static shadow','#public-shell .member-mark-full::after','position','static',/Contact shadow positioning/],
 ['left-aligned shadow','#public-shell .member-mark-full::after','left','0%',/Contact shadow horizontal center/],
 ['shifted portrait','#public-shell .member-mark-full > .member-portrait','transform','translateY(-20px)',/Portrait must not move/],
 ['changed responsive height','#public-shell[data-page=roster] .member-mark.member-mark-full','height','215px',/Responsive portrait dimensions/],
])test('rejects the in-memory '+name+' counterexample',()=>{
 const mutated=css.clone();mutated.walkRules(selector,r=>r.append({prop,value}));
 assert.throws(()=>assertPositioning(mutated),reason);
});
