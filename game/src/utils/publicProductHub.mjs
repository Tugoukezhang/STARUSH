import {PUBLIC_PRODUCT_MODULES} from './publicProductModules.mjs';

const definitions=Object.freeze({
 foundation:['公演后台','clapperboard'],campaign:['巡演与故事','route'],battle:['现场演出','music'],
 members:['成员与陪伴','users'],modes:['演出玩法','play'],operations:['企划与物资','book-open'],
 venue:['场馆事务','home'],services:['设置与服务','settings-2'],
});
const destinations=Object.freeze({
 shell:['desk','clapperboard','回到当前成员与下一场公演'],presentation:['lounge','sparkles','角色展示与互动演出'],
 save:['services','save','完整备份、恢复与中途续玩'],audio:['services','volume-2','声音、字幕与演出设置'],
 chapter:['tour','route','三站巡演与各站现场目标'],story:['records','book-open','章节故事、回顾与演出记录'],
 encounter:['preflight','swords','设施、遭遇与压轴登场'],settlement:['records','flag','本机真实成绩与演出结果'],
 kits:['roster','users','步枪、重锤与翡翠风歌'],build:['library','layers','局内改装与行动编排'],
 pigment:['preflight','palette','战斗中的街道与建筑涂染'],roster:['roster','users','成员预览、出战与配置'],
 growth:['workshop','clapperboard','训练阶位与已拥有配件'],inventory:['inventory','backpack','物件展示、兼容与装备'],
 bonds:['lounge','heart','休息室话题与本机相处记录'],challenge:['playhub','swords','排练与三站压轴连演'],
 sideplay:['sideplay','gamepad-2','现场练习与附加玩法目录'],events:['events','calendar','本地公演企划与目标'],
 recruit:['recruitment','user-plus','三位初始成员与加入档案'],tasks:['goals','check','选择本场个人演出目标'],
 economy:['workshop','ticket','已保存练习笔记与训练支出'],venue:['venue','home','房间、成员排班与节目准备'],
 cloud:['services','cloud','账号与云存档服务尚未接入'],social:['services','users','好友与联机服务尚未接入'],
 platform:['services','settings-2','平台账号、支付与发布服务尚未接入'],
});
const framework=new Set(['presentation','bonds','venue','events','recruit','sideplay']);
const services=new Set(['cloud','social','platform']);
export function getProductHubSections(){
 return Object.freeze(Object.entries(definitions).map(([id,[label,icon]])=>Object.freeze({id,label,icon,
  entries:Object.freeze(PUBLIC_PRODUCT_MODULES.filter(row=>row.domainId===id).map(row=>{
   const [page,entryIcon,description]=destinations[row.id];
   return Object.freeze({id:row.id,label:row.name,description,icon:entryIcon,page,
    status:services.has(row.id)?'service-required':framework.has(row.id)?'framework':'available'});
  })),
 })));
}
