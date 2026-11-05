import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as chapter from '../src/systems/ChapterScenePresentation.mjs';
const css=fs.readFileSync(new URL('../src/styles/battleSurface.css',import.meta.url),'utf8');
const fresh=fs.readFileSync(new URL('../src/styles/freshExperience.css',import.meta.url),'utf8');
const scope='#game-container[data-battle-mode="public"]';
function rule(selector){const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=css.match(new RegExp(escaped+'\\s*\\{([^}]+)\\}'));assert(m,selector);return m[1];}
test('public battle status is compact and unframed; meaningful values remain above the map',()=>{
 assert.match(rule(scope+' .cw-objective'),/height:\s*28px/);
 assert.match(rule(scope+' .cw-objective'),/background:\s*transparent/);
 for(const name of ['.mihoyo-player','.heat-card'])assert.match(rule(scope+' '+name),/background:\s*transparent/);
 assert.match(rule(scope+' .mihoyo-player'),/top:\s*40px/);
 assert.match(rule(scope+' #battle-chapter'),/top:\s*78px/);
 assert.match(rule(scope+' #run-build'),/top:\s*78px/);
 const notice=rule(scope+' #battle-notice');assert.match(notice,/top:\s*120px/);assert.match(notice,/width:\s*fit-content/);assert.match(notice,/right:\s*auto/);
 for(const id of ['#hp-value','#heat-level','#wave-text','#round-clock'])assert.doesNotMatch(rule(scope+' '+id),/display:\s*none/);
});
test('public combat styles have one owner; existing touch positions and tracks are preserved',()=>{
 assert.doesNotMatch(fresh,/\[data-battle-mode=["']?public["']?\]/,'later shell CSS must not override combat styling');
 const actions=rule(scope+' .mihoyo-skills');assert.match(actions,/bottom:\s*109px/);assert.match(actions,/right:\s*8px/);
 const button=rule(scope+' .skill-orb');assert.match(button,/width:\s*54px/);assert.match(button,/height:\s*54px/);assert.match(button,/grid-template-columns:\s*16px 24px/);assert.match(button,/background:\s*#26383c/);
 assert.match(css,/mask-image: radial-gradient\(circle 22px at 347px 78px/);
});
test('world label ink agrees for sprites and fallback while diagnostic labels keep their existing palette',()=>{
 assert.equal(typeof chapter.getDeviceLabelInk,'function');
 assert.equal(chapter.getDeviceLabelInk({sceneArt:'speaker'}),'#F6F9F8');
 assert.equal(chapter.getDeviceLabelInk({sceneArt:'speaker',publicStage1Suppressed:true}),'#FFB4CA');
 assert.equal(chapter.getDeviceLabelInk({}),'#293B44');
 assert.equal(chapter.getDeviceLabelInk({publicStage1Suppressed:true}),'#913B55');
});
