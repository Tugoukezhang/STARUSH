import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {buildGenyaPose} from '../src/systems/GenyaLayeredPresentation.mjs';
import {buildEnjoPose,ENJO_ART} from '../src/systems/EnjoLayeredPresentation.mjs';
import {applyObliquePose,obliqueArt} from '../src/systems/LayeredObliquePresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';

const source=new URL('../../01-美术/team-hurt-expression-source-20261007/',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,source)));
const manifest=read('source_manifest.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const faceUpdate=JSON.parse(fs.readFileSync(new URL('./fixtures/genyaFaceMaterial.json',import.meta.url)));
const teamFaceUpdate=JSON.parse(fs.readFileSync(new URL('./fixtures/teamFaceMaterial.json',import.meta.url)));
const currentFaces=[...faceUpdate.rows.map(r=>({...r,source:faceUpdate.source})),...teamFaceUpdate.rows];

for(const entry of manifest.exports)test(entry.file+' uses the reviewed expression pixels without changing registration',async()=>{
 const actual=new URL('../'+entry.runtime,import.meta.url),reviewed=new URL('candidate/'+entry.file,source);
 assert.equal(sha(fs.readFileSync(reviewed)),entry.sha256,'historical reviewed export changed');
 const frames=JSON.parse(fs.readFileSync(new URL('../'+entry.runtime.replace('.webp','.json'),import.meta.url))).frames;
 // Historical expression exports stay immutable; only explicitly superseded face frames use the later review.
 const faces=Object.entries(frames).filter(([name])=>/\/(?:face|hurtFace|closedFace)$/.test(name));
 assert(faces.length>=3);
 for(const [name,{frame}] of faces){
  const region={left:frame.x,top:frame.y,width:frame.w,height:frame.h};
  const updated=currentFaces.find(r=>r.asset===entry.runtime&&r.parts.some(p=>p.direction+'/'+p.name===name));
  const currentReview=updated?new URL('../../'+updated.source+'/export/'+updated.asset.split('/').at(-1),import.meta.url):reviewed;
  if(updated)assert.equal(sha(fs.readFileSync(currentReview)),updated.sha,'superseding reviewed export changed');
  const expected=await sharp(fs.readFileSync(currentReview)).extract(region).ensureAlpha().raw().toBuffer();
  const pixels=await sharp(fs.readFileSync(actual)).extract(region).ensureAlpha().raw().toBuffer();
  assert.deepEqual(pixels,expected,'reviewed expression changed: '+name);
 }
 assert.equal(sha(fs.readFileSync(new URL('../'+entry.runtime.replace('.webp','.json'),import.meta.url))),entry.registrationSHA);
 // The historical face export stays verified above; a reviewed whole-atlas repaint supersedes its release path.
 const released=entry.file==='genya-oblique.webp'?obliqueArt('genya').image:entry.file==='enjo-parts.webp'?ENJO_ART.image:entry.runtime.slice(7);
 assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===released).length,1);
});

test('only three independent face edits have complete source lineage; no full source package ships',()=>{
 assert.deepEqual(manifest.lineage.map(r=>r.name),['genya-down-left','genya-down-right','enjo-down']);
 assert.equal(manifest.source_only,true);assert.equal(manifest.ai_assisted,true);
 for(const gate of ['human_paintover','final_art','runtime_authorized','program_authorized','copy_to_runtime','approved_for_runtime','rig_sdk_ready'])assert.equal(manifest[gate],false);
 for(const row of manifest.lineage){
  assert.equal(sha(fs.readFileSync(new URL(row.candidate,source))),row.candidateSHA);
  assert.equal(sha(fs.readFileSync(new URL(row.generatedFile,source))),row.generatedSHA);
  assert.equal(sha(fs.readFileSync(new URL(row.aperture,source))),row.apertureSHA);
  assert(row.changedPixels>500);assert(row.frame.endsWith('/hurtFace'));
 }
 assert(!RUNTIME_PAYLOAD.some(r=>/team-hurt-expression-source|before-after-source|aperture|prompts/.test(r.file)));
});

for(const [id,build]of [['genya',buildGenyaPose],['enjo',buildEnjoPose]])test(id+' hit expression wins over blink, keeps feet and owns no extra pose node',()=>{
 const input={root:{x:100,y:100},facing:'down',legFacing:'down',state:'hurt',clock:100,phase:.4,blink:true};
 const a=build(input),b=build({...input,state:'idle'});
 assert.equal(a.parts.find(p=>p.name==='face').frame,'down/hurtFace');
 assert.deepEqual(a.feet,b.feet);assert.deepEqual(a.root,b.root);assert.equal(a.parts.length,b.parts.length);
 for(const dir of ['down-left','down-right']){
  const pose=applyObliquePose({...a,visualFacing:dir,visualLegFacing:'down'},build,id);
  assert.equal(pose.parts.find(p=>p.name==='face').frame,dir+'/hurtFace');
  assert.deepEqual(pose.feet,a.feet);
 }
 assert.equal(build({...input,defeat:.65}).parts.find(p=>p.name==='face').frame,'down/closedFace');
});
