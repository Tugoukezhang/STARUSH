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
assert len(m['layers'])==len(r['layers'])==66
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
# Added skin/cloth lies only underneath these two local regions. Everything
# else must retain the previous maximum one-level raster rounding difference.
outside=np.ones(source.shape[:2],dtype=bool)
outside[205:415,405:600]=False
outside[370:505,515:610]=False
display_delta=np.abs(source[:,:,:3]*source[:,:,3:4]/255-merged[:,:,:3]*merged[:,:,3:4]/255)
assert display_delta[outside].max()<=1.1
native=json.loads((scratch/'native-reopen.json').read_text())
native_pixels={}
for ext in ['ora','xcf','psd']:
    native_pixels[ext]=metrics(merged,pixels(scratch/(ext+'-reopened.png')))
    assert native_pixels[ext]['maxAlphaDifference']==0,ext
    tolerance=16 if ext=='ora' else 1.1
    assert native_pixels[ext]['maxDisplayedDifferenceOnBlack']<=tolerance,ext
    assert native_pixels[ext]['maxDisplayedDifferenceOnWhite']<=tolerance,ext
    assert len(native[ext])==66
assert metrics(pixels(scratch/'xcf-reopened.png'),pixels(scratch/'psd-reopened.png'))['visibleRgbaDifferentPixels']==0
assert metrics(merged,pixels(scratch/'ora-perceptual-reopened.png'))['maxDisplayedDifferenceOnBlack']<=1.1
for item in native['files']:assert sha(root/item['file'])==item['sha256']
browser=json.loads((scratch/'browser-check.json').read_text())
assert len(browser['layers'])==66 and browser['corruptionRejected']
assert not browser['errors'] and not browser['httpErrors']
assert browser['manifest']['sourceSvgSha256']==sha(root/'blue-white-layer-source.svg')
residual=pixels(root/'rendered-layers/unassigned-residual.png')
occlusion=json.loads((scratch/'occlusion-check.json').read_text())
assert occlusion['sourceSvgSha256']==sha(root/'blue-white-layer-source.svg')
feature_checks=[s for s in occlusion['states'] if 'filledAlpha' in s]
assert len(feature_checks)==5
assert all(s['filledAlpha']>=250 and s['withoutFoundationAlpha']<32 for s in feature_checks)
junction_checks=[{k:s[k] for k in ['id','dx','dy','newlyFilledPixels']} for s in occlusion['states'] if 'newlyFilledPixels' in s]
assert len(junction_checks)==8 and all(s['newlyFilledPixels']>0 for s in junction_checks)
result={'status':'WIP face/shoulder foundation added; Q86 NOT accepted','canvas':[1085,1450],
 'layerCount':66,'visiblePartitionLayers':60,'visibleUnderpaintLayers':2,'hiddenCandidates':4,
 'nonemptyPngLayers':66,'originalComposite':neutral,'nativeComposite':native_pixels,
 'nativeVersion':native['gimpVersion'],'nativeToggleMoveResetPerFormat':66,
 'recommendedNativeFormats':['xcf','psd'],'nativeXcfPsdPixelsIdentical':True,
 'oraDefaultGimpBlendMatchesBrowser':False,'savedNativeBlendMode':native['savedBlendMode'],
 'browserToggleSoloMoveReset':66,'browserCorruptionRejected':True,'browserErrors':[],
 'featureGapChecks':feature_checks,'largeShiftArtAccepted':False,
 'junctionGapChecks':junction_checks,
 'unassignedResidualPixelsAlphaAbove32':int((residual[:,:,3]>32).sum()),
 'sourcePreparationAccepted':False,'artAccepted':False,'contentComplete':False,'isLive2DModel':False,
 'files':[{'file':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(root.rglob('*')) if p.is_file() and p.suffix in ['.png','.svg','.ora','.xcf','.psd']]}
(root/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='files'},ensure_ascii=False))
