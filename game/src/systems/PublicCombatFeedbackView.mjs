import {describePlayerHitSource} from '../utils/playerHitSource.mjs';
// Presentation uses the existing pausable run clock; it never schedules combat work.
export const PUBLIC_BOSS_ARRIVAL_MS=2400;

export class PublicCombatFeedbackView {
  constructor(scene,doc=globalThis.document) {
    this.scene=scene;this.disposed=false;
    this.root=doc.createElement('div');this.root.id='combat-feedback';
    this.root.setAttribute('aria-hidden','true');
    this.entryNode=doc.createElement('div');this.entryNode.id='combat-entry';this.entryNode.hidden=true;
    this.hitNode=doc.createElement('div');this.hitNode.id='combat-hit';this.hitNode.hidden=true;
    this.hitLife=doc.createElement('strong');this.hitLife.className='combat-hit-life';
    this.hitSource=doc.createElement('span');this.hitSource.className='combat-hit-source';this.hitSource.hidden=true;
    this.hitNode.append(this.hitLife,this.hitSource);
    this.bossNode=doc.createElement('div');this.bossNode.id='combat-boss-entry';this.bossNode.hidden=true;
    this.bossTitle=doc.createElement('strong');this.bossTitle.textContent='BOSS 登场';
    this.bossName=doc.createElement('span');this.bossReason=doc.createElement('span');this.bossReason.className='combat-boss-reason';this.bossReason.textContent='设施已点亮\n压轴挑战开始';
    this.bossNode.append(this.bossTitle,this.bossName,this.bossReason);
    this.root.append(this.entryNode,this.hitNode,this.bossNode);doc.getElementById('game-container')?.append(this.root);
    this.shutdown=()=>this.destroy();scene.events?.once?.('shutdown',this.shutdown);
  }
  entry(label,now) {
    if(this.disposed||!['3','2','1','开演'].includes(label)||!Number.isFinite(now))return false;
    this.entryNode.textContent=label;this.entryUntil=now+900;this.entryNode.hidden=false;return true;
  }
  hit(before,after,max,now,source=null) {
    if(this.disposed||![before,after,max].every(Number.isInteger)||!Number.isFinite(now)
      ||max<=0||before>max||after<=0||after>=before)return false;
    this.hitLife.textContent=`受击 -${before-after} · ${after} / ${max}`;
    const copy=describePlayerHitSource(source);
    this.hitSource.textContent=copy?[copy.label,copy.hint].filter(Boolean).join(' · '):'';
    this.hitSource.hidden=!copy;
    this.hitNode.dataset.critical=String(after<=2);this.hitUntil=now+1500;this.hitNode.hidden=false;return true;
  }
  boss(name,now) {
    if(this.disposed||typeof name!=='string'||!name.trim()||!Number.isFinite(now))return false;
    this.bossName.textContent=name;this.bossUntil=now+PUBLIC_BOSS_ARRIVAL_MS;this.bossNode.hidden=false;return true;
  }
  update(now,{blocked=false}={}) {
    if(this.disposed)return;
    this.root.dataset.boss=String(this.scene._publicStage1FinaleBoss?.active===true);
    this.entryNode.hidden=blocked||!Number.isFinite(this.entryUntil)||now>=this.entryUntil;
    this.hitNode.hidden=blocked||!Number.isFinite(this.hitUntil)||now>=this.hitUntil;
    // Only this scene's live boss strip, mounted in its hud and showing the arrival, replaces the separate box.
    const owner=this.scene._publicBossPresentation;
    const carried=owner?.disposed===false&&owner.scene===this.scene&&owner.hud!=null
      &&owner.strip?.parentNode===owner.hud&&owner.strip.dataset?.entrance==='true';
    this.bossNode.hidden=carried||blocked||!Number.isFinite(this.bossUntil)||now>=this.bossUntil;
  }
  destroy() {
    if(this.disposed)return;
    this.disposed=true;this.scene.events?.off?.('shutdown',this.shutdown);this.root.remove();
  }
}
