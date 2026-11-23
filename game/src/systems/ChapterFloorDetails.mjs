// Fixed stage hardware uses world coordinates and sits below paint and actors.
const stages = {
  opening: { fixture: 'drain', ink: 0x686459, stations: [[250, 1420], [735, 1040], [278, 710], [748, 350]] },
  neon: { fixture: 'inlay', ink: 0x67838c, stations: [[288, 1430], [724, 1150], [254, 810], [730, 440]] },
  encore: { fixture: 'deck', ink: 0x888074, stations: [[270, 1410], [716, 1050], [270, 735], [736, 440]] },
  raincheck: { fixture: 'vent', ink: 0x738783, stations: [[260, 1430], [725, 1080], [274, 730], [716, 385]] },
  homecoming: { fixture: 'berth', ink: 0x947d69, stations: [[282, 1420], [740, 1080], [260, 780], [706, 400]] },
};

function drawPlate(g, x, y, fixture, ink) {
  const wide = fixture === 'deck' || fixture === 'berth';
  const width = wide ? 52 : 34;
  g.fillStyle(0x252e30, .36).fillRoundedRect(x, y, width, 13, 2);
  g.lineStyle(1, ink, .86).strokeRoundedRect(x, y, width, 13, 2);
  g.lineStyle(1, 0xd6d5bf, .48).lineBetween(x + 3, y + 1, x + width - 3, y + 1);
  if (fixture === 'drain' || fixture === 'vent') {
    g.lineStyle(2, 0x283235, .64);
    for (let offset = 5; offset < width - 3; offset += 5) {
      g.lineBetween(x + offset, y + 3, x + offset + (fixture === 'vent' ? 2 : 0), y + 10);
    }
  } else if (fixture === 'inlay') {
    g.lineStyle(2, 0x99c6c5, .65).lineBetween(x + 4, y + 7, x + width - 4, y + 7);
  } else {
    g.lineStyle(2, ink, .8);
    for (let offset = 7; offset < width - 5; offset += 8) {
      g.lineBetween(x + offset, y + 9, x + offset + 4, y + 4);
    }
    if (fixture === 'berth') g.lineBetween(x + 3, y + 16, x + width - 3, y + 16);
  }
}

// Extend each fitting towards the kerb, away from the central paint lane.
function drawSurround(graphics, x, y, fixture, ink) {
  const direction = x < 500 ? -1 : 1;
  const edge = direction < 0 ? x : x + (fixture === 'deck' || fixture === 'berth' ? 52 : 34);
  const line = (start, top, end, bottom) => graphics.lineBetween(
    edge + direction * start, y + top, edge + direction * end, y + bottom);
  graphics.lineStyle(2, ink, .57);
  switch (fixture) {
    case 'drain': // Recessed stone gutter with staggered cross joints.
      line(3, 2, 85, 2);
      line(3, 12, 85, 12);
      for (let at = 14; at < 85; at += 20) line(at, 3, at - 3, 11);
      break;
    case 'inlay': // Two inset neon tracks dog-leg towards the shop front.
      for (const top of [2, 10]) {
        line(2, top, 52, top);
        line(52, top, 68, top - 16);
        line(68, top - 16, 107, top - 16);
      }
      break;
    case 'deck': // Repeating diagonal strip on the stage cable cover.
      line(4, -2, 75, -2);
      line(4, 15, 75, 15);
      for (let at = 11; at < 70; at += 13) line(at, 13, at + 7, 0);
      break;
    case 'vent': // Two elbows carry the roof conduit away from the louvres.
      for (const inset of [0, 6]) {
        line(3, 5 + inset, 34 + inset, 5 + inset);
        line(34 + inset, 5 + inset, 34 + inset, -29 + inset);
        line(34 + inset, -29 + inset, 88, -29 + inset);
      }
      line(73, -32, 73, -20);
      break;
    case 'berth': // Worn berth-edge ruler with alternating long and short ticks.
      line(4, 15, 103, 15);
      for (let mark = 0; mark < 9; mark++) {
        const at = 7 + mark * 11;
        line(at, 15, at, mark % 3 === 0 ? -3 : 7);
      }
      break;
  }
}

export function attachChapterFloorDetails(scene, ground, chapter, depth) {
  const plan = stages[chapter];
  if (!plan || !scene.add.graphics) return;
  const graphics = scene.add.graphics().setDepth(depth + .01);
  for (const [x, y] of plan.stations) {
    drawPlate(graphics, x, y, plan.fixture, plan.ink);
    drawSurround(graphics, x, y, plan.fixture, plan.ink);
  }
  ground.once('destroy', () => graphics.destroy());
}
