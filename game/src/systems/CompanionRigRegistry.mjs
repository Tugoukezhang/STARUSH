// Explicit PSD2Live companion model registrations. Every field is declared data: nothing is derived from member ids or file names.
// verifiedChannels lists only capabilities visually verified on that exact exported model (see CompanionRigHost RIG_CHANNELS).
const register=({hitAreas,verifiedChannels,...model})=>Object.freeze({...model,hitAreas:Object.freeze(hitAreas),verifiedChannels:Object.freeze(verifiedChannels)});

export const COMPANION_RIGS=Object.freeze({
 // Native head angles slide a separate face off its collar. Only blink remains native;
 // registered shared-surface motion keeps all three meshes connected (not skeletal head turns).
 sakura:register({member:'sakura',model:'rigs/companion-sakura-20261031/sakura.p2lrt',width:853,height:1280,hitAreas:{head:'HitAreaHead',body:'HitAreaBody'},breathDriver:'shared-surface',verifiedChannels:['blink']}),
 // B257 limited candidate: full head turns/tilt expose hair cuts and remain unbound, not silently approximated.
 enjo:register({member:'enjo',model:'rigs/companion-enjo-20261101/enjo.p2lrt',width:1152,height:1664,hitAreas:{head:'HitAreaHead',body:'HitAreaBody'},breathDriver:'isolated',verifiedChannels:['nod','breath','blink']}),
});

export const getCompanionRig=member=>Object.hasOwn(COMPANION_RIGS,member)?COMPANION_RIGS[member]:null;
