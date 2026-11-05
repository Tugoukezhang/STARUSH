import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const rows=[
  {
    "file": "public/art/performer-motion-20260922/venus-walk.webp",
    "width": 512,
    "oldHeight": 1536,
    "height": 2048,
    "originalRgbaSha256": "01dd15533a729eb0a5313a6c5027ebcd1da4bc28fae804aa8905aada95af123a"
  },
  {
    "file": "public/art/performer-footrig-20260924/venus-legs.webp",
    "width": 512,
    "oldHeight": 384,
    "height": 512,
    "originalRgbaSha256": "104b0792c6e7d5a9c750cf9f3cf6f587c28d3baee7cc9451ac7ddefefb1f05b5"
  },
  {
    "file": "public/art/performer-motion-20260922/genya-walk.webp",
    "width": 512,
    "oldHeight": 1536,
    "height": 2048,
    "originalRgbaSha256": "657484444294ee15ae69b5489ccc8d45323e9609336e662e26d1a79539d02ed3"
  },
  {
    "file": "public/art/performer-footrig-20260924/genya-legs.webp",
    "width": 512,
    "oldHeight": 384,
    "height": 512,
    "originalRgbaSha256": "23ec840cefb742e7ff31777eee2531d3a6ce3355f20351ef964ad3df88b18270"
  },
  {
    "file": "public/art/performer-motion-20260922/kai-walk.webp",
    "width": 512,
    "oldHeight": 1536,
    "height": 2048,
    "originalRgbaSha256": "1690b4b6d1af1b598427a6cad7eced4069efc3c421a102b696096fe321447ce9"
  },
  {
    "file": "public/art/performer-footrig-20260924/kai-legs.webp",
    "width": 512,
    "oldHeight": 384,
    "height": 512,
    "originalRgbaSha256": "ccd4a950d1a8acc8af0e4397b48f5c2b0753f3fd1b0501b88e21cc678c929a7d"
  },
  {
    "file": "public/art/performer-motion-20260922/enjo-walk.webp",
    "width": 512,
    "oldHeight": 1536,
    "height": 2048,
    "originalRgbaSha256": "813fa8dbfcc8a7e0d25635335e7f4e555a4eb6fe533089b207afc5f9f78b8a1c"
  },
  {
    "file": "public/art/performer-footrig-20260924/enjo-legs.webp",
    "width": 512,
    "oldHeight": 384,
    "height": 512,
    "originalRgbaSha256": "2608e420e84d400e15d88e0e51bdbf483e205dd3a63ec0cbde317121b15d67f5"
  }
];
for(const row of rows)test(row.file+': POT extension preserves all original RGBA and adds only empty padding',async()=>{
 const {data,info}=await sharp(fs.readFileSync(new URL('../'+row.file,import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,row.width);assert.equal(info.height,row.height);
 const end=row.width*row.oldHeight*4;assert.equal(createHash('sha256').update(data.subarray(0,end)).digest('hex'),row.originalRgbaSha256);
 assert(data.subarray(end).every(v=>v===0));
});
