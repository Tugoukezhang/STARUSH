export const SAKURA_TURN_ART = Object.freeze({
  key:'sakura-turn-upper-20260922',path:'art/sakura-secondary-20260922/turn-base.png',frameWidth:256,frameHeight:256,
});
const YAW=Object.freeze({down:0,left:2,up:4,right:6});
const DIRECTIONS=['down','left','up','right'];
const DIAGONALS=Object.freeze({1:0,3:2,5:3,7:1});
const wrap=n=>((n%8)+8)%8;

// Presentation only: 45 degrees per 40ms, never a queue or an input delay.
export function advanceSakuraTurn(state,direction,dt,immediate=false) {
  const target=YAW[direction]??0;
  if(state.turnYaw===undefined||immediate)state.turnYaw=target;
  const delta=wrap(target-state.turnYaw+4)-4;
  const signed=delta===-4?4:delta;
  const step=Math.min(Math.abs(signed),Math.max(0,dt)/40);
  state.turnYaw=wrap(state.turnYaw+Math.sign(signed)*step);
  const cel=wrap(Math.round(state.turnYaw));
  return {frame:DIAGONALS[cel]??null,direction:DIRECTIONS[Math.floor(cel/2)],turning:Math.abs(signed)>step};
}
