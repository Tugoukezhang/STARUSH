// B296 workshop composition. Written without a shell: not executed by its author.
// Run: node --test tests/trainingPresentation296.test.mjs
// This models layout arithmetic from the shipped CSS values. It does not prove paint: browser QA still owns that.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const css=read('../src/styles/memberTraining263.css').replace(/\r\n/g,'\n');
const growthStart=css.indexOf('#game-container',css.indexOf('[data-page=workshop]{'));
assert.ok(growthStart>0,'workshop and growth blocks are both present');
const workshop=css.slice(0,growthStart).replace(/\/\*[\s\S]*?\*\//g,'');
const growth=css.slice(growthStart);

const stageRule=/\.sec-training-stage\{([^}]*)\}/.exec(workshop)?.[1]??'';
const px=name=>Number(new RegExp(`--tr296-${name}:(\\d+)px`).exec(stageRule)?.[1]);
const actorVars=id=>{
  const rule=new RegExp(`\\.sec-training-stage\\[data-performer=${id}\\]\\{([^}]*)\\}`).exec(workshop)?.[1];
  assert.ok(rule,`${id} has framing variables`);
  const value=name=>Number(new RegExp(`--tr296-${name}:([\\d.]+)`).exec(rule)?.[1]);
  return {ratio:value('ratio'),span:value('span'),top:value('top'),eyeFx:value('eye-fx')};
};

// Estimated from the source art as fractions of each source frame; re-measure if the art is replaced.
const ART={
  sakura:{knee:.61,chin:.2,headLeft:.39,headRight:.65},
  kai:{knee:.68,chin:.2,headLeft:.47,headRight:.76},
  enjo:{knee:.65,chin:.2,headLeft:.47,headRight:.7},
};
const VIEWPORTS=[[320,568],[360,640],[375,667],[390,844],[393,852],[412,915],[430,932],[480,854]];
// Chrome: header 48 + nav 48. Footers: one message row, two message rows, and candidate with deploy.
const CHROME=96,FOOTERS={single:82,wrapped:98,candidate:130};

function frame(id,width,viewportHeight,footer){
  const a=actorVars(id),art=ART[id],rail=px('rail'),pad=px('pad'),stageHeight=viewportHeight-CHROME-footer;
  const height=Math.min(width*1.5,(stageHeight-rail-pad)/a.span),rigWidth=height*a.ratio;
  const left=width*.54-rigWidth*a.eyeFx,top=pad-height*a.top;
  return {height,rigWidth,left,top,railTop:stageHeight-rail,artTop:top+height*a.top,knee:top+height*art.knee,
    chin:top+height*art.chin,headLeft:left+rigWidth*art.headLeft,headRight:left+rigWidth*art.headRight};
}

for(const id of Object.keys(ART))for(const [width,height] of VIEWPORTS)for(const [state,footer] of Object.entries(FOOTERS)){
  test(`framing296: ${id} ${width}x${height} ${state} keeps head, knee and controls clear`,()=>{
    const f=frame(id,width,height,footer),where=JSON.stringify(f);
    assert.ok(f.artTop>=0,`head is not cropped by the stage top: ${where}`);
    assert.ok(f.knee<=f.railTop,`knee stays above the rail: ${where}`);
    assert.ok(f.chin-f.artTop>=56,`head remains a readable size: ${where}`);
    assert.ok(f.headLeft>=12+112,`identity copy clears the head: ${where}`);
    assert.ok(f.headRight<=width-8-48,`tool column clears the head: ${where}`);
    assert.ok(f.left>=-.03*f.rigWidth,`left edge of the figure is not meaningfully cropped: ${where}`);
  });
}

test('stack296: portrait path carries no mask, and stage is the size container for framing',()=>{
  assert.match(workshop,/\.workshop-portrait-stage\{-webkit-mask-image:none;mask-image:none\}/);
  assert.match(stageRule,/container-type:size/);
  assert.match(stageRule,/--tr296-height:min\(150cqw,calc\(\(100cqh - var\(--tr296-rail\) - var\(--tr296-pad\)\) \/ var\(--tr296-span\)\)\)/);
});

test('stack296: both portrait renderers share one frame, including inline-sized rigs',()=>{
  const rule=/:is\(\.menu-portrait-image,\.home-portrait-rig\)\{([^}]*)\}/.exec(workshop)?.[1]??'';
  for(const property of ['left','top','width','height'])assert.match(rule,new RegExp(`(^|;)${property}:[^;]+!important`),property);
  assert.match(rule,/transform:none/);
  assert.match(workshop,/\.menu-portrait-surface\{inset:0;width:100%;height:100%\}/,'static source surface uses stage coordinates');
  assert.doesNotMatch(workshop,/height:88%/,'retired height rule, which did not reach inline-sized rigs');
});

test('stack296: workshop requests the same registered renderer used by roster',()=>{
  const shell=read('../src/systems/PublicShellView.mjs');
  assert.match(shell,/this\.mark\(stage,member,true,\{animate:true\}\);/,'uses existing character renderer, not a new face deformation');
});

test('rail296: compact translucent rail replaces the opaque stretched plate',()=>{
  const rule=/\.sec-training-body\{([^}]*)\}/.exec(workshop)?.[1]??'';
  assert.doesNotMatch(workshop,/member-training-20261103\/console\.webp/);
  assert.match(rule,/background:linear-gradient\(180deg,#0e1b1e[0-9a-f]{2},#0e1b1e[0-9a-f]{2}\)/,'translucent dark surface');
  assert.match(rule,/grid-template-columns:minmax\(0,1fr\) 20px minmax\(0,1fr\)/);
  assert.match(rule,/margin:0/);
  assert.match(workshop,/>\.workshop-effects\{display:contents\}/,'ledger rows join the rail grid');
  assert.match(workshop,/\[data-training-effect=current\]\{grid-column:1;grid-row:2\}/);
  assert.match(workshop,/\[data-training-effect=next\]\{grid-column:3;grid-row:2\}/);
  assert.match(workshop,/\[data-training-effect=cost\]\{grid-column:1\/3;grid-row:3/);
  assert.match(workshop,/>\.workshop-wallet\{grid-column:3;grid-row:3/);
});

test('rail296: blocked and save states keep distinct styling hooks on the dark surfaces',()=>{
  assert.match(workshop,/\.sec-training-body\[data-training-state=insufficient\] :is\(\[data-training-effect=cost\] dd,\.workshop-wallet strong\)\{color:#ff9d8a/);
  assert.match(workshop,/\.shell-preparation-footer\[data-training-state\]:not\(\[data-training-state=ready\]\) \[data-action=train\]\{/);
  assert.match(workshop,/\.shell-preparation-footer\[data-training-state=complete\] \[data-action=train\]\{/);
  assert.match(workshop,/\.shell-preparation-footer\[data-training-state=unsaved\] \.workshop-status\{color:#ffb4a0\}/);
  assert.match(workshop,/\.sec-training-reason\{grid-column:1;grid-row:2/);
  assert.match(workshop,/\.workshop-status\{grid-column:2;grid-row:2/);
  assert.match(workshop,/\.sec-training-body>\[data-action=retry-save\]\{[^}]*min-height:44px/);
});

test('controls296: one AI train command at the bottom, existing tool icons, 44px minimum targets',()=>{
  assert.match(workshop,/\[data-action=train\]\{grid-column:1\/-1;grid-row:1;height:48px;min-height:48px[^}]*member-training-20261103\/command\.webp/);
  const tool=/\.ui-workshop-tools \.ui-icon-command\{([^}]*)\}/.exec(workshop)?.[1]??'';
  assert.ok(Number(/;width:(\d+)px|^width:(\d+)px/.exec(tool)?.slice(1).find(Boolean))>=44,'tool width');
  assert.ok(Number(/min-height:(\d+)px/.exec(tool)?.[1])>=44,'tool height');
  assert.match(workshop,/\.ui-workshop-tools\{right:8px;top:8px/);
  assert.match(workshop,/\.sec-training-deploy\{grid-column:1\/-1;grid-row:3;min-height:44px/);
});

test('scale296: text stays fixed in px, with no viewport units or breakpoints in the workshop block',()=>{
  for(const [,value] of workshop.matchAll(/font-size:([^;}]+)/g))assert.match(value,/^\d+px$/,value);
  assert.doesNotMatch(workshop,/@media|\b\d*\.?\d+(vw|vh|dvh|svh|lvh)\b/);
  assert.doesNotMatch(workshop,/\b(568|640|667|844|852|915|932)px/,'no device heights');
});

test('scope296: growth block keeps its own surfaces and never takes the workshop framing',()=>{
  assert.match(growth,/^#game-container #public-shell\[[^\n]*\[data-page=growth\]\{/);
  assert.ok(growth.includes(".sec-growth-compare{padding:10px 14px 12px;background:url('/art/thin-ui-20261101/panel.webp')"));
  assert.ok(growth.includes(".planning-command-footer[data-plan-state=current]>.workshop-status{color:#8bd8c8}"));
  assert.doesNotMatch(growth,/--tr296-/);
});
