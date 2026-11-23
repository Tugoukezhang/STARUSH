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
count=len(m['layers'])
assert count==len(r['layers'])
assert len({l['id'] for l in m['layers']})==count
assert not any(l['kind']=='unassigned-residual' for l in m['layers'])
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
assert neutral['maxAlphaDifference']<=4
assert neutral['maxDisplayedDifferenceOnBlack']<=4.1
assert neutral['maxDisplayedDifferenceOnWhite']<=4.1
# The registered foundations now cover the whole character's occlusions.
# The original reference comparison remains bounded across the ENTIRE canvas.
native=json.loads((scratch/'native-reopen.json').read_text())
native_pixels={}
for ext in ['ora','xcf','psd']:
    native_pixels[ext]=metrics(merged,pixels(scratch/(ext+'-reopened.png')))
    assert native_pixels[ext]['maxAlphaDifference']==0,ext
    if ext!='ora':
        assert native_pixels[ext]['maxDisplayedDifferenceOnBlack']<=1.1,ext
        assert native_pixels[ext]['maxDisplayedDifferenceOnWhite']<=1.1,ext
    assert len(native[ext])==count
xcf_psd=metrics(pixels(scratch/'xcf-reopened.png'),pixels(scratch/'psd-reopened.png'))
# PSD's 8-bit channel round-trip differs at a few overlapping pixels. Keep
# measuring this explicitly; both native renders must still match PNG <=1.
assert xcf_psd['maxAlphaDifference']==0
assert xcf_psd['maxDisplayedDifferenceOnBlack']<=1.1
assert xcf_psd['maxDisplayedDifferenceOnWhite']<=1.1
assert metrics(merged,pixels(scratch/'ora-perceptual-reopened.png'))['maxDisplayedDifferenceOnBlack']<=1.1
for item in native['files']:assert sha(root/item['file'])==item['sha256']
browser=json.loads((scratch/'browser-check.json').read_text())
assert len(browser['layers'])==count and browser['corruptionRejected']
assert not browser['errors'] and not browser['httpErrors']
assert browser['manifest']['sourceSvgSha256']==sha(root/'blue-white-layer-source.svg')
result={'status':'WIP whole-character ownership and occlusion ordering; visual repair NOT accepted','canvas':[1085,1450],
 'layerCount':count,
 'visiblePartitionLayers':sum(l['kind'].startswith('visible-source') for l in m['layers']),
 'visibleUnderpaintLayers':sum(l['kind']=='generated-occlusion-underpaint' for l in m['layers']),
 'hiddenCandidates':sum(l.get('visible') is False for l in m['layers']),
 'nonemptyPngLayers':count,'originalComposite':neutral,'nativeComposite':native_pixels,
 'nativeVersion':native['gimpVersion'],'nativeToggleMoveResetPerFormat':count,
 'recommendedNativeFormats':['xcf','psd'],'nativeXcfPsdPixelsIdentical':xcf_psd['visibleRgbaDifferentPixels']==0,
 'nativeXcfPsdComparison':xcf_psd,
 'oraDefaultGimpBlendMatchesBrowser':False,'savedNativeBlendMode':native['savedBlendMode'],
 'browserToggleSoloMoveReset':count,'browserCorruptionRejected':True,'browserErrors':[],
 'largeShiftArtAccepted':False,'unassignedResidualLayerPresent':False,
 'visualProblems':['Face/fringe contour and color joins still visible when displaced',
                   'Shoulder/cuff material borders remain abrupt',
                   'Book cover patch and bookmark edge still require repair',
                   'Bare torso/skirt appearance requires a final visual pass'],
 'sourcePreparationAccepted':False,'artAccepted':False,'contentComplete':False,'isLive2DModel':False,
 'files':[{'file':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(root.rglob('*')) if p.is_file() and p.suffix in ['.png','.svg','.ora','.xcf','.psd']]}
(root/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='files'},ensure_ascii=False))
