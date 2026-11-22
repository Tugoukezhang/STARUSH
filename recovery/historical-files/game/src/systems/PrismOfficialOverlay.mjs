import {PublicRunSettlement} from './PublicRunSettlement.mjs';
import {capturePrismResult,getPrismReview} from '../utils/prismReport.mjs';
import {PRISM_CHAPTER} from '../utils/prismChapter.mjs';
import {PRISM_SEQUENCE_LABELS} from '../utils/prismSequence.mjs';
import {PUBLIC_RULESET_ID} from '../utils/releaseIdentity.mjs';
export function showPrismOfficialOverlay(scene){
 const s=scene.run.snapshot(),phase=s.phase,j=scene.chapterRun,o=scene.ui.querySelector('.prism-overlay');o.hidden=phase==='playing';scene.dom.pause.disabled=phase!=='playing';if(o.hidden)return;
 const finished=j.complete,terminal=phase==='failed'||finished;
 if(terminal){const result=capturePrismResult(j,PUBLIC_RULESET_ID);if(result){scene.settlement ||= new PublicRunSettlement(result);scene.settlementResult=scene.settlement.commit();}}
 const story=phase==='ready'?(j.index===0?'intro':j.index===1?'midpoint':null):finished?'outro':null;
 const title=phase==='ready'?`折光花庭 · ${PRISM_SEQUENCE_LABELS[j.index]}`:phase==='paused'?'花庭公演暂停':finished?'折光花庭 · 正式通关':phase==='failed'?'花庭公演暂时中断':PRISM_SEQUENCE_LABELS[j.index]+'已完成';
 const lead=story?PRISM_CHAPTER.story[story].map(([speaker,line])=>speaker+'：'+line).join(' '):phase==='complete'?`段间整备，恢复${Math.min(1,3-s.player.hp)}生命；下一段保留本场角色与记录。`:phase==='failed'?'本次已完成段落仅计入复盘。重试本站会从开场开始一场新公演。':'移动、光路、追光与破盾窗口均已暂停。';
 const tips=scene.dialogTexts?.({...s,phase:'ready'})?.[1]||'靠近西侧棱镜按E转向高台，再让高台接向花台。清除遮光巡游体、持续照射2.4秒后走入出口。';
 o.innerHTML='<section role="dialog" aria-modal="true" aria-labelledby="prism-dialog-title"><small>正式第七章 · 折光花庭</small><h2 id="prism-dialog-title"></h2><p class="prism-explain"></p><p class="prism-rules"></p><p class="prism-review"></p><p class="prism-save-note"></p><button class="prism-primary" type="button"></button><button class="prism-back" type="button">返回巡演</button></section>';
 o.querySelector('h2').textContent=title;o.querySelector('.prism-explain').textContent=lead;o.querySelector('.prism-rules').textContent=phase==='ready'?tips:'';
 const result=scene.settlementResult,review=result?.fieldReport?getPrismReview(result.fieldReport):null;
 o.querySelector('.prism-review').textContent=terminal&&result?`${(result.durationMs/1000).toFixed(1)}秒 · ${result.performance.hitCount}次受击。 ${review.event} ${review.finale}`:`第 ${j.index+1}/3 段 · 生命 ${s.player.hp}/3 · 方向键/WASD移动，E转镜，空格技能`;
 o.querySelector('.prism-save-note').textContent=result?result.persisted?'本场已保存 · 练习笔记 +'+result.reward.notes:'本场尚未保存；重试保存成功后可再演，返回不会抹掉待保存记录。':'固定3生命与角色原始攻击，段间恢复1生命（最多3）。本章无中途续演；离开或失败重试整章，其他章节旧中途记录保留。';
 if(terminal&&!result)o.querySelector('.prism-save-note').textContent='本场结果校验未通过，尚未保存或发放奖励。返回后可重新演出。';
 if(result&&!result.persisted){const retry=document.createElement('button');retry.type='button';retry.dataset.prismSave='retry';retry.textContent='重试保存';retry.addEventListener('click',()=>{scene.settlementResult=scene.settlement.commit();showPrismOfficialOverlay(scene);});o.querySelector('.prism-save-note').after(retry);}
 const primary=o.querySelector('.prism-primary');primary.textContent=phase==='ready'?'开始公演':phase==='paused'?'继续演出':finished?'再演本站':phase==='failed'?'重试本站':'继续 · '+PRISM_SEQUENCE_LABELS[j.index+1];primary.disabled=terminal&&!!result&&!result.persisted;
 primary.addEventListener('click',()=>{scene.clearInput();if(phase==='ready')scene.run.start();else if(phase==='paused')scene.run.resume();else if(phase==='complete'&&!finished&&j.advance())scene.scene.start(j.scene,{official:true,performerId:j.memberId,prismChapterRun:j});else scene.scene.start('PrismGardenScene',{official:true,performerId:scene.member.id});scene.lastPhase=null;primary.blur();});
 o.querySelector('.prism-back').addEventListener('click',()=>scene.scene.start('TitleScene',{suppressDebugAutoStart:true,openPage:'tour'}));primary.focus();
}
