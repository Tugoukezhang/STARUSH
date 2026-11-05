const charge = value => Number.isFinite(value) ? Math.floor(Math.max(0, Math.min(100, value))) : 0;
const ability = (state, value) => Object.freeze({state, canRelease:state === 'ready', charge:charge(value)});

// Action accepts the original numeric input; Encore deliberately requires a finite number.
export function evaluatePublicBattleAbilities(input = {}) {
  const f = input && typeof input === 'object' ? input : {};
  const special = Number(f.specialCharge);
  const common = f.ended ? 'ended' : f.preparing ? 'preparing' : f.paused ? 'paused' : null;
  const busy = f.choiceOpen || f.specialBusy;
  const available = f.playerPresent === true && f.alive === true && f.paintZoneReady === true && !!f.ownerId && f.ownerId === f.performerId;
  const actionState = common || (!available ? 'unavailable' : busy ? 'busy' : Number.isFinite(special) && special >= 100 ? 'ready' : 'charging');
  const encoreAvailable = available && f.playerReady === true && f.originReady === true && f.publicRound === true && f.ownerId === f.roundPerformerId;
  const encoreState = common || (!encoreAvailable ? 'unavailable' : f.encoreActive ? 'active' : busy ? 'busy' : Number.isFinite(f.encoreCharge) && f.encoreCharge >= 100 ? 'ready' : 'charging');
  return Object.freeze({action:ability(actionState, special), encore:ability(encoreState, f.encoreCharge)});
}

export function getPublicBattleAbilityState(scene, run = scene?.publicPerformerRun) {
  return evaluatePublicBattleAbilities({
    ended:run?.destroyed || scene?._battleEnded,
    preparing:scene?.publicStage1Round?.snapshot?.().phase === 'idle',
    paused:scene?._battlePaused,
    choiceOpen:run?.choiceOpen,
    specialBusy:run?.sakuraCombat?.specialBusy,
    alive:run?.alive?.() === true,
    playerPresent:!!scene?.player,
    originReady:Number.isFinite(scene?.player?.x) && Number.isFinite(scene?.player?.y),
    playerReady:scene?.player?.active === true && scene.player.hp > 0,
    paintZoneReady:!!scene?.paintZone,
    publicRound:scene?._isPublicStage1Round?.() === true,
    performerId:run?.member?.id,
    ownerId:scene?._battlePerformerContract?.publicActionOwnerId,
    roundPerformerId:scene?.publicStage1Round?.getPerformerId?.(),
    specialCharge:scene?._specialCharge,
    encoreCharge:scene?._encoreCharge,
    encoreActive:scene?._isPublicSakuraEncoreWindowActive?.() === true,
  });
}
