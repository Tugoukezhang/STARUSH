"""Q80 editable eye UV regions; PNG rendering uses Inkscape, no raster painting.
Q78 and Q79 accepted artifacts are read-only inputs. Candidate, not a blink rig.
"""
from pathlib import Path
import json,hashlib,base64,struct,subprocess,os,zipfile
from xml.etree.ElementTree import Element,SubElement,tostring
r=Path(__file__).resolve().parent;root=r.parent;out=r/'eye-layers';out.mkdir(exist_ok=True)
base=json.loads((root/'raster-layers.json').read_text());byid={l['id']:l for l in base['layers']}
reg=json.loads((r/'eye-white-registration.json').read_text());M=reg['matrixToSourceCrop'];whiteMatrix=[M[0][0]/4,M[1][0]/4,M[0][1]/4,M[1][1]/4,465+M[0][2]/4,210+M[1][2]/4]
svg=Element('svg',{'xmlns':'http://www.w3.org/2000/svg','width':'1086','height':'1448','viewBox':'0 0 1086 1448'});defs=SubElement(svg,'defs');textures={}
for name,p in [('original',root/'cutout-candidate.png'),('white',r/'eye-white-underpaint.png'),('iris',r/'iris-complete-underpaint.png')]:
 b=p.read_bytes();w,h=struct.unpack('>II',b[16:24]);SubElement(defs,'image',{'id':name,'width':str(w),'height':str(h),'href':'data:image/png;base64,'+base64.b64encode(b).decode()});textures[name]={'file':str(p.relative_to(root)),'sha256':hashlib.sha256(b).hexdigest()}
flt=SubElement(defs,'filter',{'id':'alpha-white','color-interpolation-filters':'sRGB'});SubElement(flt,'feColorMatrix',{'type':'matrix','values':'0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'})
cfg={'left':{'upper':[(513,252),(517,249),(523,249),(530,252),(535,258)],'lower':[(513,252),(514,258),(519,261),(526,262),(533,263),(535,258)],'iris':[(515,249),(525,249),(532,253),(533,260),(529,264),(522,265),(517,262),(515,255)],'highlight':[(522,250),(525,250),(526,253),(523,254)],'box':[339,76,468,573],'target':[514,243,20,25]},'right':{'upper':[(568,270),(572,266),(578,266),(582,270),(583,274)],'lower':[(568,270),(573,276),(578,281),(581,279),(583,274)],'iris':[(571,264),(578,264),(584,269),(583,277),(578,282),(574,279),(571,273)],'highlight':[(576,266),(578,267),(578,269),(575,269)],'box':[1486,164,332,411],'target':[570,259,16,23]}}
parts=[]
def path(poly):return 'M'+' L'.join(f'{x},{y}' for x,y in poly)+' Z'
def clip(id,poly):
 c=SubElement(defs,'clipPath',{'id':id});SubElement(c,'path',{'d':path(poly)});return 'url(#'+id+')'
def use(g,id,m=None):
 v={'href':'#'+id}
 if m:v['transform']='matrix('+','.join(map(str,m))+')'
 return SubElement(g,'use',v)
for side,q in cfg.items():
 old=byid['eye-'+side];x,y,w,h=old['x'],old['y'],old['width'],old['height'];opening=q['upper']+list(reversed(q['lower']))
 # The original cropped eye supplies visible lashes/skin. All new paint is traceable.
 for part in ['white','iris','highlight','upper','lower']:
  id='eye-'+side+'-'+part;g=SubElement(svg,'g',{'id':id});bounds=[x,y,x+w,y+h]
  if part=='white':g.set('clip-path',clip(id+'-clip',opening));use(g,'white',whiteMatrix)
  elif part=='iris':
   g.set('clip-path',clip(id+'-opening',opening));sx,sy,sw,sh=q['box'];tx,ty,tw,th=q['target'];use(g,'iris',[tw/sw,0,0,th/sh,tx-sx*tw/sw,ty-sy*th/sh]);c=SubElement(defs,'clipPath',{'id':id+'-original'});SubElement(c,'path',{'d':path(q['iris'])+' '+path(q['highlight']),'clip-rule':'evenodd'});u=use(g,'original');u.set('clip-path','url(#'+id+'-original)')
  elif part=='highlight':g.set('clip-path',clip(id+'-clip',q['highlight']));use(g,'original')
  else:
   poly=([(x,y),(x+w,y),(x+w,q['upper'][-1][1])]+list(reversed(q['upper']))+[(x,q['upper'][0][1])]) if part=='upper' else (q['lower']+[(x+w,q['lower'][-1][1]),(x+w,y+h),(x,y+h),(x,q['lower'][0][1])])
   g.set('clip-path',clip(id+'-clip',poly));mask=SubElement(defs,'mask',{'id':id+'-alpha','style':'mask-type:alpha','maskUnits':'userSpaceOnUse','x':str(x),'y':str(y),'width':str(w),'height':str(h)});SubElement(mask,'image',{'filter':'url(#alpha-white)','href':'data:image/png;base64,'+base64.b64encode((root/old['file']).read_bytes()).decode(),'x':str(x),'y':str(y),'width':str(w),'height':str(h)});masked=SubElement(g,'g',{'mask':'url(#'+id+'-alpha)'});use(masked,'white',whiteMatrix)
  parts.append({'id':id,'file':'expression/eye-layers/'+id+'.png','x':x,'y':y,'width':w,'height':h,'visible':True,'accepted':False,'source':part})
(r/'eye-source.svg').write_bytes(tostring(svg,encoding='utf-8',xml_declaration=True));env={**os.environ,'INKSCAPE_PROFILE_DIR':'/workspace/starush-environment/q80-green-expression-20261115/inkscape-profile'};Path(env['INKSCAPE_PROFILE_DIR']).mkdir(exist_ok=True)
actions=[]
for l in parts:
 actions+=['export-id:'+l['id'],'export-area:'+':'.join(map(str,[l['x'],l['y'],l['x']+l['width'],l['y']+l['height']])),'export-filename:'+str(root/l['file']),'export-do']
subprocess.run(['inkscape',str(r/'eye-source.svg'),'--export-id-only','--actions='+';'.join(actions)],check=True,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
for l in parts:l['sha256']=hashlib.sha256((root/l['file']).read_bytes()).hexdigest()
rows=[]
for l in base['layers']:
 if l['id'] in ['eye-left','eye-right']:rows.extend(p for p in parts if p['id'].startswith(l['id']+'-'))
 else:rows.append(l)
m={'queueItem':'Q80','status':'eye-source-candidate-unaccepted','canvas':{'width':1086,'height':1448},'layers':rows,'eyes':cfg,'textures':textures,'sourceRasterSha256':hashlib.sha256((root/'raster-layers.json').read_bytes()).hexdigest(),'artAccepted':False,'contentComplete':False,'isLive2DModel':False,'expressionAccepted':False,'note':'Candidate static eye split, no blinking/gaze/mouth parameters yet; no claim of neutral pixel equality.'}
(r/'eye-raster.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
ora=Element('image',{'w':'1086','h':'1448','name':'Q80 Green expression candidate','version':'0.0.3'});stack=SubElement(ora,'stack')
for i,l in reversed(list(enumerate(rows))):SubElement(stack,'layer',{'name':l['id'],'src':f'data/{i}.png','x':str(l['x']),'y':str(l['y']),'opacity':'1','visibility':'visible','composite-op':'svg:src-over'})
with zipfile.ZipFile(r/'green-expression-source.ora','w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED);z.writestr('stack.xml',tostring(ora))
 for i,l in enumerate(rows):z.write(root/l['file'],f'data/{i}.png')
print('EXPRESSION_SOURCE_CANDIDATE',len(rows),'layers',len(parts),'eye parts')
