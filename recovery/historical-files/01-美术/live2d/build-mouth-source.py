"""Q71 candidate source: SVG geometry selects real painted textures.
Does not paint PNG pixels or overwrite the accepted Q70 source/model.
"""
from pathlib import Path
from xml.etree.ElementTree import Element,SubElement,tostring
import json,math,base64,struct,subprocess,os,zipfile,hashlib
r=Path(__file__).parent/'red-20261114';out=r/'mouth-rig-layers';out.mkdir(exist_ok=True);registration=json.loads((r/'mouth-source-registration.json').read_text());base=json.loads((r/'eye-rig-raster.json').read_text());svg=Element('svg',{'xmlns':'http://www.w3.org/2000/svg','width':'1070','height':'1470','viewBox':'0 0 1070 1470'});defs=SubElement(svg,'defs');files={}
for f in registration:
 data=(r/f).read_bytes();w,h=struct.unpack('>II',data[16:24]);sid='tex'+str(len(files));files[f]=sid;SubElement(defs,'image',{'id':sid,'width':str(w),'height':str(h),'href':'data:image/png;base64,'+base64.b64encode(data).decode()})
upper=[[715,736],[722,733],[733,732],[746,734],[760,737],[770,741],[775,745]]
lower=[[775,745],[770,751],[764,757],[756,762],[746,763],[735,760],[725,754],[718,746],[715,736]]
specs=[('mouth-cavity','mouth-cavity-underpaint.png',upper+lower[1:]),('mouth-teeth','mouth-open-candidate.png',[[723,734],[732,734],[745,736],[758,739],[768,742],[771,745],[758,743],[744,740],[732,737]]),('mouth-tongue','mouth-open-candidate.png',[[719,749],[725,746],[733,747],[743,751],[752,756],[759,759],[752,762],[739,760],[728,755]]),('mouth-upper','mouth-cavity-underpaint.png',[[695,715],[793,715],[793,746],[775,745]]+list(reversed(upper))+[[695,736]]),('mouth-lower','mouth-cavity-underpaint.png',lower+[[695,736],[695,785],[793,785],[793,745]])]
parts=[]
for name,f,poly in specs:
 mat=registration[f]['matrix'];a,b,c,d,e,g=mat;clip=SubElement(defs,'clipPath',{'id':'clip-'+name});SubElement(clip,'polygon',{'points':' '.join(f'{x},{y}' for x,y in poly)});node=SubElement(svg,'g',{'id':name,'transform':'matrix('+','.join(map(str,mat))+')'});SubElement(node,'use',{'href':'#'+files[f],'clip-path':'url(#clip-'+name+')'});pts=[(a*x+c*y+e,b*x+d*y+g)for x,y in poly];xs,ys=zip(*pts);x,y,rx,by=math.floor(min(xs))-1,math.floor(min(ys))-1,math.ceil(max(xs))+1,math.ceil(max(ys))+1;parts.append(dict(id=name,file='mouth-rig-layers/'+name+'.png',x=x,y=y,width=rx-x,height=by-y,texture=f,textureRegion=poly,matrix=mat,accepted=False))
(r/'mouth-rig-source.svg').write_bytes(tostring(svg,encoding='utf-8',xml_declaration=True));env={**os.environ,'INKSCAPE_PROFILE_DIR':'/workspace/starush-environment/q71-mouth-source-20261114/inkscape-profile'};Path(env['INKSCAPE_PROFILE_DIR']).mkdir(exist_ok=True)
for l in parts:
 x,y,w,h=l['x'],l['y'],l['width'],l['height'];p=r/l['file'];subprocess.run(['inkscape',str(r/'mouth-rig-source.svg'),'--export-id='+l['id'],'--export-id-only','--export-area='+':'.join(map(str,[x,y,x+w,y+h])),'--export-filename='+str(p)],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE);data=p.read_bytes();l.update(bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
rows=[]
for l in base['layers']:
 if l['id']=='mouth':rows.extend(parts)
 else:rows.append(l)
pkg=dict(queueItem='Q71',status='source-candidate-no-rig',artAccepted=False,contentComplete=False,isLive2DModel=False,canvas=base['canvas'],layers=rows,mouthParts=parts,baselineQ70RasterSha256=hashlib.sha256((r/'eye-rig-raster.json').read_bytes()).hexdigest());(r/'mouth-rig-raster.json').write_text(json.dumps(pkg,ensure_ascii=False,indent=2)+'\n')
ora=Element('image',{'w':'1070','h':'1470','name':'STARUSH Q71 mouth source CANDIDATE','version':'0.0.3'});stack=SubElement(ora,'stack')
for i,l in reversed(list(enumerate(rows))):SubElement(stack,'layer',{'name':l['id'],'src':f'data/layer{i:02}.png','x':str(l['x']),'y':str(l['y']),'opacity':'1.0','visibility':'visible','composite-op':'svg:src-over'})
with zipfile.ZipFile(r/'red-mouth-source.ora','w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED);z.writestr('stack.xml',tostring(ora,encoding='utf-8',xml_declaration=True))
 for i,l in enumerate(rows):z.write(r/l['file'],f'data/layer{i:02}.png')
print('Q71 candidate',len(rows),'layers; five mouth parts, no actual mouth rig yet')
