import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.STARUSH_TEST_ROOT||fileURLToPath(new URL('..',import.meta.url));
const {SAKURA_NATIVE_ART,SAKURA_DIRECTION_ART,SAKURA_NATIVE_TURN_ART}=await import(pathToFileURL(root+'/src/systems/SakuraNativePresentation.mjs'));
const {RUNTIME_PAYLOAD}=await import(pathToFileURL(root+'/scripts/runtime-payload.mjs'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const exports=[
 ['front',SAKURA_NATIVE_ART,[512,384],'50f9c8aad1451651e415907bb87d0d43fdd85d7acb75704758df56ea7b37bd01'],
 ['directions',SAKURA_DIRECTION_ART,[512,768],'8cc27eba4881d73778658a41c4d2a79bb09934d085f215a10e72fb6b17c9d113'],
 ['turns',SAKURA_NATIVE_TURN_ART,[512,896],'dde5356b7d552393242a21d5f21b0544f795725c554c6861dea3c193d02d6103'],
];
test('native preload and payload use only the three approved grip-hand texture exports',()=>{
 for(const [name,art]of exports){const file='art/sakura-hand-art-20261005/'+name+'.webp';assert.equal(art.texture,file);assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===file).length,1);}
 for(const file of ['art/sakura-conformance-20261004/front.webp','art/sakura-details-20261004/parts.webp','art/sakura-turn-native-20261004/parts.webp'])assert(!RUNTIME_PAYLOAD.some(r=>r.file===file),'Replaced textures must not ship twice');
 assert.equal(RUNTIME_PAYLOAD.filter(a=>!['owner-equipment-art','owner-menu-motion','owner-menu-portrait','owner-character-cast','owner-character-motion','owner-weapon-fx','owner-ui','owner-world-ground','owner-enemy-attack','owner-heavy-material','owner-dash-material','owner-dash-contrast-material','owner-character-gait','owner-character-hurt','owner-character-shoot','owner-character-idle','owner-character-walk','owner-facility-fx'].includes(a.group)&&!['fonts/NotoSansSC-UI.woff2','licenses/noto-sans-sc.txt'].includes(a.file)).length,205);
 assert(!RUNTIME_PAYLOAD.some(r=>/hand-art.*(raw|manifest|comparison|png|torso)/.test(r.file)));
});
test('accepted grip atlases retain their exact lossless pixels, alpha and decode budget',()=>{
 for(const [name,art,[w,h],expected]of exports){
  const b=fs.readFileSync(root+'/public/'+art.texture);assert.equal(sha(b),expected,name+' accepted export');
  assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
  const offset=b.indexOf(Buffer.from('VP8L'));assert(offset>=12,'Accepted export must remain lossless');assert.equal(b[offset+8],0x2f);
  const bits=b.readUInt32LE(offset+9);assert.equal((bits&0x3fff)+1,w);assert.equal(((bits>>>14)&0x3fff)+1,h);assert.equal((bits>>>28)&1,1,'Keep transparent hand silhouette');
 }
 assert.equal(exports.reduce((n,[,,[w,h]])=>n+w*h*4,0),4194304);
});
test('hand art cannot silently migrate authored geometry, clips, sockets or expressions',()=>{
 const geometry=[
  [SAKURA_NATIVE_ART.data,'art/sakura-conformance-20261004/rig.json','315c280c260d2a34937a8ee9fc5b916b6f5a2d4a847cf6768dca94924042ec75'],
  [SAKURA_DIRECTION_ART.data,'art/sakura-details-20261004/views.json','626e076e8cc277d26b9dd1e9f2b2849789991a9353fbdc4e66886a7ae94edd38'],
  [SAKURA_NATIVE_TURN_ART.data,'art/sakura-turn-native-20261004/views.json','c0c1ea555cfb0a3e9d5f4d0337241b0caa11f01e35c3bdb658aeac509f4319d7'],
 ];
 for(const [actual,file,expected]of geometry){assert.equal(actual,file);assert.equal(sha(fs.readFileSync(root+'/public/'+file)),expected);assert(RUNTIME_PAYLOAD.some(r=>r.file===file));}
});
