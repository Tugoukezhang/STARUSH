const priorities = Object.freeze({guidance:1,phase:2,action:3,danger:4});
const icons = Object.freeze({
  guidance:'art/battle-signals-b293/guidance.webp',
  phase:'art/battle-signals-b293/phase.webp',
  action:'art/battle-signals-b293/action.webp',
  danger:'art/battle-signals-b293/danger.webp',
});

// One public combat message at a time, aged by the owner's pausable run clock.
export class BattleNoticeView {
  constructor(doc=globalThis.document) {
    this.pending=new Map();this.current=null;this.disposed=false;
    this.root=doc.createElement('div');this.root.id='battle-notice';this.root.hidden=true;
    this.root.setAttribute('role','status');this.root.setAttribute('aria-live','polite');
    // The message lives only in the copy span, so root.textContent stays the exact message.
    this.icon=doc.createElement('img');this.icon.className='battle-signal-icon';
    this.icon.setAttribute('alt','');this.icon.setAttribute('aria-hidden','true');this.icon.width=24;this.icon.height=24;
    this.copy=doc.createElement('span');this.copy.className='battle-signal-copy';
    this.root.append(this.icon,this.copy);
    doc.getElementById('game-container')?.append(this.root);
  }
  show(text,{kind='phase',duration=900}={},now=0) {
    if(this.disposed||!text)return;
    this.update(now);
    const entry={text:String(text),kind,remaining:Math.max(200,Math.min(6500,duration)),queuedAt:now};
    this.pending.delete(kind);
    if(this.current && priorities[kind]<priorities[this.current.kind]) {
      this.pending.set(kind,entry);return;
    }
    if(this.current && priorities[kind]>priorities[this.current.kind]) {
      this.pending.set(this.current.kind,{...this.current,remaining:this.current.endsAt-now});
    }
    this.present(entry,now);
  }
  present(entry,now) {
    this.current={...entry,endsAt:now+entry.remaining};
    this.copy.textContent=entry.text;this.icon.setAttribute('src',icons[entry.kind]);
    this.root.dataset.kind=entry.kind;this.root.hidden=false;
  }
  update(now) {
    if(this.disposed || this.current && now<this.current.endsAt)return;
    const ready=[...this.pending.values()].filter(e=>now-e.queuedAt<=6500);
    this.pending.clear();
    ready.sort((a,b)=>priorities[b.kind]-priorities[a.kind]);
    const next=ready.shift();for(const e of ready)this.pending.set(e.kind,e);
    if(next)this.present(next,now);
    else {this.current=null;this.root.hidden=true;this.copy.textContent='';}
  }
  clear(kind) {
    this.pending.delete(kind);
    if(this.current?.kind===kind){this.current=null;this.root.hidden=true;this.copy.textContent='';}
  }
  destroy() {
    if(this.disposed)return;
    this.disposed=true;this.current=null;this.pending.clear();this.root.remove();
  }
}
