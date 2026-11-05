export const RAINCHECK_CHAPTER={
 id:'raincheck',ordinal:4,name:'雨后返场',subtitle:'屋顶广播场 · 把歌送到雨停之后',accent:0x53b9ad,flipX:false,tint:0xffffff,
 revision:1,requires:'encore',sceneId:'rooftop',finalePatterns:['captured-line','momentum-cutoff','captured-line'],
 resources:{ground:'art/rooftop-20261103/neutral.webp',colorGround:'art/rooftop-20261103/color.webp',venue:'art/rooftop-20261103/venue.webp'},
 story:{title:'给没赶上的人',place:'屋顶广播场 · 雨停之后',
  intro:[['旁白','港湾散场后，一张被雨泡皱的纸条留在器材箱上：楼顶的广播还能用吗？我值晚班，没赶上。'],['步枪手','带上小音箱就够了。不是再办一场大演出。'],['重锤手','线路还湿着。两侧先通电，台子要稳住一会儿。同一条串场线接满两站，它就有备用电。'],['机甲剑士','有备用电，你躲开它也不掉拍。雨停了，别急着跑。']],
  midpoint:[['旁白','南侧校音台锁定了频率，排水沟里最后几滴水落下。远处窗台上的收音机亮了一下。'],['重锤手','听得见吗？别光看灯，试着回一句。'],['步枪手','等我数完这一拍。没备用电，一走开就得重数。这回北边先接串场线。'],['机甲剑士','北边还有一台。备用电扛不住干扰，清开了再站稳。']],
  outro:[['旁白','最后的干扰散去，屋顶的歌沿着广播传到街尾。对面值班室有人把窗推开，敲了两下窗框。'],['步枪手','收到了。这次没有错过。'],['重锤手','我收线，你们再唱一句。'],['机甲剑士','慢慢收。今天不赶下一站。']]},
 pacingSteps:['接通两侧屋顶支路','校音1.5秒；同线供电可保留进度','前往广播棚，完成雨后压轴'],
 briefing:{title:'雨后返场 · 屋顶广播场',rule:'先涂满两侧支路，再涂满中央校音台。台子亮起后靠近连续校音1.5秒；离开范围、遮挡或校音台被压制会重置这段校音。先接通本区同线两站串场可储备电力：离开或遮挡保留进度，被压制仍会重置。排水沟不可通行。',goal:'恢复十处广播设施，完成两次校音，再化解广播棚压轴。',progression:'第3、7处主设施完成时，各选择一次本场编排。'},
 encounter:{roles:['stage-cue-emitter','objective-disruptor','spotlight-captain'],labels:['雨后试频','驻点校音','广播合流','屋顶返场'],eventId:null},
 performanceFinale:{patterns:['captured-line','momentum-vector','captured-line'],summary:'三段中有一次按走位预判、两次锁定落点，顺序随串场路线变化；离开弹路，抓住三段后的涂染窗口。'}
};
