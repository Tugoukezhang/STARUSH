// Lamp feet and standing marks share the facility's real coordinates; only the
// broader calibrated state shows the actual radial range used by the contract.
const tau = Math.PI * 2;

export function drawChapterCalibrationDial(g, device, state, progress) {
  if (!device.chapterCalibrationDurationMs || state === 'locked') return;
  const {x, y} = device;
  const awaiting = device.chapterAwaitingCalibration && !device.complete;
  const active = state === 'calibrating';
  const suppressed = state === 'suppressed';
  const ink = suppressed ? 0x9a5944 : state === 'complete' ? 0x356f67 : 0x293f48;
  const light = suppressed ? 0xffbc79 : active ? 0x97f4d9 : 0xd6d1aa;
  const plateY = y + 21;
  // Split aluminium feet point inward on the left sailing light, outward on the right.
  const slant = device.id.endsWith('-right') ? -1 : 1;
  for (const offset of [-20, 20]) {
    g.lineStyle(5, ink, .92).lineBetween(x+offset, plateY, x+offset+slant*6, plateY-7);
    g.lineStyle(2, light, .96).lineBetween(x+offset, plateY, x+offset+slant*6, plateY-7);
  }
  if (!awaiting) return;
  const radius = device.chapterCalibrationRadius;
  const divisions = 12;
  for (let index=0; index<divisions; index++) {
    const angle=index*tau/divisions-Math.PI/2;
    const dx=Math.cos(angle), dy=Math.sin(angle);
    const cx=x+radius*dx, cy=y+radius*dy;
    const step=index%3===0 ? 13 : 6;
    const on=active && progress*divisions >= index+1;
    g.lineStyle(5, ink, .82).lineBetween(cx+dy*step,cy-dx*step,cx-dy*step,cy+dx*step);
    g.lineStyle(on ? 3.5 : 2,on ? 0xffde84 : light,.95).lineBetween(cx+dy*step,cy-dx*step,cx-dy*step,cy+dx*step);
    if (index%3===0) g.lineStyle(2.5,ink,.95).lineBetween(cx,cy,cx-dx*7,cy-dy*7);
  }
  // Buffered power survives leaving the rooftop pad. Match that stored state
  // with a local pair of reserve cells while the ordinary progress bar pauses.
  if (device.chapterCalibrationBuffered && !suppressed) {
    for(const offset of [-6,3]){
      g.lineStyle(5,0x334f48,.9).lineBetween(x+offset,plateY-4,x+offset,plateY+4);
      g.lineStyle(2.5,0xffcf73,1).lineBetween(x+offset,plateY-3,x+offset,plateY+3);
    }
  }
}
