import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import config from '../vite.config.js';
const root=fs.realpathSync(fileURLToPath(new URL('../',import.meta.url)));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('Vite selects the installed official Arcade build only for the bare Phaser import',()=>{
 const alias=config.resolve?.alias?.find(row=>row.find instanceof RegExp&&row.find.test('phaser'));
 assert(alias,'missing exact bare-import alias to the official Arcade-only engine');
 assert.equal(alias.replacement,path.join(root,'node_modules/phaser/dist/phaser-arcade-physics.js'));
 assert(fs.existsSync(alias.replacement));
 for(const id of ['phaser/src/geom/intersects/LineToRectangle.js','phaser/src/physics/arcade/index.js','phaserx'])assert(!alias.find.test(id),id);
 assert.deepEqual(config.plugins.map(p=>p.name),['p15-asset-boundary-guard','runtime-payload-boundary']);
});
test('installed official engine entries differ only by the excluded Matter namespace',()=>{
 const full=read('node_modules/phaser/src/phaser.js'),arcade=read('node_modules/phaser/src/phaser-arcade-physics.js');
 const expected=full.replace("    Physics: require('./physics'),","    Physics: {\n        Arcade: require('./physics/arcade')\n    },");
 assert.equal(arcade.replaceAll('\r\n','\n'),expected.replaceAll('\r\n','\n'));
 const dist=read('node_modules/phaser/dist/phaser-arcade-physics.js');
 const pkg=JSON.parse(read('node_modules/phaser/package.json'));
 assert(dist.includes(pkg.version));
 assert(dist.length<read('node_modules/phaser/dist/phaser.js').length);
});
test('production configuration and consumers use only Arcade, with no hidden Matter dependency',()=>{
 assert.match(read('src/main.js'),/default:\s*'arcade'/);
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
 for(const f of walk(path.join(root,'src')).filter(f=>/\.(mjs|js)$/.test(f)))
  assert(!/\.matter\b|Physics\.Matter\b|from\s*['\"][^'\"]*matter/.test(fs.readFileSync(f,'utf8')),path.relative(root,f));
});
