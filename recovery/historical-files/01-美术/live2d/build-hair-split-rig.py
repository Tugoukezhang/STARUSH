"""Q73 native 65-part candidate. Transfer accepted deformation bindings by
barycentric sampling of the existing rear-hair mesh; retain native texture tail.
The independent S-lock has a fixed root and a separate editable bend parameter.
"""
from pathlib import Path
import json,struct,copy,math,hashlib,sys
import numpy as np
r=Path(__file__).parent/'red-20261114'
def load(p):
 b=p.read_bytes();assert b[:8]==b'TRNSRTS\0';n=struct.unpack('>I',b[8:12])[0];return json.loads(b[12:12+n]),b[12+n:]
source=Path(sys.argv[1]);m,tail=load(source);old,_=load(r/'red-hair-rig.inx');previous={n['name']:n for n in old['nodes']['children']};nodes={n['name']:n for n in m['nodes']['children']};assert len(nodes)==65
byuid={n['uuid']:n['name'] for n in previous.values()};params=copy.deepcopy(old['param'])
for p in params:
 for b in p['bindings']:b['node']=nodes[byuid[b['node']]]['uuid']
for name,n in nodes.items():
 if name in previous:
  n['mesh']=copy.deepcopy(previous[name]['mesh']);n['transform']=copy.deepcopy(previous[name]['transform'])
l=next(l for l in json.loads((r/'hair-split-raster.json').read_text())['layers'] if l['id']=='rear-hair-left-lock');w,h=l['width'],l['height'];cx,cy=l['x']+w/2,l['y']+h/2;n=nodes[l['id']];rear=nodes['rear-hair'];rv=np.array(rear['mesh']['verts']).reshape(-1,2)+np.array(rear['transform']['trans'][:2])+[535,735];tris=np.array(rear['mesh']['indices']).reshape(-1,3)
xs=sorted(set([l['x'],l['x']+w]+[float(x) for x in rv[:,0] if l['x']<x<l['x']+w]));ys=sorted(set([l['y'],l['y']+h]+[float(y) for y in rv[:,1] if l['y']<y<l['y']+h]));vs=np.array([(x,y) for y in ys for x in xs]);nx=len(xs);inds=[]
for j in range(len(ys)-1):
 for i in range(nx-1):
  k=j*nx+i;inds.extend([k,k+nx,k+1,k+1,k+nx,k+nx+1])
n['mesh']=dict(verts=(vs-[cx,cy]).flatten().tolist(),uvs=((vs-[l['x'],l['y']])/[w,h]).flatten().tolist(),indices=inds,origin=[0.,0.]);n['transform']['trans']=[cx-535,cy-735,0.]
# Every source point is sampled from a real source triangle, never nearest-copy.
a=rv[tris[:,0]];u=rv[tris[:,1]]-a;v=rv[tris[:,2]]-a;det=u[:,0]*v[:,1]-u[:,1]*v[:,0];weights=[];choices=[]
for point in vs:
 q=point-a;bu=(q[:,0]*v[:,1]-q[:,1]*v[:,0])/det;bv=(u[:,0]*q[:,1]-u[:,1]*q[:,0])/det;valid=np.flatnonzero((bu>=-1e-7)&(bv>=-1e-7)&(bu+bv<=1+1e-7));assert len(valid),point
 t=valid[0];choices.append(tris[t]);weights.append([1-bu[t]-bv[t],bu[t],bv[t]])
choices=np.array(choices);weights=np.array(weights)
for p in params:
 sourcebinding=next((b for b in p['bindings'] if b['node']==rear['uuid'] and b['param_name']=='deform'),None)
 if sourcebinding:
  b=copy.deepcopy(sourcebinding);b['node']=n['uuid'];values=np.array(b['values']);b['values']=np.round((values[:,:,choices,:]*weights[None,None,:,:,None]).sum(axis=3),6).tolist();p['bindings'].append(b)
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
field=[[round(6*smooth((y-560)/140),6),round(1.3*smooth((y-560)/140)*math.sin((y-560)/140*math.pi),6)] for x,y in vs]
p=dict(uuid=730007,name='Hair:: Left Lock',is_vec2=False,min=[-1.,0.],max=[1.,1.],defaults=[0.,0.],axis_points=[[0.,.25,.5,.75,1.],[0.]],merge_mode='Additive',bindings=[dict(node=n['uuid'],param_name='deform',values=[[[[round(v*t,6) for v in xy]for xy in field]]for t in [-1,-.5,0,.5,1]],isSet=[[True]for _ in range(5)],interpolate_mode='Linear')]);params.append(p);m['param']=params;m['meta'].update(name='STARUSH Red Q73 Split Hair Candidate - Inochi2D, not Cubism',reference='65-layer native PSD import, independent S-lock; Q73 unaccepted')
data=json.dumps(m,ensure_ascii=False,separators=(',',':')).encode();out=r/'red-hair-split-rig.inx';out.write_bytes(b'TRNSRTS\0'+struct.pack('>I',len(data))+data+tail)
d=dict(queueItem='Q73',status='candidate-not-accepted',artAccepted=False,contentComplete=False,isLive2DModel=False,parts=65,parameters=36,channels=['Upper','Middle','Tip','Fringe Left','Fringe Center','Fringe Right','Left Lock'],modelSha256=hashlib.sha256(out.read_bytes()).hexdigest(),nativeImportSha256=hashlib.sha256(source.read_bytes()).hexdigest(),nativeTextureTailSha256=hashlib.sha256(tail).hexdigest(),sourceRasterSha256=hashlib.sha256((r/'hair-split-raster.json').read_bytes()).hexdigest(),independentPart=l['id'],independentVertices=len(vs),independentTriangles=len(inds)//3,fixedRootThroughY=560,limitations=['Independent curl bend starts below y=560; crossing follows shared ponytail field. Hidden source crossing still needs refinement before widening this range','Only one new ponytail strand separated; remaining ponytail uses three mesh regions','Browser spring controls editable INX parameters; no native physics nodes','Not Cubism and not accepted complete Live2D'])
(r/'hair-split-rig-design.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');print(d)
