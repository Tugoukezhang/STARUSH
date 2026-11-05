export function getStreetGateSegments(state, y, width) {
  const excluded = [];
  const exclude = r => {
    if (r && r.y <= y + 1 && r.y + r.height >= y - 31)
      excluded.push([Math.max(0, r.x), Math.min(width, r.x + r.width)]);
  };
  for (const p of state.props) {
    if (state.isOpen(p.id)) continue;
    // Clip by visible volume as well as its footprint, including translucent roofs.
    exclude({x:p.x-p.width/2, y:p.y-p.height, width:p.width, height:p.height});
    exclude(p.footprint);
  }
  for (const t of state.terrain) exclude(t.footprint);
  excluded.sort((a,b) => a[0]-b[0]);
  const segments=[];
  let start=0;
  for(const [left,right] of excluded) {
    if(right<=start||left>=width)continue;
    if(left>start)segments.push([start,left]);
    start=Math.max(start,right);
  }
  if(start<width)segments.push([start,width]);
  return segments;
}

export function createStreetZoneGate(scene, y, width) {
  const gate=scene.add.container(0,0).setDepth(9.2+y/10000);
  const key=scene.oldStreet.config?.prefix==='harbor'?'harbor-barrier':'street-zone-gate';
  for(const [start,end] of getStreetGateSegments(scene.oldStreet.state,y,width)) {
    const count=Math.ceil((end-start)/140),step=(end-start)/count;
    for(let i=0;i<count;i++)gate.add(scene.add.image(start+i*step,y+1,key)
      .setOrigin(0,1).setDisplaySize(step,32));
  }
  return gate;
}
