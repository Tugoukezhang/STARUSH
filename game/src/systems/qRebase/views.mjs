export function partForView(id,view){
 if(view!=='rear')return id;
 return id.startsWith('head-')||id==='head'||id==='blink-head'?'rear-head':'rear-'+id;
}
export function projectPose(p,view){
 if(view!=='rear')return p;
 const point=v=>({...v,x:2*p.root.x-v.x});
 return {...p,root:{...p.root},feet:p.feet.map(point),
  legs:p.legs.map(l=>({...l,hip:point(l.hip),knee:point(l.knee),ankle:point(l.ankle)})),
  arms:p.arms.map(a=>({...a,shoulder:point(a.shoulder),elbow:point(a.elbow),wrist:point(a.wrist)})),
  fanAngle:-p.fanAngle,headRotation:-p.headRotation};
}
