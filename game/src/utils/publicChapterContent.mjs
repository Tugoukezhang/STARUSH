import {RAINCHECK_CHAPTER} from './raincheckChapter.mjs';
import {HOMECOMING_CHAPTER} from './homecomingChapter.mjs';
// One authored content registration; original IDs and source text are preserved.
const CHAPTERS=[
  {
    "id": "opening",
    "ordinal": 1,
    "name": "星光初演",
    "subtitle": "旧商街 · 唱片店到露天剧场",
    "accent": 16738740,
    "flipX": false,
    "tint": 16777215,
    "finalePatterns": [
      "captured-line",
      "momentum-cutoff",
      "captured-line"
    ],
    "revision": 1,
    "requires": null,
    "sceneId": "oldstreet",
    "resources": {
      "ground": "art/map-presentation-20261018/opening-neutral.webp",
      "colorGround": "art/map-presentation-20261018/opening-color.webp",
      "venue": "art/chapter-venues-20261024/opening.webp"
    },
    "story": {
      "title": "旧商街的第一排",
      "place": "旧商街 · 开演之前",
      "intro": [
        [
          "旁白",
          "唱片店的节目牌褪成了灰色，门前只剩几张叠好的椅子。三人把器材放在路边。"
        ],
        [
          "战术女武神",
          "这块牌以前写过我的名字。先把它擦亮吧。"
        ],
        [
          "蔚蓝魔法师",
          "椅子我来搬，别把第一排也喷了。"
        ],
        [
          "翡翠风歌",
          "装卸门那边还能走。器材有路，开演就不难。"
        ]
      ],
      "midpoint": [
        [
          "旁白",
          "橱窗映出了新的颜色。沿着装卸门旁的小路望去，能看见街尾的露天剧场。"
        ],
        [
          "战术女武神",
          "原来离剧场这么近。以前我只敢站在店门口。"
        ],
        [
          "翡翠风歌",
          "今天往前走一点。我看着后面的路。"
        ],
        [
          "蔚蓝魔法师",
          "音箱接上了，第一排也摆好了。还差你过来。"
        ]
      ],
      "outro": [
        [
          "旁白",
          "干扰退去，剧场前留下了一排亮着的招牌。散落的节目单被收好，背面写着霓虹街口的地址。"
        ],
        [
          "蔚蓝魔法师",
          "真开起来了。明天还搬这些吗？"
        ],
        [
          "战术女武神",
          "搬。下一站也许有人在等。"
        ],
        [
          "翡翠风歌",
          "先把线收好。路上别再绊到自己。"
        ]
      ]
    },
    "pacingSteps": [
      "恢复沿街设施",
      "接通北侧舞台",
      "化解压轴攻击后完成涂染"
    ],
    "briefing": {
      "title": "星光初演 · 旧商街",
      "rule": "攻击会给经过的街面铺上颜色。沿街恢复演出设施，走向露天剧场；靠近装卸门或展板可以互动。",
      "goal": "恢复南街与剧场的十处演出设施，再完成露天压轴。",
      "progression": "点亮第 3、7 盏主灯时，各选择一次本场编排。"
    },
    "encounter": {
      "roles": [
        "stage-cue-emitter",
        "objective-disruptor",
        "spotlight-captain"
      ],
      "labels": [
        "开场校灯",
        "走位升温",
        "压力叠加",
        "压轴追光"
      ],
      "eventId": null
    },
    "performanceFinale": {
      "patterns": [
        "captured-line",
        "momentum-cutoff",
        "captured-line"
      ],
      "summary": "旧街压轴以定点锁定为主，中段加入横向预判；三段后进入涂染窗口。"
    }
  },
  {
    "id": "neon",
    "ordinal": 2,
    "name": "霓虹街口",
    "subtitle": "试听街巷 · 声浪汇入听音广场",
    "accent": 7853763,
    "flipX": false,
    "tint": 16777215,
    "finalePatterns": [
      "momentum-cutoff",
      "captured-line",
      "momentum-cutoff"
    ],
    "revision": 1,
    "requires": "opening",
    "sceneId": "neonstreet",
    "resources": {
      "ground": "art/map-presentation-20261018/neon-neutral.webp",
      "colorGround": "art/map-presentation-20261018/neon-color.webp",
      "venue": "art/chapter-venues-20261024/neon.webp"
    },
    "story": {
      "title": "两边都亮着的街口",
      "place": "霓虹街口 · 第二站",
      "intro": [
        [
          "旁白",
          "霓虹街口两侧的店面各自垂着断开的灯线。路中间的招牌仍然没有回应。"
        ],
        [
          "战术女武神",
          "先试近的这家。另一边交给谁？"
        ],
        [
          "翡翠风歌",
          "我走对面，路口留出来。"
        ],
        [
          "蔚蓝魔法师",
          "我在中间接线。哪边好了，喊一声。"
        ]
      ],
      "midpoint": [
        [
          "旁白",
          "两家店面都恢复了颜色，回应才沿着灯线传到路口。蔚蓝魔法师收起刚才没接通的插头。"
        ],
        [
          "蔚蓝魔法师",
          "难怪刚才不亮。少了哪边都不行。"
        ],
        [
          "翡翠风歌",
          "不是谁走得快，是两边都得接上。"
        ],
        [
          "战术女武神",
          "好，下次我先问一声，不闷头往前喷了。"
        ]
      ],
      "outro": [
        [
          "旁白",
          "最后一块招牌亮起。街口的人把一张港湾节目单夹进器材箱，约好在终场听完这首曲子。"
        ],
        [
          "战术女武神",
          "带上它。别又夹在箱底找不到。"
        ],
        [
          "蔚蓝魔法师",
          "放音箱旁边，肯定忘不了。"
        ],
        [
          "翡翠风歌",
          "港湾的风大，明天先检查支架。"
        ]
      ]
    },
    "pacingSteps": [
      "接通两侧门灯",
      "恢复汇流中枢",
      "停转修正弹路，完成压轴"
    ],
    "briefing": {
      "title": "霓虹街口 · 试听街巷",
      "rule": "无需逐台配色。先接通试听店与咖啡亭，街口中枢才可涂染；北侧两店接通后，广场双灯开放。房屋和隔板会挡住攻击。",
      "goal": "点亮十盏主灯，再完成压轴演出。",
      "progression": "点亮第 3、7 盏主灯时，各选择一次本场编排。"
    },
    "encounter": {
      "roles": [
        "objective-disruptor",
        "stage-cue-emitter",
        "spotlight-captain"
      ],
      "labels": [
        "街口试听",
        "守住声部",
        "交错声浪",
        "合声汇聚"
      ],
      "eventId": "neon-linked-cue"
    },
    "performanceFinale": {
      "patterns": [
        "momentum-cutoff",
        "captured-line",
        "momentum-cutoff"
      ],
      "summary": "霓虹压轴交替预判与定点锁定；末段弹路净空且距离足够时折返，预告后不追踪。"
    }
  },
  {
    "id": "encore",
    "ordinal": 3,
    "name": "终场合奏",
    "subtitle": "港湾甲板 · 合奏点亮帆顶舞台",
    "accent": 16763507,
    "flipX": false,
    "tint": 16777215,
    "finalePatterns": [
      "momentum-cutoff",
      "momentum-cutoff",
      "captured-line"
    ],
    "revision": 1,
    "requires": "neon",
    "sceneId": "harbor",
    "resources": {
      "ground": "art/map-presentation-20261018/encore-neutral.webp",
      "colorGround": "art/map-presentation-20261018/encore-color.webp",
      "venue": "art/chapter-venues-20261024/encore.webp"
    },
    "story": {
      "title": "收线之前",
      "place": "港湾演出场 · 终站",
      "intro": [
        [
          "旁白",
          "甲板尽头是帆顶舞台，两侧调音亭的灯还没亮。器材箱里的三张节目单被风吹得哗哗作响。"
        ],
        [
          "翡翠风歌",
          "先把两侧接好，再上台。别隔着甲板试音。"
        ],
        [
          "战术女武神",
          "我去左边。节目单压住了，不会飞。"
        ],
        [
          "蔚蓝魔法师",
          "右边交给我。今天这只音箱终于能上舞台了。"
        ]
      ],
      "midpoint": [
        [
          "旁白",
          "两侧调音亭恢复了颜色，甲板尽头的舞台灯还在闪烁。三人沿着灯线望向帆顶。"
        ],
        [
          "蔚蓝魔法师",
          "还剩那两盏。喷好就能开场？"
        ],
        [
          "翡翠风歌",
          "还得靠近校准。信号接稳以后，再上台。"
        ],
        [
          "战术女武神",
          "那就慢一点。这一段，我们不抢。"
        ]
      ],
      "outro": [
        [
          "旁白",
          "最后的干扰散去。三张节目单并排压在音箱下，从旧商街到港湾的巡演在这一晚收尾。"
        ],
        [
          "战术女武神",
          "以前有人替我留位置。这回我们把整排都留好了。"
        ],
        [
          "蔚蓝魔法师",
          "还不收线吗？"
        ],
        [
          "翡翠风歌",
          "等一会儿。有人还在听。"
        ],
        [
          "旁白",
          "灯没有熄灭。等掌声慢下来，她们才开始收起器材。"
        ]
      ]
    },
    "pacingSteps": [
      "恢复甲板与调音亭",
      "喷满双灯并近场校准",
      "让出横排，完成终场压轴"
    ],
    "briefing": {
      "title": "终场合奏 · 港湾甲板",
      "rule": "主灯分两段蓄满，无需切换颜色。帆顶舞台双灯喷满后，还需靠近各自灯柱累计校准1秒；离开不丢进度。水边不可通行，运输栏可以收拢。",
      "goal": "点亮十盏主灯，再完成压轴演出。",
      "progression": "点亮第 3、7 盏主灯时，各选择一次本场编排。"
    },
    "encounter": {
      "roles": [
        "stage-cue-emitter",
        "spotlight-captain",
        "objective-disruptor"
      ],
      "labels": [
        "港湾试音",
        "甲板走位",
        "领舞合拍",
        "终场合奏"
      ],
      "eventId": "harbor-cue-relay"
    },
    "performanceFinale": {
      "patterns": [
        "momentum-vector",
        "captured-line",
        "momentum-vector"
      ],
      "summary": "港湾压轴按二维走位预判；首末段弹路净空且距离足够时折返，离开弹路后等回程通过。"
    }
  }
];

export const CHAPTER_ENCOUNTER_EVENTS=Object.freeze({
 'neon-linked-cue':Object.freeze({id:'neon-linked-cue',partner:'stage-cue-emitter',secondary:'stage-cue-emitter',label:'街口联动',hint:'及时涂满干扰者，可取消尚未发出的声浪。'}),
 'harbor-cue-relay':Object.freeze({id:'harbor-cue-relay',partner:'spotlight-captain',secondary:'objective-disruptor',label:'港湾接力',hint:'领舞预告时及时涂满干扰者，可打断这次落击并打开收势窗口。'}),
});
const encounterRoles=['stage-cue-emitter','objective-disruptor','spotlight-captain'];
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export const PUBLIC_CHAPTER_CONTENT=freeze([...CHAPTERS,RAINCHECK_CHAPTER,HOMECOMING_CHAPTER]);
export const PUBLIC_CHAPTER_IDS=Object.freeze(PUBLIC_CHAPTER_CONTENT.map(row=>row.id));
export const CHAPTER_SCENE_IDS=Object.freeze(['oldstreet','neonstreet','harbor','rooftop']);
const stableScenes=Object.freeze({opening:'oldstreet',neon:'neonstreet',encore:'harbor'});
export function getChapterContent(id){return typeof id==='string'?PUBLIC_CHAPTER_CONTENT.find(row=>row.id===id)||null:null;}
export function getChapterPrerequisiteIds(id){
 const row=getChapterContent(id);if(!row)return null;const ids=[],seen=new Set([id]);let parent=row.requires;
 while(parent!==null){const entry=getChapterContent(parent);if(!entry||seen.has(parent))return null;seen.add(parent);ids.push(parent);parent=entry.requires;}
 return ids.reverse();
}

// Authoring/build contract, not a replacement save decoder or runtime state machine.
export function validateChapterContent(chapters=PUBLIC_CHAPTER_CONTENT){
 const errors=[],text=s=>typeof s==='string'&&s.trim().length>0,fail=(id,field)=>errors.push({id,field});
 if(!Array.isArray(chapters)||!chapters.length)return[{id:null,field:'chapters'}];
 for(const[id,sceneId]of Object.entries(stableScenes))if(chapters.find(row=>row?.id===id)?.sceneId!==sceneId)fail(id,'stable-scene-binding');
 const ids=new Set();
 for(const [index,row]of chapters.entries()){
  if(!row||typeof row!=='object'){fail(null,'chapter');continue;}
  const id=row.id;
  if(!text(id)||!/^[a-z][a-z0-9-]*$/.test(id)||ids.has(id))fail(id,'id');ids.add(id);
  if(row.ordinal!==index+1||!Number.isSafeInteger(row.revision)||row.revision<1)fail(id,'revision/ordinal');
  if(row.requires!==(index?chapters[index-1]?.id:null))fail(id,'requires');
  if(!CHAPTER_SCENE_IDS.includes(row.sceneId))fail(id,'sceneId');
  for(const key of ['name','subtitle'])if(!text(row[key]))fail(id,key);
  for(const key of ['accent','tint'])if(!Number.isInteger(row[key])||row[key]<0||row[key]>0xffffff)fail(id,key);
  if(typeof row.flipX!=='boolean')fail(id,'flipX');
  if(!Array.isArray(row.finalePatterns)||row.finalePatterns.length!==3||!row.finalePatterns.every(p=>['captured-line','momentum-cutoff'].includes(p)))fail(id,'finalePatterns');
  const encounter=row.encounter,roles=encounter?.roles,eventId=encounter?.eventId;
  if(!Array.isArray(roles)||roles.length!==3||new Set(roles).size!==3||!roles.every(role=>encounterRoles.includes(role)))fail(id,'encounter.roles');
  if(!Array.isArray(encounter?.labels)||encounter.labels.length!==4||!encounter.labels.every(text))fail(id,'encounter.labels');
  if(eventId!==null&&!Object.hasOwn(CHAPTER_ENCOUNTER_EVENTS,eventId))fail(id,'encounter.eventId');
  if(Array.isArray(roles)&&eventId!==null&&Object.hasOwn(CHAPTER_ENCOUNTER_EVENTS,eventId)){
   const source=roles.indexOf('objective-disruptor'),partner=roles.indexOf(CHAPTER_ENCOUNTER_EVENTS[eventId].partner);
   if(eventId==='neon-linked-cue'?source>=partner:partner>=source)fail(id,'encounter.eventOrder');
  }
  if(!Array.isArray(row.performanceFinale?.patterns)||row.performanceFinale.patterns.length!==3||!row.performanceFinale.patterns.every(p=>['captured-line','momentum-cutoff','momentum-vector'].includes(p)))fail(id,'performanceFinale.patterns');
  if(!text(row.performanceFinale?.summary))fail(id,'performanceFinale.summary');
  if(!row.resources||Object.keys(row.resources).sort().join('|')!=='colorGround|ground|venue')fail(id,'resources.keys');
  for(const key of ['ground','colorGround','venue'])if(typeof row.resources?.[key]!=='string'||!/^art\/[a-zA-Z0-9/_-]+\.webp$/.test(row.resources[key]))fail(id,'resources.'+key);
  if(!Array.isArray(row.pacingSteps)||!row.pacingSteps.length||!row.pacingSteps.every(text))fail(id,'pacingSteps');
  for(const key of ['title','rule','goal','progression'])if(!text(row.briefing?.[key]))fail(id,'briefing.'+key);
  for(const key of ['title','place'])if(!text(row.story?.[key]))fail(id,'story.'+key);
  for(const key of ['intro','midpoint','outro'])if(!Array.isArray(row.story?.[key])||!row.story[key].length||!row.story[key].every(line=>Array.isArray(line)&&line.length===2&&line.every(text)))fail(id,'story.'+key);
 }
 return errors;
}
