import {PUBLIC_CHAPTER_CONTENT} from './publicChapterContent.mjs';
// Current owner-supplied cast. Legacy diagnostic stories stay in publicStory.
export const USER_CAST_DOSSIERS=Object.freeze({
  sakura:Object.freeze({
    motive:'她带着喷涂步枪回到唱片店，想修好门前那块褪色的节目牌。那里曾经有人替她留过一个听歌的位置。',
    relationship:'步枪手负责先把远处的装置接亮，机甲剑士找通路，重锤手带着音箱收尾。她开始学着等同伴到齐再开场。',
    quote:'这回不抢第一句。等你们的灯也亮了，我们一起开始。',
  }),
  kai:Object.freeze({
    motive:'机甲剑士总先走一遍通路。她修过太多临时架起的舞台，知道一道没留好的出口，会让整场演出停下来。',
    relationship:'步枪手看得远，重锤手敢靠近；她站在两人之间，确认每次交接之后都还有退路。',
    quote:'我过去看看。先别跟着冲，等我把位置留出来。',
  }),
  enjo:Object.freeze({
    motive:'重锤手把小音箱带了一路。旧商街欠的一场开演，她想亲手补上，连最后一根松掉的支架也不放过。',
    relationship:'她常催步枪手赶紧试音，却会在机甲剑士检查通路时耐心等着。力气用来搬音箱，不用来催同伴。',
    quote:'锤子先放下。听清信号，再落这一拍。',
  }),
});

export const USER_CAST_STORIES=Object.freeze(Object.fromEntries(PUBLIC_CHAPTER_CONTENT.map(row=>[row.id,row.story])));
