"""Q73 candidate: continuous regional ponytail bends and three fringe bindings.
Keeps Q72 meshes/textures; does not claim individually repainted ponytail strands.
"""
from pathlib import Path
import json,struct,math,hashlib
r=Path(__file__).parent/'red-20261114';b=(r/'red-body-rig.inx').read_bytes();size=struct.unpack('>I',b[8:12])[0];m=json.loads(b[12:12+size]);tail=b[12+size:]
def smooth(t):
 t=max(0,min(1,t));return t*t*(3-2*t)
names=['Upper','Middle','Tip','Fringe Left','Fringe Center','Fringe Right']
long={'rear-hair','rear-hair-sleeve-underpaint','rear-hair-tips'}
def delta(name,x,y,channel):
 if channel<3:
  root=smooth((math.hypot(x-480,y-120)-80)/220)
  upper=1-smooth((y-240)/260);tip=smooth((x-450)/350)*smooth((y-280)/160)
  weight=[upper,(1-upper)*(1-tip),tip][channel]*root
  return [12*weight,(x-480)/550*5*weight]
 group=['left','center','right'][channel-3]
 # Paired fringe surfaces and their hidden underpaint share the same field.
 weight=smooth((y-170)/{'left':70,'center':28,'right':60}[group])
 return [1.4*weight,.35*weight]
for channel,name in enumerate(names):
 p=dict(uuid=730001+channel,name='Hair:: '+name,is_vec2=False,min=[-1.,0.],max=[1.,1.],defaults=[0.,0.],axis_points=[[0.,.25,.5,.75,1.],[0.]],merge_mode='Additive',bindings=[])
 for n in m['nodes']['children']:
  if not(n['name']in long if channel<3 else n['name'].startswith('fringe-'+['left','center','right'][channel-3]+'-')):continue
  cx=n['transform']['trans'][0]+535;cy=n['transform']['trans'][1]+735;v=list(zip(n['mesh']['verts'][::2],n['mesh']['verts'][1::2]));field=[delta(n['name'],cx+x,cy+y,channel)for x,y in v]
  p['bindings'].append(dict(node=n['uuid'],param_name='deform',values=[[[[round(d*t,6)for d in xy]for xy in field]]for t in [-1,-.5,0,.5,1]],isSet=[[True]for _ in range(5)],interpolate_mode='Linear'))
 m['param'].append(p)
m['meta'].update(name='STARUSH Red Q73 Hair Candidate - Inochi2D, not Cubism',reference='Continuous ponytail regional binding; Q73 unaccepted')
data=json.dumps(m,ensure_ascii=False,separators=(',',':')).encode();out=r/'red-hair-rig.inx';out.write_bytes(b[:8]+struct.pack('>I',len(data))+data+tail)
design=dict(queueItem='Q73',status='candidate-not-accepted',artAccepted=False,contentComplete=False,isLive2DModel=False,parts=64,parameters=35,channels=names,root=[480,120],fixedRootRadius=80,modelSha256=hashlib.sha256(out.read_bytes()).hexdigest(),baselineQ72Sha256=hashlib.sha256(b).hexdigest(),textureTailUnchanged=True,limitations=['Ponytail is still one continuous source texture with three mesh regions, not individually separated strands','Fringe has three independent source groups with matching underpaint','Browser spring controller is required; INX stores editable deformation parameters, not native physics nodes','Q73 visual/native/physics acceptance pending'])
(r/'hair-rig-design.json').write_text(json.dumps(design,ensure_ascii=False,indent=2)+'\n');print(design)
