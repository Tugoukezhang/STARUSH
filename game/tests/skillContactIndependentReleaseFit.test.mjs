import test from 'node:test';import assert from 'node:assert/strict';
import {UserWeaponFx} from '../src/systems/UserWeaponFx.mjs';import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
import {PublicStage1PerformerRun} from '../src/systems/PublicStage1PerformerRun.mjs';
function fixture(id='enjo',point={x:475,y:1350}){
 let now=500;const nodes=[],street=new OldStreetState(),player={...point,hp:5,active:true};
 const s={_userCastPresentation:true,player,publicPerformerRun:{now:()=>now},oldStreet:street,textures:{exists:()=>true},add:{image(x,y,key,frame){const n={x,y,key,frame,active:true,destroyed:0};for(const name of ['setOrigin','setDisplaySize','setTint','setAlpha','setDepth','setRotation','setFrame'])n[name]=(...args)=>{n[name+'Args']=args;return n;};n.destroy=()=>{if(n.active){n.active=false;n.destroyed++;}};nodes.push(n);return n;}}};
 const f=new UserWeaponFx(s,id);return{s,f,nodes,street,setNow:v=>now=v,row:{...point,radius:{sakura:60,kai:72,enjo:190}[id],start:500,angle:0,color:{sakura:'pink',kai:'cyan',enjo:'orange'}[id],sequence:1,beat:0,contacts:[{x:530,y:1350,kind:'enemy'}]}};
}
for(const id of ['sakura','kai','enjo'])test(id+' keeps a true small accepted contact when its ground release cannot fit the actual record-shop side street',()=>{
 const {f,s,nodes,street,row}=fixture(id);assert(street.clearLine(s.player,s.player,14));assert(street.clearLine(s.player,row.contacts[0],2));
 const input=JSON.stringify(row);assert.equal(f.release(row),true);assert.equal(f.stats.releases,1);assert.equal(f.stats.impacts,1);assert.equal(nodes.length,1);assert.equal(f.rows[0].kind,'impact');assert.equal(f.rows[0].ground,false);assert.equal(f.rows[0].x,530);assert.equal(f.rows[0].y,1350);assert.equal(JSON.stringify(row),input);
});
test('the real Run paint receipt still dispatches the accepted contact even if the primary cannot fit',()=>{
 const {s,f,nodes,row}=fixture('enjo');let hp=100,groundCalls=0,amountSeen;
 s.add.graphics=()=>{};
 Object.assign(s,{battleData:{stageId:1,performerId:'enjo'},time:{now:500},actorPresentation:{userCastView:{weaponFx:f}},_stampGroundSplat(){groundCalls++;},paintZone:{devices:[],applyPaintAt:()=>false},_paintPublicStage1TargetsAt(x,y,amount,radius,color,target,observe){amountSeen=amount;hp-=amount;observe({x:530,y:1350,kind:'enemy'});return true;}});
 const run=new PublicStage1PerformerRun(s);s.publicPerformerRun=run;assert.equal(run.paint(row.x,row.y,52,row.radius,row.color,null,{sequence:1,beat:0,angle:0}),true);assert.equal(hp,48);assert.equal(amountSeen,52);assert.equal(groundCalls,1);assert.equal(nodes.length,1);assert.equal(f.stats.impacts,1);assert.deepEqual(run.actionFeedback.lastRelease.contacts,[{x:530,y:1350,kind:'enemy'}]);
});
test('a failed primary plus empty/invalid/unplaceable contacts never invents a centre hit or release',()=>{
 for(const contacts of [[],[{x:NaN,y:1350}], [{x:300,y:1350,kind:'enemy'}]]){const {f,nodes,row}=fixture();assert.equal(f.release({...row,contacts}),false);assert.equal(nodes.length,0);assert.equal(f.stats.releases,0);assert.equal(f.stats.impacts,0);}
});
test('paused, ended, dead, disposed and occluded releases remain inert even with a valid contact list',()=>{
 for(const setup of [q=>q.s._battlePaused=true,q=>q.s._battleEnded=true,q=>q.s.player.hp=0,q=>q.f.destroy(),q=>q.s.oldStreet={clearLine:()=>false}]){const q=fixture();setup(q);assert.equal(q.f.release(q.row),false);assert.equal(q.nodes.length,0);assert.equal(q.f.stats.releases,0);}
});
test('primary and contact success count one release; duplicate contacts, caps, pause/expiry and cleanup stay bounded',()=>{
 const q=fixture('enjo',{x:550,y:1500}),{f,row,nodes,s,setNow}=q;const contacts=[{x:550,y:1500},{x:550,y:1500},{x:570,y:1520},{x:580,y:1520}];
 assert(f.release({...row,contacts}));assert.equal(f.stats.releases,1);assert.equal(f.stats.impacts,2);assert.equal(f.rows.length,3);const view={depth:12,disposed:false};f.update(500,view);s._battlePaused=true;f.update(9000,view);assert.equal(f.rows.length,3);s._battlePaused=false;setNow(1000);f.update(1000,view);assert.equal(f.rows.length,0);assert(nodes.every(n=>n.destroyed===1));f.destroy();f.destroy();assert(nodes.every(n=>n.destroyed===1));
});
test('actual Run paint receipt carries its pigment into both primary and accepted-contact FX',()=>{
 for(const conflicting of[false,true]){const{s,f,nodes,row}=fixture('enjo',{x:550,y:1500}),ground=[];s.add.graphics=()=>{};
 Object.assign(s,{battleData:{stageId:1,performerId:'enjo'},time:{now:500},actorPresentation:{userCastView:{weaponFx:f}},_stampGroundSplat(...a){ground.push(a);},paintZone:{devices:[],applyPaintAt:()=>false},_paintPublicStage1TargetsAt(x,y,amount,radius,color,target,observe){observe({x:530,y:1350,kind:'enemy'});return true;}});
 const run=new PublicStage1PerformerRun(s);s.publicPerformerRun=run;const release={sequence:1,beat:0,angle:0,...(conflicting?{color:'pink'}:{})},before=JSON.stringify(release);
 assert(run.paint(row.x,row.y,52,row.radius,'blue',null,release));assert.equal(ground[0][2],'blue');assert.equal(run.actionFeedback.lastRelease.color,'blue');assert(f.rows.some(r=>r.release));assert(f.rows.some(r=>r.releaseContact));assert(nodes.every(n=>n.setTintArgs[0]===0xffffff));assert(f.rows.every(r=>r.frameOffset===6));assert.equal(JSON.stringify(release),before);f.destroy();assert(nodes.every(n=>n.destroyed===1));}
});
