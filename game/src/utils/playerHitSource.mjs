const COPY=Object.freeze(Object.fromEntries(Object.entries({
 contact:['追击碰撞','拉开身位再反击'],
 emitter:['声浪命中','离开预告弹路'],
 captain:['领舞声浪','离开预告弹路'],
 boss:['压轴声浪','沿预告留出空位'],
 'harbor-ground':['港湾落击','离开锁定红圈'],
 projectile:['弹丸命中',''],
}).map(([kind,[label,hint]])=>[kind,Object.freeze({label,hint})])));
export const describePlayerHitSource=source=>Object.hasOwn(COPY,source?.kind)?COPY[source.kind]:null;

// Exact callback arguments only; copy before existing projectile consumption mutates them.
export function capturePlayerHitSource(scene,projectile=null,enemy=null){
 if(scene?._userCastPresentation!==true||scene._isPublicStage1Round?.()!==true
  ||scene.battleData?.practiceMode||scene.battleData?.defenseMode||scene._isFinaleTrialRound?.())return null;
 const role=enemy?.publicStage1EnemyRole??projectile?.publicPlayerHitRole;
 const kind=enemy?.publicStage1EnemyRole==='unlit-chaser'?'contact'
  :projectile?.publicHarborGroundStrike?'harbor-ground'
  :projectile?.publicStage1FinaleAttack||role==='finale-boss'?'boss'
  :role==='spotlight-captain'?'captain':role==='stage-cue-emitter'?'emitter':projectile?'projectile':'unknown';
 const point=projectile?.publicHarborGroundStrike?.capture??projectile??enemy;
 const position=[point?.x,point?.y].every(Number.isFinite)?Object.freeze({x:point.x,y:point.y}):null;
 return Object.freeze({kind,role:['unlit-chaser','spotlight-captain','stage-cue-emitter','finale-boss'].includes(role)?role:null,
  position,pattern:typeof projectile?.publicStage1EncounterPattern==='string'&&projectile.publicStage1EncounterPattern.length<=48?projectile.publicStage1EncounterPattern:null});
}
