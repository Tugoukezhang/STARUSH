import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=()=>fs.readFileSync(new URL('../src/systems/CompactMenuPages.mjs',import.meta.url),'utf8');
test('owner menus use dedicated home, inventory and preflight composition',()=>{
  for(const name of ['renderCompactHome','renderCompactInventory','renderCompactPreflight'])assert.match(source(),new RegExp(`export function ${name}`));
});
test('inventory retains explicit equip and detail-sheet commands, no actor carousel',()=>{
  const s=source();assert.match(s,/inventoryFeedback\(member.id,item.equipped\?null:item.id\)/);assert.match(s,/openHierarchySheet/);assert.doesNotMatch(s,/shell-member-strip|localStorage|sessionStorage/);
});
test('preflight keeps route and arrangement inspection secondary with canonical route plans',()=>{
  assert.match(source(),/createPublicRoutePlan/);assert.match(source(),/renderArrangementPlan/);assert.match(source(),/preflight-library/);
});
