import {getChapterContent} from './publicChapterContent.mjs';
export const isRooftopChapter=(data={})=>data.practiceMode!==true&&data.defenseMode!==true&&Number(data.stageId||1)===1&&getChapterContent(data.campaignChapterId)?.sceneId==='rooftop';
const rows=[
 ['arrival',500,1640,0,'楼梯口广播','west-cabinet'],
 ['south-west',230,1440,0,'南西支路','west-cabinet'],['south-east',770,1440,0,'南东支路','east-cabinet'],
 ['south-center',500,1278,0,'南校音台',null],['crossing',500,1000,0,'屋顶转播',null],
 ['north-entry',500,820,1,'北区引线',null],['north-west',230,700,1,'北西支路','west-mixer'],
 ['north-east',770,700,1,'北东支路','east-mixer'],['north-center',500,655,1,'北校音台',null],
 ['stage',500,340,1,'广播棚主灯','broadcast-stage']
];
export const ROOFTOP_DEVICES=Object.freeze(rows.map(([id,x,y,zone,label,restores])=>Object.freeze({id:'rooftop-'+id,x,y,zone,label,purpose:label,restores,kind:'light',required:true,paintMax:52,sceneArt:'signal',scenePrefix:'harbor',colorSequence:Object.freeze([]),paintPolicy:'performer',...(id.endsWith('center')?{continuousCalibration:true}:{})})));
const prop=(id,art,x,y,width,height,footprint)=>Object.freeze({id,art,x,y,width,height,footprint:Object.freeze(footprint),restorable:true});
export const ROOFTOP_PROPS=Object.freeze([
 prop('west-cabinet','control',195,1320,190,200,{x:115,y:1220,width:160,height:100}),
 prop('east-cabinet','control',805,1320,190,200,{x:725,y:1220,width:160,height:100}),
 prop('west-mixer','mixer',195,570,135,160,{x:135,y:470,width:120,height:100}),
 prop('east-mixer','mixer',805,570,135,160,{x:745,y:470,width:120,height:100}),
 Object.freeze({...prop('broadcast-stage','stage',500,245,350,226,{x:345,y:80,width:310,height:165}),materialVariant:'broadcast',neutralFromColor:true})
]);
export const ROOFTOP_TERRAIN=Object.freeze([{id:'west-drain',footprint:{x:0,y:0,width:36,height:1778}},{id:'east-drain',footprint:{x:964,y:0,width:36,height:1778}}]);
export const ROOFTOP_CONFIG=Object.freeze({chapterId:'raincheck',prefix:'harbor',props:ROOFTOP_PROPS,terrain:ROOFTOP_TERRAIN,progressiveRestoration:true,
 finaleOrigin:Object.freeze({x:500,y:300}),storyPlaces:Object.freeze(['west-cabinet','east-cabinet']),zoneComplete:'南侧广播频率已锁定',northHint:'北区串场同线两站接通，可保留北校音台离开时的进度。',finaleHint:'前往广播棚，完成雨后返场。',finaleLabel:'屋顶广播棚'});
