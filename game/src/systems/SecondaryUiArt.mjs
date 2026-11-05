import {mountPlanningUi270} from './PlanningUiArt270.mjs';
const KEYS=new Set(['growth','library','records','venue','train','apply','confirm','cancel','assign','collapse','first','second','sources','compare','room','preflight','deploy']);
export function mountSecondaryUi(view){
  const page=view.root.querySelector('[data-secondary-page]')?.dataset.secondaryPage;
  if(page&&KEYS.has(page)){
    const title=view.root.querySelector('.shell-brand').querySelector('h1');
    title.replaceChildren();delete title.dataset.uiLetter;title.dataset.secondaryLetter=page;
    title.setAttribute('aria-label',{growth:'成长规划',library:'编排图鉴',records:'演出档案',venue:'场馆'}[page]);
  }
  for(const host of view.root.querySelectorAll('[data-secondary-letter]')){
    const key=host.dataset.secondaryLetter;
    if(!KEYS.has(key))throw new RangeError(`Unknown secondary lettering: ${key}`);
    const img=view.element('img','sec-letter-art',undefined,host);img.alt='';img.draggable=false;img.setAttribute('aria-hidden','true');
    img.src=key==='deploy'?'art/hierarchy-ui-20261101/letters-confirm.webp':key==='train'&&view.page==='workshop'?'art/member-studio-20261101/letter-train.webp':key==='growth'&&view.page==='growth'?'art/member-studio-20261101/letter-growth.webp':`art/secondary-ui-20261101/letter-${key}.webp`;
  }
  if(['records','chapterArchive'].includes(view.page)){
    if(view.page==='records'){
      for(const row of view.root.querySelectorAll('[data-record-chapter]')){
        const heading=row.querySelector('h2');delete heading.dataset.uiLetter;for(const old of heading.querySelectorAll('.ui-letter-art'))old.remove();heading.dataset.archiveLetter='chapter-'+row.dataset.recordChapter;
        const open=row.querySelector('.sec-records-open');open.replaceChildren();const image=view.element('img','archive-open-glyph',undefined,open);image.src='art/hierarchy-ui-20261101/icons-archive.webp';image.alt='';image.draggable=false;image.setAttribute('aria-hidden','true');
      }
      const journal=view.root.querySelector('[data-action=story-journal]');for(const selector of ['img','svg'])for(const old of journal.querySelectorAll(selector))old.remove();journal.classList.remove('ui-icon-command');delete journal.dataset.uiIcon;journal.dataset.archiveLetter='journal';
    }
    const title=view.root.querySelector('.shell-brand').querySelector('h1');title.replaceChildren();delete title.dataset.secondaryLetter;delete title.dataset.uiLetter;title.dataset.archiveLetter=view.page;title.setAttribute('aria-label',view.page==='records'?'演出档案':'章节现场档案');
    if(view.page==='chapterArchive'){
      const guide=view.root.querySelector('.chapter-report-guide');
      if(guide){const cue=view.element('img','archive-disclosure-glyph',undefined,guide.querySelector('summary'));cue.src='art/archive-journal-20261104/chevron.webp';cue.alt='';cue.draggable=false;cue.setAttribute('aria-hidden','true');}
    }
    const keys=new Set(['records','chapterArchive','chapter-opening','chapter-neon','chapter-encore','chapter-raincheck','chapter-homecoming','history','journal','prepare','field','events']);
    for(const host of view.root.querySelectorAll('[data-archive-letter]')){
      const key=host.dataset.archiveLetter;if(!keys.has(key))throw new RangeError('Unknown archive lettering: '+key);
      for(const old of host.querySelectorAll('.sec-letter-art'))old.remove();
      const journalBody=host.closest('[data-archive-studio="289"]')&&!host.closest('.chapter-report-heading');
      const dark=host.closest('.archive-record')||host.closest('.chapter-report-tabs')||journalBody;const img=view.element('img','archive-letter-art',undefined,host);img.alt='';img.draggable=false;img.setAttribute('aria-hidden','true');img.src='art/archive-studio-20261102/letter-'+(dark?'':'light-')+key+'.webp';
      if(key==='chapter-raincheck')img.src=host.closest('[data-archive-studio="289"]')?'art/archive-journal-20261104/raincheck.webp':'art/rooftop-20261103/title.webp';
      if(key==='chapter-homecoming')img.src='art/homecoming-300/title.webp';
    }
  }
  mountPlanningUi270(view);
}
