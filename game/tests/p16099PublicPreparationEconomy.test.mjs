import assert from 'node:assert/strict';
import * as progress from '../src/utils/publicRunProgression.mjs';

assert.equal(typeof progress.trainPublicPerformer, 'function', 'Preparation must have a real persisted training command');
const prep = await import('../src/utils/publicPreparation.mjs');
const {loadPublicProfile, recordPublicRun, trainPublicPerformer, equipPublicPerformer, selectPublicPerformer} = progress;
const {getPreparationResources, getPreparationSnapshot, getPreparationEffects, getOwnedEquipment} = prep;
function storage() {
  let raw = null;
  return { fail:false, getItem:()=>raw, setItem(_key,value){if(this.fail)throw Error('quota');raw=value;},
    replace:value=>{raw=JSON.stringify(value);}, raw:()=>raw };
}
const run = (runId,chapterId='opening',victory=true)=>({runId,chapterId,performerId:'sakura',victory,choices:[],durationMs:60000});
const db=storage();
assert.deepEqual(getPreparationResources(loadPublicProfile(db)),{earned:0,spent:0,balance:0});
assert.equal(trainPublicPerformer('sakura',1,db).preparationStatus,'save-required');
recordPublicRun(run('one'),db);
assert.deepEqual(getPreparationResources(loadPublicProfile(db)),{earned:6,spent:0,balance:6});
assert.deepEqual(getOwnedEquipment(loadPublicProfile(db)).map(x=>x.id),['wide_nozzle','travelling_nozzle']);
recordPublicRun(run('one'),db);
recordPublicRun(run('loss','opening',false),db);
assert.equal(getPreparationResources(loadPublicProfile(db)).balance,6,'Duplicate and defeat grant no notes');
let result=trainPublicPerformer('sakura',1,db);
assert.equal(result.preparationStatus,'trained');
assert.equal(result.preparation.trainingLevels.sakura,2);
assert.deepEqual(getPreparationResources(result),{earned:6,spent:3,balance:3});
assert.equal(trainPublicPerformer('sakura',1,db).preparationStatus,'stale','Repeated click cannot purchase next rank');
assert.equal(trainPublicPerformer('sakura',2,db).preparationStatus,'insufficient');
assert.equal(trainPublicPerformer('unknown',1,db).preparationStatus,'invalid');
assert.equal(equipPublicPerformer('sakura','focus_lens',db).preparationStatus,'locked');
result=equipPublicPerformer('sakura','wide_nozzle',db);
assert.equal(result.preparationStatus,'equipped');
assert.deepEqual(getPreparationEffects(getPreparationSnapshot(result,'sakura'),'sakura'),
  {paintRadiusBonus:12,chargeMultiplier:1,actionPower:1.1});
assert.equal(getPreparationSnapshot(result,'kai').trainingLevel,1);
assert.equal(getPreparationSnapshot(result,'kai').equipmentId,null);
recordPublicRun(run('repeat'),db);
db.fail=true;
const before=db.raw();
assert.equal(trainPublicPerformer('sakura',2,db).preparationStatus,'storage-error');
assert.equal(equipPublicPerformer('sakura',null,db).preparationStatus,'storage-error');
assert.equal(db.raw(),before);
assert.equal(loadPublicProfile(db).preparation.trainingLevels.sakura,2,'Failed writes never queue purchases');
assert.equal(loadPublicProfile(db).preparation.equipmentByPerformer.sakura,'wide_nozzle');
db.fail=false;
result=trainPublicPerformer('sakura',2,db);
assert.equal(result.preparationStatus,'trained');
assert.equal(getPreparationResources(result).balance,0);
assert.equal(trainPublicPerformer('sakura',3,db).preparationStatus,'max-level');
recordPublicRun(run('second','neon'),db);
recordPublicRun(run('third','encore'),db);
assert.equal(getOwnedEquipment(loadPublicProfile(db)).length,4);
equipPublicPerformer('kai','rhythm_sync',db);
assert.equal(getPreparationEffects(getPreparationSnapshot(loadPublicProfile(db),'kai'),'kai').chargeMultiplier,1.15);
equipPublicPerformer('sakura','focus_lens',db);
assert.ok(Math.abs(getPreparationEffects(getPreparationSnapshot(loadPublicProfile(db),'sakura'),'sakura').actionPower-1.38)<1e-9);
assert.equal(getPreparationResources(loadPublicProfile(db)).balance,12);
assert.deepEqual(getPreparationEffects({version:1,performerId:'kai',trainingLevel:99,equipmentId:'focus_lens'},'kai'),
  {paintRadiusBonus:0,chargeMultiplier:1,actionPower:1});
assert.equal(getPreparationEffects(getPreparationSnapshot(loadPublicProfile(db),'sakura'),'kai').actionPower,1);

const legacy=JSON.parse(db.raw());delete legacy.preparation;
const old=storage();old.replace(legacy);
assert.equal(getPreparationResources(loadPublicProfile(old)).balance,21,'Historical clears migrate without inventing new victories');
assert.equal(loadPublicProfile(old).preparation.trainingLevels.sakura,1);
selectPublicPerformer('kai',old);
assert.equal(JSON.parse(old.raw()).preparation.version,1);
for(const mutation of [p=>p.preparation.version=2,p=>p.preparation.trainingLevels.kai=4,
  p=>p.preparation.equipmentByPerformer.kai='not-an-item',p=>delete p.preparation]) {
  const protectedDb=storage();protectedDb.replace(JSON.parse(db.raw()));loadPublicProfile(protectedDb);
  const corrupted=JSON.parse(protectedDb.raw());mutation(corrupted);protectedDb.replace(corrupted);
  const raw=protectedDb.raw();
  assert.equal(trainPublicPerformer('kai',1,protectedDb).preparationStatus,'save-required');
  selectPublicPerformer('venus',protectedDb);
  assert.equal(protectedDb.raw(),raw,'Unknown / corrupt / downgraded preparation must not be overwritten');
}
const freshFuture=storage();const future=JSON.parse(db.raw());future.preparation.version=9;freshFuture.replace(future);
const futureRaw=freshFuture.raw();recordPublicRun(run('future'),freshFuture);assert.equal(freshFuture.raw(),futureRaw);
const pending=storage();recordPublicRun(run('base'),pending);pending.fail=true;recordPublicRun(run('pending'),pending);
assert.equal(trainPublicPerformer('sakura',1,pending).preparationStatus,'save-required');
pending.fail=false;recordPublicRun(run('pending'),pending);
assert.equal(trainPublicPerformer('sakura',1,pending).preparationStatus,'trained');
assert.equal(getPreparationResources(loadPublicProfile(pending)).balance,6);
console.log('Public preparation economy: all assertions passed');
