const SOURCES=new Set(['projectile','melee','action']);
const point=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);

// A synchronous release-local record, not a damage owner, event bus or save DTO.
export class PublicPaintContactReceipt{
 constructor({source,x,y,color=null}={}){
  this.valid=SOURCES.has(source)&&point({x,y})&&(color===null||typeof color==='string'||Number.isFinite(color));
  this.source=source;this.origin=Object.freeze({x,y});this.color=color;
  this.contacts=[];this.contactTargets=[];
 }
 record(contact,target=null){
  if(!this.valid||!point(contact))return false;
  const row={x:contact.x,y:contact.y,kind:typeof contact.kind==='string'?contact.kind:undefined};
  if(typeof contact.direct==='boolean')row.direct=contact.direct;
  this.contacts.push(Object.freeze(row));this.contactTargets.push(target);return true;
 }
 targets(){return [...new Set(this.contactTargets.filter(Boolean))];}
 contactFor(target){const index=this.contactTargets.indexOf(target);return index<0?null:this.contacts[index];}
 snapshot(){return this.valid?Object.freeze({source:this.source,origin:this.origin,color:this.color,
  contacts:Object.freeze([...this.contacts]),hit:this.contacts.length>0}):null;}
 feedback(options={}){
  if(!options||typeof options!=='object')return null;
  const {radius,angle=0,start,position=this.origin,deposition=false,successfulPaint=false,sequence,beat}=options;
  const receipt=this.snapshot();
  if(!receipt||!point(position)||![radius,angle,start].every(Number.isFinite)||radius<=0)return null;
  return Object.freeze({receipt,...receipt,x:position.x,y:position.y,radius,angle,start,
   deposition:deposition===true,successfulPaint:successfulPaint===true,
   ...(Number.isSafeInteger(sequence)&&sequence>0?{sequence}:{}),
   ...(Number.isSafeInteger(beat)&&beat>=0?{beat}:{})});
 }
}
