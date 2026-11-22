export function physicsInput(s) {
  const head=s.yaw/12+.2*s.pitch/8+.25*s.roll/4+.2*s.sway,body=s.sway+.2*s.breath;
  return [...Array(7).fill(head),body+.15*s.ls/2.5,body+.15*s.rs/2,body+.2*s.le/3.5,body+.2*s.re/3,body+.5*s.rs/2+.4*s.rw/3];
}
export function applyPose(runtime,s) {
  for(const[name,id]of [['Moon Lift','moon'],['Moon Tilt','tilt'],['Upper Notes','upperNote'],['Near Notes','nearNote'],['Leaf Arc','arc']]) {
    runtime.set_parameter_scalar('Ornament:: '+name,s[id]);
    runtime.set_parameter_vec2('Ornament:: '+name+' Arm Correction',s.rs+s.re+s.rw,s[id]);
  }
  runtime.set_parameter_scalar('Body:: Breath',s.breath);runtime.set_parameter_scalar('Body:: Sway',s.sway);
  for(const[side,a,e,w]of [['Left','ls','le','lw'],['Right','rs','re','rw']]) {
    runtime.set_parameter_vec2('Arm:: '+side,s[a],s[e]);runtime.set_parameter_scalar('Wrist:: '+side,s[w]);
    runtime.set_parameter_vec2('Wrist:: '+side+' Arm Correction',s[a]+s[e],s[w]);
  }
  runtime.set_parameter_vec2('Head:: Yaw-Pitch',s.yaw,s.pitch);runtime.set_parameter_scalar('Head:: Roll',s.roll);runtime.set_parameter_vec2('Eye:: Gaze',s.gx,s.gy);
  for(const[name,id]of [['Eye:: Left Blink','left'],['Eye:: Right Blink','right'],['Mouth:: Close','close'],['Mouth:: Smile','smile']]) {
    runtime.set_parameter_scalar(name,s[id]);
    for(const[axis,head]of [['Yaw','yaw'],['Pitch','pitch'],['Roll','roll']])runtime.set_parameter_vec2(name+' '+axis,s[head],s[id]);
  }
  for(const[side,id]of [['left','left'],['right','right']])for(const part of ['white','iris','highlight'])runtime.set_part_opacity_by_name('eye-'+side+'-'+part,Math.min(1,(1-s[id])*4));
  runtime.set_part_opacity_by_name('mouth-closed',Math.max(0,(s.close-.75)*4));
  for(const part of ['teeth','tongue','upper','lower','cavity'])runtime.set_part_opacity_by_name('mouth-'+part,Math.min(1,(1-s.close)*4));
}
