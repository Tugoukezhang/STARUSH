"""Use native Inkscape rendering and package its unchanged PNGs into OpenRaster."""
from pathlib import Path
import json,subprocess,os,zipfile,hashlib,struct
from xml.etree.ElementTree import Element,SubElement,tostring
r=Path(__file__).resolve().parent;m=json.loads((r/'layers.json').read_text());out=r/'rendered-layers';out.mkdir(exist_ok=True)
env={**os.environ,'INKSCAPE_PROFILE_DIR':'/workspace/starush-environment/q78-green-layers-20261115/inkscape-profile'}
Path(env['INKSCAPE_PROFILE_DIR']).mkdir(exist_ok=True)
svg=r/'green-layer-source.svg';exportsvg=out/'export-visible.svg';exportsvg.write_text(svg.read_text().replace(' style="display:none"',''));rows=[];plans=[];actions=[]
for l in m['layers']:
 p=l['region'];x=max(0,min(a[0] for a in p));y=max(0,min(a[1] for a in p));right=min(1086,max(a[0] for a in p));bottom=min(1448,max(a[1] for a in p));dest=out/(l['id']+'.png')
 actions.extend(['export-id:'+l['id'],'export-area:'+':'.join(map(str,[x,y,right,bottom])),'export-filename:'+str(dest),'export-do'])
 plans.append((l,x,y,right,bottom,dest))
subprocess.run(['inkscape',str(exportsvg),'--export-id-only','--export-dpi=96','--actions='+';'.join(actions)],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
for l,x,y,right,bottom,dest in plans:
 b=dest.read_bytes();assert struct.unpack('>II',b[16:24])==(right-x,bottom-y)
 rows.append({'id':l['id'],'file':'rendered-layers/'+dest.name,'x':x,'y':y,'width':right-x,'height':bottom-y,'visible':l.get('visible',True),'sha256':hashlib.sha256(b).hexdigest()});print(l['id'],flush=True)
merged=out/'merged.png';subprocess.run(['inkscape',str(svg),'--export-area-page','--export-filename='+str(merged)],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
ora=Element('image',{'w':'1086','h':'1448','name':'STARUSH Q78 green source — UNACCEPTED','version':'0.0.3'});stack=SubElement(ora,'stack')
for i,l in reversed(list(enumerate(rows))):SubElement(stack,'layer',{'name':l['id'],'src':f'data/layer{i:02}.png','x':str(l['x']),'y':str(l['y']),'opacity':'1.0','visibility':'visible' if l['visible'] else 'hidden','composite-op':'svg:src-over'})
with zipfile.ZipFile(r/'green-layer-source.ora','w',compression=zipfile.ZIP_DEFLATED) as z:
 z.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED);z.writestr('stack.xml',tostring(ora,encoding='utf-8',xml_declaration=True));z.write(merged,'mergedimage.png')
 for i,l in enumerate(rows):z.write(r/l['file'],f'data/layer{i:02}.png')
(r/'raster-layers.json').write_text(json.dumps({'queueItem':'Q78','layers':rows,'sourcePreparationAccepted':False,'artAccepted':False,'isLive2DModel':False},ensure_ascii=False,indent=2)+'\n');exportsvg.unlink();print('EXPORTED',len(rows))
