// Registration describes existing owners, not completion or final-art approval.
const define=(id,name,domainId,dependencies,owners,pages=[],scope='v1')=>({id,name,domainId,scope,
 runtime:owners.length>0,dependencies,owners,pages});
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export const PUBLIC_PRODUCT_MODULES=freeze([
 define('shell','全局导航','foundation',[],['src/systems/PublicShellView.mjs','src/utils/publicShellSceneEntry.mjs','src/utils/publicProductHub.mjs'],['desk','playhub','backstage']),
 define('presentation','界面与演出','foundation',['shell'],['src/systems/PerformanceSequenceView.mjs','src/systems/SystemScreenFrame.mjs']),
 define('save','本地存档','foundation',[],['src/utils/publicRunProgression.mjs','src/utils/playerPreferences.mjs','src/utils/publicBattleCheckpoint.mjs','src/utils/publicBattleVisual.mjs','src/utils/publicSaveBundle.mjs']),
 define('audio','声音与设置','foundation',['shell','save'],['src/systems/PlayerSessionExperience.mjs','src/utils/p17AudioRuntime.mjs'],['services']),
 define('chapter','巡演章节','campaign',['save','presentation'],['src/utils/publicChapterContent.mjs','src/utils/publicPerformanceAccess.mjs'],['tour','preflight']),
 define('story','剧情与档案','campaign',['chapter','save','presentation'],['src/utils/publicStoryPlayback.mjs','src/systems/ChapterArchiveView.mjs'],['records','chapterArchive']),
 define('encounter','遭遇与压轴','battle',['chapter','kits','pigment'],['src/systems/PublicStage1EncounterDirector.mjs','src/systems/PublicStage1FinaleController.mjs']),
 define('settlement','演出结算','battle',['save','economy','chapter'],['src/systems/PublicRunSettlement.mjs']),
 define('kits','人物战斗','battle',['presentation'],['src/systems/PublicStage1PerformerRun.mjs','src/utils/publicBattleAbilities.mjs']),
 define('build','局内编排','battle',['kits','pigment'],['src/utils/publicBuildContent.mjs'],['library']),
 define('pigment','世界涂染','battle',['kits','presentation','save'],['src/systems/PaintZoneSystem.js','src/systems/PublicPaintContactReceipt.mjs']),
 define('roster','成员管理','members',['save','presentation'],['src/systems/PublicShellView.mjs'],['roster']),
 define('growth','训练与成长','members',['roster','economy','save'],['src/utils/publicPreparation.mjs','src/utils/publicPreparationCatalog.mjs'],['workshop','growth']),
 define('inventory','装备与配装','members',['roster','economy','save'],['src/utils/publicEquipmentInventory.mjs'],['inventory']),
 define('bonds','关系与个人故事','members',['roster','story','save'],['src/systems/ProductModuleScreens.mjs','src/utils/publicBackstageProgress.mjs'],['lounge'],'later'),
 define('challenge','排练与连演','modes',['encounter','build','save'],['src/utils/publicFinaleTrial.mjs','src/utils/publicRehearsal.mjs'],['finaleTrial','rehearsal']),
 define('sideplay','附加玩法','modes',['save','presentation'],['src/systems/ProductModuleScreens.mjs'],['sideplay'],'later'),
 define('events','活动与专题','operations',['chapter','story','economy','settlement'],['src/systems/ProductModuleScreens.mjs'],['events'],'later'),
 define('recruit','成员获取','operations',['roster','inventory','economy','save'],['src/systems/ProductModuleScreens.mjs'],['recruitment'],'later'),
 define('tasks','个人演出目标','operations',['settlement','economy','save'],['src/utils/publicRunGoals.mjs'],['goals'],'later'),
 define('economy','现有资源政策','operations',['save'],['src/utils/publicPreparation.mjs']),
 define('venue','场馆经营','venue',['chapter','inventory','economy','roster','story','save'],['src/systems/ProductModuleScreens.mjs','src/utils/publicBackstageProgress.mjs'],['venue']),
 define('cloud','账号与云存档','services',['save'],[],[],'service'),
 define('social','社交与联机','services',['cloud','settlement'],[],[],'service'),
 define('platform','平台服务接入','services',['save','cloud'],[],[],'service'),
]);
export const PUBLIC_PRODUCT_MODES=freeze([
 {id:'campaign',moduleId:'encounter',entryPage:'preflight',policy:{checkpoint:true,profileResult:true}},
 {id:'finale-trial',moduleId:'challenge',entryPage:'finaleTrial',requiredChapterIds:['opening','neon','encore'],policy:{checkpoint:false,profileResult:false}},
 {id:'rehearsal',moduleId:'challenge',entryPage:'rehearsal',policy:{checkpoint:false,profileResult:false}},
]);
export const PUBLIC_PRODUCT_STORES=freeze([
 {id:'profile',moduleId:'save',kind:'primary',ownerFile:'src/utils/publicRunProgression.mjs',keyExport:'PUBLIC_PROFILE_STORAGE_KEY'},
 {id:'preferences',moduleId:'save',kind:'preferences',ownerFile:'src/utils/playerPreferences.mjs',keyExport:'PLAYER_PREFERENCES_KEY'},
 {id:'battle-checkpoint',moduleId:'save',kind:'checkpoint',ownerFile:'src/utils/publicBattleCheckpoint.mjs',keyExport:'PUBLIC_BATTLE_CHECKPOINT_KEY'},
 {id:'battle-visual',moduleId:'save',kind:'sidecar',ownerFile:'src/utils/publicBattleVisual.mjs',parentId:'battle-checkpoint'},
 {id:'backstage',moduleId:'bonds',kind:'primary',ownerFile:'src/utils/publicBackstageProgress.mjs',keyExport:'BACKSTAGE_STORAGE_KEY'},
]);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const id=value=>typeof value==='string'&&/^[a-z][a-z0-9-]*$/.test(value);
const pageId=value=>typeof value==='string'&&/^[a-z][a-zA-Z0-9]*$/.test(value);
const text=value=>typeof value==='string'&&value.trim().length>0;
const list=(value,test)=>Array.isArray(value)&&Array.from(value).every(test)&&new Set(value).size===value.length;
const ownerFile=value=>typeof value==='string'&&/^src\/[a-zA-Z0-9_/-]+\.m?js$/.test(value);
const moduleIndex=new Map(PUBLIC_PRODUCT_MODULES.map(row=>[row.id,row]));
const pageIndex=new Map(PUBLIC_PRODUCT_MODULES.flatMap(row=>row.pages.map(page=>[page,row.id])));
const availability=new Map();
export function getPublicProductModule(moduleId,modules=PUBLIC_PRODUCT_MODULES){
 if(modules===PUBLIC_PRODUCT_MODULES)return typeof moduleId==='string'?moduleIndex.get(moduleId)??null:null;
 return typeof moduleId==='string'&&Array.isArray(modules)?modules.find(row=>row?.id===moduleId)??null:null;
}
export function isPublicProductModuleAvailable(moduleId,modules=PUBLIC_PRODUCT_MODULES){
 const visiting=new Set(),cache=modules===PUBLIC_PRODUCT_MODULES?availability:new Map();
 const visit=key=>{if(cache.has(key))return cache.get(key);const row=getPublicProductModule(key,modules);if(!row||row.runtime!==true||!list(row.dependencies,id)||!list(row.owners,ownerFile)||!row.owners.length||visiting.has(key))return false;
  visiting.add(key);const available=row.dependencies.every(visit);visiting.delete(key);cache.set(key,available);return available;};
 return visit(moduleId);
}
export function getPublicPageModuleId(page,modules=PUBLIC_PRODUCT_MODULES){
 if(typeof page!=='string'||!Array.isArray(modules))return null;
 if(modules===PUBLIC_PRODUCT_MODULES){const key=pageIndex.get(page);return key&&isPublicProductModuleAvailable(key)?key:null;}
 const rows=modules.filter(row=>Array.isArray(row?.pages)&&row.pages.includes(page));
 return rows.length===1&&isPublicProductModuleAvailable(rows[0].id,modules)?rows[0].id:null;
}
export function getPublicProductMode(modeId){
 const mode=typeof modeId==='string'?PUBLIC_PRODUCT_MODES.find(row=>row.id===modeId):null;
 return mode&&isPublicProductModuleAvailable(mode.moduleId)?mode:null;
}
export function validatePublicProductFramework({modules=PUBLIC_PRODUCT_MODULES,modes=PUBLIC_PRODUCT_MODES,stores=PUBLIC_PRODUCT_STORES,routes}={}){
 const errors=[],fail=(key,field)=>errors.push({id:key??null,field});
 if(!Array.isArray(modules)||!modules.length)return[{id:null,field:'modules'}];
 const byId=new Map(),pages=new Map();
 for(const row of modules){
  if(!record(row)){fail(null,'module');continue;}
  if(!id(row.id)||byId.has(row.id))fail(row.id,'module-id');byId.set(row.id,row);
  if(!text(row.name)||!id(row.domainId)||!['v1','later','service'].includes(row.scope)||typeof row.runtime!=='boolean')fail(row.id,'module-fields');
  if(!list(row.dependencies,id)||row.dependencies.includes(row.id))fail(row.id,'dependencies');
  if(!list(row.owners,ownerFile)||row.runtime&&!row.owners.length||!row.runtime&&row.owners?.length)fail(row.id,'owners');
  if(!list(row.pages,pageId)){fail(row.id,'pages');continue;}
  if(!row.runtime&&row.pages.length)fail(row.id,'planned-pages');
  for(const page of row.pages){if(pages.has(page))fail(page,'page-owner');pages.set(page,row.id);}
 }
 for(const row of byId.values())if(Array.isArray(row.dependencies))for(const parent of row.dependencies)if(!byId.has(parent))fail(row.id,'unknown-dependency');
 const visited=new Set(),active=new Set();
 const visit=key=>{if(active.has(key)){fail(key,'dependency-cycle');return;}if(visited.has(key))return;active.add(key);
  const deps=byId.get(key)?.dependencies;if(Array.isArray(deps))for(const parent of deps)if(byId.has(parent))visit(parent);active.delete(key);visited.add(key);};
 for(const key of byId.keys())visit(key);
 for(const row of byId.values())if(row.runtime&&!isPublicProductModuleAvailable(row.id,modules))fail(row.id,'runtime-dependency');
 if(routes!==undefined){
  if(!Array.isArray(routes))fail(null,'routes');
  else{const routeIds=new Set(routes.map(row=>row?.id));
   for(const row of routes){if(!record(row)||!pageId(row.id)){fail(null,'route');continue;}
    if(row.moduleId!==getPublicPageModuleId(row.id,modules)||row.moduleId===null)fail(row.id,'route-owner');
    if(!routeIds.has(row.rootId)||row.parentId!==null&&!routeIds.has(row.parentId))fail(row.id,'route-parent');
    if(!routes.some(root=>root?.id===row.rootId&&root.navigation))fail(row.id,'route-root');
   }
   if(routeIds.size!==routes.length)fail(null,'route-id');
   for(const page of pages.keys())if(!routeIds.has(page))fail(page,'missing-route');
   const parents=new Map(routes.filter(record).map(row=>[row.id,row.parentId]));
   for(const key of parents.keys()){const seen=new Set();let at=key;while(at!==null&&parents.has(at)){if(seen.has(at)){fail(key,'route-cycle');break;}seen.add(at);at=parents.get(at);}}
  }
 }
 if(!Array.isArray(modes))fail(null,'modes');
 else{const seen=new Set();for(const row of modes){
  if(!record(row)){fail(null,'mode');continue;}if(!id(row.id)||seen.has(row.id))fail(row.id,'mode-id');seen.add(row.id);
  if(!isPublicProductModuleAvailable(row.moduleId,modules)||!getPublicPageModuleId(row.entryPage,modules))fail(row.id,'mode-owner');
  if(!record(row.policy)||Object.keys(row.policy).sort().join('|')!=='checkpoint|profileResult'||Object.values(row.policy).some(v=>typeof v!=='boolean'))fail(row.id,'mode-policy');
 }}
 if(!Array.isArray(stores))fail(null,'stores');
 else{const seen=new Set(),keys=new Set();for(const row of stores){
  if(!record(row)){fail(null,'store');continue;}if(!id(row.id)||seen.has(row.id))fail(row.id,'store-id');seen.add(row.id);
  const owner=getPublicProductModule(row.moduleId,modules);
  if(!isPublicProductModuleAvailable(row.moduleId,modules)||!owner?.owners?.includes(row.ownerFile)||!ownerFile(row.ownerFile))fail(row.id,'store-owner');
  if(!['primary','preferences','checkpoint','sidecar'].includes(row.kind))fail(row.id,'store-kind');
  if(row.kind==='sidecar'){if(!stores.some(parent=>parent?.id===row.parentId&&parent.kind==='checkpoint')||row.keyExport!==undefined)fail(row.id,'store-parent');}
  else{const key=row.ownerFile+':'+row.keyExport;if(typeof row.keyExport!=='string'||!/^[A-Z][A-Z0-9_]*$/.test(row.keyExport)||keys.has(key))fail(row.id,'store-key');keys.add(key);}
 }}
 return errors;
}
