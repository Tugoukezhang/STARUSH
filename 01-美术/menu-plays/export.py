"""Export the skill poses, actual cast releases, and Opening telegraph used in menus."""
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent
ART = SOURCE.parents[1] / "game" / "public" / "art"
DESTINATION = ART / "menu-plays"
CELLS = {"sakura": (8, 9), "kai": (8, 10), "enjo": (9, 10)}


def write_preview(member_id, indices):
    atlas = Image.open(ART / "performance-poses" / f"{member_id}.webp").convert("RGBA")
    panel = Image.new("RGBA", (224, 112))
    for column, index in enumerate(indices):
        left, top = index % 4 * 256, index // 4 * 256
        pose = atlas.crop((left, top, left + 256, top + 256))
        pose.thumbnail((112, 112), Image.Resampling.LANCZOS)
        panel.alpha_composite(pose, (column * 112, 0))
    panel.save(DESTINATION / f"{member_id}-poses.webp", quality=90, method=6)
    capture = Image.open(SOURCE / "captures" / f"{member_id}.webp")
    capture.save(DESTINATION / f"{member_id}-live.webp", quality=91, method=6)


def write_warning():
    capture = Image.open(SOURCE / "captures" / "opening-1667.jpg")
    width, height = capture.size
    region = (int(width * .1), int(height * .35), int(width * .9), int(height * .84))
    capture.crop(region).resize((288, 215)).save(DESTINATION / "opening-warning.webp", quality=88, method=6)


if __name__ == "__main__":
    DESTINATION.mkdir(exist_ok=True)
    for member_id, cells in CELLS.items():
        write_preview(member_id, cells)
    write_warning()
