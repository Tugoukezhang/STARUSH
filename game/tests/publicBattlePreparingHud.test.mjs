import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/systems/BattleSurfaceView.mjs',import.meta.url),'utf8');
const sync=new Function('getPublicPerformer','getPublicChapter','createBattleIcon',source.slice(source.indexOf('export function syncPublicBattleHud')).replace('export function','function')+';return syncPublicBattleHud;')(()=>({name:'绯樱',actionName:'扇奏'}),()=>({name:'街区'}),()=>({}));
function fixture(phase){const nodes=new Map();const doc={getElementById(id){if(!nodes.has(id))nodes.set(id,{textContent:'',style:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},querySelector(){return true;}});return nodes.get(id);}};const scene={_isPublicStage1Round:()=>true,publicStage1Round:{snapshot:()=>({phase})},publicPerformerRun:{member:{name:'绯樱',actionName:'扇奏'},canAct:()=>phase==='active'},_specialCharge:100,_encoreCharge:100};return {nodes,doc,scene};}
test('countdown never advertises a full charge as available, and does not mutate charges',()=>{
 const {nodes,doc,scene}=fixture('idle');sync(scene,doc);assert.equal(nodes.get('special-state').textContent,'待开演');assert.equal(nodes.get('encore-state').textContent,'待开演');
 for(const id of ['skill-special','skill-encore']){assert.equal(nodes.get(id).attrs['aria-disabled'],'true');assert.match(nodes.get(id).attrs['aria-label'],/待开演/);}assert.equal(nodes.get('special-fill').style.width,'0%');assert.equal(scene._specialCharge,100);assert.equal(scene._encoreCharge,100);
});
test('active round readiness remains unchanged and legacy fixtures do not become preparing',()=>{
 const {nodes,doc,scene}=fixture('active');sync(scene,doc);assert.equal(nodes.get('special-state').textContent,'就绪');assert.equal(nodes.get('encore-state').textContent,'就绪');assert.equal(nodes.get('special-fill').style.width,'100%');
 delete scene.publicStage1Round;sync(scene,doc);assert.equal(nodes.get('special-state').textContent,'就绪');
});
