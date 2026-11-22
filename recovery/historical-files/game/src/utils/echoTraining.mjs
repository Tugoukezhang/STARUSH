import {ECHO_SCENES,ECHO_LABELS} from './echoChapter.mjs';
export const ECHO_LESSONS=Object.freeze(ECHO_SCENES.map((scene,i)=>Object.freeze({id:['opening','body','finale'][i],scene,name:ECHO_LABELS[i],description:['录制回放并与回声同时踩亮双台，清除哨兵后进入声门。','实际选择留声路线，用回声依次接通三音阶再击破守卫。','西→东→西反拍，逐相击破司钟并练习三轴预告躲避。'][i]})));
export function canTrainEcho(profile){return !!profile&&profile.persisted===true&&!profile.recovery&&!profile.hasPendingSave&&profile.campaign?.chapterClears?.echo>0}
