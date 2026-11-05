import {getChapterContent} from './publicChapterContent.mjs';
export function isNeonStreetChapter(data = {}) {
  return data.practiceMode !== true && data.defenseMode !== true && Number(data.stageId || 1) === 1
    && getChapterContent(data.campaignChapterId)?.sceneId==='neonstreet';
}
export const NEON_STREET_ART='art/neon-cohesion-20261009/';
const fixture=(id,x,y,zone,label,color,purpose,restores=null)=>Object.freeze({
  id:`neonstreet-${id}`,x,y,zone,label,kind:'light',required:true,paintMax:52,
  sceneArt:'signal',scenePrefix:'neonstreet',purpose,restores,colorSequence:Object.freeze([color]),paintPolicy:'performer',
});
export const NEON_STREET_DEVICES=Object.freeze([
  fixture('meeting',500,1630,0,'集合点音柱','pink','街角集合，声浪的第一次回应'),
  fixture('east-court',790,1470,0,'东侧广播','orange','绕向咖啡亭的侧路'),
  fixture('listening',225,1220,0,'试听店门灯','purple','恢复试听店橱窗','listening-store'),
  fixture('cafe',805,1225,0,'咖啡亭门灯','yellow','恢复咖啡亭与街区对话','night-cafe'),
  fixture('crossing',500,1005,0,'街口配电','blue','南街闭环后进入北侧听音区'),
  fixture('north-entry',500,850,1,'广场广播','orange','北区入口与声部汇合'),
  fixture('echo-shop',240,535,1,'回声店灯箱','pink','西侧听音回路','north-listening'),
  fixture('north-cafe',760,545,1,'晚间窗口','purple','东侧听音回路','north-cafe'),
  fixture('plaza-left',350,285,1,'听音棚左灯','blue','左声部准备','listening-pavilion'),
  fixture('plaza-right',650,285,1,'听音棚右灯','yellow','右声部准备','listening-pavilion'),
]);
const prop=(id,art,x,y,width,height,footprint,extra={})=>Object.freeze({
  id,art,x,y,width,height,footprint:Object.freeze(footprint),...extra,
});
export const NEON_STREET_PROPS=Object.freeze([
  // South-entry architecture shares restoration bookkeeping, never adds objectives.
  prop('frontage-west-entry','shop',330,1750,250,270,{x:230,y:1620,width:200,height:130},{restorable:true,restorationId:'listening-store'}),
  prop('frontage-east-entry','cafe',705,1750,250,242,{x:600,y:1605,width:210,height:145},{restorable:true,restorationId:'night-cafe'}),
  prop('frontage-west-middle','shop',330,1475,250,270,{x:230,y:1345,width:200,height:130},{restorable:true,restorationId:'listening-store'}),
  prop('frontage-east-middle','cafe',705,1390,250,242,{x:600,y:1245,width:210,height:145},{restorable:true,restorationId:'night-cafe'}),
  prop('listening-store','shop',225,1140,300,324,{x:100,y:975,width:250,height:165},{restorable:true}),
  prop('night-cafe','cafe',785,1130,250,242,{x:680,y:985,width:210,height:145},{restorable:true}),
  prop('north-listening','shop',250,450,250,270,{x:150,y:320,width:200,height:130},{restorable:true}),
  prop('north-cafe','cafe',750,450,230,223,{x:650,y:320,width:200,height:130},{restorable:true}),
  prop('listening-pavilion','pavilion',500,240,330,230,{x:375,y:125,width:250,height:95},{restorable:true}),
  prop('south-screen','panel',530,1210,150,64,{x:455,y:1195,width:150,height:15},
    {interaction:'fold',label:'收拢试听隔板',openedLabel:'试听隔板已收拢',near:155}),
  prop('north-screen','panel',500,700,150,64,{x:425,y:685,width:150,height:15},
    {interaction:'fold',label:'收拢广场隔板',openedLabel:'广场隔板已收拢',near:155}),
  ...[['south-west-tree',66,1500,'listening-store'],['south-east-tree',930,1500,'night-cafe'],
    ['mid-west-tree',65,875,'listening-store'],['mid-east-tree',935,875,'night-cafe'],
    ['north-west-tree',70,340,'listening-pavilion'],['north-east-tree',930,340,'listening-pavilion']]
    .map(([id,x,y,restorationId])=>prop(id,'tree',x,y,90,120,
      {x:x-12,y:y-20,width:24,height:16},{restorable:true,restorationId})),
]);
export const NEON_STREET_ASSETS=Object.freeze(['ground','shop','shop-muted','cafe','cafe-muted',
  'pavilion','pavilion-muted','panel','signal','tree','tree-muted']);
export const NEON_STREET_CONFIG=Object.freeze({
  chapterId:'neon',prefix:'neonstreet',props:NEON_STREET_PROPS,progressiveRestoration:true,
  finaleOrigin:Object.freeze({x:500,y:310}),
  storyPlaces:Object.freeze(['listening-store','night-cafe']),
  zoneComplete:'南街声部已接通',northHint:'沿街向北，把不同声部接到听音广场。',
  finaleHint:'前往北侧听音广场，准备合奏返场。',finaleLabel:'前往听音广场',
});
