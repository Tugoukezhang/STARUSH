#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")"
out=../../game/public/art/setdesign
mkdir -p "$out"

room() {
  convert "$1-original.png" -crop "512x768+$3+$4" +repage -strip -define webp:method=6 -quality 85 "$out/$2.webp"
}
room venues foyer 0 0
room venues wardrobe 512 0
room venues route 0 768
room venues workbench 512 768
room rooms archive 0 0
room rooms rehearsal 512 0
room rooms office 0 768
room rooms observatory 512 768

# Each cel has transparent gutters. Normalize the matte before trimming to the ink edge.
frame() {
  convert stationery-original.png -crop "$2" +repage -channel A -level 4%,98% +channel -trim +repage \
    -resize '320x200!' -strip -define webp:method=6 -quality 91 "$out/$1.webp"
}
frame card '768x350+0+0'
frame note '768x350+768+0'
frame monitor '768x310+0+350'
frame dialog '768x310+768+350'
frame strip '768x316+0+660'
frame stub '768x316+768+660'

# Small cast portraits serve both the first-paint passes and the 50px member selector.
headshot() {
  convert "../../game/public/art/$2/avatar.png" -filter Lanczos -resize 180x180 -strip \
    -define webp:method=6 -quality 89 "$out/avatar-$1.webp"
}
headshot sakura red-valkyrie-20261123
headshot kai green-windsong-20261123
headshot enjo blue-academy-20261123
