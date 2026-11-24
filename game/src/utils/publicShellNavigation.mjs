import {getPublicPageModuleId} from './publicProductModules.mjs';
const root=(label,icon,callback=null)=>Object.freeze({label,icon,callback});
export const PUBLIC_SHELL_ROUTES=Object.freeze([
  {id:'desk',title:'主界面',domainId:'foundation',rootId:'desk',parentId:null,navigation:root('主页','clapperboard','onBack')},
  {id:'roster',title:'偶像名册',domainId:'members',rootId:'roster',parentId:'desk',navigation:root('成员','users','onRoster')},
  {id:'tour',title:'巡演路线',domainId:'performance',rootId:'tour',parentId:'desk',navigation:root('巡演','route','onTour')},
  {id:'inventory',title:'装备背包',domainId:'members',rootId:'inventory',parentId:'desk',navigation:root('背包','backpack')},
  {id:'records',title:'公演档案',domainId:'archive',rootId:'records',parentId:'desk',navigation:root('档案','book-open')},
  {id:'workshop',title:'成员训练',domainId:'members',rootId:'roster',parentId:'roster'},
  {id:'preflight',title:'出战准备',domainId:'performance',rootId:'tour',parentId:'tour'},
  {id:'playhub',title:'压轴排练',domainId:'performance',rootId:'tour',parentId:'tour'},
  {id:'goals',title:'本场目标',domainId:'performance',rootId:'tour',parentId:'playhub'},
  {id:'library',title:'编排资料库',domainId:'performance',rootId:'tour',parentId:'playhub'},
  {id:'growth',title:'成长资料',domainId:'members',rootId:'roster',parentId:'workshop'},
  {id:'finaleTrial',title:'压轴连演',domainId:'performance',rootId:'tour',parentId:'playhub'},
  {id:'rehearsal',title:'压轴排练室',domainId:'performance',rootId:'tour',parentId:'playhub'},
  {id:'chapterArchive',title:'章节现场档案',domainId:'archive',rootId:'records',parentId:'records'},
  {id:'backstage',title:'巡演后台',domainId:'foundation',rootId:'desk',parentId:'desk'},
  {id:'lounge',title:'成员休息室',domainId:'members',rootId:'desk',parentId:'desk'},
  {id:'venue',title:'场馆事务',domainId:'venue',rootId:'desk',parentId:'desk'},
  {id:'events',title:'公演企划',domainId:'operations',rootId:'desk',parentId:'backstage'},
  {id:'recruitment',title:'成员介绍',domainId:'operations',rootId:'desk',parentId:'backstage'},
  {id:'sideplay',title:'练习广场',domainId:'performance',rootId:'desk',parentId:'backstage'},
  {id:'services',title:'设置与服务',domainId:'foundation',rootId:'desk',parentId:'backstage'},
].map(row=>Object.freeze({...row,moduleId:getPublicPageModuleId(row.id)})));
export const PUBLIC_SHELL_ROOTS=Object.freeze(PUBLIC_SHELL_ROUTES.filter(row=>row.navigation));
export const getPublicShellRoute=id=>typeof id==='string'?PUBLIC_SHELL_ROUTES.find(row=>row.id===id&&row.moduleId!==null&&row.moduleId===getPublicPageModuleId(id))??null:null;
export const isPublicShellPage=id=>getPublicShellRoute(id)!==null;
export const getPublicShellRootId=id=>getPublicShellRoute(id)?.rootId??null;
