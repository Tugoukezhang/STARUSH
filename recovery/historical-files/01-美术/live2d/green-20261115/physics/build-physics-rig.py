"""Q82 native local deform bindings; preserve all accepted Q81 meshes/textures."""
from pathlib import Path
import json,struct,math,hashlib
r=Path(__file__).resolve().parent
raw=(r.parent/'body/green-body-rig.inx').read_bytes();size=struct.unpack('>I',raw[8:12])[0];m=json.loads(raw[12:12+size]);tail=raw[12+size:]
layers={x['id']:x for x in json.loads((r.parent/'expression/closure/expression-raster.json').read_text())['layers']}
def smooth(t):
 t=max(0.,min(1.,t));return t*t*(3-2*t)
long={'ponytail-main','flower-root-hair','ponytail-rear-original-fragments'}
groups=[long,long,long,{'fringe-center','rear-fragments-fringe-center'},{'fringe-right','fringe-right-rear-original-fragments'},{'hair-cheek-left','cheek-root-hidden-paint','rear-fragments-hair-cheek-left'},{'hair-side-right','right-cuff-hair-underpaint','right-hair-rear-original-fragments'}]
cloth={'waist-cloth-left-backing','inner-skirt-hidden-paint','skirt-left','skirt-right','skirt-opening-lip','ribbon-bottom-left','ribbon-lower-right','ribbon-middle-right','rear-fragments-skirt-left','rear-fragments-skirt-right','rear-fragments-ribbon-middle-right'}
groups += [cloth,cloth,cloth,cloth,{'ribbon-upper-right','rear-fragments-ribbon-upper-right','wrist-ribbon-hidden-paint'}]
names=['Hair:: Upper','Hair:: Middle','Hair:: Tip','Hair:: Fringe Center','Hair:: Fringe Right','Hair:: Cheek','Hair:: Side','Cloth:: Left Hem','Cloth:: Right Hem','Cloth:: Left Tip','Cloth:: Right Tip','Cloth:: Wrist Ribbon']
def field(c,x,y):
 if c<3:
  root=smooth((math.hypot(x-450,y-200)-95)/160);upper=1-smooth((y-300)/200);tip=smooth((y-500)/200);w=[upper,1-upper-tip,tip][c]*root;dx=[5,9,13][c]*w
  return [dx,dx*.18*math.sin((y-200)/500*math.pi)]
 if c<5:
  w=smooth((y-205)/115);return [1.1*w,.25*w]
 if c==5:
  w=smooth((y-252)/90);return [.85*w,.25*w]
 if c==6:
  w=smooth((x-600)/105);return [1.5*w,-.5*w]
 if c in [7,8]:
  left=1-smooth((x-500)/220);w=smooth((y-620)/330)*([left,1-left][c-7]);return [[7,9][c-7]*w,2*w]
 if c==9:
  w=(1-smooth((x-500)/200))*smooth((y-980)/230);return [12*w,3*w]
 if c==10:
  w=smooth((x-600)/180)*smooth((y-880)/250);return [12*w,-3*w]
 t=(y-350)/205
 w=math.sin(math.pi*t)**2 if 0<t<1 else 0
 return [5*w,1.5*w]
for c,name in enumerate(names):
 p=dict(uuid=820001+c,name=name,is_vec2=False,min=[-1.,0.],max=[1.,1.],defaults=[0.,0.],axis_points=[[0.,.25,.5,.75,1.],[0.]],merge_mode='Additive',bindings=[])
 for n in m['nodes']['children']:
  if n['name'] not in groups[c]:continue
  l=layers[n['name']];cx,cy=l['x']+l['width']/2,l['y']+l['height']/2;vs=list(zip(n['mesh']['verts'][::2],n['mesh']['verts'][1::2]));dv=[field(c,cx+x,cy+y)for x,y in vs]
  p['bindings'].append(dict(node=n['uuid'],param_name='deform',values=[[[[round(v*t,6)for v in xy]for xy in dv]]for t in [-1,-.5,0,.5,1]],isSet=[[True]for _ in range(5)],interpolate_mode='Linear'))
 m['param'].append(p)
m['meta'].update(name='STARUSH Green Q82 Hair Cloth Candidate - Inochi2D',reference='Q81 retained. Twelve local spring channels, browser controller, no native physics nodes.')
data=json.dumps(m,ensure_ascii=False,separators=(',',':')).encode();out=r/'green-physics-rig.inx';out.write_bytes(raw[:8]+struct.pack('>I',len(data))+data+tail)
d=dict(queueItem='Q82',status='candidate-not-accepted',hairClothAccepted=False,artAccepted=False,contentComplete=False,isLive2DModel=False,parts=len(m['nodes']['children']),parameters=len(m['param']),channels=names,groups=[sorted(s)for s in groups],vertices=sum(len(n['mesh']['verts'])//2 for n in m['nodes']['children']),triangles=sum(len(n['mesh']['indices'])//3 for n in m['nodes']['children']),modelSha256=hashlib.sha256(out.read_bytes()).hexdigest(),baselineQ81Sha256=hashlib.sha256(raw).hexdigest(),textureTailExact=True,limits=['Continuous ponytail uses upper/middle/tip mesh regions; not every painted strand is individually separated','Four independent short-hair groups; root fields are fixed','Cloth surfaces sharing boundaries receive the same world-space field','Fixed 120Hz browser spring controller; INX contains editable deformation parameters, no native physics nodes','Limited accepted head/arm range only; full character and production integration not complete'])
(r/'physics-rig-design.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');print({k:d[k]for k in ['parts','parameters','vertices','triangles','modelSha256']})

acceptance=r/'physics-acceptance.json'
if acceptance.exists():
 accepted=json.loads(acceptance.read_text())
 if accepted.get('modelSha256')==d['modelSha256'] and all(hashlib.sha256((r/f).read_bytes()).hexdigest()==h for f,h in accepted['files'].items()):
  d.update(status='accepted-Q82-limited-hair-cloth',hairClothAccepted=True)
  (r/'physics-rig-design.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
