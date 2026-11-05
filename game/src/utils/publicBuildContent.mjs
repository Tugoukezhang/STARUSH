import {PublicRunProgression,getRunChoice} from './publicRunProgression.mjs';
import {PUBLIC_EQUIPMENT,getPreparationEffects,isEquipmentCompatible} from './publicPreparation.mjs';
import {USER_CAST} from './userCast.mjs';

export function combinePublicBuildEffects(run,prepared) {
  return {...run,paintRadiusBonus:run.paintRadiusBonus+prepared.paintRadiusBonus,
    chargeMultiplier:run.chargeMultiplier*prepared.chargeMultiplier,actionPower:run.actionPower*prepared.actionPower};
}

const tactics=Object.freeze({
  'wide_brush:echo':'扩大基础覆盖，再由第三次有效命中的原落点追加补色。回响不追踪移动目标。',
  'wide_brush:overdrive':'先用宽幅覆盖通路，再以强化主动行动集中铺色。普通射击威力不变。',
  'wide_brush:recovery':'用更宽覆盖推进设施，完成必需设施时补回生命。满生命不积存恢复。',
  'relay:echo':'普通攻击命中后向另一目标接力，每第三次有效命中再在原落点回响。两者不递归触发。',
  'relay:overdrive':'普通攻击负责相邻目标接力，主动行动负责集中涂染。主动行动不会额外生成接力链。',
  'relay:recovery':'利用相邻有效目标推进设施，设施真正恢复完成后才补生命。没有邻近目标就没有接力。',
  'tempo:echo':'通过实际战斗事件更快蓄能，同时保留第三次有效命中的落点回响。射速和计时不加快。',
  'tempo:overdrive':'事件充能与主动涂染相互配合。需要主动释放行动，安可充能不受这项蓄能加成。',
  'tempo:recovery':'靠事件蓄能获得行动机会，靠设施完成恢复生命。既不提供护盾，也不会自动释放行动。',
  'fanfire:echo':'普通射击分为三路，真实命中才计入第三次回响；空落点不计数，回响不再生成齐射。',
  'fanfire:overdrive':'普通三路齐射用于铺开覆盖，主动扫射保持原有强化；齐射不把每路威力乘三。',
  'fanfire:recovery':'用三路弹道推进分散目标，设施真实完成后再恢复生命；中央涂染量降为原来的60%。',
});
const roleNotes=Object.freeze({
  sakura:'扫射向前方铺开；范围加成扩大弹道、落点与扫射覆盖，遮挡后仍需换位。',
  kai:'突进会改变落脚位置；范围加成扩大沿途涂染，不延长突进，也不提供无敌。',
  enjo:'重锤集中作用于近身；范围加成扩大落锤覆盖，威力加成不等于远距离命中。',
});
const numeric=value=>String(Math.round(value*10000)/10000);

export function getPublicBuildModel(preparation,performerId,choices=[]) {
  const member=USER_CAST.find(row=>row.id===performerId);
  if(!member||!Array.isArray(choices)||choices.length>2)return null;
  const snapshot=preparation??{version:1,performerId,trainingLevel:1,equipmentId:null};
  if(snapshot.version!==1||snapshot.performerId!==performerId||!Number.isInteger(snapshot.trainingLevel)
    ||snapshot.trainingLevel<1||snapshot.trainingLevel>3
    ||(snapshot.equipmentId!==null&&!isEquipmentCompatible(snapshot.equipmentId,performerId)))return null;
  const growth=new PublicRunProgression({performerId});
  for(const id of choices)if(!growth.choose(id))return null;
  const prepared=getPreparationEffects(snapshot,performerId),effects=combinePublicBuildEffects(growth.effects(),prepared);
  const rows=[{label:'涂染半径加成',value:`+${numeric(effects.paintRadiusBonus)}`},
    {label:'事件行动充能',value:`${numeric(effects.chargeMultiplier)} 倍`},
    {label:'主动涂染倍率',value:`${numeric(effects.actionPower)} 倍`}];
  const equipment=PUBLIC_EQUIPMENT.find(row=>row.id===snapshot.equipmentId);
  const modifies=!!equipment&&(!!equipment.performerId||equipment.behavior===true);
  return Object.freeze({performerId,name:member.name,
    preparation:Object.freeze({version:1,performerId,trainingLevel:snapshot.trainingLevel,equipmentId:snapshot.equipmentId}),
    preparationLabel:`阶位 ${snapshot.trainingLevel} · ${equipment?.name||'未装备配件'}`,
    choices:Object.freeze(growth.choices),effects:Object.freeze(effects),rows:Object.freeze(rows.map(Object.freeze)),
    modification:modifies?Object.freeze({id:equipment.id,name:equipment.name,description:equipment.description}):null,
    roleNote:roleNotes[performerId]+(choices.includes('fanfire')?' 普通射击三列，中路60%、两翼各20%；射击间隔不变，仍会被建筑遮挡。':'')+(modifies?' '+equipment.name+'：'+equipment.description:''),
    tactic:performerId==='kai'&&choices.includes('echo')?'每第三次有效挥剑后，沿当时方向延迟回斩。125范围、140度扇区逐段染色，每个目标最多14点；不追踪、不穿墙。':performerId==='enjo'&&choices.includes('echo')?'每第三次有效命中，从原落锤点向外扩散震波。每个目标最多涂染14点，经过的地面同步染色；墙后不会命中。':tactics[choices.join(':')]||'本场编排尚未选满；已装备配件与训练加成保持生效。',
  });
}

export function getPublicBuildOption(build,id) {
  if(!build)return null;
  const growth=new PublicRunProgression({choices:build.choices,performerId:build.performerId});if(!growth.choose(id))return null;
  const after=getPublicBuildModel(build.preparation,build.performerId,growth.choices);if(!after)return null;
  const before=build.effects,next=after.effects;
  const delta={wide_brush:`涂染半径 +${numeric(before.paintRadiusBonus)} → +${numeric(next.paintRadiusBonus)}`,
    tempo:`事件充能 ${numeric(before.chargeMultiplier)} → ${numeric(next.chargeMultiplier)} 倍`,
    overdrive:`主动涂染 ${numeric(before.actionPower)} → ${numeric(next.actionPower)} 倍`,
    relay:'160 范围内另一目标 +8 涂染',
    echo:build.performerId==='kai'?'每3次有效挥剑 → 延迟回斩':build.performerId==='enjo'?'每3次命中 → 扩散震波':'第3次有效命中后 200ms 补色',recovery:'必需设施完成后恢复 1 生命',fanfire:'普通射击 1列 → 3列'}[id];
  const detail={wide_brush:{sakura:'弹道、落点和扫射覆盖变宽。',kai:'弹道、落点和突进轨迹变宽。',enjo:'弹道、落点和重锤覆盖变宽。'}[build.performerId],
    tempo:'射速、计时与安可不变。',overdrive:'仅主动涂染与覆盖增强，普通射击不变。',
    relay:'无另一有效目标不触发，不递归。',echo:build.performerId==='kai'?'200ms后回斩125范围、140度；每目标14点，不追踪、不穿墙。':build.performerId==='enjo'?'从原落锤点扩散至150范围，每个目标14点；不穿墙、不递归。':'原落点、不追踪；空击不计数，不递归。',
    recovery:'上限 5；满生命不积存，无护盾。',fanfire:'中路60%、两翼各20%；射击间隔不变，遮挡后需换位。'}[id];
  return {id,label:getRunChoice(id,build.performerId).label,delta,detail,after};
}

export function getPublicChoiceReview(build,review) {
  if(!build||!review||typeof review!=='object')return [];
  const labels={relay:'额外接力',echo:'回响释放',tempo:'额外行动充能',recovery:'恢复生命'};
  const rows=[];
  for(const id of build.choices.filter(id=>Object.hasOwn(labels,id))){
    const value=review[id];
    if(!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER||(id!=='tempo'&&!Number.isSafeInteger(value)))return [];
    rows.push({id,label:getRunChoice(id,build.performerId).label,text:labels[id]+' '+Number(value.toFixed(2))+(id==='relay'||id==='echo'?' 次':' 点')+(id==='echo'?'（释放次数，不是命中数）':'')});
  }
  return rows;
}
