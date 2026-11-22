"""Q73 source assembly: preserve original visible PNGs through SVG selection.
Image-gen supplies only the hidden crossing repair. Inkscape renders geometry;
Python packages the unchanged exports and never paints raster pixels.
"""
from pathlib import Path
from xml.etree.ElementTree import Element,SubElement,tostring
import json,base64,struct,subprocess,os,zipfile,hashlib,math
r=Path(__file__).parent/'red-20261114';out=r/'hair-crossing-layers';out.mkdir(exist_ok=True)
base=json.loads((r/'mouth-rig-raster.json').read_text());proposal=json.loads((r/'hair-crossing-proposal.json').read_text())
svg=Element('svg',{'xmlns':'http://www.w3.org/2000/svg','width':'1070','height':'1470','viewBox':'0 0 1070 1470'});defs=SubElement(svg,'defs')
for sid,f in [('original','rendered-layers/rear-hair.png'),('repair',proposal.get('repairTexture','hair-crossing-underpaint-candidate.png'))]:
 data=(r/f).read_bytes();w,h=struct.unpack('>II',data[16:24]);SubElement(defs,'image',{'id':sid,'width':str(w),'height':str(h),'href':'data:image/png;base64,'+base64.b64encode(data).decode()})
poly=proposal['foregroundPolygon'];points=' '.join(f'{x},{y}'for x,y in poly);d='M'+' L'.join(f'{x},{y}'for x,y in poly)+' Z'
clip=SubElement(defs,'clipPath',{'id':'foreground','shape-rendering':'crispEdges'});SubElement(clip,'polygon',{'points':points})
clip=SubElement(defs,'clipPath',{'id':'background','shape-rendering':'crispEdges'});SubElement(clip,'path',{'d':'M0,0 H1033 V705 H0 Z '+d,'clip-rule':'evenodd'})
f=SubElement(defs,'filter',{'id':'selection-feather','x':'-10%','y':'-10%','width':'120%','height':'120%'});SubElement(f,'feGaussianBlur',{'stdDeviation':'0.7'})
bgmask=SubElement(defs,'mask',{'id':'background-soft','maskUnits':'userSpaceOnUse','x':'0','y':'0','width':'1033','height':'705'});SubElement(bgmask,'rect',{'width':'1033','height':'705','fill':'white'});SubElement(bgmask,'polygon',{'points':points,'fill':'black','shape-rendering':'crispEdges'});localmask=SubElement(bgmask,'g',{'clip-path':'url(#crossing)'});SubElement(localmask,'polygon',{'points':points,'fill':'black','stroke':'black','stroke-width':'2','filter':'url(#selection-feather)'})
# Pixel-aligned vector scanlines partition original pixels without double
# antialiasing. This is SVG selection geometry, not raster repainting.
scanlines=[]
for iy in range(705):
 yy=iy+.5;edges=[]
 for (ax,ay),(bx,by) in zip(poly,poly[1:]+poly[:1]):
  if (ay<=yy<by) or (by<=yy<ay):edges.append(ax+(yy-ay)*(bx-ax)/(by-ay))
 edges.sort()
 for left,right in zip(edges[::2],edges[1::2]):
  x0=max(0,math.ceil(left-.5));x1=min(1033,math.ceil(right-.5))
  if x1>x0:scanlines.append((x0,iy,x1-x0))
for name,inverse in [('foreground-pixels',False),('background-pixels',True)]:
 sel=SubElement(defs,'mask',{'id':name,'maskUnits':'userSpaceOnUse','x':'0','y':'0','width':'1033','height':'705'});SubElement(sel,'rect',{'width':'1033','height':'705','fill':'white' if inverse else 'black'})
 for xx,yy,ww in scanlines:SubElement(sel,'rect',{'x':str(xx),'y':str(yy),'width':str(ww),'height':'1','fill':'black' if inverse else 'white'})
clip=SubElement(defs,'clipPath',{'id':'crossing'});SubElement(clip,'polygon',{'points':' '.join(f'{x},{y}'for x,y in proposal['repairPolygon'])})
f=SubElement(defs,'filter',{'id':'white-alpha','color-interpolation-filters':'sRGB'});SubElement(f,'feColorMatrix',{'type':'matrix','values':'0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'})
mask=SubElement(defs,'mask',{'id':'original-alpha','mask-type':'alpha','maskUnits':'userSpaceOnUse','x':'0','y':'0','width':'1033','height':'705'});SubElement(mask,'use',{'href':'#original','filter':'url(#white-alpha)'})
main=SubElement(svg,'g',{'id':'rear-hair','transform':'translate(21 5)'})
repair=SubElement(main,'g',{'mask':'url(#original-alpha)'});repair=SubElement(repair,'g',{'clip-path':'url(#crossing)'})
SubElement(repair,'use',{'href':'#repair','transform':'matrix('+','.join(map(str,proposal['repairMatrix']))+')'})
SubElement(main,'use',{'href':'#original','mask':'url(#background-soft)'})
front=SubElement(svg,'g',{'id':'rear-hair-left-lock','transform':'translate(21 5)'});SubElement(front,'use',{'href':'#original','mask':'url(#foreground-pixels)'})
(r/'hair-crossing-source.svg').write_bytes(tostring(svg,encoding='utf-8',xml_declaration=True));env={**os.environ,'INKSCAPE_PROFILE_DIR':'/workspace/starush-environment/q73-hair-crossing-refine-20261114/inkscape-profile'};Path(env['INKSCAPE_PROFILE_DIR']).mkdir(exist_ok=True)
parts=[]
for name,bounds in [('rear-hair',[21,5,1033,705]),('rear-hair-left-lock',[66,405,205,305])]:
 x,y,w,h=bounds;p=out/(name+'.png');subprocess.run(['inkscape',str(r/'hair-crossing-source.svg'),'--export-id='+name,'--export-id-only','--export-area='+':'.join(map(str,[x,y,x+w,y+h])),'--export-filename='+str(p)],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE);data=p.read_bytes();parts.append(dict(id=name,file='hair-crossing-layers/'+name+'.png',x=x,y=y,width=w,height=h,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),accepted=False))
rows=[]
for l in base['layers']:
 if l['id']=='rear-hair':rows.extend(parts)
 else:rows.append(l)
pkg=dict(queueItem='Q73',status='candidate-not-accepted',artAccepted=False,contentComplete=False,isLive2DModel=False,canvas=base['canvas'],layers=rows,hairParts=parts,baselineQ71RasterSha256=hashlib.sha256((r/'mouth-rig-raster.json').read_bytes()).hexdigest(),sourceNote='Original visible S-lock and remaining ponytail selected without repainting; image_gen repair restricted to newly hidden crossing. Pending visual acceptance.')
(r/'hair-crossing-raster.json').write_text(json.dumps(pkg,ensure_ascii=False,indent=2)+'\n')
ora=Element('image',{'w':'1070','h':'1470','name':'STARUSH Q73 split hair source CANDIDATE','version':'0.0.3'});stack=SubElement(ora,'stack')
for i,l in reversed(list(enumerate(rows))):SubElement(stack,'layer',{'name':l['id'],'src':f'data/layer{i:02}.png','x':str(l['x']),'y':str(l['y']),'opacity':'1.0','visibility':'visible','composite-op':'svg:src-over'})
with zipfile.ZipFile(r/'red-hair-crossing-source.ora','w',zipfile.ZIP_DEFLATED)as z:
 z.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED);z.writestr('stack.xml',tostring(ora,encoding='utf-8',xml_declaration=True))
 for i,l in enumerate(rows):z.write(r/l['file'],f'data/layer{i:02}.png')
print('Q73 candidate',len(rows),'layers; original foreground and bounded hidden crossing')
