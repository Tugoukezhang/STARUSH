"""Build an explicitly labelled Inochi2D INX study from our native PSD import.
No Cubism/moc3 encoding. Texture tail is retained byte-for-byte from our own
Inochi Creator export. Re-running on the produced INX replaces, not stacks, rigging.
"""
import json,math,struct,hashlib,sys
from pathlib import Path
root=Path(__file__).parent/'red-20261114'
source=Path(sys.argv[1]) if len(sys.argv)>1 else root/'red-head-mesh.inx'
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
heads=set(raster['groups'][0]['members'])
# Local face axes follow the reference's existing diagonal eye line.
angle=math.radians(26);ca,sa=math.cos(angle),math.sin(angle)
def smooth(t):
 t=max(0,min(1,t));return t*t*(3-2*t)
def field(x,y,yaw,pitch,roll=0,part=""):
 # Goggles/headband are a rigid planar accessory: project one plane about
 # the held rim. A local soft contact mask would bend the lens like rubber.
 if part in ['head-accessories','head-accessories-paint']:
  u=ca*(x-685)+sa*(y-162);v=-sa*(x-685)+ca*(y-162)
  ay,ap,ar=map(math.radians,(yaw*.75,pitch*.65,roll*.75))
  uu=u*math.cos(ay);vv=v*math.cos(ap)+u*math.sin(ay)*math.sin(ap)
  px=ca*uu-sa*vv;py=sa*uu+ca*vv
  xx=px*math.cos(ar)-py*math.sin(ar);yy=px*math.sin(ar)+py*math.cos(ar)
  return [round(xx-(x-685),6),round(yy-(y-162),6)]
 u=ca*(x-581)+sa*(y-225);v=-sa*(x-581)+ca*(y-225)
 depth=53*math.exp(-(u/105)**2-(v/130)**2)+9*math.exp(-((x-606)/24)**2-((y-244)/20)**2)
 ay,ap,ar=map(math.radians,(yaw,pitch,roll))
 ux=u*math.cos(ay)+depth*math.sin(ay);zz=depth*math.cos(ay)-u*math.sin(ay)
 vy=v*math.cos(ap)-zz*math.sin(ap)
 dx=ca*(ux-u)-sa*(vy-v);dy=sa*(ux-u)+ca*(vy-v)
 # Neck base and finger/goggle contact stay anchored; distant ponytail is not a physics rig.
 neckFade=smooth((y-250)/42)
 # Keep collar attachment centred on the neck, not across the entire jaw.
 # Long ponytail lower ends stay fixed until their separate physics work.
 neck=1-neckFade if part in ['rear-hair','rear-hair-tips','rear-hair-sleeve-underpaint'] else 1-neckFade*math.exp(-((x-548)/42)**2)
 far=.25+.75*math.exp(-((x-581)/260)**2-((y-225)/260)**2)
 contact=1-math.exp(-((x-685)/26)**2-((y-162)/23)**2)
 weight=neck*far*contact
 rx=(x-552)*math.cos(ar)-(y-279)*math.sin(ar)-(x-552)
 ry=(x-552)*math.sin(ar)+(y-279)*math.cos(ar)-(y-279)
 # Shared crown projection keeps lens/headband structure while all adjacent
 # hair surfaces use the same field: independent accessory projection opens
 # the source's occlusion cuts. Blend smoothly into the face depth field.
 u0=ca*(x-685)+sa*(y-162);v0=-sa*(x-685)+ca*(y-162)
 gy,gp,gr=map(math.radians,(yaw*.75,pitch*.65,roll*.75))
 uu=u0*math.cos(gy);vv=v0*math.cos(gp)+u0*math.sin(gy)*math.sin(gp)
 px=ca*uu-sa*vv;py=sa*uu+ca*vv
 gx=px*math.cos(gr)-py*math.sin(gr)-(x-685)
 gy=px*math.sin(gr)+py*math.cos(gr)-(y-162)
 crown=(1-smooth((y-170)/65))*math.exp(-((x-580)/270)**4)
 return [round((dx+rx)*weight*(1-crown)+gx*crown,6),round((dy+ry)*weight*(1-crown)+gy*crown,6)]
params=[dict(uuid=690001,name='Head:: Yaw-Pitch',is_vec2=True,min=[-20.,-12.],max=[20.,12.],defaults=[0.,0.],axis_points=[[0.,.25,.5,.75,1.],[0.,.25,.5,.75,1.]],merge_mode='Additive',bindings=[]),dict(uuid=690002,name='Head:: Roll',is_vec2=False,min=[-5.,0.],max=[5.,1.],defaults=[0.,0.],axis_points=[[0.,.5,1.],[0.]],merge_mode='Additive',bindings=[])]
stats=[]
for node in model['nodes']['children']:
 a=byid[node['name']];w,h=a['width'],a['height'];cx,cy=a['x']+w/2,a['y']+h/2
 node['transform']['trans']=[cx-535,cy-735,0.]
 step=10 if node['name'] in heads else max(w,h)
 # Every cropped layer has an outer edge ring and interior lattice. Fine face layers share 7 px spacing.
 xs=sorted(set([-w/2,-w/2+min(2,w/4),w/2-min(2,w/4),w/2]+[i-cx for i in range(math.ceil(a['x']/step)*step,a['x']+w,step)]))
 ys=sorted(set([-h/2,-h/2+min(2,h/4),h/2-min(2,h/4),h/2]+[i-cy for i in range(math.ceil(a['y']/step)*step,a['y']+h,step)]))
 if node['name'] not in heads:xs=[-w/2,w/2];ys=[-h/2,h/2]
 verts=[[x,y] for y in ys for x in xs];inds=[];nx=len(xs)
 for j in range(len(ys)-1):
  for i in range(nx-1):
   a0=j*nx+i;inds += [a0,a0+nx,a0+1,a0+1,a0+nx,a0+nx+1]
 node['mesh']={'verts':[v for p in verts for v in p],'uvs':[v for x,y in verts for v in [(x+w/2)/w,(y+h/2)/h]],'indices':inds,'origin':[0.,0.]}
 if node['name'] in heads:
  values=[[[field(cx+x,cy+y,yaw,pitch,part=node["name"]) for x,y in verts] for pitch in [-12,-6,0,6,12]] for yaw in [-20,-10,0,10,20]]
  params[0]['bindings'].append(dict(node=node['uuid'],param_name='deform',values=values,isSet=[[True]*5 for _ in range(5)],interpolate_mode='Linear'))
  rolls=[[[field(cx+x,cy+y,0,0,z,part=node["name"]) for x,y in verts]] for z in [-5,0,5]]
  params[1]['bindings'].append(dict(node=node['uuid'],param_name='deform',values=rolls,isSet=[[True] for _ in range(3)],interpolate_mode='Linear'))
 stats.append({'id':node['name'],'vertices':len(verts),'triangles':len(inds)//3,'deformed':node['name'] in heads})
model['param']=params
model['meta'].update(name='STARUSH Red Q69 Mesh Study - Inochi2D, not Cubism',rigger='Codex / STARUSH',artist='User GPT-generated design; STARUSH derivative layers',copyright='STARUSH user design',reference=f'Q68 {len(byid)}-layer source; Q69 work in progress')
data=json.dumps(model,separators=(',',':'),ensure_ascii=False).encode();out=root/'red-head-mesh.inx';out.write_bytes(b[:8]+struct.pack('>I',len(data))+data+tail)
design={'queueItem':'Q69','status':'work-in-progress','format':'Inochi Creator INX / INP1','isLive2DModel':False,'artAccepted':False,'contentComplete':False,'sourceRasterSha256':hashlib.sha256((root/'raster-layers.json').read_bytes()).hexdigest(),'textureTailSha256':hashlib.sha256(tail).hexdigest(),'nativeModelSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'coordinateSystem':'1070x1470 source canvas; model origin=(535,735)','parameters':[{k:v for k,v in p.items() if k!='bindings'} for p in params],'layers':stats,'limitations':['Non-Cubism study; not a complete Live2D delivery','Approximate spatial depth field needs art review at combinations','No eye/blink/physics or game integration yet']}
(root/'head-mesh-design.json').write_text(json.dumps(design,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'bytes':out.stat().st_size,'parts':len(stats),'deformed':len(heads),'vertices':sum(x['vertices'] for x in stats),'triangles':sum(x['triangles'] for x in stats)}))
