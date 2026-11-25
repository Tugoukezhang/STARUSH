"""Export the authored curbside signs, load-out bay and calibrated roof paving."""
from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

source = Path(__file__).resolve().parent
public = source.parents[1] / "game" / "public" / "art"
dest = Path(sys.argv[1]) if len(sys.argv) > 1 else public
master = Image.open(source / "props-master.png").convert("RGBA")
width, height = master.size

def save(image, path):
    path = dest / path
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    image.save(tmp, format="WEBP", quality=93, method=6, exact=True)
    tmp.replace(path)

def quadrant(column, row):
    tile = master.crop((width*column//2,height*row//2,width*(column+1)//2,height*(row+1)//2))
    # A tiny isolated edge pixel can otherwise move the transparent padding.
    box = tile.getchannel("A").point(lambda v: 255 if v >= 35 else 0).getbbox()
    return tile.crop(box)

for name, column, row in [("headphones",1,0),("cup",0,1),("record",1,1)]:
    prop = quadrant(column, row)
    prop.thumbnail((105, 133), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (112, 140))
    canvas.alpha_composite(prop, ((112-prop.width)//2, 137-prop.height))
    save(canvas, "chapter-landmarks/" + name + ".webp")

lights = Image.open(source/"lights-master.png").convert("RGBA")
cell = lights.width // 3
for col, name in enumerate(("sail-left","sail-right","roof-console")):
    panel = lights.crop((col*cell,0,(col+1)*cell,lights.height))
    panel = panel.crop(panel.getchannel("A").point(lambda v: 255 if v >= 35 else 0).getbbox())
    frame_size = (152,128) if name=="roof-console" else (114,152)
    panel.thumbnail((frame_size[0]-5,frame_size[1]-5),Image.Resampling.LANCZOS)
    frame = Image.new("RGBA",frame_size)
    frame.alpha_composite(panel,((frame.width-panel.width)//2,frame.height-2-panel.height))
    save(frame, "chapter-landmarks/"+name+".webp")

# Keep the original shelter silhouette and walkable footprint. The equipment is
# inside the right-hand loading bay, where it remains visible from the spawn.
cart = quadrant(0,0)
cart.thumbnail((182,190), Image.Resampling.LANCZOS)
for muted in (False, True):
    name = "shed-muted.webp" if muted else "shed.webp"
    shed = Image.open(public/"harbor-cohesion-20261009"/name).convert("RGBA")
    decoration = cart.copy()
    if muted:
        graded = ImageOps.colorize(ImageOps.grayscale(cart), "#253039", "#dcd9ca").convert("RGBA")
        graded.putalpha(cart.getchannel("A"))
        decoration = Image.blend(graded, cart, 0.23)
    shed.alpha_composite(decoration, (shed.width-17-cart.width, shed.height-16-cart.height))
    save(shed, "chapter-landmarks/" + name)

# Show hinge barrels, opening seam and handle on the existing interactive gate.
gate = Image.open(source/"loading-gate-source.webp").convert("RGBA")
d = ImageDraw.Draw(gate)
for x in (4, gate.width-24):
    for y in (22, 85):
        d.rounded_rectangle((x,y,x+18,y+29),radius=4,fill="#404f55",outline="#e4d8af",width=3)
        d.line((x+3,y+12,x+16,y+12),fill="#eec66f",width=4)
for y in (30,65,101):
    d.polygon([(137,y-2),(146,y-2),(136,y+15),(128,y+15)],fill="#e1b158",outline="#394247")
d.rounded_rectangle((148,59,161,85),radius=4,fill="#23353b",outline="#f9e3aa",width=3)
save(gate,"street-volume-20260913/gate.webp")

# Suppress speckle through the main walking and tuning lane. Preserve large
# slab seams and both engraved circular covers, with more patina at the sides.
for mode in ("neutral","color"):
    floor = Image.open(source/("roof-"+mode+"-source.webp")).convert("RGB")
    pixels = np.asarray(floor).astype(float)
    coarse = np.asarray(floor.filter(ImageFilter.GaussianBlur(6.5))).astype(float)
    x = np.arange(floor.width)
    along = np.clip((x-85)/245,0,1) * np.clip((floor.width-85-x)/245,0,1)
    along = along*along*(3-2*along)
    mix = (along*.79)[None,:,None]
    result = np.rint(pixels*(1-mix)+coarse*mix).clip(0,255).astype("uint8")
    save(Image.fromarray(result), "rooftop-20261103/"+mode+".webp")
