const LIFE=220,MAX_CONTACTS=12;
// Angles, travel and painted length in world pixels for each weapon.
const SPRAYS = {
  sakura: [[-.88,32,6],[-.42,41,9],[.12,46,11],[.54,38,8],[1.02,28,5]],
  kai: [[-1.15,29,8],[-.73,36,11],[-.25,44,14],[.31,39,10],[.66,26,6]],
  enjo: [[-2.3,24,5],[-1.2,30,6],[-.18,38,7],[1.05,31,6],[2.2,25,5]],
};

// Secondary ink only. Accepted contacts, damage and clocks remain with their original owners.
export class ContactInkFragments{
 constructor(scene, performer='sakura'){this.scene=scene;this.performer=performer;this.motionPreference=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');this.shards=SPRAYS[performer]??SPRAYS.sakura;this.rows=[];this.graphics=null;}
 add({x,y,angle,color,start}){
  if(![x,y,angle,start].every(Number.isFinite)||!Number.isInteger(color)||color<0||color>0xffffff)return;
  // Successive contacts share the same cloud while each retains its own visible impact core.
  const crowded=this.rows.some(row=>start>=row.start && start-row.start<80 && Math.hypot(x-row.x,y-row.y)<32);
  this.rows.push({x,y,angle,color,start,crowded});if(this.rows.length>MAX_CONTACTS)this.rows.shift();
 }
 update(now,depth=9.8){
  if(!Number.isFinite(now))return;
  this.graphics?.clear();this.rows=this.rows.filter(r=>now>=r.start&&now-r.start<LIFE);
  if(!this.rows.length)return;
  const g=this.graphics??=this.scene.add?.graphics?.();if(!g)return;g.setDepth(depth+.00001);
  for(const r of this.rows){
   const p=(now-r.start)/LIFE,ease=1-(1-Math.min(1,p*2.6))**3,alpha=.84*(1-p),clear=this.scene.oldStreet?.clearLine?.bind(this.scene.oldStreet);
   const quiet=this.motionPreference?.matches===true;
   this.shards.forEach(([offset,distance,length],i)=>{
    if((quiet||r.crowded)&&i%2===1)return;
    const reach=quiet?distance*.48:distance;
    // Wind curls away from the blade; a book cast opens into facets around the hit.
    const curl=this.performer==='kai'&&!quiet ? .48*ease : 0;
    const a=r.angle+offset+curl,dx=Math.cos(a),dy=Math.sin(a),nx=-dy,ny=dx;
    const tip={x:r.x+dx*(3+(reach-3)*ease),y:r.y+dy*(3+(reach-3)*ease)};
    const tail={x:tip.x-dx*length*(.45+.55*(1-p)),y:tip.y-dy*length*(.45+.55*(1-p))};
    const width=(1.3+(i%3)*.55)*(1-p*.5),triangle=w=>[tip.x,tip.y,tail.x+nx*w,tail.y+ny*w,tail.x-nx*w,tail.y-ny*w];
    const outline=triangle(width+.7);
    if(clear&&[0,2,4].some(k=>clear(r,{x:outline[k],y:outline[k+1]},1)===false))return;
    g.fillStyle(0x19232c,alpha*.9).fillTriangle(...outline);
    g.fillStyle(r.color,alpha).fillTriangle(...triangle(width));
    if(this.performer==='enjo' && !r.crowded && !quiet) {
      // Complete the crystal back inside the same cover boundary as the forward face.
      const back={x:tail.x-dx*length*.45,y:tail.y-dy*length*.45};
      if(!clear || clear(r,back,1)!==false) {
        g.fillStyle(r.color,alpha*.66).fillTriangle(tail.x+nx*width,tail.y+ny*width,
          back.x,back.y,tail.x-nx*width,tail.y-ny*width);
      }
    }
    // Inside the tested shard triangle, a short glint peaks before the pigment fades.
    if (!quiet && i % 2 === 1 && p < .7) {
      const midX = (tip.x + tail.x) / 2;
      const midY = (tip.y + tail.y) / 2;
      g.fillStyle(0xf5ffff, alpha * (1 - p / .7)).fillTriangle(
        tip.x, tip.y, midX + nx * width * .45, midY + ny * width * .45, tail.x, tail.y
      );
    }
   });
  }
 }
 clear(){this.rows=[];this.graphics?.destroy();this.graphics=null;}
}
