export function createAtmosphereFeedback(scene,publicRound) {
  const y=publicRound?168:667*.35;
  const style={fontSize:publicRound?'14px':'36px',fontFamily:'"Microsoft YaHei", "PingFang SC", Arial, sans-serif',
    fontStyle:'bold',stroke:publicRound?'#F4F7F8':'#111',strokeThickness:publicRound?3:4};
  if(!publicRound)style.shadow={blur:8,color:'#000',fill:true};
  const label=scene.add.text(187.5,y,'',style).setOrigin(.5).setDepth(60).setAlpha(0).setScale(publicRound?1:.5);
  const ring=scene.add.circle(187.5,y,15,0,0).setDepth(55).setAlpha(0);
  if(publicRound){label.setScrollFactor(0);ring.setScrollFactor(0);}
  return {label,ring};
}

export function playPublicAtmosphereFeedback(scene,name) {
  const label=scene.atmoLabel;
  scene.tweens.killTweensOf(label);scene.tweens.killTweensOf(scene.atmoRing);
  scene.atmoRing.setAlpha(0).setScale(1);
  if(typeof scene._showPublicBattleNotice==='function' && scene.battleData?.defenseMode!==true) {
    label.setAlpha(0);
    scene._showPublicBattleNotice(name,{kind:'phase',duration:660});
    return;
  }
  label.setText(name).setColor('#314951').setScale(1).setAlpha(0);
  scene.tweens.add({targets:label,alpha:.9,duration:110,hold:440,yoyo:true,
    onComplete:()=>label.setAlpha(0).setScale(1)});
}
