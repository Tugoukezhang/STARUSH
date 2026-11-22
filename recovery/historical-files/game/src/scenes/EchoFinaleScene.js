import {EchoWorkshopScene} from './EchoWorkshopScene.js';
import {EchoFinale,ECHO_FINALE as MAP} from '../utils/echoFinale.mjs';
export class EchoFinaleScene extends EchoWorkshopScene {
 constructor(){super('EchoFinaleScene');this.segmentLabel='回声工坊 · 守谱司钟';}
 createRun(){return new EchoFinale(this.member.id)}
 mountUI(){super.mountUI();this.ui.classList.add('echo-finale');this.ui.setAttribute('aria-label','守谱司钟压轴试演');this.ui.querySelector('.prism-header small').textContent='压轴 · 三相反拍';this.ui.querySelector('h1').textContent='守谱司钟';}
 drawGarden(){
  const g=this.add.graphics();g.fillStyle(0x242536).fillRoundedRect(18,150,339,400,22);g.lineStyle(3,0xc1ac82).strokeRoundedRect(20,150,335,400,22);
  for(let y=175;y<540;y+=28)g.lineStyle(1,0xc8b69b,.14).lineBetween(27,y,348,y);
  // Original suspended bell cradle and radiating tuning tracks, within the shared collision field.
  g.lineStyle(5,0x9b835d).lineBetween(130,270,130,195).lineBetween(130,195,246,195).lineBetween(246,195,246,270);
  for(const p of MAP.pads){g.lineStyle(2,0x7d778f,.6).lineBetween(p.x,p.y,188,285);this.add.text(p.x,p.y+38,p.id==='west'?'西台 · 一 / 三相':'东台 · 二相',{fontSize:'11px',color:'#f2dcb3'}).setOrigin(.5);}
  g.fillStyle(0x9b7854).fillRoundedRect(165,390,45,35,5);g.lineStyle(2,0xdbc191).lineBetween(171,399,204,399);
  this.add.text(188,174,'声门',{fontSize:'11px',color:'#f3ddb4'}).setOrigin(.5);
  this.add.text(188,475,'录制自己 · 留下反拍 · 靠近破盾',{fontSize:'12px',color:'#d3c5df'}).setOrigin(.5);
 }
 dialogTexts(s){return s.phase==='ready'?['让回声敲开司钟','先到西台按E录制，站稳至少0.6秒，再按E回放。回声留台1秒便开启3.8秒破绽；本人靠近司钟自动攻击，也可用技能。每削去90生命强制换相，重新在西→东→西台录制。竖线横躲、横带纵躲、十字斜躲。三相结束后走入上方声门。','开始试演']:s.phase==='paused'?['反拍暂歇','录制、回声、反拍进度、破绽和攻击预告全部冻结。','继续试演']:s.phase==='complete'?['三相司钟已谢幕','三次反拍、每相实际伤害与最终出口均由真实判定记录。','再试一次']:['这一拍没能躲开','回声不会替本人挡伤。先留在指定台录制，再离台靠近司钟；竖线横躲、横带纵躲、十字斜躲。重试从第一相开始。','重新试演']}
 showOverlay(){super.showOverlay();const s=this.run.snapshot();this.ui.querySelector('.prism-save-note').textContent='压轴试演：固定3生命，不计正式成绩与奖励。离开或重试从第一相开始，原有巡演中途记录保留。';if(['complete','failed'].includes(s.phase))this.ui.querySelector('.prism-review').textContent=`反拍 ${s.breaks} 次 · 实伤 ${s.damage}/270 · 受击 ${s.hits} · ${(s.time/1000).toFixed(1)}秒\n`+s.phaseRecords.map(r=>`第${r.stage}相 ${r.damage}伤 / ${r.breaks}反拍 / ${r.hits}受击`).join('；');}
 renderFrame(){
  super.renderFrame();const s=this.run.snapshot(),g=this.field,p=s.player;g.clear();
  if(s.path.length>1){g.lineStyle(2,0xb8dbea,.7).beginPath().moveTo(s.path[0].x,s.path[0].y);for(const q of s.path)g.lineTo(q.x,q.y);g.strokePath();}
  for(const pad of MAP.pads){const active=pad.id===s.requiredPad.id&&!s.gateOpen;g.fillStyle(active?0x47566a:0x272b3d).fillCircle(pad.x,pad.y,27);g.lineStyle(active?3:1,active?0xffdc9a:0x747389).strokeCircle(pad.x,pad.y,26);g.lineStyle(2,0xc4dfe8,active?1:.3).strokeCircle(pad.x,pad.y,13);if(active)g.lineStyle(5,0xc8edf2).beginPath().arc(pad.x,pad.y,31,-Math.PI/2,-Math.PI/2+Math.PI*2*s.matchMs/MAP.matchMs,false).strokePath();}
  if(s.ghost){const e=s.ghost;g.fillStyle(0xbde6f0,.5).fillEllipse(e.x,e.y-12,22,30);g.fillStyle(0xe2f5ff,.9).fillCircle(e.x,e.y-31,8);g.lineStyle(2,0xbbddea).strokeCircle(e.x,e.y,20);}
  if(s.recording)g.lineStyle(3,0xf3c68d).strokeCircle(p.x,p.y,24);
  const e=s.enemy;if(e.hp>0){const metal=s.exposed?0xffd89b:0xa6a1cb;g.fillStyle(0x171a2b).fillEllipse(e.x,e.y+25,77,19);g.fillStyle(metal).fillRoundedRect(e.x-22,e.y-22,44,43,16);g.fillStyle(metal).fillTriangle(e.x-23,e.y+6,e.x-34,e.y+25,e.x+34,e.y+25);g.fillStyle(metal).fillTriangle(e.x+23,e.y+6,e.x-34,e.y+25,e.x+34,e.y+25);g.lineStyle(3,0x302938).strokeEllipse(e.x,e.y+22,60,12);g.fillStyle(0xece4bf).fillCircle(e.x,e.y+25,6);g.fillStyle(0x3d3654).fillRect(e.x-3,e.y-15,6,28);g.lineStyle(s.exposed?2:4,s.exposed?0xffd991:0x9bd8ec,s.exposed?.5:.9).strokeCircle(e.x,e.y,43);
   for(let i=0;i<3;i++){const x=e.x-43+i*30;g.fillStyle(0x161827).fillRoundedRect(x,e.y+50,27,5,2);g.fillStyle(0xf3caae).fillRoundedRect(x,e.y+50,27*Math.max(0,Math.min(1,(e.hp-i*90)/90)),5,2);}
   if(s.exposed)g.lineStyle(4,0xffe0a1).beginPath().arc(e.x,e.y,47,-Math.PI/2,-Math.PI/2+Math.PI*2*s.windowMs/MAP.windowMs,false).strokePath();
  }
  const h=s.hazard;if(h&&h.state!=='rest'){const c=h.state==='active'?0xff869d:0xffd394;g.fillStyle(c,h.state==='active'?.5:.18);if(h.axis!=='horizontal')g.fillRect(h.x-18,165,36,370);if(h.axis!=='vertical')g.fillRect(25,h.y-18,325,36);g.lineStyle(2,c,.9);if(h.axis!=='horizontal')for(let y=180;y<530;y+=24)g.lineBetween(h.x-13,y,h.x+13,y+10);if(h.axis!=='vertical')for(let x=35;x<340;x+=24)g.lineBetween(x,h.y-13,x+10,h.y+13);}
  for(const f of this.flashes)g.lineStyle(f.type==='action'?5:2,0xf2c5e7).lineBetween(f.from.x,f.from.y-15,f.to.x,f.to.y);
  g.lineStyle(4,s.gateOpen?0xffe1a6:0x7e7495).strokeRoundedRect(158,154,60,43,8);
  this.dom.progress.textContent=`第${s.bossStage}/3相 · 司钟 ${s.enemy.hp}/270`;
  this.dom.target.textContent=s.gateOpen?'三相完成 · 走入上方声门':s.exposed?`破绽 ${(s.windowMs/1000).toFixed(1)}秒 · 靠近司钟攻击`:`${s.requiredPad.id==='west'?'西':'东'}台留回声 · 反拍 ${(s.matchMs/1000).toFixed(1)}/1秒`;
  this.dom.hint.textContent=h?.state==='warning'?`${h.axis==='vertical'?'竖线 · 横向躲避':h.axis==='horizontal'?'横带 · 纵向躲避':'十字 · 斜向躲避'} · ${(h.remainingMs/1000).toFixed(1)}秒`:s.recording?'至少0.6秒后按E回放；回声留台，本人前进':s.exposed?'光盾已开 · 每相90生命，换相必须重录':'西 → 东 → 西 · 本人站台不会反拍';
  this.dom.rotate.disabled=s.phase!=='playing'||s.gateOpen;
 }
}
