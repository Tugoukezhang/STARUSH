"""Read-only verification. No pixel editing or image output; writes JSON evidence."""
from pathlib import Path
import hashlib, json, os, zipfile
import numpy as np
from PIL import Image

root=Path(__file__).resolve().parent
scratch=Path(os.environ.get('STARUSH_Q86_SCRATCH','/tmp/starush-q86'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def pixels(path):
    with Image.open(path) as im: return np.array(im.convert('RGBA'),dtype=np.float64)
def metrics(a,b):
    delta=np.abs(a-b)
    # Compare displayed color, not irrelevant RGB values in transparent pixels.
    def against(bg,p): return p[:,:,:3]*p[:,:,3:4]/255+bg*(1-p[:,:,3:4]/255)
    return {'maxAlphaDifference':float(delta[:,:,3].max()),
            'alphaDifferentPixels':int((delta[:,:,3]>0).sum()),
            'maxDisplayedDifferenceOnBlack':float(np.abs(against(0,a)-against(0,b)).max()),
            'maxDisplayedDifferenceOnWhite':float(np.abs(against(255,a)-against(255,b)).max()),
            'visibleRgbaDifferentPixels':int(((delta.max(2)>0)&((a[:,:,3]>0)|(b[:,:,3]>0))).sum())}

m=json.loads((root/'layers.json').read_text());r=json.loads((root/'raster-layers.json').read_text())
assert sha(root/'cutout-candidate.png')==sha(root.parents[1]/'blue-academy-chibi-20261123/portrait.png')
assert r['manifestSha256']==sha(root/'layers.json')
assert r['sourceSvgSha256']==sha(root/'blue-white-layer-source.svg')
assert len(m['layers'])==len(r['layers'])==61
assert not m['sourcePreparationAccepted'] and not m['artAccepted'] and not m['isLive2DModel']
for src in m['sources']: assert sha(root/src['file'])==src['sha256']
for layer,source in zip(r['layers'],m['layers']):
    assert layer['id']==source['id']
    assert sha(root/layer['file'])==layer['sha256']
    p=pixels(root/layer['file'])
    assert p.shape==(layer['height'],layer['width'],4)
    assert p[:,:,3].max()>0,layer['id']
with zipfile.ZipFile(root/'blue-white-layer-source.ora') as archive:
    for n,layer in enumerate(r['layers']): assert archive.read(f'data/layer{n:02}.png')==(root/layer['file']).read_bytes()

source=pixels(root/'cutout-candidate.png');merged=pixels(root/'rendered-layers/merged.png')
neutral=metrics(source,merged)
assert neutral['maxAlphaDifference']<=1
assert neutral['maxDisplayedDifferenceOnBlack']<=1.1
assert neutral['maxDisplayedDifferenceOnWhite']<=1.1
native=json.loads((scratch/'native-reopen.json').read_text())
native_pixels={}
for ext in ['ora','xcf','psd']:
    native_pixels[ext]=metrics(merged,pixels(scratch/(ext+'-reopened.png')))
    assert native_pixels[ext]['visibleRgbaDifferentPixels']==0,ext
    assert len(native[ext])==61
for item in native['files']:assert sha(root/item['file'])==item['sha256']
browser=json.loads((scratch/'browser-check.json').read_text())
assert len(browser['layers'])==61 and browser['corruptionRejected']
assert not browser['errors'] and not browser['httpErrors']
assert browser['manifest']['sourceSvgSha256']==sha(root/'blue-white-layer-source.svg')
residual=pixels(root/'rendered-layers/unassigned-residual.png')
result={'status':'WIP source infrastructure verified; Q86 NOT accepted','canvas':[1085,1450],
 'layerCount':61,'visiblePartitionLayers':57,'hiddenCandidates':4,
 'nonemptyPngLayers':61,'originalComposite':neutral,'nativeComposite':native_pixels,
 'nativeVersion':native['gimpVersion'],'nativeToggleMoveResetPerFormat':61,
 'browserToggleSoloMoveReset':61,'browserCorruptionRejected':True,'browserErrors':[],
 'unassignedResidualPixelsAlphaAbove32':int((residual[:,:,3]>32).sum()),
 'sourcePreparationAccepted':False,'artAccepted':False,'contentComplete':False,'isLive2DModel':False,
 'files':[{'file':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(root.rglob('*')) if p.is_file() and p.suffix in ['.png','.svg','.ora','.xcf','.psd']]}
(root/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='files'},ensure_ascii=False))
