export class PublicTargetFocusView{
 constructor({doc=globalThis.document}={}){
  if(typeof doc?.createElement!=='function')return;
  const host=doc.getElementById?.('game-container');if(!host)return;
  this.root=doc.createElement('div');this.root.id='public-target-focus';this.root.hidden=true;this.root.setAttribute('role','status');this.root.setAttribute('aria-live','polite');
  this.image=doc.createElement('img');this.image.src='art/formal-ui-20261016/lens.webp';this.image.alt='';this.image.width=28;this.image.height=28;this.image.draggable=false;
  this.image.addEventListener('error',()=>{this.image.hidden=true;});
  this.label=doc.createElement('span');this.root.append(this.image,this.label);host.append(this.root);
 }
 show(p,label,width,height,inRange=true){
  if(!this.root)return;
  this.root.hidden=false;this.root.style.left=Math.max(68,Math.min(width-68,p.x))+'px';this.root.style.top=Math.max(184,Math.min(height-80,p.y+20))+'px';
  this.root.dataset.state=inRange?'in-range':'locked';
  const text=(inRange?'集火 · ':'锁定 · ')+label;if(this.label.textContent!==text)this.label.textContent=text;
 }
 hide(){if(this.root)this.root.hidden=true;}
 destroy(){this.root?.remove();this.root=null;}
}
