import test from 'node:test';import assert from 'node:assert/strict';
import {sampleSwordEchoVisual,SWORD_ECHO_ART} from '../src/systems/SwordEchoField291.mjs';
test('candidate head timing is explicitly retimed, with follow-through and harmless residue',()=>{
 assert.equal(sampleSwordEchoVisual(-1),null);
 assert.equal(sampleSwordEchoVisual(0).frame,0);assert.equal(sampleSwordEchoVisual(199).frame,0);
 for(const [age,frame] of [[200,0],[238,0],[239,1],[245,1],[287,1],[288,2],[290,2],[335,2],[340,2],[341,3],[379,3],[380,4],[420,5],[639,5]])assert.equal(sampleSwordEchoVisual(age).frame,frame);
 assert.equal(sampleSwordEchoVisual(640),null);
 assert(sampleSwordEchoVisual(100).alpha<sampleSwordEchoVisual(200).alpha);
 assert(sampleSwordEchoVisual(500).alpha>sampleSwordEchoVisual(600).alpha);
 assert.equal(SWORD_ECHO_ART.frameWidth,512);assert.equal(SWORD_ECHO_ART.frameHeight,512);
});
