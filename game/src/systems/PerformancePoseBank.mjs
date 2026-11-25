import {PERFORMANCE_POSE_BOUNDS} from '../utils/performancePoseBounds.mjs';

const directory = 'art/performance-poses/';
export const RIFLE_STRIDE = 'stage-rifle-stride';
export const CREW_POSES = 'stage-equipment-performance';
const crewRows = {
  'unlit-chaser': 0, 'stage-cue-emitter': 1, 'objective-disruptor': 2,
  'spotlight-captain': 3, 'finale-boss': 4,
};
const castKey = id => 'stage-performer-' + id;

export function preloadPerformancePoses(scene, id) {
  if (!['sakura','kai','enjo'].includes(id)) return;
  const cell = {frameWidth:256, frameHeight:256};
  scene.load.spritesheet(castKey(id), directory + id + '.webp', cell);
  if (id === 'sakura') scene.load.spritesheet(RIFLE_STRIDE, directory + 'rifle-stride.webp', cell);
  scene.load.spritesheet(CREW_POSES, directory + 'stage-crew.webp', cell);
}

export function loadedPerformancePose(scene, id) {
  const key = castKey(id), bounds = PERFORMANCE_POSE_BOUNDS[id];
  if (!bounds || !scene.textures?.exists(key) || !scene.textures.get?.(key)?.has(bounds.length-1)) return null;
  const stride = id === 'sakura' && scene.textures.exists(RIFLE_STRIDE) && scene.textures.get?.(RIFLE_STRIDE)?.has(55);
  return {key, bounds, strideBounds:stride ? PERFORMANCE_POSE_BOUNDS.rifleStride : null};
}

export function crewPoseFrame(role, pose, state, chaserState) {
  if (!Object.hasOwn(crewRows, role)) return null;
  const first = crewRows[role] * 3;
  if (role === 'unlit-chaser') {
    if (chaserState === 'windup' || chaserState === 'guard') return first;
    if (chaserState === 'rush') return first + 1;
    if (chaserState === 'recovery') return first + 2;
    if (chaserState === 'approach' && !pose.step) return 15;
    return first + (pose.step || 0);
  }
  if (pose.releasing || state === 'disrupting') return first + 1;
  if (state === 'windup' && !pose.discharged) return first;
  return first + 2;
}

// Track the actual travel direction independently of the active weapon's facing.
export class PerformerStride {
  constructor() {
    this.axis = 'side';
    this.moving = false;
    this.changedAt = -Infinity;
    this.lastSide = 1;
    this.lastFrame = 0;
  }

  advance(dx, dy, moving, clock, distance) {
    if (moving) {
      const horizontal = Math.abs(dx), vertical = Math.abs(dy);
      let axis = this.axis;
      // Keep the last axis near diagonals to avoid swapping the full body every pixel.
      if (vertical > horizontal * 1.15) axis = dy < 0 ? 'up' : 'down';
      else if (horizontal > vertical * 1.15 || !this.moving) axis = 'side';
      if (!this.moving || axis !== this.axis) this.changedAt = clock;
      if (horizontal > .05) this.lastSide = Math.sign(dx);
      this.axis = axis;
      this.lastFrame = Math.floor(distance / 17) % 4;
    } else if (this.moving) {
      this.changedAt = clock;
    }
    this.moving = moving;
  }

  verticalFrame(clock) {
    const holding = this.moving || clock - this.changedAt < 84;
    return (this.axis === 'up' ? 0 : 4) + (holding ? this.lastFrame : 0);
  }

  settle(clock, reduced) {
    const age = clock - this.changedAt;
    if (reduced || age < 0 || age >= 155) return 0;
    // Shift weight while the original world position already follows the control.
    return Math.sin(Math.PI * age / 155) * (1 - age / 155);
  }
}
