"""Q74 combined candidate. Native editable limited arm motions for overlap validation."""
from pathlib import Path
import json,struct,math,hashlib
r=Path(__file__).parent/'red-20261114'
b=(r/'red-cloth-rig.inx').read_bytes();size=struct.unpack('>I',b[8:12])[0];m=json.loads(b[12:12+size]);tail=b[12+size:]
def smooth(t):
 t=max(0,min(1,t));return t*t*(3-2*t)
def rotate(x,y,px,py,angle,weight):
 a=math.radians(angle)*weight;c,s=math.cos(a),math.sin(a);u,v=x-px,y-py
 return [round(c*u-s*v-u,6),round(s*u+c*v-v,6)]
channels=[('Grip Sway',{'grip-hand-surface','weapon','weapon-surface'},lambda x,y,t:rotate(x,y,490,335,t*1.5,smooth((y-375)/185))),('Raised Response',{'arm-right','arm-right-surface'},lambda x,y,t:rotate(x,y,785,345,t*2,smooth((345-y)/95)))]
rows=[]
for i,(name,parts,field) in enumerate(channels):
 bindings=[]
 for n in m['nodes']['children']:
  if n['name'] not in parts:continue
  vs=n['mesh']['verts'];tx,ty=n['transform']['trans'][:2];coords=[(vs[j]+tx+535,vs[j+1]+ty+735)for j in range(0,len(vs),2)]
  values=[[[field(x,y,t) for x,y in coords]]for t in [-1,-.5,0,.5,1]]
  bindings.append(dict(node=n['uuid'],param_name='deform',values=values,isSet=[[True]for _ in range(5)],interpolate_mode='Linear'))
  rows.append(dict(channel=name,part=n['name'],vertices=len(coords),maximumDisplacement=max(math.hypot(*field(x,y,1))for x,y in coords)))
 m['param'].append(dict(uuid=740010+i,name='Arm:: '+name,is_vec2=False,min=[-1.,0.],max=[1.,1.],defaults=[0.,0.],axis_points=[[0.,.25,.5,.75,1.],[0.]],merge_mode='Additive',bindings=bindings))
m['meta'].update(name='STARUSH Red Q74 Hair Cloth Arm Candidate - Inochi2D, not Cubism',reference='Combined spring playback and limited arm overlap validation; Q74/Q75 unaccepted')
data=json.dumps(m,ensure_ascii=False,separators=(',',':')).encode();out=r/'red-cloth-combined-rig.inx';out.write_bytes(b'TRNSRTS\0'+struct.pack('>I',len(data))+data+tail)
d=dict(queueItem='Q74',status='candidate-not-accepted',artAccepted=False,contentComplete=False,isLive2DModel=False,parts=65,parameters=len(m['param']),springChannels=10,armBindings=rows,modelSha256=hashlib.sha256(out.read_bytes()).hexdigest(),parentSha256=hashlib.sha256(b).hexdigest(),textureTailSha256=hashlib.sha256(tail).hexdigest(),limitations=['Q74 overlap pending; Q75 hand/weapon full scope unaccepted','Browser spring control, not native physics nodes','Non-Cubism and not complete Live2D'])
(r/'cloth-combined-rig-design.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');print(json.dumps(d))
