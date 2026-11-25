const DIALOGUES={
 sakura:{
  greeting:{prompt:'步枪检查好了。难得安静下来，先陪我整理装备，还是坐一会儿？',choices:[
   {id:'check-first',label:'我帮你确认装备',response:'那就把备用弹匣递给我吧。检查有人一起做，连这种小事也轻松了不少。'},
   {id:'rest-first',label:'先一起坐一会儿',response:'好，步枪已经锁好保险。窗边那个位置留给你，等杯子里的热气慢慢散掉。'}]},
  rehearsal:{prompt:'移动中的瞄准还想再练一次。你觉得先稳住站姿，还是先走一遍路线？',choices:[
   {id:'steady-first',label:'先把站姿稳下来',response:'嗯，我把重心放低一点。你替我数四拍，先不急着扣下扳机。'},
   {id:'route-first',label:'先走一遍路线',response:'那就先绕过拐角，记住每个能停稳的位置。你在旁边，我就不用一个人反复猜了。'}]},
  encore:{prompt:'扇面扫射的边线检查过了。返场前，你想听我再确认一次，还是把时间留给休息？',choices:[
   {id:'confirm-encore',label:'再确认一次边线',response:'中路和两翼都记下了。我会注意前方的遮挡，不把所有子弹都交给同一个角度。'},
   {id:'rest-encore',label:'把余力留给返场',response:'听你的。先收起检查表，安静等灯亮起来；准备好了，也可以不一直绷着。'}]}
 },
 kai:{
  greeting:{prompt:'风铃已经收好了。这里很安静，你想聊聊下一步，还是先看看窗外？',choices:[
   {id:'check-first',label:'一起确认下一步',response:'那就只确认一件事：下一次起步时，我先看清落脚处。剩下的，不必在这里急着决定。'},
   {id:'rest-first',label:'先看看窗外',response:'好。那道光刚好落在地板边缘。什么也不说地待一会儿，也是不错的安排。'}]},
  rehearsal:{prompt:'我想把突进的动作接顺。先练起步的站姿，还是沿着路线慢慢走？',choices:[
   {id:'steady-first',label:'从稳稳的一步开始',response:'我会先把脚跟落稳，再接下一拍。你数慢一点就好，这一次不追求更快。'},
   {id:'route-first',label:'沿路线慢慢走一遍',response:'好的，拐角留半步余地。等路线熟悉了，再把风铃和脚步接在同一个节奏里。'}]},
  encore:{prompt:'返场的站位已经确认。要再校准一次起步点，还是先给自己留一点余力？',choices:[
   {id:'confirm-encore',label:'再校准一次起步点',response:'起步、转向、收步，顺序不变。谢谢你愿意陪我把这些不起眼的地方也确认清楚。'},
   {id:'rest-encore',label:'先放松一下',response:'明白。我会把风铃放在一边。真正开演之前，可以先不用考虑怎样做得更好。'}]}
 },
 enjo:{
  greeting:{prompt:'魔法书合好啦！你想陪我整理一下书页，还是先占住沙发的好位置？',choices:[
   {id:'check-first',label:'一起整理书页',response:'帮我按住这一页！小鸟总爱把书签叼走，两个人一起找就快多啦。'},
   {id:'rest-first',label:'先占个沙发位置',response:'那我把靠垫给你！书页先合上，现在只要坐下来，听听窗外的声音就好。'}]},
  rehearsal:{prompt:'下一次施法我想接得更顺。先练稳稳的落点，还是先找出场的路线？',choices:[
   {id:'steady-first',label:'先把落点练稳',response:'就照你数的拍子翻页。看，橙色的星纹落在谱架下，连最外圈也清清楚楚！'},
   {id:'route-first',label:'先找出场的路线',response:'那我先绕一圈，不施法！等脚下的路顺了，再把这股劲儿一起带上。'}]},
  encore:{prompt:'书签夹在返场的那一页。要一起核对星纹落点，还是先靠着沙发缓口气？',choices:[
   {id:'confirm-encore',label:'再确认星纹落点',response:'你指的地方正好！我把谱页的星纹描清楚，等灯亮了就从这里展开。'},
   {id:'rest-encore',label:'一起缓口气',response:'收到！书本放好，肩膀放松。热烈不是一直喊着往前冲，休息好了，下一拍才响亮。'}]}
 }
};
for(const topics of Object.values(DIALOGUES)){for(const q of Object.values(topics)){q.choices.forEach(Object.freeze);Object.freeze(q.choices);Object.freeze(q);}Object.freeze(topics);}Object.freeze(DIALOGUES);
// Only validated member/topic identities enter the authored dialogue registry.
export function getCompanionQuestion(memberId,topicId){return DIALOGUES[memberId][topicId];}
