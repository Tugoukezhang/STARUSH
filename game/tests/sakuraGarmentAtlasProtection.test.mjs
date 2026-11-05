import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {brotliDecompressSync} from 'node:zlib';
import {SAKURA_REFINED_ART,SAKURA_OBLIQUE_ART} from '../src/systems/SakuraRefinedPresentation.mjs';

const root=process.env.STARUSH_TEST_ROOT||fileURLToPath(new URL('..',import.meta.url));
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const sha=b=>createHash('sha256').update(b).digest('hex');
// Sparse reviewed cloth masks are embedded so this contract never depends on temporary QA/source folders.
const candidates=[
  {
    "group": "cardinal",
    "file": "public/art/sakura-refined-20261006/parts.webp",
    "data": "public/art/sakura-refined-20261006/views.json",
    "sha256": "ee740b939830c683f07459fb0b785bead0b4fe475730021314c19e561a568397",
    "bytes": 776908,
    "geometrySha256": "94d177bbe8e3e38732b55a6949468451bbded7f40540b0a76c71b88d0bd0f8a1",
    "alphaSha256": "1f2d2e2b5f7868da19ce5424f476d43b5d694d8565e6f76548c63f6d585b2c20",
    "protectedRgbaSha256": "0a42dc9960c9c66f69577b9c64b239bfc1b2f18198a948d99c630454e7b9a65e",
    "maskSha256": "eb138daa92ba0da619d8fb313b63e5c9df5aacb848410df6fc0b3c6ad309652d",
    "mask": "m///H+CnAAKIhBuApBBz4nBvPxuGI759Y29WfwRdPB1FgypzbZ6pItwfJPoh0m30V/pCH3v7afXp3OAeALS4j/ZkrrhX3Kfdj8oV9wb3AGCK+wzuAcAU9xncA4Bp7iP3DO4BwNB9Du4BgOY+zpfFBwC5PQHY5of+C/6N4gWASu4DwD5/umvu3/A3uRcAXnB/hP0AoCBO7hb3eZ/CBf4AAMLJ3eK+zB8AELjQHwAAOLlb3Jf6BwDt29zb3bj/kf9aOL/tmPH+E//T/fS+ofu5/aX6M/uxn1vYvsI/2yFnO+Rsh5ztMG50kEBqgQnqLUnxDetdyeH4HmVwfIdyWL1NOTDfoDROX+t7vj2ZkA7rDckn/O5k83lRvRdJnd+bjDYvrncjL/Rbk9XlW/1i70fqsB8AXIbcs3sAMDw+yb0v+aG/0td4QR/GSZ/FRf0AQBYfANCd3UX3AEDYDwBQHN3RXXYPAPb6W7+ieACA7pP1je4FgIziBYBQ/+t/W7zoHrsX3SP9AwCG8aJ7oH8EYDXO+dH4iO4BALs/6+/3/yVrwp8LCJq/jLkmvslgAQ==",
    "parts": [
      {
        "direction": "left",
        "region": [
          1255,
          530,
          88,
          138
        ],
        "maxSkin": 15
      },
      {
        "direction": "right",
        "region": [
          404,
          720,
          105,
          119
        ],
        "maxSkin": 0
      }
    ]
  },
  {
    "group": "oblique",
    "file": "public/art/sakura-oblique-20261006/parts.webp",
    "data": "public/art/sakura-oblique-20261006/views.json",
    "sha256": "5ca7bad71992fb2cd12b73f6dc538c5ad4d385d6487f859c102b5de8ff371553",
    "bytes": 822298,
    "geometrySha256": "1c3c778cedceeed09c1ef69a8a22ef996cf6baeeead36e6126e5a0a47a15a200",
    "alphaSha256": "f5492c33a6828a2c9d1adc4a0976b6de9167e638fc37c211cbd9b90090c08637",
    "protectedRgbaSha256": "d10d77856f428e070ba6db601ec3efff3e5581cb52aeb6cfa13d94be5cef261e",
    "maskSha256": "ff5908e172ed94118e67270fcbeaeb804ec1136dfc5c7e3eae375eb2d0c25577",
    "mask": "m///H+CnAALgv2+/0u8GZaSl/xN2K2yEBZIsxXDJkVE5a5Sd3rxb6d7T1QEAR+QlChsoUd2fZAUwdVrSimNyrc8owr37mzQY1nxnP89kkZlXGNErZUtbqWdblZPGoPUJlw/26TJaat0Ozx5NtdaH5ycxcX2ny0N9urh5K2yAoGa95nOYf38+seWLlpbSyOwfalr6en89X3c7XXwY9qz6l9d3VTLzNcP5/nqCy/dJoaf77dJRnzfTr/vliS+3/j/58cgwKlrD9TqeQ/+TL/Y8UreuJH0Flu1dQlthZ94O/XyJJ4bueaYCmf9qkFOzO16Ob8D8Lah8bV0swPRInxz6+zbmKYHGGsJMSEWi7Prbciz3H/Uia7DCb2c+1Z9E02fC9EQD3YG+eDwJ7zFiPBId6ks85VyIsUDUDtJ62/XP6dcSbzEqDtlhD4i2pGYWiosN54kgWZxAo7yN8aSbo/8N5N5i0jARZZRiigH2q/w541PiHV/F8AVcPk67vYwdlFAiSijRtMqXOWPcMn8U3bort6H+xRvMBlFsA6EVAvzSZlGskDfXXzNsY9uRNBPlBkSH/KEemjkPsIQziqb5SbTS3yaiHOqTMAUi6pDaZvu/xA7Q7D8Neugl5pp4WYz4zhalLfdH4Tx/FMVjS0/1h8KGrXJ/PFbbF7cD/ahCSiOJ7HVZh4Rmax2s2XqaRYgytlwqcDTNz6IT/9C1wWyeP7luMotw2DyNgf6iE6cArnct8yy6AWmZP7eQ2Vx/Fw9FTvWn0bDKruELAJBCLAVa1LS0WGJRgb+YVPU/cjSvUvoIc0Jakaju31x31DjXf+stPGBDjKnvL+yUVBUK1v6irgnrFED9StSBOT0mUX1/+vFgaJ9/H+QDAACxsK69CABQO4dglGqio/4tghFtrz+eOyxa5e/1IcQ1uQEAFjOoxtNOZlGV/1Bpmt93tw4rq/I/UiEKVjOAiiFI9UJjUtRe5g/3HVKd9h+2WFJBLfMnGkRKOmQ9KBwVn5pI6HCdv5RofFVlDBAJSKXGIn/22hoYnT8dkBBikX+bhKnRFKMqHlUppY6dWzqXCCPWClBUgTo8oiJWYRWhijSjqA4+nWz9kzr6xvZ59XnjUA2qkmYUdRauxAi6hYJwhcDRWn8BIJM5iv5CJWjZdgnqIoAhIyS68N+qYsqrO6UQbk5URaPcYOhOKgSZi1RwqqxGK4n2Hyr9h8r0QlDXAqhxXgEccVAl4FymspN4hzQWhxr7O4b2+TPhjzl+OxL1zdg5tQ01a15fvwN8WmC1AfU7MuD1D3QAfGpYtfX0fyUBAIDPhL6y0NRBfxaX6Z1L9f0Ipd+sXrIq88/PCcAtM86hglMDiOkH+rKq79cFI1/uRA3vB0DF8Sidp2n9cYYKg8yG0qAyUhhTdpDqLZmnNHl/9cRtAQ==",
    "parts": [
      {
        "direction": "front-right",
        "region": [
          378,
          527,
          143,
          156
        ],
        "maxSkin": 0
      },
      {
        "direction": "front-left",
        "region": [
          847,
          527,
          137,
          148
        ],
        "maxSkin": 0
      },
      {
        "direction": "back-right",
        "region": [
          1705,
          527,
          125,
          141
        ],
        "maxSkin": 0
      },
      {
        "direction": "back-left",
        "region": [
          1016,
          527,
          121,
          147
        ],
        "maxSkin": 1
      }
    ]
  }
];
const shoulderSkin=(r,g,b,a)=>a>200&&r>175&&g>110&&b>75&&r-b>30&&g-b>5&&r>g+5;
for(const c of candidates){
 test(c.group+': reviewed derived texture bytes and unchanged atlas geometry',()=>{
  const bytes=fs.readFileSync(path.join(root,c.file));
  assert.equal(sha(bytes),c.sha256,'Only the reviewed shoulder-closed cloth atlas may ship');
  assert.equal(bytes.length,c.bytes);
  assert.equal(sha(fs.readFileSync(path.join(root,c.data))),c.geometrySha256);
 });
 test(c.group+': all alpha, gutters, faces, hands and non-cloth RGBA stay exact',async()=>{
  const {data,info}=await sharp(path.join(root,c.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([info.width,info.height,info.channels],[2048,1024,4]);
  const mask=brotliDecompressSync(Buffer.from(c.mask,'base64')),alpha=Buffer.alloc(mask.length),hash=createHash('sha256');
  assert.equal(mask.length,2048*1024);assert.equal(sha(mask),c.maskSha256);
  const rigs=JSON.parse(fs.readFileSync(path.join(root,c.data)));
  for(let i=0;i<mask.length;i++){
   alpha[i]=data[i*4+3];
   if(!mask[i])hash.update(data.subarray(i*4,i*4+4));
   else{
    const x=i%2048,y=Math.floor(i/2048);
    assert(c.parts.some(p=>x>=p.region[0]&&x<p.region[0]+p.region[2]&&y>=p.region[1]&&y<p.region[1]+p.region[3]),'No paint outside reviewed torso regions');
   }
  }
  assert.equal(sha(alpha),c.alphaSha256);
  assert.equal(hash.digest('hex'),c.protectedRgbaSha256);
  for(const p of c.parts)assert.deepEqual(rigs.views[p.direction].meshes.find(m=>m.name==='torso').region,p.region);
 });
 test(c.group+': no large opaque bare shoulder aperture below the protected collar',async()=>{
  const {data,info}=await sharp(path.join(root,c.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(const p of c.parts){
   const [left,top,w,h]=p.region;let count=0;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=((top+y)*info.width+left+x)*4;
    if(y>h*.18&&shoulderSkin(...data.subarray(i,i+4)))count++;
   }
   assert(count<=p.maxSkin,p.direction+': shoulder skin is still painted into the jacket ('+count+')');
  }
 });
}
test('existing loader paths, eight views and 93 mesh ownership; no generated source media references',()=>{
 assert.equal(SAKURA_REFINED_ART.texture,'art/sakura-refined-20261006/parts.webp');
 assert.equal(SAKURA_OBLIQUE_ART.texture,'art/sakura-oblique-20261006/parts.webp');
 const rigs=candidates.flatMap(c=>Object.values(JSON.parse(fs.readFileSync(path.join(root,c.data))).views));
 assert.equal(rigs.length,8);assert.equal(rigs.reduce((n,r)=>n+r.meshes.length,0),93);
 for(const c of candidates)assert.doesNotMatch(fs.readFileSync(path.join(root,c.data),'utf8'),/sakura-garment-study|raw\/|imageDataUrl|data:image|paint-mask|human_paintover/);
});
