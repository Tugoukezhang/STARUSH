"""Read-only image registration; writes review metadata, never rewrites artwork.

Requires opencv-python-headless + numpy. Affine fits are diagnostic proposals,
not an art acceptance decision. Run from any cwd with the asset directory.
"""
import hashlib
import json
import sys
from pathlib import Path

import cv2
import numpy as np

root = Path(sys.argv[1]).resolve()
detector = cv2.SIFT_create(nfeatures=9000)


def read(name):
    image = cv2.imread(str(root / name), cv2.IMREAD_UNCHANGED)
    if image is None or image.ndim != 3 or image.shape[2] != 4:
        raise ValueError(f"Not an RGBA image: {name}")
    return image


def features(im):
    mask = (im[:, :, 3] > 220).astype('uint8') * 255
    return detector.detectAndCompute(cv2.cvtColor(im[:, :, :3], cv2.COLOR_BGR2GRAY), mask)


base = read('cutout-candidate.png')
base_k, base_d = features(base)
head = read('head-composite.png')
head_k, head_d = features(head)


def fit(im, ref_k, ref_d):
    keypoints, descriptors = features(im)
    matches = [] if descriptors is None or ref_d is None else cv2.BFMatcher().knnMatch(descriptors, ref_d, k=2)
    good = [m[0] for m in matches if len(m) == 2 and m[0].distance < .72 * m[1].distance]
    if len(good) < 8:
        return np.eye(3), {'status': 'manual-required', 'matches': len(good)}
    src = np.float32([keypoints[m.queryIdx].pt for m in good])
    dst = np.float32([ref_k[m.trainIdx].pt for m in good])
    matrix, inliers = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=3)
    if matrix is None:
        return np.eye(3), {'status': 'manual-required', 'matches': len(good)}
    transform = np.vstack([matrix, [0, 0, 1]])
    distance = np.linalg.norm((np.c_[src, np.ones(len(src))] @ matrix.T) - dst, axis=1)
    chosen = inliers[:, 0].astype(bool)
    count = int(chosen.sum())
    scale = float(np.linalg.norm(matrix[:, 0]))
    valid = count >= 8 and .5 <= scale <= 1.5
    return (transform if valid else np.eye(3)), {
        'status': 'proposal-needs-visual-review' if valid else 'manual-required',
        'matches': len(good), 'inliers': count,
        'medianInlierErrorPx': round(float(np.median(distance[chosen])), 3),
        'scale': round(scale, 5),
    }


head_transform, head_fit = fit(head, base_k, base_d)
names = ['rear-hair', 'coat-rear', 'body-core', 'coat-left-flap', 'coat-front', 'weapon', 'arm-left',
         'face-base', 'eye-left', 'eye-right', 'mouth', 'short-hair', 'head-accessories-paint', 'head-accessories', 'arm-right', 'arm-right-surface']
manual_feature_boxes = {
    'eye-left': [543, 207, 594, 245],
    'eye-right': [601, 236, 636, 271],
    'mouth': [580, 285, 591, 290],
}
# Runtime texture regions preserve the derivative reference's exact eye/mouth
# pixels. This is geometry metadata, not a new/redrawn raster file. The prior
# generated alternatives remain on disk for comparison, but are not selected.
source_regions = {
    'eye-left': [
        [[548,198],[559,194],[574,195],[588,200],[599,210],[597,218],[582,221],[562,215],[552,207]],
        [[566,186],[576,186],[590,193],[602,203],[597,200],[584,194],[571,190]],
    ],
    'eye-right': [
        [[611,227],[622,222],[633,224],[645,231],[640,241],[628,245],[616,241]],
        [[614,215],[625,215],[639,219],[644,225],[637,222],[624,218]],
    ],
    'mouth': [[[578,255],[585,254],[594,257],[598,261],[595,263],[588,260],[581,259]]],
}
layers = []
for name in names:
    texture_file = 'cutout-candidate.png' if name in source_regions else ('head-accessories.png' if name == 'head-accessories-paint' else name + '.png')
    im = read(texture_file)
    if name in ['face-base', 'eye-left', 'eye-right', 'mouth', 'short-hair', 'head-accessories']:
        matrix, diagnostic = fit(im, head_k, head_d)
        # Face without eyes has deliberately removed the matching features.
        # Retains the head canvas coordinates; do not guess from unrelated skin.
        if name == 'face-base':
            matrix, diagnostic = np.eye(3), {'status': 'manual-required', 'reason': 'occlusion repaint has no reliable unchanged features'}
        if name in manual_feature_boxes:
            ys, xs = np.where(im[:, :, 3] > 32)
            x, y, right, bottom = manual_feature_boxes[name]
            sx, sy = (right-x)/(xs.max()+1-xs.min()), (bottom-y)/(ys.max()+1-ys.min())
            matrix = np.array([[sx, 0, x-sx*xs.min()], [0, sy, y-sy*ys.min()], [0, 0, 1]])
            diagnostic = {'status': 'manual-proposal-needs-visual-review', 'targetBoxInHeadCanvas': manual_feature_boxes[name]}
        matrix = head_transform @ matrix
        diagnostic['reference'] = 'head-composite.png'
    else:
        matrix, diagnostic = fit(im, base_k, base_d)
        diagnostic['reference'] = 'cutout-candidate.png'
    if name in source_regions:
        matrix = np.eye(3)
        diagnostic = {'status': 'source-UV-region-needs-seam-review', 'reference': 'cutout-candidate.png'}
    alpha = im[:, :, 3]
    ys, xs = np.where(alpha > 16)
    mask = head_regions.get('canvasMasks', {}).get(name, {})
    if mask:
        inverse = np.linalg.inv(matrix)
        to_texture = lambda polygons: [[list(map(float, (inverse @ [x,y,1])[:2])) for x,y in poly] for poly in polygons]
        if mask.get('regions'): regions = to_texture(mask['regions'])
        subtract += to_texture(mask.get('subtractRegions', []))
    layers.append({
        'id': name, 'file': texture_file, 'width': im.shape[1], 'height': im.shape[0],
        'sha256': hashlib.sha256((root / texture_file).read_bytes()).hexdigest(),
        'textureRegions': source_regions.get(name),
        'alphaBBoxAbove16': [int(xs.min()), int(ys.min()), int(xs.max()+1), int(ys.max()+1)],
        'matrix': [float(matrix[0, 0]), float(matrix[1, 0]), float(matrix[0, 1]), float(matrix[1, 1]), float(matrix[0, 2]), float(matrix[1, 2])],
        'registration': diagnostic, 'accepted': False,
    })

manifest = {
    'schemaVersion': 1, 'queueItem': 'Q68', 'status': 'work-in-progress',
    'artAccepted': False, 'contentComplete': False, 'isLive2DModel': False,
    'canvas': {'width': base.shape[1], 'height': base.shape[0]},
    'reference': 'cutout-candidate.png',
    'sourceNote': 'User supplied red PNG through conversation reference. Cutout is an edited derivative, not byte-identical source.',
    'headRegistration': head_fit, 'layers': layers, 'groups': head_regions['groups'],
    'remaining': ['Identity comparison against original user image', 'Shoulder/hand/weapon seam and overlap repair',
                  'Further separate eyelid/iris elements', 'Subdivide coat panels and hair locks',
                  'Editable source export and pose/occlusion validation', 'Real deformer/mesh binding in later queue items'],
}
(root / 'layers.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({x['id']: x['registration'] for x in layers}, ensure_ascii=False, indent=2))
