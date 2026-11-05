// Continuous 2D deformation field for the full 1024x1536 Enjo portrait.
// All coordinates are original source pixels. Pure and stateless: the output
// depends only on the arguments, never on frame history.

const BREATH_PX = 4;
const HEAD_BREATH_SHARE = 0.5;
const NOD_PX = 4.5;
const NOD_FACE_PX = 1.5; // Extra face travel: the closest 2D gets to head pitch.
const NOD_LEAN_PX = 1;
const TORSO_ACKNOWLEDGE = 0.25;
const LOOK_PX = 2.5;
const HAIR_X_PX = 5;
const HAIR_Y_PX = 1.2;
const TAU = Math.PI * 2;

const smoothstep = (from, to, value) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};
const falloff = (from, to, value) => 1 - smoothstep(from, to, value);
const union = (a, b) => 1 - (1 - a) * (1 - b);

// 0 on everything that must not move, rising smoothly to 1 outside it.
function freeMask(x, y) {
  // The hammer head's right edge is near x=444, so the rectangle runs to 450.
  const hammer = Math.hypot(Math.max(x - 450, 0), Math.max(570 - y, 0));
  return smoothstep(0, 90, hammer)
    * smoothstep(60, 180, Math.hypot(x - 335, y - 570)) // Grip reaches above y=570.
    * smoothstep(0, 90, 1200 - y); // Boots and floor.
}

const headWeight = (x, y) => falloff(190, 340, Math.abs(x - 560))
  * falloff(345, 430, y)
  * smoothstep(0, 90, y); // Keeps the top texture border pinned.

const faceWeight = (x, y) => falloff(0.35, 1, Math.hypot((x - 560) / 190, (y - 265) / 150));

const torsoWeight = (x, y) => falloff(0.25, 1, Math.hypot((x - 570) / 260, (y - 460) / 220));

function hairWeight(x, y) {
  const left = smoothstep(100, 170, x) * falloff(270, 430, x);
  const right = smoothstep(680, 840, x) * falloff(900, 970, x);
  return (left + right)
    * smoothstep(350, 450, y)
    * falloff(850, 950, y)
    * smoothstep(60, 260, Math.hypot(x - 690, y - 580)); // Calm around the hip hand.
}

/**
 * Maps a source point to its deformed position.
 * Controls are required and assumed legal: breath 0..1, greet -1..1, look -1..1,
 * time in seconds. Time reaches only the hair, whose drive is 0 unless breath or
 * greet is nonzero.
 */
export function deformEnjo(x, y, { breath, greet, look, time }) {
  if (breath === 0 && greet === 0 && look === 0) return { x, y };

  const free = freeMask(x, y);
  const head = headWeight(x, y);
  const face = faceWeight(x, y);
  const torso = torsoWeight(x, y);
  const hair = hairWeight(x, y) * union(breath, greet * greet);

  const sway = TAU * 0.23 * time + 0.009 * y + 0.004 * x;
  const flutter = TAU * 0.37 * time + 0.014 * y - 0.003 * x;

  const dx = NOD_LEAN_PX * greet * head
    + LOOK_PX * look * face
    + HAIR_X_PX * hair * (0.6 * Math.sin(sway) + 0.4 * Math.sin(flutter));
  const dy = -BREATH_PX * breath * union(torso, HEAD_BREATH_SHARE * head)
    + greet * (NOD_PX * union(head, TORSO_ACKNOWLEDGE * torso) + NOD_FACE_PX * face)
    + HAIR_Y_PX * hair * Math.sin(sway + 1.1);

  return { x: x + free * dx, y: y + free * dy };
}

function requireFinite(name, value) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite, got ${value}`);
}

// [seconds, value]: anticipation lifts, the nod peaks, then a slight rebound settles.
const GREETING_KEYS = [[0, 0], [0.18, -0.22], [0.52, 1], [0.82, -0.08], [1.2, 0]];
const GREETING_SECONDS = 1.2;

/**
 * Greeting drive for deformEnjo's `greet`, -0.22..1, positive nods downward.
 * Exactly 0 before the start and from 1.2s on. Negative age is valid because a
 * requestAnimationFrame timestamp can precede the event that started the greeting.
 */
export function greetingEnvelope(ageSeconds) {
  requireFinite('ageSeconds', ageSeconds);
  if (ageSeconds <= 0 || ageSeconds >= GREETING_SECONDS) return 0;
  let next = 1;
  while (ageSeconds > GREETING_KEYS[next][0]) next += 1;
  const [fromTime, fromValue] = GREETING_KEYS[next - 1];
  const [toTime, toValue] = GREETING_KEYS[next];
  const blend = smoothstep(fromTime, toTime, ageSeconds);
  return fromValue * (1 - blend) + toValue * blend;
}

// Seconds between blink ends. The 0.46s entry reads as an occasional double blink.
const BLINK_GAPS = [3.1, 4.7, 0.46, 5.9, 2.3, 3.7];
const BLINK_CYCLE = BLINK_GAPS.reduce((sum, gap) => sum + gap, 0);
const BLINK_SECONDS = 0.24;

/**
 * Eye closure 0..1 as a pure function of time: closes over 0.07s, holds for 0.05s,
 * opens over 0.12s. Exactly 0 at and before time 0.
 */
export function blinkAmount(timeSeconds) {
  requireFinite('timeSeconds', timeSeconds);
  if (timeSeconds <= 0) return 0;
  const local = timeSeconds % BLINK_CYCLE;
  let index = 0;
  let blinkEnd = BLINK_GAPS[0];
  while (local >= blinkEnd) {
    index += 1;
    blinkEnd += BLINK_GAPS[index];
  }
  const age = local - (blinkEnd - BLINK_SECONDS);
  return smoothstep(0, 0.07, age) * falloff(0.12, BLINK_SECONDS, age);
}
