// B245 AI face edits, isolated to eyes/mouth on the exact padded master.
const ART = Object.freeze(Object.fromEntries([
 ['enjo', 394, 244, 330, 330], ['kai', 534, 164, 310, 310],
].map(([id, x, y, width, height]) => [id, Object.freeze({
 id, x, y, width, height,
 blink: `art/menu-expression-20261031/${id}-blink.webp`,
 smile: `art/menu-expression-20261031/${id}-smile.webp`,
})])));

export function getMenuPortraitExpressionArt(id) {
 return Object.hasOwn(ART, id) ? ART[id] : null;
}

export function menuPortraitExpressionPose(pose, {elapsed, reactionAge, area, reduced}) {
 if (reduced) return {...pose, eyelid: 0, blink: false, smileOpacity: 0};
 const reacting = Number.isFinite(reactionAge) && reactionAge >= 0 && reactionAge < 900
  && (area === 'head' || area === 'body');
 const phase = elapsed % 5000;
 // A closed-eye source has no half-open frame: switch it on for a short hold.
 const blink = phase >= 4400 && phase < 4520 || reacting && area === 'head' && reactionAge < 120;
 const smileOpacity = reacting ? Math.sin(Math.PI * reactionAge / 900) ** 2 : 0;
 return {...pose, eyelid: blink ? 1 : 0, blink, smileOpacity};
}
