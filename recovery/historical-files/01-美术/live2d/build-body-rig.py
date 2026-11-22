"""Q72 local torso breathing and grounded weight shift in real Inochi meshes.
Accepted Q71 and native texture bytes remain unchanged. No whole-image scaling.
"""
from pathlib import Path
import json,math,struct,hashlib,copy
r=Path(__file__).parent/'red-20261114';source=r/'red-mouth-rig.inx';b=source.read_bytes();assert b[:8]==b'TRNSRTS\0';size=struct.unpack('>I',b[8:12])[0];model=json.loads(b[12:12+size]);tail=b[12+size:];layers={l['id']:l for l in json.loads((r/'mouth-rig-raster.json').read_text())['layers']}
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def motion(x,y,breath,balance,name=''):
 if name in ['weapon','weapon-surface']:x,y=285,780
 if y>=1160:return [0.,0.]
 fade=smooth((1160-y)/880);upper=1-smooth((y-280)/280);chest=math.exp(-((y-400)/110)**2-((x-580)/170)**2)*smooth((y-280)/70)
 dx=breath*(x-580)*.012*chest+balance*7*fade
 dy=breath*(-1.1*upper-2*chest)+balance*(-.7*fade+(x-580)*.004*chest)
 return [round(dx,6),round(dy,6)]
def p(uid,name):return dict(uuid=uid,name=name,is_vec2=False,min=[-1.,0.],max=[1.,1.],defaults=[0.,0.],axis_points=[[0.,.25,.5,.75,1.],[0.]],merge_mode='Additive',bindings=[])
breath=p(720001,'Body:: Breath');balance=p(720002,'Body:: Balance');newmeshes=[]
bound={b['node']for p in model['param']for b in p['bindings'] if b['param_name']=='deform'}
for node in model['nodes']['children']:
 l=layers[node['name']];w,h=l['width'],l['height'];cx,cy=l['x']+w/2,l['y']+h/2
 if node['uuid']not in bound and node['name']not in ['weapon','weapon-surface']:
  xs=sorted(set([-w/2,w/2]+[x-cx for x in range(l['x'],l['x']+w,24)]));ys=sorted(set([-h/2,h/2]+[y-cy for y in range(l['y'],l['y']+h,24)]+[y-cy for y in [280,350,400,560,750,1160]if l['y']<y<l['y']+h]));vs=[(x,y)for y in ys for x in xs];nx=len(xs);inds=[]
  for j in range(len(ys)-1):
   for i in range(nx-1):
    k=j*nx+i;inds.extend([k,k+nx,k+1,k+1,k+nx,k+nx+1])
  node['mesh']=dict(verts=[v for xy in vs for v in xy],uvs=[v for x,y in vs for v in [(x+w/2)/w,(y+h/2)/h]],indices=inds,origin=[0.,0.]);newmeshes.append(node['name'])
 verts=list(zip(node['mesh']['verts'][::2],node['mesh']['verts'][1::2]));node['transform']['trans']=[cx-535,cy-735,0.]
 for param,axis in [(breath,0),(balance,1)]:
  values=[]
  for v in [-1,-.5,0,.5,1]:
   args=[0.,0.];args[axis]=v;values.append([[motion(cx+x,cy+y,*args,node['name'])for x,y in verts]])
  param['bindings'].append(dict(node=node['uuid'],param_name='deform',values=values,isSet=[[True]for _ in values],interpolate_mode='Linear'))
model['param'].extend([breath,balance]);model['meta'].update(name='STARUSH Red Q72 Body Breath Candidate - Inochi2D, not Cubism',reference='Q71 64 layers; local torso motion, Q72 unaccepted')
data=json.dumps(model,separators=(',',':'),ensure_ascii=False).encode();out=r/'red-body-rig.inx';out.write_bytes(b[:8]+struct.pack('>I',len(data))+data+tail)
d=dict(queueItem='Q72',status='candidate-not-accepted',format='Inochi Creator INX',artAccepted=False,contentComplete=False,isLive2DModel=False,parts=len(model['nodes']['children']),parameters=[{k:v for k,v in p.items()if k!='bindings'}for p in model['param']],vertices=sum(len(n['mesh']['verts'])//2 for n in model['nodes']['children']),triangles=sum(len(n['mesh']['indices'])//3 for n in model['nodes']['children']),retessellatedParts=newmeshes,modelSha256=hashlib.sha256(out.read_bytes()).hexdigest(),baselineQ71Sha256=hashlib.sha256(b).hexdigest(),textureTailSha256=hashlib.sha256(tail).hexdigest(),anchors={'groundFromY':1160,'weaponGrip':[285,780],'headConstantAboveY':280},limits=['Torso breathing and small weight shift only, no independent hair/cloth physics','Head/eye/mouth parameters inherited; non-Cubism','Shared position field preserves layer junctions; all combinations need visual acceptance'])
(r/'body-rig-design.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');print({k:d[k]for k in ['parts','vertices','triangles','modelSha256']})
