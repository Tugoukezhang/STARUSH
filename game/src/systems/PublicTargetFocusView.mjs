export class PublicTargetFocusView{
 constructor({doc=globalThis.document}={}){
  if(typeof doc?.createElement!=='function')return;
  const host=doc.getElementById?.('game-container');if(!host)return;
  this.root=doc.createElement('div');this.root.id='public-target-focus';this.root.hidden=true;this.root.setAttribute('role','status');this.root.setAttribute('aria-live','polite');
  this.image=doc.createElement('img');this.image.src='art/formal-ui-20261016/lens.webp';this.image.alt='';this.image.width=28;this.image.height=28;this.image.draggable=false;
  this.image.addEventListener('error',()=>{this.image.hidden=true;});
  this.label=doc.createElement('span');this.root.append(this.image,this.label);host.append(this.root);
  this.auto=doc.createElement('div');this.auto.id='public-auto-target';this.auto.hidden=true;
  this.auto.setAttribute('aria-hidden','true');host.append(this.auto);
 }
 show(p,label,width,height,inRange=true,player=null){
  if(!this.root)return;
  this.root.hidden=false;
  // Near a performer, tuck the caption to their open side. The reticle stays on the target.
  const crowded=player&&Math.abs(p.x-player.x)<86&&Math.abs(p.y-player.y)<86;
  const side=p.x<width/2?1:-1;
  const x=crowded?player.x+side*94:p.x;
  this.root.style.left=Math.max(55,Math.min(width-55,x))+'px';
  this.root.style.top=Math.max(148,Math.min(height-80,crowded?p.y+4:p.y+20))+'px';
  this.root.dataset.state=inRange?'in-range':'locked';
  const text=(inRange?'集火 · ':'锁定 · ')+label;if(this.label.textContent!==text)this.label.textContent=text;
 }
 showAuto(p,fixture){
  if(!this.auto||!p)return;
  this.auto.hidden=false;this.auto.dataset.kind=fixture?'fixture':'enemy';
  this.auto.style.left=p.x+'px';this.auto.style.top=(p.y+9)+'px';
 }
 hideAuto(){if(this.auto)this.auto.hidden=true;}
 hide(){if(this.root)this.root.hidden=true;}
 destroy(){this.root?.remove();this.auto?.remove();this.root=null;this.auto=null;}
}
