import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {fileURLToPath} from 'node:url';
import {assertChapterContent,chapterContentGuard} from '../scripts/check-chapter-content.mjs';
import {PUBLIC_CHAPTER_CONTENT} from '../src/utils/publicChapterContent.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
test('build gate checks all twelve real resources and refuses an actual missing reference',()=>{
 const report=assertChapterContent(root);assert.deepEqual(report,{chapters:5,ids:['opening','neon','encore','raincheck','homecoming'],resources:12});
 assert.throws(()=>assertChapterContent(root,{exists:file=>!file.endsWith('neon.webp')&&fs.existsSync(file)}),/Missing chapter resource.*neon.webp/);
});
test('Vite hook invokes the same guard and both normal and Q builds include it',()=>{
 const plugin=chapterContentGuard();assert.equal(plugin.apply,'build');plugin.configResolved({root});plugin.buildStart();
 const bad=chapterContentGuard();bad.configResolved({root:root+'/absent-root'});assert.throws(()=>bad.buildStart(),/Missing chapter resource/);
 const config=fs.readFileSync(new URL('../vite.config.js',import.meta.url),'utf8');assert.equal(config.match(/plugins: \[chapterContentGuard\(\),/g)?.length,2);
});
test('existing but source-only art cannot pass the release-content gate',()=>{
 const chapters=JSON.parse(JSON.stringify(PUBLIC_CHAPTER_CONTENT));chapters[0].resources.venue='art/enjo-layered-20261007/enjo-parts.webp';
 assert.throws(()=>assertChapterContent(root,{chapters}),/not in runtime payload/);
});
