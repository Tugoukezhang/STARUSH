"""Q80 mouth texture selection, real PNG paint sources and editable SVG regions.
Never writes accepted Q78/Q79 sources. Inkscape exports, not raster synthesis.
"""
from pathlib import Path
from xml.etree.ElementTree import Element,SubElement,tostring
import json,base64,struct,hashlib,subprocess,os,zipfile
r=Path(__file__).resolve().parent;root=r.parent;out=r/'mouth-layers';out.mkdir(exist_ok=True)
base=json.loads((r/'eye-raster.json').read_text());old=next(l for l in base['layers'] if l['id']=='mouth');x,y,w,h=[old[k] for k in ['x','y','width','height']]
reg=json.loads((r/'mouth-registration.json').read_text());M=reg['matrixToSourceCrop'];matrix=[M[0][0]/4,M[1][0]/4,M[0][1]/4,M[1][1]/4,465+M[0][2]/4,210+M[1][2]/4]
svg=Element('svg',{'xmlns':'http://www.w3.org/2000/svg','width':'1086','height':'1448','viewBox':'0 0 1086 1448'});defs=SubElement(svg,'defs');sources={}
for name,p in [('original',root/'cutout-candidate.png'),('cavity',r/'mouth-cavity-underpaint.png')]:
 b=p.read_bytes();iw,ih=struct.unpack('>II',b[16:24]);SubElement(defs,'image',{'id':name,'width':str(iw),'height':str(ih),'href':'data:image/png;base64,'+base64.b64encode(b).decode()});sources[name]={'file':str(p.relative_to(root)),'sha256':hashlib.sha256(b).hexdigest()}
flt=SubElement(defs,'filter',{'id':'alpha-white','color-interpolation-filters':'sRGB'});SubElement(flt,'feColorMatrix',{'type':'matrix','values':'0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'})
mask=SubElement(defs,'mask',{'id':'mouth-alpha','style':'mask-type:alpha','maskUnits':'userSpaceOnUse','x':str(x),'y':str(y),'width':str(w),'height':str(h)});SubElement(mask,'image',{'filter':'url(#alpha-white)','href':'data:image/png;base64,'+base64.b64encode((root/old['file']).read_bytes()).decode(),'x':str(x),'y':str(y),'width':str(w),'height':str(h)})
upper=[(537.5,290.5),(541,290.8),(545,291.4),(549,292.7),(553,294.1),(556.5,295.5),(559.5,297)]
lower=[(537.5,290.5),(538.2,296),(540,300),(543,302.8),(547,305.2),(550,306.4),(553,304.5),(556,301),(559.5,297)]
teeth=[(538.8,290.8),(542,290.9),(546,291.8),(550,293),(554,294.4),(557,295.9),(556.8,296.9),(553,295.8),(549,294.5),(545,293.1),(541,292.6)]
tongue=[(538.5,294.5),(541,294),(544,294.7),(548,296),(552,299),(554,301.7),(552,304.6),(550,306),(546,304.5),(542,301.8),(540,299)]
specs=[('mouth-cavity','cavity',upper+list(reversed(lower))),('mouth-teeth','original',teeth),('mouth-tongue','original',tongue),('mouth-upper','original',[(x,y),(x+w,y),(x+w,upper[-1][1])]+list(reversed(upper))+[(x,upper[0][1])]),('mouth-lower','original',lower+[(x+w,lower[-1][1]),(x+w,y+h),(x,y+h),(x,lower[0][1])])]
parts=[]
for id,tex,poly in specs:
 clip=SubElement(defs,'clipPath',{'id':id+'-clip'});SubElement(clip,'polygon',{'points':' '.join(f'{px},{py}' for px,py in poly)});g=SubElement(svg,'g',{'id':id,'clip-path':'url(#'+id+'-clip)'});masked=SubElement(g,'g',{'mask':'url(#mouth-alpha)'});a={'href':'#'+tex}
 if tex=='cavity':a['transform']='matrix('+','.join(map(str,matrix))+')'
 SubElement(masked,'use',a);parts.append({'id':id,'file':'expression/mouth-layers/'+id+'.png','x':x,'y':y,'width':w,'height':h,'visible':True,'accepted':False,'texture':tex,'region':poly})
(r/'mouth-source.svg').write_bytes(tostring(svg,encoding='utf-8',xml_declaration=True));env={**os.environ,'INKSCAPE_PROFILE_DIR':'/workspace/starush-environment/q80-expression-rig-20261115/inkscape-profile'};acts=[]
for l in parts:acts+=['export-id:'+l['id'],'export-area:'+':'.join(map(str,[x,y,x+w,y+h])),'export-filename:'+str(root/l['file']),'export-do']
subprocess.run(['inkscape',str(r/'mouth-source.svg'),'--export-id-only','--actions='+';'.join(acts)],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
for l in parts:l['sha256']=hashlib.sha256((root/l['file']).read_bytes()).hexdigest()
rows=[]
for l in base['layers']:rows.extend(parts if l['id']=='mouth' else [l])
m={**base,'status':'expression-source-candidate-unaccepted','layers':rows,'mouth':{'upper':upper,'lower':lower,'teeth':teeth,'tongue':tongue},'mouthSources':sources,'eyeRasterSha256':hashlib.sha256((r/'eye-raster.json').read_bytes()).hexdigest(),'note':'87 independent parts; expressions still require actual native binding and visual acceptance.'};(r/'expression-raster.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
ora=Element('image',{'w':'1086','h':'1448','name':'Q80 Green expression candidate','version':'0.0.3'});stack=SubElement(ora,'stack')
for i,l in reversed(list(enumerate(rows))):SubElement(stack,'layer',{'name':l['id'],'src':f'data/{i}.png','x':str(l['x']),'y':str(l['y']),'opacity':'1','visibility':'visible','composite-op':'svg:src-over'})
with zipfile.ZipFile(r/'green-expression-source.ora','w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED);z.writestr('stack.xml',tostring(ora))
 for i,l in enumerate(rows):z.write(root/l['file'],f'data/{i}.png')
print('EXPRESSION_SOURCE_CANDIDATE',len(rows),'layers')
