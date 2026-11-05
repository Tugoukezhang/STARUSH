import { PUBLIC_PERFORMERS,getPublicPerformer } from './publicRunProgression.mjs';
import {USER_CAST_MOTION_BOUNDS,ENJO_WALK_ART,ENJO_HURT_ART,ENJO_REST_ART,KAI_HURT_ART,RIFLE_SHOOT_ART,RIFLE_IDLE_ART,RIFLE_REST_ART,RIFLE_WALK_ART} from './userCastMotionData.mjs';

const BASE='art/user-cast-20261015/';
// IDs preserve existing saves; these are the owner's replacement designs.
export const USER_CAST=Object.freeze([
  {id:'sakura',designId:'cat-rifle',name:'步枪手',actionName:'扇面扫射',actionSummary:'向前方三条路线扫射，留下连续涂色区域',identityMark:'枪'},
  {id:'kai',designId:'mecha-sword',name:'机甲剑士',actionName:'涂色突进',actionSummary:'沿移动方向突进，留下宽幅涂色轨迹，期间仍会受伤',identityMark:'剑'},
  {id:'enjo',designId:'hammer-cat',name:'重锤手',actionName:'重锤爆染',actionSummary:'重锤砸向周围，集中涂染近身区域',identityMark:'锤'},
].map(row=>Object.freeze({...getPublicPerformer(row.id),...row})));

let enabled=false;
export let UI_CAST=PUBLIC_PERFORMERS;
// App boot owns the migration; importing a legacy renderer alone does not activate it.
export function configureUserCast(value){enabled=value===true;UI_CAST=enabled?USER_CAST:PUBLIC_PERFORMERS;}
export function isUserCastEnabled(){return enabled;}

export function getUserCastArt(id){
  const member=USER_CAST.find(row=>row.id===id);if(!member)return null;
  const portrait=BASE+member.designId+'.webp',battle=BASE+member.designId+'-battle.webp';
  return Object.freeze({id,designId:member.designId,key:'user-cast-'+member.designId,battle,
    portrait,victory:portrait,defeat:portrait,avatar:BASE+member.designId+'-avatar.webp',
    width:member.id==='kai'?715:member.id==='enjo'?507:433,height:420,
    motion:Object.freeze({key:'user-motion-'+member.designId,path:'art/three-cast-actions-20261018/'+member.designId+'.webp',
      frameWidth:384,frameHeight:320,originX:member.id==='kai'?240/384:.5,originY:304/320,bounds:USER_CAST_MOTION_BOUNDS[id],
      ...(id==='enjo'?{walk:ENJO_WALK_ART,hurt:ENJO_HURT_ART,rest:ENJO_REST_ART}:id==='sakura'?{shoot:RIFLE_SHOOT_ART,idle:RIFLE_IDLE_ART,rest:RIFLE_REST_ART,walk:RIFLE_WALK_ART}:id==='kai'?{hurt:KAI_HURT_ART}:{})})});
}
export function getPlayablePerformer(id){return USER_CAST.find(row=>row.id===id)||USER_CAST[0];}
export function getUiPerformer(id){return enabled?getPlayablePerformer(id):getPublicPerformer(id);}
export function getDisplayPerformer(id){return enabled?USER_CAST.find(row=>row.id===id)||getPublicPerformer(id):getPublicPerformer(id);}
export function getActiveUserCastArt(id){return enabled?getUserCastArt(id):null;}
