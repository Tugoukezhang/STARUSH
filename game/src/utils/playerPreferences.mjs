import {PUBLIC_CHAPTER_IDS,getChapterContent} from './publicChapterContent.mjs';
import {normalizeStoryProgress} from './publicStoryPlayback.mjs';
export const PLAYER_PREFERENCES_KEY = 'starush.player-preferences';
const chapterIds = PUBLIC_CHAPTER_IDS;
const defaults = () => ({ version: 1, muted: false, volume: 1, musicVolume: 0.45, seenChapters: [], seenStoryIntros: [], storyProgress: [] });
function normalize(value, previous = defaults()) {
  return {
    version: 1,
    muted: typeof value?.muted === 'boolean' ? value.muted : previous.muted,
    volume: Number.isFinite(value?.volume) ? Math.max(0, Math.min(1, value.volume)) : previous.volume,
    musicVolume: Number.isFinite(value?.musicVolume) ? Math.max(0, Math.min(1, value.musicVolume)) : previous.musicVolume,
    seenChapters: Array.isArray(value?.seenChapters)
      ? [...new Set(value.seenChapters.filter(id => chapterIds.includes(id)))] : [...previous.seenChapters],
    seenStoryIntros: Array.isArray(value?.seenStoryIntros)
      ? [...new Set(value.seenStoryIntros.filter(id => chapterIds.includes(id)))] : [...previous.seenStoryIntros],
    storyProgress: normalizeStoryProgress(value?.storyProgress===undefined?previous.storyProgress:value.storyProgress),
  };
}

export function validatePlayerPreferencesBackup(raw) {
  try {
    if(typeof raw!=='string'||raw.length>128*1024)return false;
    const value=JSON.parse(raw);
    if(!value||value.version!==1||Object.keys(value).some(k=>!Object.hasOwn(defaults(),k)))return false;
    const canonical=v=>JSON.stringify(v,(_k,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
    return canonical(normalize(value))===canonical({...defaults(),...value});
  }catch{return false;}
}

export class PlayerPreferences {
  constructor(storage = () => globalThis.localStorage) {
    this.storage = storage;
    this.value = defaults();
    this.pending = false;
    this.readOnly = false;
  }
  read() {
    try {
      const raw = this.storage()?.getItem(PLAYER_PREFERENCES_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      this.readOnly = Number(parsed?.version) > 1;
      if (!this.pending && !this.readOnly) this.value = parsed?.version === 1 ? normalize(parsed) : defaults();
    } catch { /* Keep this session's last usable settings when storage is unavailable. */ }
    return normalize(this.value);
  }
  update(patch) {
    this.value = normalize(patch, this.read());
    this.pending = true;
    try {
      const storage = this.storage();
      if (!this.readOnly && typeof storage?.setItem === 'function') {
        storage.setItem(PLAYER_PREFERENCES_KEY, JSON.stringify(this.value));
        this.pending = false;
      }
    } catch { /* Applied in memory; UI must not promise persistence. */ }
    return { value: normalize(this.value), persisted: !this.pending };
  }
  recordStoryProgress(row) {
    const valid=normalizeStoryProgress([row]);
    if(!valid.length)return {accepted:false,value:this.read(),persisted:!this.pending};
    const rows=this.read().storyProgress.filter(entry=>entry.id!==row.id);
    return {...this.update({storyProgress:[...rows,valid[0]]}),accepted:true};
  }
}

export const playerPreferences = new PlayerPreferences();
export function applyPlayerAudioPreferences(sound, preferences) {
  sound?.setVolume?.(preferences.volume);
  sound?.setMute?.(preferences.muted);
  sound?.emit?.('starush-audio-preferences', preferences);
}

export function getChapterBriefing(id) {
 const chapter=getChapterContent(id);if(chapter)return {...chapter.briefing};
 // Preserve the legacy unknown-ID adapter; new authoring uses strict lookup and build validation.
 return {...getChapterContent('opening').briefing,goal:'点亮十盏主灯，再完成压轴演出。'};
}
