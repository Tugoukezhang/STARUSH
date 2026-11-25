// Face centres in the six 512px busts; align the eyes while keeping the hand gesture in frame.
const faces = Object.freeze({
  sakura: {victory:[.62,.382], defeat:[.65,.408]},
  kai: {victory:[.515,.33], defeat:[.548,.387]},
  enjo: {victory:[.515,.355], defeat:[.525,.404]},
});

export function getCastResultArt(member, victory){
  const state = victory ? 'victory' : 'defeat';
  const [faceX, faceY] = faces[member][state];
  return {src:`art/cast-encounters-20261125/${member}-${state}.webp`, width:512, height:512, head:.303, faceX, faceY};
}
