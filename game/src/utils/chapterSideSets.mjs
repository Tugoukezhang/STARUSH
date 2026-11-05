const CHAPTERS=Object.freeze({
 homecoming:{prefix:'harbor',art:'signal',names:['码头应援','帆顶应援'],points:[[[155,1460],[155,1240]],[[845,1450],[845,1060]],[[155,820],[155,380]],[[845,820],[845,380]]]},
 raincheck:{prefix:'harbor',art:'signal',names:['屋顶试听','广播试听'],points:[[[100,1530],[100,1100]],[[900,1530],[900,1100]],[[100,800],[100,360]],[[900,800],[900,360]]]},
 opening:{prefix:'oldstreet',art:'lamp',names:['门店串场','剧场串场'],points:[[[145,1500],[145,1190]],[[945,1430],[940,1110]],[[85,700],[85,330]],[[940,840],[920,350]]]},
 neon:{prefix:'neonstreet',art:'signal',names:['南街接力','广场接力'],points:[[[110,1460],[110,1180]],[[920,1460],[920,1160]],[[105,820],[105,500]],[[910,820],[910,500]]]},
 encore:{prefix:'harbor',art:'signal',names:['甲板校音','舞台校音'],points:[[[155,1460],[155,1240]],[[845,1450],[845,1060]],[[155,820],[155,380]],[[845,820],[845,380]]]},
});
const BRANCHES=['west','east'];
export function getChapterSideSetSummary(id){
 if(!CHAPTERS[id])return '';
 if(id==='homecoming')return '南北两区各选一条串场线，完成同线两站；同线先后自由，不需要驻点校音。';
 return '南北两区各选一条串场线，完成两站；第一站完成后另一线留待复演。'
  +(id==='neon'?'霓虹按前站→后站接力。':id==='encore'?'港湾串场站涂满后也需靠近校准。':id==='raincheck'?'屋顶试听同线两站自由安排；连续校音仅用于主线中央灯，赶在校音前接通两站，本区校音台就有储备。':'旧街同线两站可自由安排先后。');
}
function sideDefinitions(chapterId){
 const c=CHAPTERS[chapterId];
 return Object.freeze(c?c.points.flatMap((points,i)=>points.map(([x,y],sideIndex)=>Object.freeze({
  id:chapterId+'-side-'+i+'-'+sideIndex,x,y,zone:Math.floor(i/2),label:'串场 · '+(i%2?'东':'西')+(sideIndex+1),
  purpose:c.names[Math.floor(i/2)],kind:'light',required:false,chapterSideSet:true,sideBranch:BRANCHES[i%2],sideIndex,
  sceneArt:c.art,scenePrefix:c.prefix,paintMax:52,colorSequence:Object.freeze([]),paintPolicy:'performer',
 }))):[]);
}
// Authored definitions decide which stations form a branch; only live completion counts, never a device count.
export function hasCompletedChapterSideBranch(chapterId,zone,devices){
 const rows=sideDefinitions(chapterId).filter(d=>d.zone===zone);
 return BRANCHES.some(branch=>[0,1].every(sideIndex=>{
  const def=rows.find(d=>d.sideBranch===branch&&d.sideIndex===sideIndex);
  return !!def&&devices.some(row=>row.id===def.id&&row.chapterSideSet===true&&row.zone===def.zone
   &&row.sideBranch===branch&&row.sideIndex===sideIndex&&row.complete===true);
 }));
}
export class ChapterSideSet {
 constructor(chapterId,routeId=null){
  this.chapterId=chapterId;this.selected=CHAPTERS[chapterId]&&BRANCHES.includes(routeId)?[routeId,routeId]:[null,null];this.disposed=false;
  this.definitions=sideDefinitions(chapterId);
 }
 definition(d){return this.definitions.find(row=>row.id===d?.id);}
 lockReason(d,devices){
  const row=this.definition(d);if(!row||this.disposed)return '本场未开放';
  const selected=this.selected[row.zone];if(selected&&selected!==row.sideBranch)return '另一线留待复演';
  if(this.chapterId==='neon'&&row.sideIndex===1&&!devices.some(x=>x.id===this.definitions.find(p=>p.zone===row.zone&&p.sideBranch===row.sideBranch&&p.sideIndex===0)?.id&&x.complete))return '先接前站';
  return '';
 }
 canReceive(d,devices){return !d?.complete&&!!this.definition(d)&&!this.lockReason(d,devices);}
 completed(d,devices){
  const row=this.definition(d);if(!row||!d.complete||this.lockReason(d,devices))return false;
  const changed=this.selected[row.zone]===null;this.selected[row.zone]=row.sideBranch;return changed;
 }
 zoneComplete(zone,devices){
  const branch=this.selected[zone];return !this.disposed&&!!branch&&this.definitions.filter(d=>d.zone===zone&&d.sideBranch===branch)
   .every(d=>devices.some(row=>row.id===d.id&&row.complete));
 }
 snapshot(devices){
  const zones=[0,1].map(zone=>({zone,branch:this.selected[zone],completed:this.selected[zone]
   ?this.definitions.filter(d=>d.zone===zone&&d.sideBranch===this.selected[zone]&&devices.some(row=>row.id===d.id&&row.complete)).length:0}));
  return {chapterId:this.chapterId,total:4,completed:zones.reduce((n,z)=>n+z.completed,0),zones};
 }
 destroy(){this.disposed=true;this.selected=[null,null];}
}
export function getChapterSideSetReview(row,chapterId){
 if(!row||!CHAPTERS[chapterId]||row.chapterId!==chapterId||row.total!==4||!Array.isArray(row.zones)||row.zones.length!==2)return null;
 if(row.zones.some((z,i)=>z.zone!==i||![null,...BRANCHES].includes(z.branch)||!Number.isInteger(z.completed)
  ||z.completed<0||z.completed>2||(!z.branch&&z.completed!==0)))return null;
 if(row.completed!==row.zones.reduce((n,z)=>n+z.completed,0))return null;
 return {completed:row.completed,total:4,label:'本场串场路线',text:row.zones.map((z,i)=>CHAPTERS[chapterId].names[i]+' · '
  +(z.branch===null?'未选线':z.branch==='west'?'西线':'东线')+' '+z.completed+'/2').join('；')+'。复演可尝试另一线。'};
}
