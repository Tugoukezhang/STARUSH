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
assert not m['artAccepted'] and not m['contentComplete'] and not m['isLive2DModel']
for src in m['sources']: assert sha(root/src['file'])==src['sha256']
generation=json.loads((root/'generation.json').read_text())
for item in generation['images']+generation.get('inputExports',[]):
    assert sha(root/item['file'])==item['sha256'],item['file']
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
# This revision intentionally repaints visible material to create continuous
# parts. Keep the full-canvas reference difference in the report, rather than
# increasing the old pixel-match tolerance or claiming identity by that test.
# Original/reference bytes, donor provenance, current PNG hashes, exact reset,
# and native round-trips are still checked independently.
retouches=[{'id':l['id'],**l['surfacePaint']} for l in m['layers'] if l.get('surfacePaint')]
assert retouches and 'not a pixel-identical' in m['sourceNote']
review=json.loads((root/'visual-review.json').read_text()) if (root/'visual-review.json').exists() else None
if m['sourcePreparationAccepted']:
    assert review and review['sourcePreparationAccepted']
    assert review['mergedSha256']==sha(root/'rendered-layers/merged.png')
    assert review['layerSha256']=={l['id']:l['sha256'] for l in r['layers']}
    assert review['allWholePartStatesReviewed'] and not review['blockingFindings']
native=json.loads((scratch/'native-reopen.json').read_text())
native_pixels={}
for ext in ['ora','xcf','psd']:
    native_pixels[ext]=metrics(merged,pixels(scratch/(ext+'-reopened.png')))
    # Full source-layer buffers are checked below. Different 8-bit src-over
    # implementations round partially transparent overlaps slightly differently.
    assert native_pixels[ext]['maxAlphaDifference']<=1,ext
    if ext!='ora':
        assert native_pixels[ext]['maxDisplayedDifferenceOnBlack']<=2.1,ext
        assert native_pixels[ext]['maxDisplayedDifferenceOnWhite']<=2.1,ext
    assert len(native[ext])==count
    for layer in native[ext]:
        assert layer['bufferAlphaMaxDifference']==0,(ext,layer['id'])
        assert layer['bufferVisibleColorMaxDifference']<=1,(ext,layer['id'])
xcf_psd=metrics(pixels(scratch/'xcf-reopened.png'),pixels(scratch/'psd-reopened.png'))
# PSD's 8-bit channel round-trip differs at a few overlapping pixels. Keep
# measuring this explicitly; both native renders must still match PNG <=1.
assert xcf_psd['maxAlphaDifference']==0
assert xcf_psd['maxDisplayedDifferenceOnBlack']<=1.1
assert xcf_psd['maxDisplayedDifferenceOnWhite']<=1.1
assert metrics(merged,pixels(scratch/'ora-perceptual-reopened.png'))['maxDisplayedDifferenceOnBlack']<=2.1
for item in native['files']:assert sha(root/item['file'])==item['sha256']
browser=json.loads((scratch/'browser-check.json').read_text())
assert len(browser['layers'])==count and browser['corruptionRejected']
assert not browser['errors'] and not browser['httpErrors']
assert browser['manifest']['sourceSvgSha256']==sha(root/'blue-white-layer-source.svg')
result={'status':'Q86 editable source preparation accepted; NOT a Live2D model' if m['sourcePreparationAccepted'] else 'WIP: current visible retouch requires whole-part review','canvas':[1085,1450],
 'layerCount':count,
 'visiblePartitionLayers':sum(l['kind'].startswith('visible-source') for l in m['layers']),
 'visibleUnderpaintLayers':sum(l['kind']=='generated-occlusion-underpaint' for l in m['layers']),
 'hiddenCandidates':sum(l.get('visible') is False for l in m['layers']),
 'nonemptyPngLayers':count,'originalComposite':neutral,'originalPixelMatchClaimed':False,
 'referenceComparisonPurpose':'Full-canvas difference report for the intentionally repainted source derivative; original and runtime portrait remain immutable',
 'visibleRetouches':retouches,'nativeComposite':native_pixels,
 'nativeVersion':native['gimpVersion'],'nativeToggleMoveResetPerFormat':count,
 'nativeLayerBuffers':{ext:{'comparedLayers':count,'maxAlphaDifference':max(l['bufferAlphaMaxDifference'] for l in native[ext]),'maxVisibleColorDifference':max(l['bufferVisibleColorMaxDifference'] for l in native[ext])} for ext in ['ora','xcf','psd']},
 'nativeCompositeRoundingLimit':{'alpha':1,'displayColor':2.1,'note':'Per-layer native pixels checked independently; no relaxation of visual acceptance'},
 'recommendedNativeFormats':['xcf','psd'],'nativeXcfPsdPixelsIdentical':xcf_psd['visibleRgbaDifferentPixels']==0,
 'nativeXcfPsdComparison':xcf_psd,
 'oraDefaultGimpBlendMatchesBrowser':False,'savedNativeBlendMode':native['savedBlendMode'],
 'browserToggleSoloMoveReset':count,'browserCorruptionRejected':True,'browserErrors':[],
 'largeShiftArtAccepted':False,'unassignedResidualLayerPresent':False,
 'visualProblems':review['blockingFindings'] if review else ['Final whole-part review has not been recorded'],
 'sourcePreparationAccepted':m['sourcePreparationAccepted'],'artAccepted':False,'contentComplete':False,'isLive2DModel':False,
 'files':[{'file':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(root.rglob('*')) if p.is_file() and p.suffix in ['.png','.svg','.ora','.xcf','.psd']]}
(root/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='files'},ensure_ascii=False))
