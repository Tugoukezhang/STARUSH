import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,statSync,utimesSync} from 'node:fs';
import {join,relative,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer,request} from 'node:http';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

for(const mode of ['no-store','revalidate'])test(`static delivery ${mode} validates content without stale same-path assets`,async()=>{
 const dir=mkdtempSync(join(tmpdir(),'starush-cache-'));mkdirSync(join(dir,'dist'));
 const actor=join(dir,'dist/actor.webp'),script=join(dir,'dist/game.js');
 const text='const stage = "original";\n'.repeat(1000);
 writeFileSync(join(dir,'dist/index.html'),'<!doctype html><title>ST RUSH</title>');writeFileSync(actor,Buffer.from([1,2,3,4]));writeFileSync(script,text);
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
 const child=spawn(process.execPath,[fileURLToPath(new URL('../scripts/qa-static-server.mjs',import.meta.url)),'--port',String(port),'--ttl','30',...(mode==='revalidate'?['--cache',mode]:[])],{cwd:dir,windowsHide:true,stdio:'ignore'}),closed=once(child,'exit');
 const get=(pathname,headers={},method='GET')=>new Promise((resolve,reject)=>{
  const req=request({hostname:'127.0.0.1',port,path:pathname,method,headers},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));res.on('error',reject);});req.on('error',reject);req.end();
 });
 try{
  let health;for(let i=0;i<60;i++){health=await get('/__qa_health').catch(()=>null);if(health?.status===200)break;await new Promise(r=>setTimeout(r,50));}assert.equal(health?.status,200);
  assert.equal(health.headers['cache-control'],'no-store');
  const first=await get('/actor.webp');assert.equal(first.status,200);assert.deepEqual(first.body,Buffer.from([1,2,3,4]));
  if(mode==='no-store'){
   assert.equal(first.headers['cache-control'],'no-store');assert.equal(first.headers.etag,undefined);
   assert.equal((await get('/actor.webp',{'If-None-Match':'*'})).status,200);return;
  }
  assert.equal(first.headers['cache-control'],'no-cache');assert.match(first.headers.etag,/^W\/"[a-f0-9]{64}"$/);
  for(const tag of [first.headers.etag,first.headers.etag.slice(2),`"other", ${first.headers.etag}`,'*']){
   const same=await get('/actor.webp',{'If-None-Match':tag});assert.equal(same.status,304);assert.equal(same.body.length,0);assert.equal(same.headers.etag,first.headers.etag);assert.equal(same.headers['cache-control'],'no-cache');
  }
  assert.equal((await get('/actor.webp',{'If-None-Match':first.headers.etag},'HEAD')).status,304);
  assert.equal((await get('/actor.webp',{'If-None-Match':'"other"'})).status,200);
  const info=statSync(actor);writeFileSync(actor,Buffer.from([4,3,2,1]));utimesSync(actor,info.atime,info.mtime);
  const updated=await get('/actor.webp',{'If-None-Match':first.headers.etag});assert.equal(updated.status,200);assert.notEqual(updated.headers.etag,first.headers.etag);assert.deepEqual(updated.body,Buffer.from([4,3,2,1]));
  const zipped=await get('/game.js',{'Accept-Encoding':'gzip'});assert.equal(zipped.headers['content-encoding'],'gzip');assert.equal(gunzipSync(zipped.body).toString(),text);
  const zipCached=await get('/game.js',{'Accept-Encoding':'gzip','If-None-Match':zipped.headers.etag});assert.equal(zipCached.status,304);assert.equal(zipCached.headers.vary,'Accept-Encoding');assert.equal(zipCached.body.length,0);
  const identity=await get('/game.js',{'Accept-Encoding':'gzip;q=0'});assert.equal(identity.headers['content-encoding'],undefined);assert.equal(identity.body.toString(),text);
  assert.equal((await get('/game.js',{},'HEAD')).body.length,0);
  for(const p of ['/','/index.html','/extensionless-route','/runtime-payload.json']){
   if(p.endsWith('.json'))writeFileSync(join(dir,'dist/runtime-payload.json'),'{}');
   const r=await get(p,{'If-None-Match':'*'});assert.equal(r.status,200);assert.equal(r.headers['cache-control'],'no-store');assert.equal(r.headers.etag,undefined);
  }
  const missing=await get('/missing.webp',{'If-None-Match':'*'});assert.equal(missing.status,404);assert.equal(missing.headers['cache-control'],'no-store');
 }finally{
  if(child.exitCode===null)child.kill();await closed;assert.equal(await get('/__qa_health').catch(()=>null),null);
  const scoped=relative(tmpdir(),dir);assert(!isAbsolute(scoped)&&!scoped.startsWith('..')&&scoped.startsWith('starush-cache-'));rmSync(dir,{recursive:true,force:true});
 }
});
