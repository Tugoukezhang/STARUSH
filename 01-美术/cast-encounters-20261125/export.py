"""Export the commissioned character sheets without changing the master art."""
from pathlib import Path
from shutil import copyfile
from PIL import Image

SOURCE = Path(__file__).resolve().parent
PUBLIC = SOURCE.parents[1] / 'game/public/art/cast-encounters-20261125'
MEMBERS = ('sakura', 'kai', 'enjo')


def cell(sheet, column, row, rows):
    w, h = sheet.size
    return sheet.crop((round(column * w / 3), round(row * h / rows),
                       round((column + 1) * w / 3), round((row + 1) * h / rows)))


def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    book = Image.open(SOURCE / 'spellbook.png').convert('RGBA')
    for size, target in ((1254, 'blue-academy-20261123/weapon.png'), (256, 'printroom/book-icon.png')):
        icon = Image.new('RGBA', (size, size))
        scaled = book.copy()
        scaled.thumbnail((size, size), Image.Resampling.LANCZOS)
        icon.alpha_composite(scaled, ((size-scaled.width)//2, (size-scaled.height)//2))
        icon.save(PUBLIC.parent / target, optimize=True)
    copyfile(PUBLIC.parent / 'blue-academy-20261123/weapon.png',
             SOURCE.parent / 'blue-academy-chibi-20261123/weapon.png')
    outcome = Image.open(SOURCE / 'outcomes.png').convert('RGBA')
    room = Image.open(SOURCE / 'residence.png').convert('RGBA')
    dialogue = Image.open(SOURCE / 'dialogue.png').convert('RGBA')
    for column, member in enumerate(MEMBERS):
        reactions = Image.new('RGBA', (1536, 512))
        for row in range(3):
            drawing = cell(dialogue, column, row, 3).resize((512,512), Image.Resampling.LANCZOS)
            reactions.alpha_composite(drawing, (row*512,0))
        reactions.save(PUBLIC / f'{member}-dialogue.webp', quality=91, method=6)
        for row, state in enumerate(('victory', 'defeat')):
            bust = cell(outcome, column, row, 2)
            bust.save(PUBLIC / f'{member}-{state}.webp', quality=91, method=6)
        strip = Image.new('RGBA', (3 * 256, 256))
        poses = [cell(room, column, row, 3) for row in range(3)]
        # The floor anchor stays at y=244. Seated bodies keep the artist's
        # shorter silhouette, using the same optical scale as the standing pose.
        boxes = [im.getchannel('A').point(lambda a: 255 if a > 32 else 0).getbbox() for im in poses]
        scale = 228 / (boxes[0][3] - boxes[0][1])
        for ix, (im, bounds) in enumerate(zip(poses, boxes)):
            sprite = im.crop(bounds)
            sprite = sprite.resize((round(sprite.width * scale), round(sprite.height * scale)), Image.Resampling.LANCZOS)
            strip.alpha_composite(sprite, (256 * ix + (256 - sprite.width) // 2, 244 - sprite.height))
        strip.save(PUBLIC / f'{member}-room.webp', quality=90, method=6)


if __name__ == '__main__':
    main()
