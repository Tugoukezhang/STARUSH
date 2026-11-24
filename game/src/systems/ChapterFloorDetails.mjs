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

// The frontage is registered to the building's feet. Narrow props keep their baked shadows.
function drawThreshold(g, prop, plan) {
  const foot = prop.footprint;
  if (!prop.restorable || !foot || foot.width < 96) return;
  const left = foot.x - 4;
  const width = foot.width + 8;
  const y = Math.max(prop.y, foot.y + foot.height);
  const stone = plan.fixture === 'drain';
  const dock = plan.fixture === 'berth' || plan.fixture === 'deck';
  const thickness = stone ? 12 : 8;
  // Contact shadow, slab and bevel are separate values, all quieter than wet pigment.
  g.fillStyle(0x24343a, .20).fillRoundedRect(left + 3, y - 3, width, thickness + 6, 3);
  g.fillStyle(plan.ink, .46).fillRoundedRect(left, y - 4, width, thickness, 2);
  g.lineStyle(1.5, 0xd6d7bf, .60).lineBetween(left + 2, y + thickness - 5, left + width - 2, y + thickness - 5);
  if (plan.fixture === 'inlay') {
    // Broken insets at shop corners keep the sidewalk quieter than the stage lights.
    for (const start of [left + 5, left + width - 38]) {
      g.lineStyle(2, 0x90bebc, .68).lineBetween(start, y + 1, start + 33, y + 1);
    }
    return;
  }
  const count = Math.max(2, Math.round(width / (stone ? 32 : 46)));
  g.lineStyle(1.5, 0x364044, .52);
  for (let i = 1; i < count; i++) {
    const at = left + width * i / count;
    if (stone) g.lineBetween(at, y - 3, at - 2, y + 7);
    else if (dock) g.lineBetween(at - 3, y + 2, at + 2, y - 3);
    else g.lineBetween(at - 2, y, at + 2, y);
  }
}

export function attachChapterFloorDetails(scene, ground, chapter, depth, props = []) {
  const plan = stages[chapter];
  if (!plan || !scene.add.graphics) return;
  const graphics = scene.add.graphics().setDepth(depth + .01);
  for (const prop of props) drawThreshold(graphics, prop, plan);
  for (const [x, y] of plan.stations) {
    drawPlate(graphics, x, y, plan.fixture, plan.ink);
    drawSurround(graphics, x, y, plan.fixture, plan.ink);
  }
  ground.once('destroy', () => graphics.destroy());
}
