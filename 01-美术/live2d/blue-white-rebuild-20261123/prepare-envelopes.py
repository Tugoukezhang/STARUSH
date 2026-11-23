"""Derive vector occlusion masks from the previous native UV exports. Never paints raster pixels.
Re-run only after original part ownership changes, then build-source and export-source.
"""
import json,runpy
from pathlib import Path
from PIL import Image
import numpy as np
from scipy import ndimage
r=Path(__file__).resolve().parent;c=runpy.run_path(str(r/'complete-source.py'));z={v:i+1 for i,v in enumerate(c['Z_ORDER'])}
s=json.loads((r/'layers.json').read_text());m=json.loads((r/'raster-layers.json').read_text());labels=np.zeros((1450,1085),np.uint8)
for k,l in enumerate(m['layers']):
 if not s['layers'][k]['kind'].startswith('visible-source'):continue
 a=np.array(Image.open(r/l['file']))[:,:,3];patch=labels[l['y']:l['y']+l['height'],l['x']:l['x']+l['width']];patch[a>0]=z[l['id']]
# Native shape-edge gaps are covered by the declared UV ownership corrections.
for owner,cells in json.loads((r/'micro-ownership.json').read_text())['cells'].items():
 for x,y in cells:labels[y,x]=z[owner]
ref=np.array(Image.open(r/'cutout-candidate.png'))[:,:,3]
owners={}
for p in c['foundations']():
 owner=p.get('controlOwner',p['id']);region=np.array(p['region']);x0=max(0,int(region[:,0].min())-5);x1=min(1085,int(region[:,0].max())+6);y0=max(0,int(region[:,1].min())-5);y1=min(1450,int(region[:,1].max())+6)
 # Only source pixels at or above the physical part are legitimate occluders.
 mask=(labels[y0:y1,x0:x1]>=z[owner])&(ref[y0:y1,x0:x1]>0)
 runs=owners.setdefault(owner,[])
 for j,row in enumerate(mask):
  edges=np.diff(np.r_[False,row,False].astype(np.int8));starts=np.where(edges==1)[0];ends=np.where(edges==-1)[0]
  runs.extend([[int(x0+a),int(y0+j),int(b-a)] for a,b in zip(starts,ends)])
(r/'occlusion-envelopes.json').write_text(json.dumps({'purpose':'UV masks of original pixels owned by a part or its foreground occluders; keeps native part painting in actual draw order','owners':owners},separators=(',',':'))+'\n');print('OCCLUSION_ENVELOPES',len(owners),sum(map(len,owners.values())))
