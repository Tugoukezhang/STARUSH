import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cssPath=new URL('../src/styles/preflightProductionV3.css',import.meta.url);
const css=()=>fs.readFileSync(cssPath,'utf8');
test('preflight production styling is a late, owner-only page scope',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert(html.indexOf('preflightProductionV3.css')>html.indexOf('tourProgramV3.css'));
 assert.match(css(),/#game-container #public-shell\[data-cast=owner-three\]\[data-ui-pass=stage-v2\]\[data-inner-family=true\]\[data-page=preflight\]/);
 assert.match(css(),/\.shell-content\[data-preflight-presentation=stage-v3\]/);
});
test('all three existing portrait compositions have bounded natural-ratio canvas geometry',()=>{
 const s=css();assert.match(s,/\.preflight-portrait-stage[^}]*width:100%/);
 assert.match(s,/\.home-portrait-rig[^}]*aspect-ratio:853 \/ 1280/);
 assert.match(s,/\.menu-portrait-motion[^}]*aspect-ratio:1152 \/ 1664/);
 assert.match(s,/\.home-portrait-canvas[^}]*width:100%;height:100%/);
});
test('route segments and six configuration commands are bounded, native and not tile stacks',()=>{
 const s=css();assert.match(s,/\.preflight-route > \.preflight-links[^}]*repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(s,/\.preflight-tools \.preflight-links[^}]*repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(s,/\.preflight-tools \.preflight-links button[^}]*flex-direction:row/);
 assert.match(s,/min-height:44px/);assert(!/font-size:[^;]*vw|letter-spacing:-|data:image|https?:/.test(s));
});
test('empty plan and actual plan share readable unframed bands, not silent defaults',()=>{
 assert.match(css(),/\.preflight-plan-empty/);assert.match(css(),/\.preflight-plan-pair/);
 assert.match(css(),/\[data-action=preflight-select-plan\]/);
});
test('start is a separate fixed-track command and inherited bitmap borders are removed',()=>{
 const s=css();assert.match(s,/\.shell-selection-footer[^}]*grid-template-columns:minmax\(0,1fr\) 132px/);
 assert.match(s,/\[data-action=start\][^}]*border-image:none/);
 assert.match(s,/\[data-action=start\].*::before/);assert.match(s,/content:none/);
});
test('header controls stay legible and reduced motion and compact screens are explicit',()=>{
 const s=css();assert.match(s,/\.shell-header :is\(\.shell-icon-button,\.shell-wallet,button svg,\.shell-wallet strong\)/);
 assert.match(s,/@media\(max-height:600px\)/);assert.match(s,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(s,/:focus-visible/);assert.match(s,/\[hidden\] \{display:none!important;/);
});
