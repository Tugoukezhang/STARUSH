export const PERFORMER_GROUND_OFFSET = 26;
const CEL = Object.freeze({scale:1.5,groundOffset:PERFORMER_GROUND_OFFSET,displaySize:96});
const NATIVE = Object.freeze({scale:2/3,groundOffset:PERFORMER_GROUND_OFFSET});

// Visible alpha height, not padded atlas dimensions: the public cast targets ~72 world px.
export function performerVisualMetrics(id) {
  if(id==='sakura')return NATIVE;
  return ['venus','genya','kai','enjo'].includes(id)?CEL:null;
}
export function performerVisualY(y,scale=1,groundOffset=PERFORMER_GROUND_OFFSET) {
  return y+groundOffset*(1-scale);
}
