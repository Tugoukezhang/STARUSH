"""Q83 original moon and leaf-note response; retain accepted source/texture order."""
from pathlib import Path
import json,struct,math,hashlib
r=Path(__file__).resolve().parent;raw=(r.parent/'physics/green-physics-rig.inx').read_bytes();size=struct.unpack('>I',raw[8:12])[0];m=json.loads(raw[12:12+size]);tail=raw[12+size:]
layers={x['id']:x for x in json.loads((r.parent/'expression/closure/expression-raster.json').read_text())['layers']}
names=['Moon Lift','Moon Tilt','Upper Notes','Near Notes','Leaf Arc'];groups=[{'moon-chime','rear-fragments-moon-chime'},{'moon-chime','rear-fragments-moon-chime'},{'music-leaves-upper'},{'leaf-near-moon'},{'music-leaves-right'}]
def rot(x,y,cx,cy,a):
 a=math.radians(a);return [cx+math.cos(a)*(x-cx)-math.sin(a)*(y-cy),cy+math.sin(a)*(x-cx)+math.cos(a)*(y-cy)]
def smooth(t):
 t=max(0,min(1,t));return t*t*(3-2*t)
def field(c,x,y,t):
 if c==0:return [t,-5*t]
 cx,cy,angle,dx,dy={1:(790,130,2,0,0),2:(660,125,3,-2,-4),3:(685,230,-3,2,-2),4:(940,240,2,4,-3)}[c]
 q=rot(x,y,cx,cy,angle*t);w=smooth((math.hypot(x-870,y-270)-35)/110) if c==4 else 1
 return [(q[0]-x+dx*t)*w,(q[1]-y+dy*t)*w]
steps=[-1,-.5,0,.5,1];axis=[0.,.25,.5,.75,1.]
for c,name in enumerate(names):
 p=dict(uuid=830001+c,name='Ornament:: '+name,is_vec2=False,min=[-1.,0.],max=[1.,1.],defaults=[0.,0.],axis_points=[axis,[0.]],merge_mode='Additive',bindings=[])
 correction=dict(uuid=830011+c,name='Ornament:: '+name+' Arm Correction',is_vec2=True,min=[-8.,-1.],max=[8.,1.],defaults=[0.,0.],axis_points=[axis,axis],merge_mode='Additive',bindings=[])
 for n in m['nodes']['children']:
  if n['name'] not in groups[c]:continue
  l=layers[n['name']];cx,cy=l['x']+l['width']/2,l['y']+l['height']/2;vs=[(cx+x,cy+y)for x,y in zip(n['mesh']['verts'][::2],n['mesh']['verts'][1::2])]
  dv=[[[[round(v,6)for v in field(c,x,y,t)]for x,y in vs]]for t in steps]
  p['bindings'].append(dict(node=n['uuid'],param_name='deform',values=dv,isSet=[[True]for _ in steps],interpolate_mode='Linear'))
  values=[]
  for angle in steps:
   row=[]
   for t in steps:
    ds=[]
    for x,y in vs:
     dx,dy=field(c,x,y,t);qx,qy=rot(dx,dy,0,0,angle*8);ds.append([round(qx-dx,6),round(qy-dy,6)])
    row.append(ds)
   values.append(row)
  correction['bindings'].append(dict(node=n['uuid'],param_name='deform',values=values,isSet=[[True]*5 for _ in steps],interpolate_mode='Linear'))
 m['param'].extend([p,correction])
m['meta'].update(name='STARUSH Green Q83 Moon Notes Candidate - Inochi2D',reference='Original finite moon/leaf response; retained depth and hand-relative arm corrective')
data=json.dumps(m,ensure_ascii=False,separators=(',',':')).encode();out=r/'green-ornament-rig.inx';out.write_bytes(raw[:8]+struct.pack('>I',len(data))+data+tail)
d=dict(queueItem='Q83',status='candidate-not-accepted',ornamentAccepted=False,artAccepted=False,contentComplete=False,isLive2DModel=False,parts=len(m['nodes']['children']),parameters=len(m['param']),channels=names,modelSha256=hashlib.sha256(out.read_bytes()).hexdigest(),baselineQ82Sha256=hashlib.sha256(raw).hexdigest(),limits=['Moon frame moves as its existing independent layer; individual bells are not separately repainted','Five original local response controls and five hand-relative corrective channels','No added sound, particle effect or production integration','Accepted head/body/arms ranges only'])
# Preserve acceptance only when this exact deliverable set still matches its manifest.
afile=r/'ornament-acceptance.json'
if afile.exists():
 a=json.loads(afile.read_text())
 if a.get('modelSha256')==d['modelSha256'] and all((r/name).exists() and hashlib.sha256((r/name).read_bytes()).hexdigest()==digest for name,digest in a.get('files',{}).items()):
  d.update(status='accepted-Q83-limited-ornaments',ornamentAccepted=True)
(r/'ornament-rig-design.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');print(d)
