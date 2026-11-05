import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
const css=fs.readFileSync(new URL('../src/styles/companionConversationV3.css',import.meta.url),'utf8');
const owner=fs.readFileSync(new URL('../src/styles/ownerGeneratedUi.css',import.meta.url),'utf8');
const small=css.slice(css.indexOf('@media(max-height:600px)'),css.indexOf('@media(max-width:340px)'));
const loungeOwner=owner.slice(owner.indexOf(' &[data-page=lounge] {'),owner.indexOf(' &[data-page=venue] {'));
const ownerSmall=loungeOwner.slice(loungeOwner.indexOf('@media(max-height:600px)'));
const rule=(source,selector)=>{const start=source.indexOf(selector);assert.ok(start>=0,selector);return source.slice(start,source.indexOf('}',start));};
const px=(block,name)=>{const m=block.match(new RegExp(`(?:^|[;{ ])${name}:(\\d+)px`));assert.ok(m,`${name} in ${block}`);return Number(m[1]);};
// Vertical padding of a shorthand: top + bottom.
const vertical=block=>{const m=block.match(/padding:(\d+)px(?: (\d+)px)?(?: (\d+)px)?/);assert.ok(m,block);return Number(m[1])+Number(m[3]??m[1]);};
const NAV=63;

test('lounge chrome: compact header with native 44px controls and no battle deployment row',()=>{
 const header=rule(css,'& .shell-header {');assert.equal(px(header,'height'),52);assert.ok(px(header,'height')-vertical(header)-2>=44,'44px controls fit inside the header');
 assert.ok(px(rule(small,'& .shell-header {'),'height')-vertical(rule(small,'& .shell-header {'))-2>=44,'small header still holds 44px controls');
 const controls=rule(css,'& .shell-header .shell-icon-button {');for(const name of['width','height','min-width','min-height'])assert.equal(px(controls,name),44,name);
 assert.ok(px(rule(css,'& .shell-brand h1 {'),'line-height')+px(rule(css,'& .shell-brand .shell-eyebrow {'),'line-height')<=44,'title and eyebrow are whole, not clipped');
 assert.equal(rule(css,'& .shell-session-context {'),'& .shell-session-context {display:none;');
 assert.doesNotMatch(owner,/session-context \{display:none/,'the deployment row is removed only by the lounge stylesheet');
});

test('cast strip, dialogue band and contextual dock leave a large portrait room at 375x667 and 320x568',()=>{
 assert.doesNotMatch(rule(loungeOwner,'& .pm-cast-strip {'),/padding/,'strip spacing has one owner');
 const scene=(viewport,s,control)=>viewport-px(rule(s,'& .shell-header {'),'height')-NAV-(44+vertical(rule(s,'& .pm-cast-strip {'))+2)
  -px(rule(s,'& .pm-dialogue {'),'height')-(control+vertical(rule(s,'& .pm-choices {')))-px(rule(s,'& .pm-save-status {'),'min-height');
 const control=Math.max(px(rule(css,'& button.pm-answer[data-owner-ui-skin] {'),'min-height'),px(rule(css,'& button.pm-question-back[data-owner-ui-skin] {'),'min-height'),px(rule(loungeOwner,'& button.pm-topic[data-owner-ui-skin] {'),'min-height'));
 const smallControl=px(rule(ownerSmall,'& :is(button.pm-answer,button.pm-question-back,button.pm-topic)[data-owner-ui-skin] {'),'min-height');
 const regular=scene(667,css,control),compact=scene(568,small,smallControl);
 assert.ok(regular>=300,`375x667 scene ${regular}`);assert.ok(compact>=225,`320x568 scene ${compact}`);
 for(const block of[rule(css,'& .pm-dialogue {'),rule(small,'& .pm-dialogue {')]){const h=px(block,'height');assert.ok(h>=100&&h<=112,`dialogue ${h}`);}
 assert.ok(control>=44&&smallControl>=44);
});

test('dialogue keeps three readable scrollable lines inside the band insets',()=>{
 const head=px(rule(css,'& .pm-dialogue-heading {'),'min-height');
 for(const [s,band] of[[css,rule(loungeOwner,'& .pm-dialogue[data-owner-ui-band] {')],[small,rule(ownerSmall,'& .pm-dialogue[data-owner-ui-band] {')]]){
  const response=rule(s,'& .pm-response {');assert.ok(px(response,'font-size')>=13);assert.equal(px(response,'max-height'),3*px(response,'line-height'));
  assert.ok(vertical(band)+head+px(response,'max-height')<=px(rule(s,'& .pm-dialogue {'),'height'),band);
 }
 assert.match(rule(css,'& .pm-response {'),/overflow-y:auto/);
 assert.doesNotMatch(css+loungeOwner,/\.pm-(response|question|answers|dialogue)[^{]*\{[^}]*display:none/);
});

test('speaker and bounded history share one line; visit count stays native but visually hidden',()=>{
 const ledger=rule(loungeOwner,'& .pm-dialogue-heading .pm-ledger {');assert.match(ledger,/flex-wrap:nowrap/);assert.match(ledger,/overflow:hidden/);
 const hidden=rule(css,'& .pm-ledger [data-companion-visits] {');
 assert.match(hidden,/clip-path:inset\(50%\)/);assert.doesNotMatch(hidden,/display:none|visibility:hidden/);
 assert.match(rule(css,'& .pm-speaker-avatar {'),/width:22px;height:22px/);
});

test('members stay a native strip of whole names; B252 portrait anchors retain the existing scope',()=>{
 assert.match(rule(loungeOwner,'& .pm-cast-option[data-owner-ui-skin] > span {'),/white-space:nowrap/);
 assert.match(rule(loungeOwner,'& button.pm-cast-option[data-owner-ui-skin] {'),/min-height:44px/);
 assert.ok(css.includes('--head-px:70px;--face-top:112px;')&&css.includes('--head-px:58px;--face-top:94px;'));
 for(const value of['--portrait-head:0.2195;--face-x:0.542;--face-y:0.139;',`--portrait-head:${(151/1152).toFixed(6)};--face-x:${(574/1152).toFixed(6)};--face-y:${(325.5/1664).toFixed(6)};`,`--portrait-head:${(148/1152).toFixed(6)};--face-x:${(513.5/1152).toFixed(6)};--face-y:${(338/1664).toFixed(6)};`])assert.ok(css.includes(value),value);
 assert.doesNotMatch(css+loungeOwner,/gradient|& button \{[^}]*transform|& \* \{/);
 assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/button:focus-visible/);
});
