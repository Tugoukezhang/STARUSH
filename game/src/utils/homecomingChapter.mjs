export const HOMECOMING_CHAPTER={
 id:'homecoming',ordinal:5,name:'回港加演',subtitle:'重访港湾 · 留给收工的人',accent:0xea806e,flipX:false,tint:0xffffff,
 revision:1,requires:'raincheck',sceneId:'harbor',finalePatterns:['momentum-cutoff','captured-line','momentum-cutoff'],
 resources:{ground:'art/map-presentation-20261018/encore-neutral.webp',colorGround:'art/map-presentation-20261018/encore-color.webp',venue:'art/chapter-venues-20261024/encore.webp'},
 story:{title:'这一排留给你们',place:'港湾演出场 · 白天回港',
  intro:[['旁白','屋顶广播后的第二天，太阳把码头晒得发白。帆顶还在，第一排却摆满了装卸工的工具箱。'],['重锤手','上回散场，他们替咱们扛了一整夜箱子，一首歌都没听全。今天换我扛，你们坐下。'],['步枪手','今天不用守着灯校音了吧？那我从入口开唱。'],['机甲剑士','不用。一站供一站，跳不了。等追兵踩上线再点灯，让回流替你收拾它们。'],['重锤手','还有码头边的串场灯，挑一边接满两站，北边才放行。这个魔法也打不开，我试过。']],
  midpoint:[['旁白','两侧调音亭都亮了。帆顶下的音箱咳出一声电流，工具箱上的装卸工一起抬起头。'],['重锤手','听见没？这一声是我接的！……行，你们俩也接了。'],['机甲剑士','还早。左边那盏先通，右边才肯亮，别跑反了。'],['步枪手','北边串场线要是还差，我顺路补上。第一句，等灯全亮了再唱。']],
  outro:[['旁白','最后一道杂音散去，日头已经偏西。工具箱上的人没有起身，拍着箱盖，把最后一拍还给舞台。'],['重锤手','这回总算轮到你们坐着听了。箱子归我，谁也别抢。'],['步枪手','以前有人替我留位置。今天这一排，是他们自己坐满的。'],['机甲剑士','等他们拍完再收线。这一轮巡演到这儿，可以慢慢走了。']]},
 pacingSteps:['沿码头逐站通电，接满南区串场','点亮两侧调音亭，再接左灯与右灯','接满北区串场，完成收工加演'],
 briefing:{title:'回港加演 · 重访港湾',rule:'南区：码头集合灯→栈桥侧灯→器材间接线→调度亭接线→中段配电。北区：调音区入口→东西声部（顺序自由）→帆顶左灯→右灯。主设施点亮后沿来路回流，涂染线上的追兵与地面。无需驻点校音；每区另接满同线两站串场，南区齐了才开北区。',goal:'接通十处主设施与四处串场站，前往帆顶完成返场压轴。',progression:'第3、7处主设施完成时，各选择一次本场编排。'},
 encounter:{roles:['stage-cue-emitter','objective-disruptor','spotlight-captain'],labels:['码头再会','顺线通电','双路汇流','收工加演'],eventId:null},
 performanceFinale:{patterns:['momentum-vector','captured-line','momentum-vector'],summary:'压轴首末段按走位预判，中段锁定落点，顺序随串场路线变化；躲开三段声浪后靠近涂染。'}
};
