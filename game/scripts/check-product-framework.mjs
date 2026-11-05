import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
import {PUBLIC_PRODUCT_MODULES,PUBLIC_PRODUCT_MODES,PUBLIC_PRODUCT_STORES,validatePublicProductFramework} from '../src/utils/publicProductModules.mjs';
import {PUBLIC_SHELL_ROUTES} from '../src/utils/publicShellNavigation.mjs';
export async function assertProductFramework(root,{modules=PUBLIC_PRODUCT_MODULES,modes=PUBLIC_PRODUCT_MODES,stores=PUBLIC_PRODUCT_STORES,routes=PUBLIC_SHELL_ROUTES,exists=fs.existsSync}={}){
 const errors=validatePublicProductFramework({modules,modes,stores,routes});if(errors.length)throw new Error('Product framework contract: '+JSON.stringify(errors));
 const owners=[...new Set(modules.flatMap(row=>row.owners))];
 for(const owner of owners)if(!exists(path.join(root,owner)))throw new Error('Missing product owner: '+owner);
 const keys=new Set();
 for(const store of stores){if(store.kind==='sidecar')continue;const source=await import(pathToFileURL(path.resolve(root,store.ownerFile)).href),key=source[store.keyExport];
  if(typeof key!=='string'||!key.length)throw new Error('Missing product key export: '+store.id+':'+store.keyExport);
  if(keys.has(key))throw new Error('Duplicate product storage key: '+store.id);keys.add(key);
 }
 return{modules:modules.length,runtimeModules:modules.filter(row=>row.runtime).length,plannedModules:modules.filter(row=>!row.runtime).length,pages:routes.length,roots:routes.filter(row=>row.navigation).length,modes:modes.length,stores:stores.length,primaryKeys:keys.size,ownerFiles:owners.length,artAccepted:false,contentComplete:false};
}
export function productFrameworkGuard(){let root;return{name:'starush-product-framework-guard',apply:'build',configResolved(config){root=config.root;},async buildStart(){console.log('[product-framework-guard] '+JSON.stringify(await assertProductFramework(root)));}};}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))assertProductFramework(path.resolve(import.meta.dirname,'..'))
 .then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1;});
