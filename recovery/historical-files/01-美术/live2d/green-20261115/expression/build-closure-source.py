"""Add a separately painted closed-lip correction, preserving tested 87-part source."""
from pathlib import Path
from xml.etree.ElementTree import Element,SubElement,tostring
import json,struct,base64,hashlib,subprocess,os,zipfile
r=Path(__file__).resolve().parent;root=r.parent;out=r/'closure';out.mkdir(exist_ok=True);m=json.loads((r/'expression-raster.json').read_text());M=json.loads((r/'mouth-closed-registration.json').read_text())['matrixToSourceCrop'];matrix=[M[0][0]/4,M[1][0]/4,M[0][1]/4,M[1][1]/4,465+M[0][2]/4,210+M[1][2]/4];b=(r/'mouth-closed-underpaint.png').read_bytes();iw,ih=struct.unpack('>II',b[16:24]);x,y,w,h=530,283,37,32
svg=Element('svg',{'xmlns':'http://www.w3.org/2000/svg','width':'1086','height':'1448','viewBox':'0 0 1086 1448'});defs=SubElement(svg,'defs');gr=SubElement(defs,'radialGradient',{'id':'fade'});SubElement(gr,'stop',{'offset':'75%','stop-color':'white'});SubElement(gr,'stop',{'offset':'100%','stop-color':'black'});mask=SubElement(defs,'mask',{'id':'feather','maskUnits':'userSpaceOnUse','x':str(x),'y':str(y),'width':str(w),'height':str(h)});SubElement(mask,'ellipse',{'cx':'548.5','cy':'299','rx':'18.5','ry':'16','fill':'url(#fade)'});g=SubElement(svg,'g',{'mask':'url(#feather)'});SubElement(g,'image',{'width':str(iw),'height':str(ih),'href':'data:image/png;base64,'+base64.b64encode(b).decode(),'transform':'matrix('+','.join(map(str,matrix))+')'});(out/'closed-lip-source.svg').write_bytes(tostring(svg));env={**os.environ,'INKSCAPE_PROFILE_DIR':'/workspace/starush-environment/q80-expression-rig-20261115/inkscape-profile'};subprocess.run(['inkscape',str(out/'closed-lip-source.svg'),'--export-area='+':'.join(map(str,[x,y,x+w,y+h])),'--export-filename='+str(out/'mouth-closed.png')],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
l={'id':'mouth-closed','file':'expression/closure/mouth-closed.png','x':x,'y':y,'width':w,'height':h,'visible':False,'accepted':False,'sha256':hashlib.sha256((out/'mouth-closed.png').read_bytes()).hexdigest(),'texture':'image_gen closed lips, SIFT registration; independent skin feather'};rows=[]
for a in m['layers']:
 rows.append(a)
 if a['id']=='mouth-lower':rows.append(l)
m['layers']=rows;m['note']='88-part closed-lip correction candidate; native binding and transition acceptance required';m['closureSourceSha256']=hashlib.sha256(b).hexdigest();(out/'expression-raster.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');ora=Element('image',{'w':'1086','h':'1448','name':'Q80 closed lip correction candidate','version':'0.0.3'});stack=SubElement(ora,'stack')
for i,a in reversed(list(enumerate(rows))):SubElement(stack,'layer',{'name':a['id'],'src':f'data/{i}.png','x':str(a['x']),'y':str(a['y']),'opacity':'1','visibility':'visible' if a.get('visible',True) else 'hidden','composite-op':'svg:src-over'})
with zipfile.ZipFile(out/'green-expression-source.ora','w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED);z.writestr('stack.xml',tostring(ora))
 for i,a in enumerate(rows):z.write(root/a['file'],f'data/{i}.png')
print('Closure candidate',len(rows))
