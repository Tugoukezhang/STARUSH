import lineToRectangle from 'phaser/src/geom/intersects/LineToRectangle.js';
import {getChapterContent} from './publicChapterContent.mjs';

export function isOldStreetChapter(data = {}) {
  return data.practiceMode !== true && data.defenseMode !== true && Number(data.stageId || 1) === 1
    && getChapterContent(data.campaignChapterId||'opening')?.sceneId==='oldstreet';
}

const fixture = (id,x,y,zone,label,art,purpose,restores=null) => Object.freeze({
  id:`oldstreet-${id}`,x,y,zone,label,kind:'light',required:true,paintMax:52,
  sceneArt:art,purpose,restores,colorSequence:Object.freeze([]),paintPolicy:'performer',
});
export const OLD_STREET_DEVICES = Object.freeze([
  fixture('welcome',510,1635,0,'南口音箱','speaker','集合与首个涂染反馈'),
  fixture('records',350,1460,0,'唱片店灯箱','lamp','恢复唱片店门面','record-shop'),
  fixture('tickets',820,1100,0,'票亭电源','power','打开外街视野中的场所锚点','ticket-kiosk'),
  fixture('repair',350,1120,0,'音响铺音箱','speaker','外街与装卸巷汇合','repair-shop'),
  fixture('crossing',550,970,0,'街口路灯','lamp','南街恢复后开放剧场前庭'),
  fixture('north',490,820,1,'前庭配电','power','北区入口与第二组节奏'),
  fixture('garden',184,520,1,'花店门灯','lamp','引导侧面绕行而非穿楼','garden-shop'),
  fixture('mix',735,580,1,'露天调音箱','speaker','前庭外侧交战位置'),
  fixture('stage-left',370,270,1,'舞台左灯','lamp','露天剧场的左侧准备','theater'),
  fixture('stage-right',630,270,1,'舞台右灯','lamp','露天剧场的右侧准备','theater'),
]);

const prop=(id,art,x,y,width,height,footprint,extra={}) => Object.freeze({
  id,art,x,y,width,height,footprint:footprint?Object.freeze(footprint):null,...extra,
});
export const OLD_STREET_PROPS = Object.freeze([
  prop('record-shop','shop',339,1420,280,260,{x:220,y:1290,width:240,height:116},{restorable:true}),
  prop('repair-shop','repair',350,1080,240,201,{x:240,y:980,width:210,height:100},{restorable:true}),
  prop('ticket-kiosk','kiosk',820,1050,172,184,{x:738,y:962,width:150,height:80},{restorable:true}),
  prop('garden-shop','garden',184,482,170,164,{x:100,y:420,width:156,height:62},{restorable:true}),
  prop('theater','canopy',500,176,352,166,{x:335,y:105,width:330,height:71},{restorable:true}),
  // Ordinary facades share place bookkeeping; attack coverage still owns their visible color.
  prop('frontage-east-entry','repair',805,1740,240,201,{x:695,y:1640,width:210,height:100},{restorable:true,restorationId:'ticket-kiosk',materialVariant:'tailor'}),
  prop('frontage-east-records','shop',790,1515,280,260,{x:670,y:1385,width:240,height:116},{restorable:true,restorationId:'record-shop',materialVariant:'bookshop'}),
  prop('frontage-east-middle','shop',790,1305,280,260,{x:670,y:1175,width:240,height:116},{restorable:true,restorationId:'repair-shop',materialVariant:'cafe'}),
  prop('frontage-west-middle','repair',350,1250,240,201,{x:240,y:1150,width:210,height:100},{restorable:true,restorationId:'repair-shop',materialVariant:'rehearsal'}),
  prop('frontage-west-entry','repair',350,1660,240,201,{x:240,y:1560,width:210,height:100},{restorable:true,restorationId:'record-shop'}),
  prop('frontage-east-forecourt','garden',820,790,220,212,{x:710,y:708,width:202,height:82},{restorable:true,restorationId:'garden-shop'}),
  prop('loading-gate','gate',175,1020,80,45,{x:135,y:1005,width:80,height:15},
    {interaction:'open',label:'推开装卸门',openedLabel:'装卸巷已通',near:155}),
  prop('acoustic-panel','panel',530,640,150,64,{x:455,y:625,width:150,height:15},
    {interaction:'fold',label:'收起展板',openedLabel:'展板已收拢',near:155}),
  prop('records-tree','tree',158,1400,90,120,{x:146,y:1380,width:24,height:16},{restorable:true,restorationId:'record-shop'}),
  prop('repair-tree','tree',490,1080,90,120,{x:478,y:1060,width:24,height:16},{restorable:true,restorationId:'repair-shop'}),
  prop('kiosk-tree','tree',927,1050,90,120,{x:915,y:1030,width:24,height:16},{restorable:true,restorationId:'ticket-kiosk'}),
  prop('garden-tree','tree',65,520,90,120,{x:53,y:500,width:24,height:16},{restorable:true,restorationId:'garden-shop'}),
  prop('crossing-tree','tree',170,785,90,120,{x:158,y:765,width:24,height:16},{restorable:true,restorationId:'repair-shop'}),
  prop('south-tree','tree',945,1520,90,120,{x:933,y:1500,width:24,height:16},{restorable:true,restorationId:'ticket-kiosk'}),
  prop('theater-tree-l','tree',245,210,90,120,{x:233,y:190,width:24,height:16},{restorable:true,restorationId:'theater'}),
  prop('theater-tree-r','tree',745,210,90,120,{x:733,y:190,width:24,height:16},{restorable:true,restorationId:'theater'}),
]);

export const OLD_STREET_ASSETS = Object.freeze(['ground','shop','shop-muted','repair','repair-muted',
  'garden','garden-muted','kiosk','kiosk-muted','canopy','canopy-muted','tree','tree-muted',
  'gate','panel','lamp','speaker','power','bookshop','bookshop-muted','cafe','cafe-muted',
  'tailor','tailor-muted','rehearsal','rehearsal-muted']);

export class OldStreetState {
  constructor(props=OLD_STREET_PROPS,terrain=[]) { this.props=props;this.terrain=terrain;this.opened=new Set(); this.restored=new Set(); }
  isOpen(id) { return this.opened.has(id); }
  blockers() { return [...this.props.filter(p=>p.footprint&&!this.opened.has(p.id)),...this.terrain]; }
  clearLine(from,to,padding=0,ignoreId=null) {
    if(![from?.x,from?.y,to?.x,to?.y].every(Number.isFinite))return false;
    const line={x1:from.x,y1:from.y,x2:to.x,y2:to.y};
    return !this.blockers().some(p=> {
      if(p.id===ignoreId)return false;
      const r=p.footprint;
      return lineToRectangle(line,{x:r.x-padding,y:r.y-padding,
        right:r.x+r.width+padding,bottom:r.y+r.height+padding});
    });
  }
  interact(id,player) {
    const prop=this.props.find(p=>p.id===id&&p.interaction);
    if(!prop||this.opened.has(id)||Math.hypot(player.x-prop.x,player.y-prop.y)>prop.near
      ||!this.clearLine(player,prop,0,id)) return false;
    this.opened.add(id);return true;
  }
  restore(id) {
    if(id)this.restored.add(id);
    if(id==='record-shop'&&this.props.some(p=>p.id==='loading-gate'))this.opened.add('loading-gate');
  }
}
