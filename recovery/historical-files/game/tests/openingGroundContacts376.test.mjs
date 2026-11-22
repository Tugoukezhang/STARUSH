import test from 'node:test';import assert from 'node:assert/strict';
import {openingGroundContact,createOpeningGroundContacts} from '../src/systems/OpeningGroundContacts376.mjs';
import {OLD_STREET_PROPS,OLD_STREET_DEVICES,OldStreetState} from '../src/utils/oldStreetMap.mjs';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';
test('authored first-chapter contacts stay at visible feet, exclude gates and leave map definitions and sight untouched',()=>{
 const before=JSON.stringify({props:OLD_STREET_PROPS,devices:OLD_STREET_DEVICES}),state=new OldStreetState(),blockers=state.blockers(),lines=OLD_STREET_DEVICES.map(d=>state.clearLine({x:500,y:1700},d));
 for(const p of OLD_STREET_PROPS){const c=openingGroundContact(p);if(p.interaction){assert.equal(c,null);continue}assert(c);assert(Math.abs(c.y-p.y)<3);assert(c.x>=p.x-p.width/2&&c.x<=p.x+p.width/2);assert(c.width>0&&c.width<=p.width);assert(c.height<=8);if(p.art==='tree')assert(c.width<=34)}
 assert.equal(JSON.stringify({props:OLD_STREET_PROPS,devices:OLD_STREET_DEVICES}),before);assert.deepEqual(state.blockers(),blockers);assert.deepEqual(OLD_STREET_DEVICES.map(d=>state.clearLine({x:500,y:1700},d)),lines);
});
test('one static graphic draws a bounded three-layer contact per prop and releases with the scene',()=>{
 const ellipses=[];let created=0,destroyed=0,depth;const g={setDepth(n){depth=n;return this},fillStyle(c,a){this.color=c;this.alpha=a;return this},fillEllipse(...points){ellipses.push({points,color:this.color,alpha:this.alpha});return this},destroy(){destroyed++}};
 const result=createOpeningGroundContacts({add:{graphics(){created++;return g}}},OLD_STREET_PROPS);assert.equal(result,g);assert.equal(created,1);assert.equal(depth,.45);assert.equal(ellipses.length,OLD_STREET_PROPS.filter(p=>!p.interaction).length*3);assert(ellipses.every(e=>e.alpha<=.1&&e.points.every(Number.isFinite)));
 const owner=Object.create(OldStreetScene.prototype);owner.groundContacts=result;owner.items=new Map;owner.destroy();owner.destroy();assert.equal(destroyed,1);assert.equal(owner.groundContacts,null);
});
test('invalid or unrelated props create no shadow or graphics allocation',()=>{
 const p=OLD_STREET_PROPS[0];for(const value of[null,{...p,x:NaN},{...p,width:0},{...p,art:'stage'},{...p,interaction:'open'}])assert.equal(openingGroundContact(value),null);assert.equal(createOpeningGroundContacts({add:{graphics(){throw Error('unneeded allocation')}}},[{...p,art:'stage'}]),null);
});
