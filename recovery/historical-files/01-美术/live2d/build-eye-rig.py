"""Q70 actual Inochi mesh bindings from a native 60-layer PSD import.
No Cubism encoding; accepted Q69 model stays byte-identical.
"""
import json,struct,math,hashlib,copy,sys,ast
from pathlib import Path
root=Path(__file__).parent/'red-20261114'
def load(path):
 b=path.read_bytes();assert b[:8]==b'TRNSRTS\0';n=struct.unpack('>I',b[8:12])[0];return json.loads(b[12:12+n]),b[12+n:]
source=Path(sys.argv[1]);model,tail=load(source);baseline,_=load(root/'red-head-mesh.inx');raster=json.loads((root/'eye-rig-raster.json').read_text());byid={l['id']:l for l in raster['layers']};nodes=model['nodes']['children'];assert len(nodes)==60 and set(n['name'] for n in nodes)==set(byid)
oldByName={n['name']:n for n in baseline['nodes']['children']};newByName={n['name']:n for n in nodes};oldUuid={n['uuid']:n['name'] for n in baseline['nodes']['children']}
# Reuse only our own pure head-deformation functions; never execute its builder.
module=ast.parse((root.parent/'build-head-mesh.py').read_text());functions=[n for n in module.body if isinstance(n,ast.FunctionDef) and n.name in ['smooth','field']];scope={'math':math,'ca':math.cos(math.radians(26)),'sa':math.sin(math.radians(26))};exec(compile(ast.Module(body=functions,type_ignores=[]),'head-field','exec'),scope);field=scope['field']
params=copy.deepcopy(baseline['param'])
for p in params:
 keep=[]
 for binding in p['bindings']:
  name=oldUuid[binding['node']]
  if name in newByName:binding['node']=newByName[name]['uuid'];keep.append(binding)
 p['bindings']=keep

def param(uid,name,vec,lo,hi,default,axes):return dict(uuid=uid,name=name,is_vec2=vec,min=lo,max=hi,defaults=default,axis_points=axes,merge_mode='Additive',bindings=[])
blink={s:param(700010+i,'Eye:: '+s.title()+' Blink',False,[0.,0.],[1.,1.],[0.,0.],[[0.,.25,.5,.75,1.],[0.]]) for i,s in enumerate(['left','right'])};gaze=param(700020,'Eye:: Gaze',True,[-1.,-1.],[1.,1.],[0.,0.],[[0.,.5,1.],[0.,.5,1.]])
def binding(node,name,values,nx,ny):return dict(node=node['uuid'],param_name=name,values=values,isSet=[[True]*ny for _ in range(nx)],interpolate_mode='Linear')
for node in nodes:
 name=node['name'];l=byid[name]
 if name in oldByName:
  old=oldByName[name];node['mesh']=copy.deepcopy(old['mesh']);node['transform']=copy.deepcopy(old['transform']);continue
 side=name.split('-')[1];kind=name.split('-')[2];q=raster['eyes'][side];w,h=l['width'],l['height'];cx,cy=l['x']+w/2,l['y']+h/2;xs=sorted(set([-w/2,w/2]+[x-cx for x in range(l['x'],l['x']+w,2)]));ys=sorted(set([-h/2,h/2]+[y-cy for y in range(l['y'],l['y']+h,2)]));verts=[(x,y) for y in ys for x in xs];inds=[];nx=len(xs)
 for j in range(len(ys)-1):
  for i in range(nx-1):
   k=j*nx+i;inds += [k,k+nx,k+1,k+1,k+nx,k+nx+1]
 node['mesh']=dict(verts=[v for xy in verts for v in xy],uvs=[v for x,y in verts for v in [(x+w/2)/w,(y+h/2)/h]],indices=inds,origin=[0.,0.]);node['transform']['trans']=[cx-535,cy-735,0.]
 values=[[[field(cx+x,cy+y,yaw,pitch) for x,y in verts] for pitch in [-12,-6,0,6,12]] for yaw in [-20,-10,0,10,20]];params[0]['bindings'].append(binding(node,'deform',values,5,5));params[1]['bindings'].append(binding(node,'deform',[[[field(cx+x,cy+y,0,0,z) for x,y in verts]] for z in [-5,0,5]],3,1))
 a,b,c,d,e,f=q['matrix'];det=a*d-b*c;ex,ey=q['axis'];ax,ay=q['A'];width=q['width']
 def eyeDelta(x,y,opening):
  tx=(d*(x-e)-c*(y-f))/det;ty=(-b*(x-e)+a*(y-f))/det;u=ex*(tx-ax)+ey*(ty-ay);v=-ey*(tx-ax)+ex*(ty-ay);s=math.sin(math.pi*max(0,min(1,u/width)));target=q['closed']*s;edge=q[kind]*s
  band=20 if kind=='upper' else 10
  weight=max(0,min(1,(v+q['margin'])/(edge-band+q['margin']))) if kind=='upper' else max(0,min(1,(q['margin']-v)/(q['margin']-edge-band)))
  dv=(target-edge)*weight*(1-opening);dx,dy=-ey*dv,ex*dv;return [round(a*dx+c*dy,6),round(b*dx+d*dy,6)]
 if kind in ['upper','lower']:blink[side]['bindings'].append(binding(node,'deform',[[[eyeDelta(cx+x,cy+y,o) for x,y in verts]] for o in [1,.75,.5,.25,0]],5,1))
 else:blink[side]['bindings'].append(binding(node,'opacity',[[1.],[1.],[1.],[1.],[0.]],5,1))
 if kind in ['iris','highlight']:
  distance=10 if side=='left' else 7
  values=[[[[round((a*ex+c*ey)*gx*distance+(-a*ey+c*ex)*gy*7,6),round((b*ex+d*ey)*gx*distance+(-b*ey+d*ex)*gy*7,6)] for _ in verts] for gy in [-1,0,1]] for gx in [-1,0,1]];gaze['bindings'].append(binding(node,'deform',values,3,3))
params.extend([blink['left'],blink['right'],gaze]);model['param']=params;model['meta'].update(name='STARUSH Red Q70 Eye Rig Candidate - Inochi2D, not Cubism',rigger='Codex / STARUSH',artist='User GPT-generated design; STARUSH layered derivative',reference='60-layer Q70 candidate, unaccepted')
data=json.dumps(model,separators=(',',':'),ensure_ascii=False).encode();out=root/'red-eye-rig.inx';out.write_bytes(b'TRNSRTS\0'+struct.pack('>I',len(data))+data+tail)
design=dict(queueItem='Q70',status='candidate-not-accepted',format='Inochi Creator INX / INP1',artAccepted=False,contentComplete=False,isLive2DModel=False,parts=len(nodes),vertices=sum(len(n['mesh']['verts'])//2 for n in nodes),triangles=sum(len(n['mesh']['indices'])//3 for n in nodes),nativeImportSha256=hashlib.sha256(source.read_bytes()).hexdigest(),sourceRasterSha256=hashlib.sha256((root/'eye-rig-raster.json').read_bytes()).hexdigest(),baselineQ69Sha256=hashlib.sha256((root/'red-head-mesh.inx').read_bytes()).hexdigest(),modelSha256=hashlib.sha256(out.read_bytes()).hexdigest(),textureTailSha256=hashlib.sha256(tail).hexdigest(),parameters=[{k:v for k,v in p.items() if k!='bindings'} for p in params],limitations=['Candidate: source identity/seams and all combinations need visual acceptance','No physics or production homepage integration','Native opacity at closed endpoint supplements actual eyelid mesh occlusion'])
(root/'eye-rig-design.json').write_text(json.dumps(design,ensure_ascii=False,indent=2)+'\n');print({k:design[k] for k in ['parts','vertices','triangles','modelSha256']})
