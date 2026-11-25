import {getActiveUserCastArt,getUiPerformer} from '../utils/userCast.mjs';

// Two cells from each actor's live performance atlas and a recorded in-game release.
export function appendMemberActionPreview(view,parent,memberId){
  if(!getActiveUserCastArt(memberId))return;
  const member=getUiPerformer(memberId);
  const figure=view.element('figure','member-action-film',undefined,parent);
  figure.dataset.member=memberId;
  figure.setAttribute('aria-label',member.actionName+' · 起手、释放和现场涂色');
  figure.style.setProperty('--actor-film','url("art/menu-plays/'+memberId+'-poses.webp")');
  for(const [index,label] of ['起手','释放','实战'].entries()){
    const shot=view.element('div','member-action-shot',undefined,figure);
    if(index===2){
      const image=view.element('img','member-action-live',undefined,shot);
      image.src='art/menu-plays/'+memberId+'-live.webp';image.alt='';
    }else{
      const pose=view.element('span','member-action-pose',undefined,shot);
      pose.setAttribute('aria-hidden','true');
      pose.style.backgroundPosition=index*100+'% 0';
    }
    view.element('small','',label,shot);
  }
}
