export const RELAY_TRANSFER_ART=Object.freeze({key:'user-relay-transfer-20261029',path:'art/relay-ink-transfer-20261029/transfer.webp',frameWidth:512,frameHeight:192,frames:20,palettes:Object.freeze(['pink','blue','yellow','purple','orange']),duration:300});
const ENDS=[.16,.46,.76,1];

// Accepted-paint receipt only. These captured endpoints never own targets, damage or travel.
export class RelayInkTransfer{
 constructor(scene){this.scene=scene;this.rows=[];}
 ready(){const s=this.scene;return s._userCastPresentation===true&&!s._battleEnded&&!s._battlePaused&&!s._publicBattleDialog&&s.player?.active!==false&&s.player?.hp>0;}
 add(point){
  const s=this.scene,{x,y,color,from}=point||{},bank=RELAY_TRANSFER_ART.palettes.indexOf(color),start=s.publicPerformerRun?.now?.();
  if(!this.ready()||!Number.isFinite(x+y+from?.x+from?.y+start)||bank<0||!s.textures?.exists(RELAY_TRANSFER_ART.key))return false;
  const length=Math.hypot(x-from.x,y-from.y);if(length<6||length>160.001||s.oldStreet?.clearLine(from,{x,y},1)===false)return false;
  const node=s.add.image((x+from.x)/2,(y+from.y)/2,RELAY_TRANSFER_ART.key,bank*4).setOrigin(.5,.5)
   .setDisplaySize(length*512/480,Math.max(8,Math.min(34,length*.32))).setRotation(Math.atan2(y-from.y,x-from.x)).setAlpha(.9).setDepth(6);
  while(this.rows.length>=4)this.rows.shift().node.destroy();
  this.rows.push({node,x,y,from:{x:from.x,y:from.y},color,bank,start});return true;
 }
 update(){
  const s=this.scene;if(s._battleEnded||s.player?.active===false||s.player?.hp<=0){this.clear();return;}
  if(s._battlePaused||s._publicBattleDialog)return;
  const now=s.publicPerformerRun?.now?.();
  this.rows=this.rows.filter(row=>{const age=now-row.start;if(!Number.isFinite(age)||age<0||age>=RELAY_TRANSFER_ART.duration){row.node.destroy();return false;}
   const progress=age/RELAY_TRANSFER_ART.duration;row.node.setFrame(row.bank*4+ENDS.findIndex(end=>progress<end)).setAlpha(progress<.76?.9:.9*(1-progress)/.24);return true;
  });
 }
 clear(){for(const row of this.rows)row.node.destroy();this.rows=[];}
}
