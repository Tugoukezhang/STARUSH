export function normalizeBattlePerformerId(value) {
  if (typeof value !== 'string') return null;
  const id = value.trim().toLowerCase();
  return id.length > 0 ? id : null;
}

export function resolveBattlePerformerIdentityContract(
  battleData = {},
  { presentationId } = {}
) {
  const performerId = normalizeBattlePerformerId(battleData.performerId);
  const characterId = normalizeBattlePerformerId(battleData.characterId);
  const teamLeadId = normalizeBattlePerformerId(battleData.team?.[0]?.characterId);
  const resolvedPresentationId = normalizeBattlePerformerId(presentationId);
  const hasHiddenDiagnostic = battleData.practiceMode === true
    || battleData.p15ManualFocusExperiment === true
    || battleData.p15KaiPrototypeExperiment === true
    || battleData.p15IntegratedActionCompositionExperiment === true
    || battleData.p15PerformanceHighPointArcExperiment === true
    || battleData.p15SetlistCueExperiment === true
    || battleData.p15HostileProjectileExperiment === true
    || normalizeBattlePerformerId(battleData.p15PerformerPrototypeId) !== null;
  const isPublicStage1 = Number(battleData.stageId || 1) === 1 && !hasHiddenDiagnostic;
  const identityAligned = performerId !== null
    && performerId === characterId
    && performerId === teamLeadId;
  const presentationAligned = performerId !== null
    && performerId === resolvedPresentationId;
  const publicActionOwnerId = isPublicStage1 && identityAligned && presentationAligned
    ? performerId
    : null;

  return Object.freeze({
    performerId,
    characterId,
    teamLeadId,
    presentationId: resolvedPresentationId,
    isPublicStage1,
    identityAligned,
    presentationAligned,
    publicActionOwnerId,
  });
}

export function isPublicBattleActionOwnedBy(contract, actionOwnerId) {
  const ownerId = normalizeBattlePerformerId(actionOwnerId);
  return ownerId !== null && ownerId === contract?.publicActionOwnerId;
}
