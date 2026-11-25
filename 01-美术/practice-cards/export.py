"""Export each practice card from the two halves of the original painting."""
from pathlib import Path
from tempfile import NamedTemporaryFile

from PIL import Image

source = Path(__file__).resolve().parent
output = source.parents[1] / "game" / "public" / "art" / "program-studio-20261101"

if __name__ == "__main__":
    with Image.open(source / "clapper-and-target.png") as painting:
        width, height = painting.size
        if width != height * 2:
            raise ValueError("Expected two equal square paintings")
        for panel, filename in enumerate(("practice-score.webp", "practice-target.webp")):
            left = height * panel
            bounds = (left, 25, left + height, height - 26)
            card = painting.crop(bounds).convert("RGB").resize((640, 604), Image.Resampling.LANCZOS)
            with NamedTemporaryFile(dir=output, delete=False) as file:
                card.save(file, "WEBP", quality=84, method=6)
            Path(file.name).replace(output / filename)
