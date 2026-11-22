"""Build an explicitly labelled Inochi2D INX study from our native PSD import.
No Cubism/moc3 encoding. Texture tail is retained byte-for-byte from our own
Inochi Creator export. Re-running on the produced INX replaces, not stacks, rigging.
"""
import json,math,struct,hashlib,sys
from pathlib import Path
root=Path(__file__).resolve().parent
source=Path(sys.argv[1]) if len(sys.argv)>1 else root/'green-head-mesh.inx'
designFile=root/'head-mesh-design.json'
if len(sys.argv)<=1 and designFile.exists():
 previous=json.loads(designFile.read_text())
 actual=hashlib.sha256((root/'raster-layers.json').read_bytes()).hexdigest()
 if previous['sourceRasterSha256']!=actual:raise SystemExit('Source layers changed: re-export PSD, import into Inochi Creator, and pass the freshly saved INX explicitly; do not reuse stale textures.')
b=source.read_bytes(); assert b[:8]==b'TRNSRTS\0'
size=struct.unpack('>I',b[8:12])[0]; model=json.loads(b[12:12+size]); tail=b[12+size:]
raster=json.loads((root/'raster-layers.json').read_text()); byid={x['id']:x for x in raster['layers']}
names=[n['name'] for n in model['nodes']['children']]
if len(names)!=len(byid) or len(set(names))!=len(names) or set(names)!=set(byid):
 raise SystemExit('Native import layers differ from current source: import the current PSD before building.')
sourceLayers=json.loads((root/'layers.json').read_text())['layers']
heads=set('scalp-underpaint ear-root-underpaint ponytail-main flower-root-hair neck-skin hair-side-right brow-left brow-right fringe-right fringe-center hair-flower earring-right earrings ear-left face cheek-root-hidden-paint hair-cheek-left nose mouth eye-right eye-left ponytail-rear-original-fragments fringe-right-rear-original-fragments right-hair-rear-original-fragments'.split())
heads.update(l['id'] for l in sourceLayers if l.get('controlOwner') in heads)
assert heads<=set(byid)

# Green source: eyes lie on a 20-degree diagonal; jaw/neck pivot=(510,340).
angle=math.radians(20);ca,sa=math.cos(angle),math.sin(angle)
def smooth(t):
 t=max(0,min(1,t));return t*t*(3-2*t)
def field(x,y,yaw,pitch,roll=0,part=""):
 u=ca*(x-535)+sa*(y-260);v=-sa*(x-535)+ca*(y-260)
 depth=43*math.exp(-(u/83)**2-(v/103)**2)+7*math.exp(-((x-552)/18)**2-((y-285)/18)**2)
 ay,ap,ar=map(math.radians,(yaw,pitch,roll))
 ux=u*math.cos(ay)+depth*math.sin(ay);z=depth*math.cos(ay)-u*math.sin(ay)
 vy=v*math.cos(ap)-z*math.sin(ap)
 dx=ca*(ux-u)-sa*(vy-v);dy=sa*(ux-u)+ca*(vy-v)
 # Shared continuous field prevents adjacent hair/face cut lines separating.
 # Neck attachment and the lower ponytail fade to their current neutral anchors.
 neck=1-smooth((y-302)/43)*math.exp(-((x-510)/52)**2)
 tail=1-smooth((y-350)/160)
 far=.30+.70*math.exp(-((x-535)/260)**2-((y-260)/250)**2)
 weight=neck*tail*far
 rx=(x-510)*math.cos(ar)-(y-340)*math.sin(ar)-(x-510)
 ry=(x-510)*math.sin(ar)+(y-340)*math.cos(ar)-(y-340)
 return [round((dx+rx)*weight,6),round((dy+ry)*weight,6)]
params=[dict(uuid=790001,name='Head:: Yaw-Pitch',is_vec2=True,min=[-12.,-8.],max=[12.,8.],defaults=[0.,0.],axis_points=[[0.,.25,.5,.75,1.],[0.,.25,.5,.75,1.]],merge_mode='Additive',bindings=[]),dict(uuid=790002,name='Head:: Roll',is_vec2=False,min=[-4.,0.],max=[4.,1.],defaults=[0.,0.],axis_points=[[0.,.5,1.],[0.]],merge_mode='Additive',bindings=[])]
stats=[]
for node in model['nodes']['children']:
 a=byid[node['name']];w,h=a['width'],a['height'];cx,cy=a['x']+w/2,a['y']+h/2
 node['transform']['trans']=[cx-543,cy-724,0.]
 step=(20 if node['name'] in ['ponytail-main','flower-root-hair'] else 6) if node['name'] in heads else max(w,h)
 # Every cropped layer has an outer edge ring and interior lattice. Fine face layers share 10 px spacing.
 xs=sorted(set([-w/2,-w/2+min(2,w/4),w/2-min(2,w/4),w/2]+[i-cx for i in range(math.ceil(a['x']/step)*step,a['x']+w,step)]))
 ys=sorted(set([-h/2,-h/2+min(2,h/4),h/2-min(2,h/4),h/2]+[i-cy for i in range(math.ceil(a['y']/step)*step,a['y']+h,step)]))
 if node['name'] not in heads:xs=[-w/2,w/2];ys=[-h/2,h/2]
 verts=[[x,y] for y in ys for x in xs];inds=[];nx=len(xs)
 for j in range(len(ys)-1):
  for i in range(nx-1):
   a0=j*nx+i;inds += [a0,a0+nx,a0+1,a0+1,a0+nx,a0+nx+1]
 node['mesh']={'verts':[v for p in verts for v in p],'uvs':[v for x,y in verts for v in [(x+w/2)/w,(y+h/2)/h]],'indices':inds,'origin':[0.,0.]}
 if node['name'] in heads:
  values=[[[field(cx+x,cy+y,yaw,pitch,part=node["name"]) for x,y in verts] for pitch in [-8,-4,0,4,8]] for yaw in [-12,-6,0,6,12]]
  params[0]['bindings'].append(dict(node=node['uuid'],param_name='deform',values=values,isSet=[[True]*5 for _ in range(5)],interpolate_mode='Linear'))
  rolls=[[[field(cx+x,cy+y,0,0,z,part=node["name"]) for x,y in verts]] for z in [-4,0,4]]
  params[1]['bindings'].append(dict(node=node['uuid'],param_name='deform',values=rolls,isSet=[[True] for _ in range(3)],interpolate_mode='Linear'))
 stats.append({'id':node['name'],'vertices':len(verts),'triangles':len(inds)//3,'deformed':node['name'] in heads})
model['param']=params
model['meta'].update(name='STARUSH Green Q79 Mesh Study - Inochi2D, not Cubism',rigger='Codex / STARUSH',artist='User GPT-generated design; STARUSH derivative layers',copyright='STARUSH user design',reference=f'Q78 {len(byid)}-layer source; Q79 work in progress')
data=json.dumps(model,separators=(',',':'),ensure_ascii=False).encode();out=root/'green-head-mesh.inx';out.write_bytes(b[:8]+struct.pack('>I',len(data))+data+tail)
design={'queueItem':'Q79','status':'work-in-progress','format':'Inochi Creator INX / INP1','isLive2DModel':False,'artAccepted':False,'contentComplete':False,'sourceRasterSha256':hashlib.sha256((root/'raster-layers.json').read_bytes()).hexdigest(),'textureTailSha256':hashlib.sha256(tail).hexdigest(),'nativeModelSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'coordinateSystem':'1086x1448 source canvas; origin=(543,724); face=(535,260); neck=(510,340)','parameters':[{k:v for k,v in p.items() if k!='bindings'} for p in params],'layers':stats,'limitations':['Non-Cubism study; not a complete Live2D delivery','Approximate spatial depth field needs art review at combinations','No eye/blink/physics or game integration yet']}
(root/'head-mesh-design.json').write_text(json.dumps(design,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'bytes':out.stat().st_size,'parts':len(stats),'deformed':len(heads),'vertices':sum(x['vertices'] for x in stats),'triangles':sum(x['triangles'] for x in stats)}))
