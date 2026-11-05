import meta from './qRebase/registration.mjs';
import { createBattlePresentationAdapter, battleGaitProfile } from './qRebase/battle-presentation-adapter.mjs';
import { createPoseBridge } from './qRebase/pose-bridge.mjs';
import { projectPose } from './qRebase/views.mjs';
import { buildRenderPlan } from './qRebase/render-plan.mjs';
import { PhaserRigView } from './qRebase/phaser-rig-view.mjs';
import {visualStudyEnabled,ENJO_STUDY_KEY,EnjoCelStudyView} from './EnjoVisualStudy.mjs';
const IDS = ['sakura', 'venus', 'genya', 'kai', 'enjo'];
const keyFor = id => 'five-q-trial-' + id;
export function isOptionalQRebaseTrialFile(scene, file) {
  const data = scene.initialBattleData || {}, id = data.performerId || 'sakura';
  return scene._qRebaseTrialRequested === true && data.practiceMode !== true
    && Number(data.stageId || 1) === 1 && IDS.includes(id)
    && (file?.key === keyFor(id) || id==='enjo' && scene._enjoVisualStudyRequested===true && file?.key===ENJO_STUDY_KEY) && ['image', 'json'].includes(file.type);
}
export function qRebaseTrialRequested(data = {}, href, enabled) {
  if (!enabled || data.practiceMode === true || Number(data.stageId || 1) !== 1 || !IDS.includes(data.performerId || 'sakura')) return false;
  try { return new URL(href).searchParams.get('qRebaseTrial') === '1'; } catch { return false; }
}
export function preloadQRebaseTrial(scene, id) {
  if (!IDS.includes(id) || !scene.load?.atlas) return false;
  const old = scene.load.imageLoadType;
  scene.load.imageLoadType = 'HTMLImageElement';
  try {
    scene.load.atlas(keyFor(id), 'art/five-q-trial-20261013/' + id + '.webp', 'art/five-q-trial-20261013/' + id + '.json');
    scene._enjoVisualStudyRequested=id==='enjo'&&scene._qRebaseTrialRequested===true&&visualStudyEnabled();
    if(scene._enjoVisualStudyRequested)scene.load.atlas(ENJO_STUDY_KEY,'art/enjo-visual-study-20261014/atlas-gait.webp','art/enjo-visual-study-20261014/atlas-gait.json');
  }
  finally { scene.load.imageLoadType = old; }
  return true;
}
export class QRebaseTrialView {
  constructor(actor, id) {
    if(id==='enjo'&&actor.scene._enjoVisualStudyRequested===true){
      try{return new EnjoCelStudyView(actor);}catch(error){actor.scene.enjoVisualStudyFallback=String(error.message);}
    }
    this.actor = actor; this.scene = actor.scene; this.id = id; this.key = keyFor(id); this.qRebaseTrial = true;
    this.disposed = false; this.depth = 9.8; this.rows = []; this.savedVisibility = new Map();
    const texture = this.scene.textures?.get(this.key);
    const frames = Object.keys(meta.parts).filter(name => id === 'sakura' ? !IDS.slice(1).some(other => name.startsWith(other + '-')) : name.startsWith(id + '-'));
    if (!this.scene.textures?.exists(this.key) || !frames.every(name => texture?.has(name))) {
      if (this.scene.textures?.exists(this.key)) this.scene.textures.remove(this.key);
      throw Error('Missing complete trial atlas');
    }
    this.legacy = actor.sakuraView || actor.venusView || actor.genyaView || actor.kaiView || actor.enjoView;
    this.adapter = createBattlePresentationAdapter(id);
    const bootOffsets = ['right-boot', 'left-boot'].map(name => {
      const m = meta.parts[meta.performers[id].prefix + name], [a, b] = m.joints;
      return (b[0] - a[0]) * m.width * 6 / ((b[1] - a[1]) * m.height);
    });
    this.bridge = createPoseBridge({ performerId: id, bootOffsets, gaitProfile: battleGaitProfile(id) });
    this.renderer = new PhaserRigView(this.scene, this.key);
    // Keep the atlas through the existing defeat transition; release at scene shutdown.
    this.releaseTexture = () => { if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key); };
    this.scene.events.once('shutdown', this.releaseTexture);
  }
  legacyNodes() {
    const nodes = this.legacy?.nodes;
    return [...(nodes instanceof Map ? nodes.values() : Array.isArray(nodes) ? nodes.map(n => n.node || n) : []),
      ...(this.legacy?.seams?.nodes?.values() ?? []), this.legacy?.shadow].filter(Boolean);
  }
  restoreLegacy() {
    for (const [node, visible] of this.savedVisibility) if (node.active) node.setVisible(visible);
    this.savedVisibility.clear();
  }
  update(now, attack, frozen) {
    if (this.disposed) return;
    const s = this.scene, a = this.actor, v = this.legacy, f = v?.frame, p = v?.pose;
    const mapped = this.adapter.sample({
      performerId: this.id, now, active: s.player?.active !== false, ended: !!s._battleEnded, frozen,
      player: { x: s.player.x, y: s.player.y, hp: s.player.hp }, actor: { state: a.state, direction: a.direction, hurtUntil: a.hurtUntil }, attack,
      layered: this.id !== 'sakura' ? p : null, shot: v?.motion?.shot,
      refined: this.id === 'sakura' && f ? { upperDirection: f.upperDirection, lowerDirection: f.lowerDirection, hurt: f.hurt,
        hurtProgress: f.hurt ? Math.min(1, (f.clock - v.controller.hurtAt) / 360) : null, visualRecovery: f.visualRecovery, visualRecoveryMs: f.visualRecoveryMs } : null
    });
    this.mapping = mapped;
    if (!mapped.visible) { this.renderer.render([]); this.rows = []; return; }
    const sampled = this.bridge.update(mapped);
    this.sampled = sampled;
    this.rows = buildRenderPlan(sampled.pose, meta, { anchor: sampled.anchor, upperView: mapped.upperView, lowerView: mapped.lowerView });
    this.renderer.render(this.rows, this.depth);
    const alpha = s.player.invulnerable && s.player.hp > 0 ? Math.max(.75, s.playerGfx?.alpha ?? 1) : s.playerGfx?.alpha ?? 1;
    for (const node of this.renderer.nodes) node.setAlpha?.(alpha);
    for (const node of this.legacyNodes()) { this.savedVisibility.set(node, node.visible); node.setVisible(false); }
    const rig = sampled.pose;
    this.pose = { ...rig, state: mapped.presentation?.kind === 'hurt' ? 'hurt' : mapped.presentation?.kind === 'attack' ? mapped.presentation.actionFlavor === 'basic' ? 'attack' : 'action' : rig.mode };
    this.state = { native: true, qRebaseTrial: true, attackId: attack?.id ?? null, attackPhase: attack?.phase ?? null };
    this.upper = this.renderer.nodes.find((node, i) => this.rows[i]?.part.includes('head'));
    const forearm = this.rows.find(r => r.part === meta.performers[this.id].prefix + (mapped.upperView === 'rear' ? 'rear-' : '') + 'right-forearm');
    this.hand = forearm?.to ? { ...forearm.to } : null;
  }
  handWorld() { return this.disposed ? null : this.hand; }
  feetWorld() {
    if (!this.sampled || this.disposed) return [];
    const p = projectPose(this.sampled.pose, this.mapping.lowerView), a = this.sampled.anchor;
    return p.feet.filter(f => f.contact && !(f.lift > 0)).map(f => ({ x: a.x + f.x - p.root.x, y: a.y + f.y - p.root.y }));
  }
  cueExclusionBounds() {
    if (this.disposed || !this.rows.length) return null;
    const points = this.rows.filter(r => !r.part.includes('fan')).flatMap(r => {
      const angle = r.angle * Math.PI / 180;
      return [[0, 0], [r.width, 0], [r.width, r.height], [0, r.height]].map(([x, y]) => {
        x -= r.origin[0] * r.width; y -= r.origin[1] * r.height;
        return { x: r.x + x * Math.cos(angle) - y * Math.sin(angle), y: r.y + x * Math.sin(angle) + y * Math.cos(angle) };
      });
    });
    return { x: Math.min(...points.map(p => p.x)), y: Math.min(...points.map(p => p.y)), right: Math.max(...points.map(p => p.x)), bottom: Math.max(...points.map(p => p.y)) };
  }
  setWorldDepth(depth) { if (Number.isFinite(depth)) { this.depth = depth; if (!this.disposed) this.renderer.render(this.rows, depth); } }
  captureDefeat() {
    if (this.disposed || !this.rows.length || this.scene.player?.hp > 0) return null;
    const head = meta.performers[this.id].prefix + (this.mapping.upperView === 'rear' ? 'rear-head' : 'head-defeat');
    const rows = this.rows.map(r => r.part.includes('head') ? { ...r, part: head, height: r.width * meta.parts[head].height / meta.parts[head].width } : { ...r });
    return { qRebaseTrial: true, key: this.key, rows, depth: this.depth };
  }
  destroy() { if (this.disposed) return; this.disposed = true; this.renderer.destroy(); this.savedVisibility.clear(); this.rows = []; this.hand = null; }
}
export class QRebaseDefeatView {
  constructor(scene, pose, duration, onComplete) {
    this.started = false; this.disposed = false; this.timers = [];
    if (!scene.textures?.exists(pose?.key) || !scene.time?.delayedCall || !pose.rows?.length) return;
    this.started = true; this.renderer = new PhaserRigView(scene, pose.key); this.renderer.render(pose.rows, pose.depth);
    for (const [portion, alpha] of [[.25, .8], [.6, .45]]) this.timers.push(scene.time.delayedCall(duration * portion, () => {
      if (!this.disposed) this.renderer.nodes.forEach(n => n.setAlpha(alpha));
    }));
    this.timers.push(scene.time.delayedCall(duration, () => { if (!this.disposed) { this.destroy(); onComplete?.(); } }));
  }
  destroy() { if (this.disposed) return; this.disposed = true; this.timers.forEach(t => t.remove(false)); this.timers = []; this.renderer?.destroy(); }
}
