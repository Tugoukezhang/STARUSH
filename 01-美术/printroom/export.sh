#!/usr/bin/env bash
set -euxo pipefail
cd "$(dirname "$0")"
out=../../game/public/art/printroom
mkdir -p "$out"
# Each crop is a separate editable region in the original GPT image.
sprite() {
  convert "$1-original.png" -crop "$3" +repage -resize "$4" -quality "$5" "$out/$2.webp"
}
sprite nav ../infield/nav-desk '622x642+0+0' '140x140' 88
sprite nav ../infield/nav-roster '624x642+630+0' '140x140' 88
sprite nav ../infield/nav-tour '622x606+0+648' '140x140' 88
sprite nav ../infield/nav-inventory '624x606+630+648' '140x140' 88
sprite tickets primary '1496x219+338+13' '592x' 89
sprite tickets paper '1496x218+338+248' '592x' 89
sprite tickets ink '1496x220+338+486' '592x' 89
sprite rooms dressing '835x470+0+0' '680x' 84
sprite rooms gear '835x470+837+0' '680x' 84
sprite rooms records '835x470+0+471' '680x' 84
sprite rooms rehearsal '835x470+837+471' '680x' 84
convert speaker-original.png -resize 360x360 -quality 87 "$out/motif.webp"
