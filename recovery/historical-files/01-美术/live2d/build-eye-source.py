"""Author eye texture regions as SVG geometry; rasterization is by Inkscape.
Original/generated PNG bytes are never painted or rewritten by this script.
Q68/Q69 accepted files remain separate from this Q70 candidate.
"""
from pathlib import Path
import math,json,base64,hashlib,subprocess,os,struct,zipfile
from xml.etree.ElementTree import Element,SubElement,tostring
r=Path(__file__).parent/'red-20261114';out=r/'eye-rig-layers';out.mkdir(exist_ok=True)
base=json.loads((r/'raster-layers.json').read_text());mat=json.loads((r/'eye-blink-proposal.json').read_text())['matrix'];a,b,c,d,e,f=mat
cfg={'left':dict(A=[603,492],B=[739,555],upper=-25,lower=22,closed=9,margin=65,irisBox=[131,93,675,700],irisTarget=[610,474,80,95],highlight=[[674,498],[680,499],[681,505],[676,508],[672,503]]),'right':dict(A=[838,631],B=[920,637],upper=-20,lower=26,closed=15,margin=48,irisBox=[1164,246,481,543],irisTarget=[844,600,58,70],highlight=[[877,614],[883,615],[882,621],[877,623],[874,619]])}
svg=Element('svg',{'xmlns':'http://www.w3.org/2000/svg','xmlns:xlink':'http://www.w3.org/1999/xlink','width':'1070','height':'1470','viewBox':'0 0 1070 1470'});defs=SubElement(svg,'defs');files={}
for name in ['eye-white-underpaint.png','iris-complete-candidate.png','face-uncovered-closeup.png']:
 data=(r/name).read_bytes();w,h=struct.unpack('>II',data[16:24]);sid='tex'+str(len(files));files[name]=sid;SubElement(defs,'image',{'id':sid,'width':str(w),'height':str(h),'href':'data:image/png;base64,'+base64.b64encode(data).decode()})
parts=[]
originalIris={'left':[[619,491],[637,487],[663,496],[687,509],[697,525],[690,544],[677,553],[656,552],[636,537],[624,519]],'right':[[842,624],[855,615],[874,617],[889,625],[889,641],[878,655],[861,657],[849,645]]}
def world(p):x,y=p;return [a*x+c*y+e,b*x+d*y+f]
def add(name,file,poly,extra=None):
 gid='eye-'+name;clip=SubElement(defs,'clipPath',{'id':'clip-'+gid});SubElement(clip,'polygon',{'points':' '.join(f'{x},{y}' for x,y in poly)});g=SubElement(svg,'g',{'id':gid,'transform':'matrix('+','.join(map(str,mat))+')'});gg=SubElement(g,'g',{'clip-path':'url(#clip-'+gid+')'});use=SubElement(gg,'use',{'href':'#'+files[file]});
 if extra:use.set('transform','matrix('+','.join(map(str,extra))+')')
 if name.endswith('-iris'):
  side=name.split('-')[0];cp=SubElement(defs,'clipPath',{'id':'original-'+gid});polys=[originalIris[side],cfg[side]['highlight']];path=' '.join('M '+' L '.join(f'{x},{y}' for x,y in ps)+' Z' for ps in polys);SubElement(cp,'path',{'d':path,'clip-rule':'evenodd'});SubElement(g,'use',{'href':'#'+files['face-uncovered-closeup.png'],'clip-path':'url(#original-'+gid+')'})
 points=[world(p) for p in poly];xs,ys=zip(*points);bounds=[math.floor(min(xs))-1,math.floor(min(ys))-1,math.ceil(max(xs))+1,math.ceil(max(ys))+1];parts.append(dict(id=gid,file='eye-rig-layers/'+gid+'.png',bounds=bounds,texture=file,region=poly))
for side,q in cfg.items():
 ax,ay=q['A'];bx,by=q['B'];w=math.hypot(bx-ax,by-ay);ex,ey=(bx-ax)/w,(by-ay)/w;q.update(width=w,axis=[ex,ey],matrix=mat)
 def point(u,v):return [ax+ex*u-ey*v,ay+ey*u+ex*v]
 us=[w*i/24 for i in range(25)];upper=[point(u,q['upper']*math.sin(math.pi*u/w)) for u in us];lower=[point(u,q['lower']*math.sin(math.pi*u/w)) for u in us]
 add(side+'-white','eye-white-underpaint.png',upper+list(reversed(lower)))
 x,y,iw,ih=q['irisBox'];tx,ty,tw,th=q['irisTarget'];extra=[tw/iw,0,0,th/ih,tx-x*tw/iw,ty-y*th/ih];add(side+'-iris','iris-complete-candidate.png',[[tx,ty],[tx+tw,ty],[tx+tw,ty+th],[tx,ty+th]],extra)
 add(side+'-highlight','face-uncovered-closeup.png',q['highlight'])
 add(side+'-upper','eye-white-underpaint.png',[point(-12,-q['margin']),point(w+12,-q['margin']),point(w+12,2),point(w,0)]+list(reversed(upper))+[point(-12,0)])
 add(side+'-lower','eye-white-underpaint.png',lower+[point(w+12,0),point(w+12,q['margin']),point(-12,q['margin']),point(-12,0)])
(r/'eye-rig-source.svg').write_bytes(tostring(svg,encoding='utf-8',xml_declaration=True))
env={**os.environ,'INKSCAPE_PROFILE_DIR':'/workspace/starush-environment/q70-eye-rig-20261114/inkscape-profile'};Path(env['INKSCAPE_PROFILE_DIR']).mkdir(exist_ok=True)
for part in parts:
 x,y,rx,by=part.pop('bounds');p=r/part['file'];subprocess.run(['inkscape',str(r/'eye-rig-source.svg'),'--export-id='+part['id'],'--export-id-only','--export-area='+':'.join(map(str,[x,y,rx,by])),'--export-filename='+str(p)],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE);data=p.read_bytes();part.update(x=x,y=y,width=rx-x,height=by-y,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),accepted=False)
rows=[]
for l in base['layers']:
 if l['id'] in ['eye-left','eye-right']:rows.extend(p for p in parts if p['id'].startswith(l['id']+'-'))
 else:rows.append(l)
pkg=dict(schemaVersion=1,queueItem='Q70',status='candidate-not-accepted',artAccepted=False,contentComplete=False,isLive2DModel=False,canvas=base['canvas'],layers=rows,eyes=cfg,sourceSvgSha256=hashlib.sha256((r/'eye-rig-source.svg').read_bytes()).hexdigest(),baselineRasterSha256=hashlib.sha256((r/'raster-layers.json').read_bytes()).hexdigest())
(r/'eye-rig-raster.json').write_text(json.dumps(pkg,ensure_ascii=False,indent=2)+'\n')
ora=Element('image',{'w':'1070','h':'1470','name':'STARUSH Q70 eye source CANDIDATE','version':'0.0.3'});stack=SubElement(ora,'stack')
for i,l in reversed(list(enumerate(rows))):SubElement(stack,'layer',{'name':l['id'],'src':f'data/layer{i:02}.png','x':str(l['x']),'y':str(l['y']),'opacity':'1.0','visibility':'visible','composite-op':'svg:src-over'})
with zipfile.ZipFile(r/'red-eye-source.ora','w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED);z.writestr('stack.xml',tostring(ora,encoding='utf-8',xml_declaration=True))
 for i,l in enumerate(rows):z.write(r/l['file'],f'data/layer{i:02}.png')
print('Exported',len(parts),'eye parts;',len(rows),'full model source layers')
