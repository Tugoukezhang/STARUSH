import { hasPublicProfileWriteAuthority } from './publicRunProgression.mjs';
import {getCompanionQuestion} from './publicCompanionDialogue.mjs';

export const BACKSTAGE_STORAGE_KEY = 'starush.backstage.v1';
export const BACKSTAGE_ROOMS = Object.freeze([
  { id: 'stage', name: '舞台', programs: [
    { id: 'stage-soundcheck', name: '舞台试音' },
    { id: 'stage-blocking', name: '走位确认' },
  ] },
  { id: 'rehearsal', name: '排练室', programs: [
    { id: 'rehearsal-rhythm', name: '节拍排练' },
    { id: 'rehearsal-ensemble', name: '合奏排练' },
  ] },
  { id: 'lounge', name: '休息室', programs: [
    { id: 'lounge-rest', name: '安静休息' },
    { id: 'lounge-review', name: '演出复盘' },
  ] },
].map(room => Object.freeze({ ...room, programs: Object.freeze(room.programs.map(Object.freeze)) })));
export const BACKSTAGE_TOPICS = Object.freeze([
  { id: 'greeting', label: '打个招呼' },
  { id: 'rehearsal', label: '聊聊排练' },
  { id: 'encore', label: '聊聊安可' },
].map(Object.freeze));

const MEMBERS = ['sakura', 'enjo', 'kai'];
const ROOM_IDS = BACKSTAGE_ROOMS.map(room => room.id);
const TOPIC_IDS = BACKSTAGE_TOPICS.map(topic => topic.id);
const MAX_BYTES = 32 * 1024;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));

function createState() {
  return {
    version: 2,
    visits: { sakura: 0, enjo: 0, kai: 0 },
    topics: { sakura: null, enjo: null, kai: null },
    selectedCompanionId: null,
    conversations: { sakura: null, enjo: null, kai: null },
    rooms: Object.fromEntries(BACKSTAGE_ROOMS.map(room => [room.id, {
      memberId: null, programId: room.programs[0].id, prepared: false,
    }])),
  };
}

function validState(state) {
  const current=record(state)&&state.version===2;
  if (!exact(state, current?['version','visits','topics','rooms','selectedCompanionId','conversations']:['version', 'visits', 'topics', 'rooms']) || ![1,2].includes(state.version)
    || !exact(state.visits, MEMBERS) || !exact(state.topics, MEMBERS) || !exact(state.rooms, ROOM_IDS)) return false;
  for (const id of MEMBERS) {
    const count = state.visits[id], topic = state.topics[id];
    if (!Number.isSafeInteger(count) || count < 0 || count > 999
      || (count === 0 ? topic !== null : !TOPIC_IDS.includes(topic))) return false;
  }
  const assigned = new Set();
  for (const definition of BACKSTAGE_ROOMS) {
    const room = state.rooms[definition.id];
    if (!exact(room, ['memberId', 'programId', 'prepared']) || typeof room.prepared !== 'boolean'
      || !definition.programs.some(program => program.id === room.programId)) return false;
    if (room.memberId === null) {
      if (room.prepared) return false;
    } else {
      if (!MEMBERS.includes(room.memberId) || assigned.has(room.memberId)) return false;
      assigned.add(room.memberId);
    }
  }
  if(current){
    if((state.selectedCompanionId!==null&&!MEMBERS.includes(state.selectedCompanionId))||!exact(state.conversations,MEMBERS))return false;
    for(const id of MEMBERS){const c=state.conversations[id];if(c===null)continue;
      if(!exact(c,['topicId','replyId'])||!TOPIC_IDS.includes(c.topicId)||state.visits[id]===0||state.topics[id]!==c.topicId
        ||!getCompanionQuestion(id,c.topicId).choices.some(row=>row.id===c.replyId))return false;
    }
  }
  return true;
}

function decode(raw) {
  if (typeof raw !== 'string' || raw.length >= MAX_BYTES) return null;
  if(new TextEncoder().encode(raw).length>=MAX_BYTES)return null;
  let state;
  try{state=JSON.parse(raw);}catch(error){if(error.name!=='SyntaxError')throw error;return null;}
  if(!validState(state))return null;
  if(state.version===1)return {...state,version:2,selectedCompanionId:null,conversations:{sakura:null,enjo:null,kai:null}};
  return state;
}

// Missing domains are handled by the full-save owner, not silently repaired here.
export function validateBackstageBackup(raw) {
  return decode(raw) !== null;
}

function resolveStorage(storage) {
  try { return storage === undefined ? globalThis.localStorage : storage; }
  catch { return null; }
}

function readProgress(storage) {
  const state = createState();
  try {
    const raw = storage.getItem(BACKSTAGE_STORAGE_KEY);
    if (raw === null) return { status: 'ready', state };
    const decoded = decode(raw);
    return decoded ? { status: 'ready', state: decoded } : { status: 'protected', state };
  } catch { return { status: 'unavailable', state }; }
}

export function loadBackstageProgress(storage) {
  return readProgress(resolveStorage(storage));
}

function validCommand(command) {
  if (!record(command)) return false;
  if(command.type==='select-companion')return exact(command,['type','memberId'])&&MEMBERS.includes(command.memberId);
  if(command.type==='reply')return exact(command,['type','memberId','topicId','replyId'])&&MEMBERS.includes(command.memberId)&&TOPIC_IDS.includes(command.topicId)
    &&getCompanionQuestion(command.memberId,command.topicId).choices.some(row=>row.id===command.replyId);
  if (command.type === 'talk') return exact(command, ['type', 'memberId', 'topicId'])
    && MEMBERS.includes(command.memberId) && TOPIC_IDS.includes(command.topicId);
  if (command.type === 'assign') return exact(command, ['type', 'roomId', 'memberId', 'programId'])
    && MEMBERS.includes(command.memberId)
    && BACKSTAGE_ROOMS.some(room => room.id === command.roomId
      && room.programs.some(program => program.id === command.programId));
  return command.type === 'prepare' && exact(command, ['type', 'roomId']) && ROOM_IDS.includes(command.roomId);
}

export function updateBackstageProgress(command, storage) {
  const target = resolveStorage(storage), loaded = readProgress(target);
  const result = status => ({ status, state: loaded.state });
  if (loaded.status === 'protected') return result('protected');
  if (loaded.status === 'unavailable') return result('storage-error');
  if (!hasPublicProfileWriteAuthority()) return result('write-denied');
  if (!validCommand(command)) return result('invalid-command');
  if(command.type==='reply'){
    const c=loaded.state.conversations[command.memberId];
    if(c!==null&&c.topicId===command.topicId&&c.replyId===command.replyId)return result('unchanged');
  }
  const before = JSON.stringify(loaded.state), next = JSON.parse(before);
  if (command.type === 'talk'||command.type==='reply') {
    next.visits[command.memberId] = Math.min(999, next.visits[command.memberId] + 1);
    next.topics[command.memberId] = command.topicId;
    next.selectedCompanionId=command.memberId;
    next.conversations[command.memberId]=command.type==='reply'?{topicId:command.topicId,replyId:command.replyId}:null;
  } else if(command.type==='select-companion'){
    next.selectedCompanionId=command.memberId;
  } else if (command.type === 'assign') {
    for (const room of Object.values(next.rooms)) {
      if (room.memberId === command.memberId) {
        room.memberId = null;
        room.prepared = false;
      }
    }
    next.rooms[command.roomId] = { memberId: command.memberId, programId: command.programId, prepared: false };
  } else {
    const room = next.rooms[command.roomId];
    if (room.memberId !== null) room.prepared = true;
  }
  const raw = JSON.stringify(next);
  if (raw === before) return result('unchanged');
  if (!hasPublicProfileWriteAuthority()) return result('write-denied');
  try {
    target.setItem(BACKSTAGE_STORAGE_KEY, raw);
    if (target.getItem(BACKSTAGE_STORAGE_KEY) !== raw) return result('storage-error');
    return { status: 'saved', state: next };
  } catch {
    // No pending commands or rollback: a failed readback must not overwrite disk.
    return result('storage-error');
  }
}

const LINES = {
  sakura: {
    greeting: '来啦。我正在做步枪检查，先确认枪械状态，再去排练场，好吗？',
    rehearsal: '瞄准时先稳住站姿。我想把扇面扫射的三条路线看清楚，再练移动中的射击。',
    encore: '返场前我会再检查步枪。扇面扫射也要留心边线，把每一发都落在预想的位置。',
    victory: '最近一次公演已通关。很好，接下来也把每次瞄准做扎实。',
    defeat: '最近一次公演未通关。不必着急，先把枪械检查和瞄准分开练。',
  },
  enjo: {
    greeting: '来了就击个掌！我想试试重锤的落点，先从一记干脆的重音开始！',
    rehearsal: '爆拍不是只比谁用力！收住前半拍，再把重音打准，这段就有劲儿了！',
    encore: '返场当然要热烈！不过先把落点站稳，最后那一下才够响亮！',
    victory: '最近一次公演已通关！漂亮，把这股劲儿带进排练！',
    defeat: '最近一次公演未通关。别急着硬冲，拆开难点再来一轮！',
  },
  kai: {
    greeting: '你好。先检查脚下的空间，再确定起步方向。节奏可以从四拍开始。',
    rehearsal: '我会把突进拆成起步、移动和收步。先校准落脚，再连接下一拍。',
    encore: '返场先确认站位和换气点。保留余力，比仓促加速更可靠。',
    victory: '最近一次公演已通关。结果确认，可以继续校准动作的衔接。',
    defeat: '最近一次公演未通关。先看清一个难点，不必同时修改所有动作。',
  },
};

export function getCompanionLine(memberId, topicId, profile, state) {
  if (!MEMBERS.includes(memberId) || !TOPIC_IDS.includes(topicId)) return null;
  const lines = LINES[memberId];
  const conversation=state.conversations[memberId];
  const body=conversation!==null&&conversation.topicId===topicId
    ?getCompanionQuestion(memberId,topicId).choices.find(row=>row.id===conversation.replyId).response:lines[topicId];
  // Only explicit save facts inform results; visit counts are not shared memories.
  const run = record(profile) && Object.hasOwn(profile, 'lastRun') ? profile.lastRun : null;
  const outcome = record(run) && Object.hasOwn(run, 'victory') && typeof run.victory === 'boolean'
    ? (run.victory ? lines.victory : lines.defeat) : null;
  return outcome ? `${outcome}${body}` : body;
}
