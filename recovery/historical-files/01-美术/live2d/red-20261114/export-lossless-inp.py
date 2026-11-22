"""Repack a native INP with original texture bytes/UVs, without raster resampling.
Input 1: editable source INX; input 2: actual Creator-exported INP.
Retains native-exported runtime schema/parameters; excludes editor-only groups.
"""
import argparse,json,struct,hashlib
from pathlib import Path

def read(path):
 b=path.read_bytes();assert b[:8]==b'TRNSRTS\x00';n=struct.unpack('>I',b[8:12])[0];j=json.loads(b[12:12+n]);tail=b[12+n:];assert tail[:8]==b'TEX_SECT';count=struct.unpack('>I',tail[8:12])[0];pos=12
 for _ in range(count):
  size=struct.unpack('>I',tail[pos:pos+4])[0];assert tail[pos+4]==1;pos+=5+size
 assert pos==len(tail),'Unexpected trailing section; review before repacking'
 return j,tail,count

def export(source,native,out):
 s,st,sc=read(source);n,nt,nc=read(native);sp={x['uuid']:x for x in s['nodes']['children']};np={x['uuid']:x for x in n['nodes']['children']};assert sp.keys()==np.keys();assert len(s['param'])==len(n['param'])
 for uid,target in np.items():
  original=sp[uid]
  for key in ['name','transform']:assert original[key]==target[key]
  for key in ['verts','indices']:assert original['mesh'][key]==target['mesh'][key]
  target['mesh']['uvs']=original['mesh']['uvs'];target['textures']=original['textures']
 assert 'groups' not in n,'Native runtime export must exclude editor groups'
 data=json.dumps(n,ensure_ascii=False,separators=(',',':')).encode();out.write_bytes(b'TRNSRTS\x00'+struct.pack('>I',len(data))+data+st)
 return dict(format='Inochi2D INP',method='Native runtime schema with original per-part texture bytes and corresponding UV/index restoration; no image pixels changed',parts=len(np),parameters=len(n['param']),nativeAtlasTextures=nc,losslessTextures=sc,textureSectionSHA256=hashlib.sha256(st).hexdigest(),outputSHA256=hashlib.sha256(out.read_bytes()).hexdigest())
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('source',type=Path);p.add_argument('native',type=Path);p.add_argument('output',type=Path);a=p.parse_args();print(json.dumps(export(a.source,a.native,a.output),ensure_ascii=False))
