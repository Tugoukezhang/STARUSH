import {getChapterContent} from './publicChapterContent.mjs';
export const HARBOR_STAGE_ART = 'art/harbor-cohesion-20261009/';

export function isHarborStageChapter(data={}) {
  return data.practiceMode!==true&&data.defenseMode!==true&&Number(data.stageId||1)===1&&getChapterContent(data.campaignChapterId)?.sceneId==='harbor';
}
const colors=['pink','blue','yellow','purple','orange'];
const places=[
  ['meeting',500,1630,0,'码头集合灯','港湾入口的第一次声部交接'],
  ['west-deck',240,1450,0,'栈桥侧灯','沿甲板侧路接入准备区'],
  ['shed',280,1250,0,'器材间接线','恢复器材间','equipment-shed'],
  ['control',740,1050,0,'调度亭接线','恢复调度亭','control-cabin'],
  ['crossing',500,1005,0,'中段配电','南段准备完成后进入调音区'],
  ['north-entry',500,850,1,'调音区入口','从准备区汇入双侧声部'],
  ['west-relay',280,690,1,'西侧声部','恢复西侧调音亭','west-relay'],
  ['east-relay',720,690,1,'东侧声部','恢复东侧调音亭','east-relay'],
  ['stage-left',350,300,1,'帆顶左灯','舞台左侧接力完成','sail-stage'],
  ['stage-right',650,300,1,'帆顶右灯','舞台右侧接力完成','sail-stage'],
];
export const HARBOR_STAGE_DEVICES=Object.freeze(places.map(([id,x,y,zone,label,purpose,restores=null],i)=>Object.freeze({
  id:`harbor-${id}`,x,y,zone,label,purpose,restores,kind:'light',required:true,paintMax:26,
  sceneArt:'signal',scenePrefix:'harbor',colorSequence:Object.freeze([colors[i%5],colors[(i+2)%5]]),paintPolicy:'performer',
})));
const prop=(id,art,x,y,width,height,footprint,extra={})=>Object.freeze({id,art,x,y,width,height,footprint:Object.freeze(footprint),...extra});
export const HARBOR_STAGE_PROPS=Object.freeze([
  // Keep the central deck and every existing light clear; these are real equipment bays.
  prop('frontage-west-entry','shed',330,1740,230,225,{x:225,y:1590,width:210,height:150},{restorable:true,restorationId:'equipment-shed'}),
  prop('frontage-east-entry','control',700,1710,195,215,{x:614,y:1590,width:172,height:120},{restorable:true,restorationId:'control-cabin'}),
  prop('frontage-east-transfer','control',730,1320,195,215,{x:644,y:1200,width:172,height:120},{restorable:true,restorationId:'control-cabin'}),
  prop('equipment-shed','shed',280,1170,230,225,{x:175,y:1020,width:210,height:150},{restorable:true}),
  prop('control-cabin','control',730,970,195,215,{x:644,y:850,width:172,height:120},{restorable:true}),
  prop('west-relay','mixer',280,600,135,160,{x:220,y:500,width:120,height:100},{restorable:true}),
  prop('east-relay','mixer',720,600,135,160,{x:660,y:500,width:120,height:100},{restorable:true}),
  prop('sail-stage','stage',500,245,350,225,{x:345,y:80,width:310,height:165},{restorable:true}),
  prop('south-transport','barrier',500,1240,145,62,{x:427.5,y:1225,width:145,height:15},
    {interaction:'fold',label:'收拢运输栏',openedLabel:'运输栏已收拢',near:155}),
  prop('north-transport','barrier',500,745,145,62,{x:427.5,y:730,width:145,height:15},
    {interaction:'fold',label:'收拢调音区运输栏',openedLabel:'运输栏已收拢',near:155}),
]);
// The generated ground has continuous water outside the measured 12.4%-87.6% deck.
export const HARBOR_STAGE_TERRAIN=Object.freeze([
  Object.freeze({id:'west-water',footprint:Object.freeze({x:0,y:0,width:124,height:1778})}),
  Object.freeze({id:'east-water',footprint:Object.freeze({x:876,y:0,width:124,height:1778})}),
]);
export const HARBOR_STAGE_ASSETS=Object.freeze(['ground','shed','shed-muted','control','control-muted',
  'mixer','mixer-muted','stage','stage-muted','barrier','signal']);
export const HARBOR_STAGE_CONFIG=Object.freeze({chapterId:'encore',prefix:'harbor',props:HARBOR_STAGE_PROPS,terrain:HARBOR_STAGE_TERRAIN,progressiveRestoration:true,
  finaleOrigin:Object.freeze({x:500,y:300}),
  storyPlaces:Object.freeze(['west-relay','east-relay']),zoneComplete:'码头准备区已接通',
  northHint:'沿甲板向北，接通两侧调音亭和帆顶舞台。',finaleHint:'前往帆顶舞台前，完成终场合奏。',finaleLabel:'前往港湾舞台',
});
export const HOMECOMING_STAGE_CONFIG=Object.freeze({...HARBOR_STAGE_CONFIG,chapterId:'homecoming',
 zoneComplete:'码头接线已贯通',northHint:'接通北入口与两侧调音亭，再依次点亮左右台灯。',
 finaleHint:'帆顶已经通电，前往舞台完成收工加演。',finaleLabel:'前往返场舞台',
});
