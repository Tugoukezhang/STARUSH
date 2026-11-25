"""Register the original painted poses to the same shoe contacts as the approved cast."""
import json
from pathlib import Path
from statistics import median

from PIL import Image, ImageChops, ImageFilter

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[1]
OUTPUT = PROJECT / "game/public/art/performance-poses"
CELL = 256
CAST = {
    "sakura": ("red-valkyrie", 152, 251, 238),
    "kai": ("green-windsong", 144, 242, 220),
    "enjo": ("blue-academy", 144, 246, 225),
}
MIDDLE_ROWS = (0, 340, 624, 938, 1260, 1619)
ENEMY_SOLES = (211, 212, 206, 211, 205)


def painted_cell(sheet, box):
    tile = sheet.crop(box).convert("RGBA")
    alpha = tile.getchannel("A")
    # Keep the antialiased ink along a painted shape; discard faint background matte.
    silhouette = alpha.point(lambda a: 255 if a >= 80 else 0).filter(ImageFilter.MaxFilter(7))
    tile.putalpha(ImageChops.multiply(alpha, silhouette))
    bounds = tile.getbbox()
    if not bounds:
        raise ValueError(f"Empty source cell at {box}")
    return tile.crop(bounds)


def align(tile, scale, anchor_x, sole_y):
    ratio = min(scale, (CELL - 8) / tile.width, (sole_y - 4) / tile.height)
    w, h = max(1, round(tile.width * ratio)), max(1, round(tile.height * ratio))
    tile = tile.resize((w, h), Image.Resampling.LANCZOS)
    foot = tile.getchannel("A").crop((0, h - min(h, 10), w, h)).point(lambda a: 255 if a > 128 else 0).getbbox()
    center = (foot[0] + foot[2]) / 2 if foot else w / 2
    left = max(3, min(CELL - w - 3, round(anchor_x - center)))
    dst = Image.new("RGBA", (CELL, CELL))
    dst.alpha_composite(tile, (left, sole_y - h))
    return dst


def registered_frame(source, index):
    x, y = (index % 6) * CELL, (index // 6) * CELL
    return source.crop((x, y, x + CELL, y + CELL))


# Four small shifts of the original aiming shoulder pair with the four vertical steps.
CROSS_SHOULDERS = (6, 7, 9, 10)


def turning_stride(upper, feet):
    # Register the two belts on their opaque centerline. The soft eight-pixel seam
    # falls under the jacket tails. Each sole comes entirely from the painted gait.
    waist = 168
    def center(tile):
        belt = tile.getchannel('A').crop((78, waist-6, 192, waist+5))
        left, _, right, _ = belt.point(lambda a: 255 if a > 100 else 0).getbbox()
        return 78 + (left + right) / 2
    lower = Image.new('RGBA', (CELL, CELL))
    lower.alpha_composite(feet, (round(center(upper)-center(feet)), 0))
    blend = Image.new('L', (1, CELL))
    blend.putdata([max(0, min(255, round((waist+4-y)*255/8))) for y in range(CELL)])
    return Image.composite(upper, lower, blend.resize((CELL, CELL)))


def rifle_stride(tile, kick):
    # One live step, registered at the hips. Gun/shoulder absorb recoil, soles keep
    # the original step; a continuous falloff prevents a seam along the belt.
    pose = Image.new("RGBA", tile.size)
    for y in range(CELL):
        weight = min(1, max(0, (185 - y) / 43))
        shift = round(-kick * weight)
        pose.paste(tile.crop((0, y, CELL, y + 1)), (shift, y))
    return pose


def pack(tiles, out, columns):
    atlas = Image.new("RGBA", (columns * CELL, ((len(tiles) + columns - 1) // columns) * CELL))
    for index, tile in enumerate(tiles):
        atlas.alpha_composite(tile, (index % columns * CELL, index // columns * CELL))
    temporary = out.with_suffix('.tmp')
    atlas.save(temporary, "WEBP", quality=89, alpha_quality=100, method=4)
    temporary.replace(out)


def export_cast(name, config):
    design, anchor, sole, height = config
    sheet = Image.open(HERE / f"{name}.png")
    src = []
    for r in range(3):
        for c in range(4):
            src.append(painted_cell(sheet, (round(sheet.width*c/4), round(sheet.height*r/3),
                                            round(sheet.width*(c+1)/4), round(sheet.height*(r+1)/3))))
    ratio = height / median(tile.height for tile in src[:8])
    tiles = [align(tile, ratio, anchor, sole) for tile in src]
    original = Image.open(HERE.parent / f"{design}-chibi-20261123/motion.png").convert("RGBA")
    # The last recovery pose comes from the original hands returning to their rest position.
    tiles.append(registered_frame(original, 12))
    fall = Image.open(HERE / 'curtain-fall.png')
    fall_row = list(CAST).index(name)
    # Actual row gutters differ from a strict third of the image height.
    gutters = (0, 374/1186, 747/1186, 1)
    poses = [painted_cell(fall, (round(fall.width*c/3), round(fall.height*gutters[fall_row]),
                                round(fall.width*(c+1)/3), round(fall.height*gutters[fall_row+1]))) for c in range(3)]
    scale = min(height / poses[0].height, 238/max(tile.width for tile in poses))
    tiles.extend(align(tile,scale,anchor,sole) for tile in poses)
    pack(tiles, OUTPUT / f"{name}.webp", 4)
    banks = {name: tiles}
    if name == 'sakura':
        stride = [rifle_stride(registered_frame(original, step), kick)
                  for kick in (0, 10, 5, 1) for step in range(6, 12)]
        cross = [turning_stride(registered_frame(original, CROSS_SHOULDERS[index % 4]), feet)
                 for index, feet in enumerate(tiles[:8])]
        stride.extend(rifle_stride(step, kick) for kick in (0, 10, 5, 1) for step in cross)
        pack(stride, OUTPUT / 'rifle-stride.webp', 7)
        banks['rifleStride'] = stride
    return {bank: [list(tile.getchannel('A').point(lambda a: 255 if a >= 48 else 0).getbbox())
                   for tile in frames] for bank, frames in banks.items()}


def export_crew():
    sheet = Image.open(HERE / "stage-crew.png")
    tiles = []
    for row, sole in enumerate(ENEMY_SOLES):
        src = [painted_cell(sheet, (round(sheet.width*c/3), MIDDLE_ROWS[row],
                                    round(sheet.width*(c+1)/3), MIDDLE_ROWS[row+1])) for c in range(3)]
        ratio = min((sole-6)/max(t.height for t in src), 237/max(t.width for t in src))
        tiles.extend(align(tile, ratio, 128, sole) for tile in src)
    # The neutral upright body reads differently from a deliberate crouched guard.
    tiles.append(Image.open(PROJECT / 'game/public/art/enemy-ensemble-20261009/runner.webp').convert('RGBA'))
    pack(tiles, OUTPUT / 'stage-crew.webp', 4)


if __name__ == '__main__':
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bounds = {}
    for name, config in CAST.items():
        bounds.update(export_cast(name, config))
    out = PROJECT / 'game/src/utils/performancePoseBounds.mjs'
    lines = ['// Generated by 01-美术/performance-poses/export.py. Bounds exclude transparent margins.',
             'export const PERFORMANCE_POSE_BOUNDS = {']
    for name, values in bounds.items():
        lines += [f'  {name}: [']
        for i in range(0, len(values), 4):
            lines += ['    '+', '.join(json.dumps(row, separators=(',', ':')) for row in values[i:i+4])+',']
        lines += ['  ],']
    out.write_text('\n'.join(lines + ['};','']))
    export_crew()
