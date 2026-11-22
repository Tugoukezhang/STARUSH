// Package unchanged generated PNG bytes into an editable SVG layer document.
// No raster alteration and no model/acceptance claims. Inkscape layers preserve
// image references, transforms and draw order for continued authoring.
import {readFile, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(process.argv[2]||'');
const manifest=JSON.parse(await readFile(join(root,'layers.json'),'utf8'));
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
if(manifest.status!=='work-in-progress'||manifest.artAccepted!==false||manifest.isLive2DModel!==false)throw Error('This exporter only packages unaccepted layer sources');
const ids=new Set(),groups=[],textures=new Map();
let bytes=0,decoded=0;
for(const layer of manifest.layers){
 if(!/^[a-z0-9-]+$/.test(layer.id)||ids.has(layer.id))throw Error('Invalid/duplicate layer id');
 ids.add(layer.id);
 if(!/^[a-z0-9-]+\.png$/.test(layer.file))throw Error('Layer must refer to a local PNG');
 if(layer.matrix.length!==6||!layer.matrix.every(Number.isFinite))throw Error('Invalid transform');
 const png=await readFile(join(root,layer.file));
 if(png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||![2,6].includes(png[25]))throw Error('Expected RGB or RGBA PNG');
 if(png[25]===2&&!layer.textureRegions?.length)throw Error('Opaque hidden paint requires explicit clipping regions');
 if(png.readUInt32BE(16)!==layer.width||png.readUInt32BE(20)!==layer.height)throw Error('PNG size mismatch');
 if(createHash('sha256').update(png).digest('hex')!==layer.sha256)throw Error('PNG changed after registration');
 if(!textures.has(layer.file)){bytes+=png.length;decoded+=layer.width*layer.height*4;textures.set(layer.file,`<image id="tex-${layer.file}" width="${layer.width}" height="${layer.height}" xlink:href="data:image/png;base64,${png.toString('base64')}"/>`)}
 let clip='';
 if(layer.textureRegions){
  for(const p of layer.textureRegions)if(p.length<3||!p.every(a=>a.length===2&&a.every(Number.isFinite)))throw Error('Invalid texture region');
  const d=layer.textureRegions.map(p=>'M'+p.map(a=>a.join(',')).join(' L')+' Z').join(' ');
  clip=`<clipPath id="clip-${layer.id}"><path d="${d}"/></clipPath>`;
 }
 groups.push(`${clip}<g id="${layer.id}" inkscape:groupmode="layer" inkscape:label="${layer.id}" transform="matrix(${layer.matrix.join(' ')})"${clip?` clip-path="url(#clip-${layer.id})"`:''}><use xlink:href="#tex-${layer.file}"/></g>`);
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${manifest.canvas.width}" height="${manifest.canvas.height}" viewBox="0 0 ${manifest.canvas.width} ${manifest.canvas.height}"><title>STARUSH Q68 editable layer source — work in progress</title><desc>${escape(manifest.sourceNote)}. Not an animated model. Art acceptance remains false.</desc><defs>${[...textures.values()].join('')}</defs>${groups.join('\n')}</svg>`;
await writeFile(join(root,'red-layer-source.svg'),svg);
const report={layers:groups.length,sourcePngBytes:bytes,uncroppedDecodedRgbaBytes:decoded,svgBytes:Buffer.byteLength(svg),artAccepted:false,isLive2DModel:false};
await writeFile(join(root,'source-package.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
