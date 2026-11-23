import {getDisplayPerformer,USER_CAST,isUserCastEnabled} from './userCast.mjs';
import {USER_CAST_DOSSIERS,USER_CAST_STORIES} from './userCastStory.mjs';
import {PUBLIC_CHAPTER_IDS,getChapterPrerequisiteIds} from './publicChapterContent.mjs';
const displayNames={'绯樱':'步枪手','苍海':'翡翠风歌','金星':'蔚蓝魔法师','幻夜':'翡翠风歌','炎上':'蔚蓝魔法师'};
const castText=text=>isUserCastEnabled()?text.replace(/绯樱|苍海|金星|幻夜|炎上/g,name=>displayNames[name]):text;
const dossiers={
  sakura:{id:'sakura',name:'绯樱',role:'领唱 / 把第一句唱给街坊',
    motive:'巡演名单上没有这条旧商街。绯樱却记得，第一次敢开口唱歌，是因为唱片店门前有人停下来听。',
    relationship:'她负责把大家带上台；苍海提醒她别抢拍，金星则总能听见她没说出口的紧张。',
    quote:'不用先成为谁期待的样子。先让这一排灯，为我们亮起来。'},
  kai:{id:'kai',name:'苍海',role:'节拍 / 先给同伴留出位置',
    motive:'苍海习惯在开演前走过每一条通道。比起独自抢到最前面，更在意身后的人能不能跟上。',
    relationship:'与绯樱一个催人出发、一个提醒停步；排练时的争执，常常变成台上最稳的一次交接。',
    quote:'不用一直向前冲。停稳这一拍，下一步才有地方落。'},
  venus:{id:'venus',name:'金星',role:'和声 / 接住还没唱完的话',
    motive:'金星会把排练时漏掉的声音记在小本里。这趟巡演，她想让那些总在最后一排的人也有自己的声部。',
    relationship:'她能接住炎上的临时起意，也会把幻夜过于含蓄的建议，翻译成大家听得懂的一句话。',
    quote:'不用每个人都唱主旋律。有人回应，才叫合唱。'},
  genya:{id:'genya',name:'幻夜',role:'回响 / 给安静留一个声部',
    motive:'幻夜喜欢在散场后听空舞台的回声。来到这里，不是为了消除安静，而是找回安静里曾经有人留下的东西。',
    relationship:'金星总能听懂幻夜省略的半句；炎上喜欢把那慢半拍接成意料之外的重音。',
    quote:'先听一会儿。不是所有回声，都会立刻回来。'},
  enjo:{id:'enjo',name:'炎上',role:'重拍 / 把犹豫推过起点',
    motive:'炎上不太会说漂亮的开场白，但愿意第一个搬音箱、最后一个收线。比起漂亮计划，更想让这次演出真的发生。',
    relationship:'与幻夜常常一快一慢，却都不愿丢下任何一个声部；绯樱负责开口，炎上负责给出第一下重拍。',
    quote:'开场不用完美。你唱第一句，我来接第一拍。'},
};
export const CHARACTER_DOSSIERS=Object.freeze(Object.fromEntries(Object.entries(dossiers).map(([id,d])=>[id,Object.freeze(d)])));
export function getCharacterDossier(id){
  const d=CHARACTER_DOSSIERS[id];if(!d)return null;
  if(!isUserCastEnabled()||!USER_CAST.some(row=>row.id===id))return d;
  const member=getDisplayPerformer(id);
  return {...d,...USER_CAST_DOSSIERS[id],name:member.name,role:member.actionName};
}

const stories={
  opening:{title:'旧商街的第一排',place:'旧商街 · 开演之前',
    intro:[['旁白','唱片店门口的旧节目单还贴着，街上的演出装置却失了颜色。露天剧场就在街道另一端。'],['绯樱','第一场不去大舞台。先从这条街开始，好吗？']],
    midpoint:[['旁白','唱片店的橱窗重新有了颜色。装卸门旁的小路，留着街坊从前运送演出器材的痕迹。'],['金星','这里不是没有观众，只是很久没有开场。'],['绯樱','那就把第一排，留给路过的人。']],
    outro:[['旁白','最后一段干扰散去，店面的颜色没有消失。剧场的第一排不再空着。'],['绯樱','原来开场，不是站上台才算。'],['金星','街口的人送来了下一站的消息：霓虹街口，也有灯在等我们。']],
    replies:{sakura:'从唱片店开始，沿街把演出装置接起来。最后，我们在剧场见。',kai:'我先看通路。装卸门打开以后，别急着跑，看看它连向哪里。',venus:'先回应离我们最近的那一盏灯。它亮了，旁边的人才知道我们来了。',genya:'橱窗还留着颜色的痕迹。我们沿着它往前走。',enjo:'好。先把这条街叫醒，音箱交给我。'}},
  neon:{title:'不同颜色的回应',place:'霓虹街口 · 第二站',
    intro:[['旁白','旧商街送来的消息，把队伍带到霓虹街口。失色的招牌沿着街巷延伸，路口还留着演出的干扰。'],['金星','把我们的颜色带过去，让这些招牌重新回应。']],
    midpoint:[['旁白','各自亮起的招牌，渐渐接成了一段完整的旋律。'],['幻夜','不是把不同的声音盖住。是给它们各自的位置。']],
    outro:[['旁白','最后一处失色被修复，街口不再只有一种声音。队伍收到港湾演出场留下的邀请。'],['金星','下一次，不只是我们接住彼此。也让整座舞台接住这首歌。']],
    replies:{sakura:'我来起头。沿着街巷，让路过的人听见我们。',kai:'路口的干扰更密，先留出换位的空间。',venus:'一盏一盏接起来。这一次，和声才是主角。',genya:'听到了。先是近处，再是对面的回应。',enjo:'别怕换拍。错过这一盏，我们换个位置再来。'}},
  encore:{title:'把最后一拍留给大家',place:'港湾演出场 · 终站',
    intro:[['旁白','巡演到了最后一站。失色的甲板通向帆顶舞台，两侧调音亭还在等待回应。'],['苍海','沿途把装置点亮，再去迎接最后一段演出。']],
    midpoint:[['旁白','两侧调音亭先后恢复了颜色。先前各自练习的声部，终于沿着甲板汇向同一座舞台。'],['炎上','最后一段，一起上。']],
    outro:[['旁白','最后一拍落下，港湾演出场的颜色留在灯光里。旧商街和霓虹街口送来的节目单，被并排放在台前。'],['绯樱','我们真的，把这场演出走完了。'],['幻夜','散场以后，回声还会留一会儿。'],['旁白','三站巡演到此落幕。那些重新亮起的地方，已经是这段旅程的一部分。']],
    replies:{sakura:'第一句由我来。后面的声部，交给大家。',kai:'先接稳，再向前。最后一拍不需要抢。',venus:'听见了吗？这次每一个声部都在。',genya:'我会把回响留下，等你们接上最后一句。',enjo:'这次不提前。等信号，我们一起落拍。'}},
};
const phaseNames={intro:'开场',midpoint:'途中',outro:'章尾'};
export function getChapterStory(chapterId,phase,memberId='sakura'){
  if(isUserCastEnabled()&&USER_CAST.some(row=>row.id===memberId)){
    const current=USER_CAST_STORIES[chapterId];
    if(!current||!phaseNames[phase])return null;
    return {id:`${chapterId}:${phase}`,chapterId,phase,title:current.title,place:current.place,label:phaseNames[phase],
      lines:current[phase].map(([speaker,text])=>({speaker,text}))};
  }
  const s=stories[chapterId],d=getCharacterDossier(memberId);
  if(!s||!d||!s[phase])return null;
  const lines=s[phase].map(([speaker,text])=>({speaker:isUserCastEnabled()?displayNames[speaker]||speaker:speaker,text:castText(text)}));
  if(phase==='intro'||phase==='midpoint')lines.push({speaker:d.name,text:phase==='intro'?s.replies[memberId]:d.quote});
  return {id:`${chapterId}:${phase}`,chapterId,phase,title:s.title,place:s.place,label:phaseNames[phase],lines};
}
export function canReadStoryBeat(profile,chapterId,phase){
  const ids=isUserCastEnabled()?PUBLIC_CHAPTER_IDS:Object.keys(stories),index=ids.indexOf(chapterId);
  if(index<0||!phaseNames[phase])return false;
  const cleared=profile?.campaign?.clearedChapterIds||[];
  const prerequisites=isUserCastEnabled()?getChapterPrerequisiteIds(chapterId):ids.slice(0,index);
  return phase==='intro'?prerequisites.every(id=>cleared.includes(id)):cleared.includes(chapterId);
}
export function getReadableStoryEntries(profile){
  return (isUserCastEnabled()?PUBLIC_CHAPTER_IDS:Object.keys(stories)).flatMap(id=>Object.keys(phaseNames).filter(phase=>canReadStoryBeat(profile,id,phase))
    .map(phase=>getChapterStory(id,phase,profile.selectedId||'sakura')));
}
