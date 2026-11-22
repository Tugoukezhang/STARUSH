"""Q81 local torso mesh and two-link arm skinning; untouched Q80 accepted source."""
from pathlib import Path
import json,math,struct,hashlib,copy
r=Path(__file__).resolve().parent;root=r.parent;source=root/'expression/closure/green-expression-rig.inx';raw=source.read_bytes();size=struct.unpack('>I',raw[8:12])[0];model=json.loads(raw[12:12+size]);tail=raw[12+size:];layers={l['id']:l for l in json.loads((root/'expression/closure/expression-raster.json').read_text())['layers']}
def smooth(t):
 t=max(0.,min(1.,t));return t*t*(3-2*t)
def rot(x,y,cx,cy,degrees):
 a=math.radians(degrees);c,s=math.cos(a),math.sin(a);return [cx+c*(x-cx)-s*(y-cy),cy+s*(x-cx)+c*(y-cy)]
def body(x,y,breath,sway):
 if y>=820:return [0.,0.]
 upper=1-smooth((y-320)/500);chest=math.exp(-((x-560)/150)**2-((y-425)/95)**2)*smooth((y-310)/50)
 return [round(breath*(x-560)*.014*chest+sway*(10*upper+.008*(660-y)*upper),6),round(breath*(-1.8*upper-2.6*chest)+sway*(x-570)*.005*upper,6)]
armConfig={'left':{'shoulder':[464,386],'elbow':[360,510],'wrist':[260,615],'range':[2.5,3.5]},'right':{'shoulder':[612,371],'elbow':[734,422],'wrist':[818,272],'range':[2.,3.]}}
left={'left-arm-hidden-paint','upper-arm-left','sleeve-left','sleeve-left-ornament','lowered-hand','leaf-left','rear-fragments-upper-arm-left','rear-fragments-sleeve-left-ornament','rear-fragments-leaf-left'}
right={'right-arm-hidden-paint','upper-arm-right','sleeve-right','raised-hand','wrist-ribbon-hidden-paint','ribbon-upper-right','rear-fragments-ribbon-upper-right','moon-chime','rear-fragments-moon-chime','leaf-near-moon','music-leaves-right','music-leaves-upper'}
rigid={'left':{'lowered-hand','leaf-left','rear-fragments-leaf-left'},'right':{'raised-hand','wrist-ribbon-hidden-paint','ribbon-upper-right','rear-fragments-ribbon-upper-right','moon-chime','rear-fragments-moon-chime','leaf-near-moon','music-leaves-right','music-leaves-upper'}}
tether={'ribbon-upper-right','rear-fragments-ribbon-upper-right'}
def attachment(name,y):return smooth((565-y)/170) if name in tether else 1.
def arm(x,y,side,a,b,name):
 cfg=armConfig[side];sx,sy=cfg['shoulder'];ex,ey=cfg['elbow'];wx,wy=cfg['wrist'];vx,vy=wx-ex,wy-ey;length=math.hypot(vx,vy)
 if name in rigid[side]:root=lower=1.
 else:
  root=smooth(math.hypot(x-sx,y-sy)/45);proj=((x-ex)*vx+(y-ey)*vy)/length;lower=smooth((proj+25)/65)*root
 q=rot(x,y,ex,ey,b*lower);q=rot(*q,sx,sy,a*root);weight=attachment(name,y);return [round((q[0]-x)*weight,6),round((q[1]-y)*weight,6)]
def wrist(x,y,side,w,name):
 wx,wy=armConfig[side]['wrist'];q=rot(x,y,wx,wy,w);weight=attachment(name,y);return[(q[0]-x)*weight,(q[1]-y)*weight]
def param(uid,name,vec,lo,hi,axes):return dict(uuid=uid,name=name,is_vec2=vec,min=lo,max=hi,defaults=[0.,0.],axis_points=axes,merge_mode='Additive',bindings=[])
def bind(node,values):return dict(node=node['uuid'],param_name='deform',values=values,isSet=[[True]*len(values[0])for _ in values],interpolate_mode='Linear')
axis=[0.,.25,.5,.75,1.];steps=[-1,-.5,0,.5,1]
params=[param(810001,'Body:: Breath',False,[-1,0],[1,1],[axis,[0.]]),param(810002,'Body:: Sway',False,[-1,0],[1,1],[axis,[0.]])]
arms={s:param(810010+i,'Arm:: '+s.title(),True,[-v for v in armConfig[s]['range']],armConfig[s]['range'],[axis,axis]) for i,s in enumerate(['left','right'])}
wrists={s:param(810020+i,'Wrist:: '+s.title(),False,[-3,0],[3,1],[axis,[0.]])for i,s in enumerate(['left','right'])}
corr={s:param(810030+i,'Wrist:: '+s.title()+' Arm Correction',True,[-sum(armConfig[s]['range']),-3],[sum(armConfig[s]['range']),3],[axis,axis])for i,s in enumerate(['left','right'])}
bound={b['node']for p in model['param']for b in p['bindings']if b['param_name']=='deform'};changed=[]
for n in model['nodes']['children']:
 name=n['name'];l=layers[name];w,h=l['width'],l['height'];cx,cy=l['x']+w/2,l['y']+h/2;side='left'if name in left else 'right'if name in right else None
 if n['uuid']not in bound:
  step=10 if side and (name not in rigid[side] or name in tether) else 24
  xs=sorted(set([-w/2,w/2]+[x-cx for x in range(l['x'],l['x']+w,step)]));ys=sorted(set([-h/2,h/2]+[y-cy for y in range(l['y'],l['y']+h,step)]+[y-cy for y in [320,386,425,510,615,660,820]if l['y']<y<l['y']+h]));vs=[(x,y)for y in ys for x in xs];nx=len(xs);inds=[]
  for j in range(len(ys)-1):
   for i in range(nx-1):k=j*nx+i;inds.extend([k,k+nx,k+1,k+1,k+nx,k+nx+1])
  n['mesh']=dict(verts=[v for xy in vs for v in xy],uvs=[v for x,y in vs for v in [(x+w/2)/w,(y+h/2)/h]],indices=inds,origin=[0.,0.]);changed.append(name)
 vs=list(zip(n['mesh']['verts'][::2],n['mesh']['verts'][1::2]))
 for i,p in enumerate(params):p['bindings'].append(bind(n,[[[body(cx+x,cy+y,v if i==0 else 0,v if i==1 else 0)for x,y in vs]]for v in steps]))
 if side:
  a,b=armConfig[side]['range'];arms[side]['bindings'].append(bind(n,[[[arm(cx+x,cy+y,side,aa*a,bb*b,name)for x,y in vs]for bb in steps]for aa in steps]))
  if name in rigid[side]:
   wrists[side]['bindings'].append(bind(n,[[[wrist(cx+x,cy+y,side,v*3,name)for x,y in vs]]for v in steps]));values=[]
   for av in steps:
    row=[]
    for wv in steps:
     dv=[]
     for x,y in vs:
      dx,dy=wrist(cx+x,cy+y,side,wv*3,name);q=rot(dx,dy,0,0,av*(a+b));dv.append([round(q[0]-dx,6),round(q[1]-dy,6)])
     row.append(dv)
    values.append(row)
   corr[side]['bindings'].append(bind(n,values))
model['param'].extend([*params,*arms.values(),*wrists.values(),*corr.values()]);model['meta'].update(name='STARUSH Green Q81 Body and Arms Candidate - Inochi2D',reference='Q80 retained; Q81 independent torso and two-link arms, no completed physics')
data=json.dumps(model,separators=(',',':'),ensure_ascii=False).encode();out=r/'green-body-rig.inx';out.write_bytes(raw[:8]+struct.pack('>I',len(data))+data+tail);d={'queueItem':'Q81','status':'candidate-not-accepted','bodyArmsAccepted':False,'artAccepted':False,'contentComplete':False,'isLive2DModel':False,'parts':len(model['nodes']['children']),'parameters':[{k:v for k,v in p.items()if k!='bindings'}for p in model['param']],'vertices':sum(len(n['mesh']['verts'])//2 for n in model['nodes']['children']),'triangles':sum(len(n['mesh']['indices'])//3 for n in model['nodes']['children']),'retessellated':changed,'armConfig':armConfig,'armGroups':{'left':sorted(left),'right':sorted(right)},'rigidGroups':{s:sorted(rigid[s])for s in rigid},'modelSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'baselineQ80Sha256':hashlib.sha256(raw).hexdigest(),'textureTailSha256':hashlib.sha256(tail).hexdigest(),'limits':['Small shoulder/elbow/wrist range only; no gesture retargeting','Torso lower than y820 stays fixed; floating pose, not grounded walking','Wrist arm-angle corrective channels need adapter coupling','Hair/clothing physics and production integration not implemented']};(r/'body-rig-design.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');print({k:d[k]for k in ['parts','vertices','triangles','modelSha256']})
