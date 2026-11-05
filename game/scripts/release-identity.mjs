import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {PUBLIC_RULESET_ID} from '../src/utils/releaseIdentity.mjs';

export function createReleaseIdentity(root, assets) {
  const hash=crypto.createHash('sha256');
  const files=['index.html','package.json','package-lock.json','vite.config.js',
    'scripts/runtime-payload.mjs','scripts/release-identity.mjs'];
  const walk=dir=>{
    for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
      const relative=`${dir}/${entry.name}`;
      if(entry.isSymbolicLink())throw Error(`Release source symlink: ${relative}`);
      if(entry.isDirectory())walk(relative);else if(entry.isFile())files.push(relative);
    }
  };
  walk('src');
  for(const file of files.sort()){
    const bytes=fs.readFileSync(path.join(root,file));
    hash.update(`${file}\0${bytes.length}\0`);hash.update(bytes);
  }
  for(const row of [...assets].sort((a,b)=>a.file.localeCompare(b.file)))hash.update(`\0${row.file}\0${row.sha256}`);
  return {buildId:`rc-${hash.digest('hex').slice(0,12)}`,rulesetId:PUBLIC_RULESET_ID};
}
