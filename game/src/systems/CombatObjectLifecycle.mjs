export const COMBAT_OBJECT_OWNERS = Object.freeze({
  PLAYER_PROJECTILE: 'playerProjectile',
  ENEMY_PROJECTILE: 'enemyProjectile',
  PUBLIC_STAGE_PRESSURE_PROJECTILE: 'publicStagePressureProjectile',
  HIDDEN_STAGE_PRESSURE_PROJECTILE: 'hiddenStagePressureProjectile',
});

export const DEFAULT_COMBAT_OBJECT_LIMITS = Object.freeze({
  [COMBAT_OBJECT_OWNERS.PLAYER_PROJECTILE]: 64,
  [COMBAT_OBJECT_OWNERS.ENEMY_PROJECTILE]: 64,
  [COMBAT_OBJECT_OWNERS.PUBLIC_STAGE_PRESSURE_PROJECTILE]: 4,
  [COMBAT_OBJECT_OWNERS.HIDDEN_STAGE_PRESSURE_PROJECTILE]: 4,
});

export class CombatObjectLifecycleRegistry {
  constructor(limits = {}) {
    this.limits = new Map();
    this.owners = new Map();
    Object.entries(limits).forEach(([owner, limit]) => {
      const safeLimit = Math.max(0, Math.floor(Number(limit) || 0));
      this.limits.set(owner, safeLimit);
      this.owners.set(owner, new Set());
    });
  }

  track(owner, item) {
    const entries = this.owners.get(owner);
    if (!entries || !item) return false;
    if (entries.has(item)) return true;
    if (entries.size >= (this.limits.get(owner) || 0)) return false;
    entries.add(item);
    return true;
  }

  release(owner, item) {
    return this.owners.get(owner)?.delete(item) === true;
  }

  clearOwner(owner, disposer = null) {
    const entries = this.owners.get(owner);
    if (!entries) return 0;
    const items = [...entries];
    entries.clear();
    if (typeof disposer === 'function') items.forEach((item) => disposer(item));
    return items.length;
  }

  clearAll(disposer = null) {
    let cleared = 0;
    this.owners.forEach((_entries, owner) => {
      cleared += this.clearOwner(owner, disposer);
    });
    return cleared;
  }

  snapshot() {
    return Object.fromEntries([...this.owners.entries()].map(([owner, entries]) => [
      owner,
      {
        active: entries.size,
        limit: this.limits.get(owner) || 0,
      },
    ]));
  }
}

export function createDefaultCombatObjectLifecycleRegistry() {
  return new CombatObjectLifecycleRegistry(DEFAULT_COMBAT_OBJECT_LIMITS);
}

export function disposeCombatObject(object, {
  visualProperty = 'gfx',
  reason = 'disposed',
  onRelease = null,
} = {}) {
  if (!object || object.p16Disposed === true) return false;
  object.p16Disposed = true;
  object.p16DisposeReason = String(reason || 'disposed');

  const visual = object[visualProperty];
  if (visual && visual.destroyed !== true) visual.destroy?.();
  object[visualProperty] = null;

  object.destroy?.();
  if (typeof onRelease === 'function') onRelease(object);
  return true;
}
