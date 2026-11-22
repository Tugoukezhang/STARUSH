"""Render editable SVG layers with Inkscape; package unchanged PNG exports.

No raster painting occurs here. Bounds measured from the review renderer must
match the current manifest. Outputs are unaccepted production source assets,
not an animated model. Original source PNGs are never rewritten.
"""
import argparse, hashlib, json, os, struct, subprocess, zipfile
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, tostring
parser=argparse.ArgumentParser();parser.add_argument('root',type=Path);parser.add_argument('bounds',type=Path);parser.add_argument('--profile',type=Path,required=True);args=parser.parse_args()
root=args.root.resolve();manifest=json.loads((root/'layers.json').read_text());bounds=json.loads(args.bounds.read_text());svg=root/'red-layer-source.svg'
assert manifest['artAccepted'] is False and manifest['isLive2DModel'] is False
assert [l['id'] for l in bounds['layers']]==[l['id'] for l in manifest['layers']]
assert bounds['canvas']==manifest['canvas']
args.profile.mkdir(parents=True,exist_ok=True);env={**os.environ,'INKSCAPE_PROFILE_DIR':str(args.profile.resolve())}
out=root/'rendered-layers';out.mkdir(exist_ok=True)
rows=[]
for l in bounds['layers']:
    x,y,r,b=[l[k] for k in ['x','y','right','bottom']]
    assert all(isinstance(v,int) for v in [x,y,r,b]) and 0<=x<r<=manifest['canvas']['width'] and 0<=y<b<=manifest['canvas']['height']
    path=out/(l['id']+'.png')
    command=['inkscape',str(svg),'--export-id='+l['id'],'--export-id-only','--export-dpi=96','--export-area='+':'.join(map(str,[x,y,r,b])),'--export-filename='+str(path)]
    subprocess.run(command,env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    png=path.read_bytes();assert png[:8]==bytes.fromhex('89504e470d0a1a0a')
    width,height=struct.unpack('>II',png[16:24]);assert (width,height)==(r-x,b-y)
    rows.append({'id':l['id'],'file':'rendered-layers/'+path.name,'x':x,'y':y,'width':width,'height':height,'bytes':len(png),'sha256':hashlib.sha256(png).hexdigest(),'accepted':False})
    print('Exported '+l['id'],flush=True)
# Native SVG renderer provides OpenRaster's full merged preview, not a screenshot.
merged=out/'merged.png';subprocess.run(['inkscape',str(svg),'--export-area-page','--export-dpi=96','--export-filename='+str(merged)],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
ora=Element('image',{'w':str(manifest['canvas']['width']),'h':str(manifest['canvas']['height']),'name':'STARUSH Q68 red layers — UNACCEPTED','version':'0.0.3'});stack=SubElement(ora,'stack')
# OpenRaster serializes highest paint layer first; source manifest is bottom-up.
for i,l in reversed(list(enumerate(rows))):SubElement(stack,'layer',{'name':l['id'],'src':f'data/layer{i:02}.png','x':str(l['x']),'y':str(l['y']),'opacity':'1.0','visibility':'visible','composite-op':'svg:src-over'})
with zipfile.ZipFile(root/'red-layer-source.ora','w',compression=zipfile.ZIP_DEFLATED) as z:
    z.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED)
    z.writestr('stack.xml',tostring(ora,encoding='utf-8',xml_declaration=True))
    for i,l in enumerate(rows):z.write(root/l['file'],f'data/layer{i:02}.png')
    z.write(merged,'mergedimage.png')
package={'schemaVersion':1,'queueItem':'Q68','status':'work-in-progress','artAccepted':False,'contentComplete':False,'isLive2DModel':False,'sourceSvgSha256':hashlib.sha256(svg.read_bytes()).hexdigest(),'sourceNote':'Inkscape rasterization of individually addressable SVG layers, not new painting; neutral registration baked into offsets. No rig/physics. Original chat image bytes not claimed.','canvas':manifest['canvas'],'groups':manifest['groups'],'layers':rows,'encodedLayerBytes':sum(l['bytes'] for l in rows),'decodedLayerRgbaBytes':sum(l['width']*l['height']*4 for l in rows)}
(root/'raster-layers.json').write_text(json.dumps(package,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:package[k] for k in ['encodedLayerBytes','decodedLayerRgbaBytes','artAccepted','isLive2DModel']}),flush=True)
