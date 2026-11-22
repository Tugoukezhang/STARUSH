import {PRISM_OBJECTIVES} from './prismChapter.mjs';
import { OLD_STREET_DEVICES } from './oldStreetMap.mjs';
import { NEON_STREET_DEVICES } from './neonStreetMap.mjs';
import { HARBOR_STAGE_DEVICES } from './harborStageMap.mjs';
import { ROOFTOP_DEVICES } from './rooftopMap.mjs';
import {PUBLIC_CHAPTER_CONTENT} from './publicChapterContent.mjs';

export const PUBLIC_CHAPTER_COLORS = Object.freeze({pink:'粉',blue:'蓝',yellow:'黄',purple:'紫',orange:'橙'});
export const PUBLIC_CHAPTER_SCENES=Object.freeze({oldstreet:OLD_STREET_DEVICES,neonstreet:NEON_STREET_DEVICES,harbor:HARBOR_STAGE_DEVICES,rooftop:ROOFTOP_DEVICES});

export const PUBLIC_CHAPTERS=Object.freeze(PUBLIC_CHAPTER_CONTENT.map(content=>{
  const {revision,requires,sceneId,resources,story,pacingSteps,briefing,encounter,performanceFinale,...chapter}=content;
  return Object.freeze({...chapter,devices:PUBLIC_CHAPTER_SCENES[sceneId]});
}));

export function getPublicChapter(id) {
  return PUBLIC_CHAPTERS.find(chapter=>chapter.id===id) || PUBLIC_CHAPTERS[0];
}
export function getNextPublicChapterId(id) {
  const index=PUBLIC_CHAPTERS.findIndex(chapter=>chapter.id===id);
  return index<0 ? null : PUBLIC_CHAPTERS[index+1]?.id || null;
}
export function getBattleChapter(data={}) {
  return getPublicChapter(data.practiceMode===true || Number(data.stageId || 1)!==1 ? null : data.campaignChapterId);
}

// Preserve chapter phase progress/IDs; performer-policy fixtures do not demand palette input.
export function resolveChapterPaintHit(device, amount, color) {
  const sequence=device.colorSequence || [];
  const sequenceIndex=Math.max(0,Number(device.sequenceIndex) || 0);
  const previous={accepted:false,paint:Number(device.paint)||0,sequenceIndex,complete:device.complete===true};
  if(previous.complete || !Number.isFinite(amount) || amount<=0
    || (device.paintPolicy==='performer' && !Object.hasOwn(PUBLIC_CHAPTER_COLORS,color))
    || (device.paintPolicy!=='performer' && sequence.length && sequence[sequenceIndex]!==color)) return previous;
  const paint=Math.min(device.paintMax,previous.paint+amount);
  if(paint<device.paintMax) return {...previous,accepted:true,paint};
  if(sequenceIndex+1<sequence.length) return {accepted:true,paint:0,sequenceIndex:sequenceIndex+1,complete:false};
  return {accepted:true,paint,sequenceIndex,complete:true};
}

export function getCumulativeChapterPaintProgress(device) {
  if (device.complete) return 1;
  const phases = Math.max(1, device.colorSequence?.length || 0);
  const phase = Math.max(0, Math.min(phases - 1, Number(device.sequenceIndex) || 0));
  const progress = Math.max(0, Math.min(1, (Number(device.paint) || 0) / (Number(device.paintMax) || 1)));
  return (phase + progress) / phases;
}

export function getChapterDeviceLabel(device) {
  const label=typeof device.label==='string' ? device.label : device.sourceLabel || '';
  const sequence=device.colorSequence || [];
  if(!sequence.length || device.paintPolicy==='performer') return label;
  const current=PUBLIC_CHAPTER_COLORS[sequence[device.sequenceIndex || 0]] || '';
  const phase=sequence.length>1 ? ` ${Number(device.sequenceIndex || 0)+1}/${sequence.length}` : '';
  return `${label}\n${current}${phase}`;
}
