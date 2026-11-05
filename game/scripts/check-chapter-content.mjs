import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {PUBLIC_CHAPTER_CONTENT,validateChapterContent} from '../src/utils/publicChapterContent.mjs';
import {PUBLIC_CHAPTER_SCENES} from '../src/utils/publicCampaign.mjs';
import {RUNTIME_PAYLOAD} from './runtime-payload.mjs';
export function assertChapterContent(root,{chapters=PUBLIC_CHAPTER_CONTENT,exists=fs.existsSync}={}){
 const errors=validateChapterContent(chapters);if(errors.length)throw new Error('Chapter content contract: '+JSON.stringify(errors));
 for(const row of chapters)if(!PUBLIC_CHAPTER_SCENES[row.sceneId]?.length)throw new Error('Unbound chapter scene: '+row.id);
 const resources=[...new Set(chapters.flatMap(row=>Object.values(row.resources)))];
 const published=new Set(RUNTIME_PAYLOAD.map(row=>row.file));
 for(const file of resources)if(!published.has(file))throw new Error('Chapter resource not in runtime payload: '+file);
 for(const file of resources)if(!exists(path.join(root,'public',file)))throw new Error('Missing chapter resource: '+file);
 return{chapters:chapters.length,ids:chapters.map(row=>row.id),resources:resources.length};
}
export function chapterContentGuard(){let root;return{name:'starush-chapter-content-guard',apply:'build',configResolved(config){root=config.root;},buildStart(){console.log('[chapter-content-guard] '+JSON.stringify(assertChapterContent(root)));}};}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(assertChapterContent(path.resolve(import.meta.dirname,'..'))));
