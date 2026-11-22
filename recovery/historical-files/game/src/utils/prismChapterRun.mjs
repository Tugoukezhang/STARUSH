import {PrismOpening} from './prismOpening.mjs';import {PrismBody} from './prismBody.mjs';import {PrismFinale} from './prismFinale.mjs';
import {PRISM_SEQUENCE_SCENES} from './prismSequence.mjs';
const owners=[PrismOpening,PrismBody,PrismFinale];
export class PrismChapterRun {
 constructor(memberId='sakura'){this.runId=globalThis.crypto?.randomUUID?.()||`prism-${Date.now()}-${Math.random().toString(36).slice(2)}`;this.owner=new PrismOpening(memberId);this.memberId=this.owner.memberId;this.index=0;this.completed=[];}
 get scene(){return PRISM_SEQUENCE_SCENES[this.index];}
 get complete(){return this.index===2&&this.owner.phase==='complete';}
 advance(){if(this.owner.phase!=='complete'||this.index>=2)return false;const finished=this.owner.snapshot(),hp=Math.min(3,finished.player.hp+1);this.completed.push(structuredClone(finished));this.index++;this.owner=new owners[this.index](this.memberId);this.owner.player.hp=hp;return true;}
 summary(){const records=[...this.completed.map(s=>structuredClone(s)),this.owner.snapshot()];return {runId:this.runId,chapterId:'prism',contentRevision:1,memberId:this.memberId,index:this.index,phase:this.owner.phase,victory:this.complete,routeId:records[1]?.route||null,records};}
}
