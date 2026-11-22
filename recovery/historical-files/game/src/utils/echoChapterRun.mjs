import {EchoWorkshop} from './echoWorkshop.mjs';import {EchoRelay} from './echoRelay.mjs';import {EchoFinale} from './echoFinale.mjs';import {ECHO_SCENES} from './echoChapter.mjs';
const owners=[EchoWorkshop,EchoRelay,EchoFinale];
export class EchoChapterRun {
 constructor(memberId='sakura'){this.runId=globalThis.crypto?.randomUUID?.()||`echo-${Date.now()}-${Math.random().toString(36).slice(2)}`;this.owner=new EchoWorkshop(memberId);this.memberId=this.owner.memberId;this.index=0;this.completed=[];this.ordinal=8;}
 get scene(){return ECHO_SCENES[this.index]}
 get complete(){return this.index===2&&this.owner.phase==='complete'}
 advance(){if(this.owner.phase!=='complete'||this.index>=2)return false;const finished=this.owner.snapshot(),hp=Math.min(3,finished.player.hp+1);this.completed.push(structuredClone(finished));this.index++;this.owner=new owners[this.index](this.memberId);this.owner.player.hp=hp;return true}
 summary(){const records=[...this.completed.map(s=>structuredClone(s)),this.owner.snapshot()];return {runId:this.runId,chapterId:'echo',contentRevision:1,memberId:this.memberId,index:this.index,phase:this.owner.phase,victory:this.complete,routeId:records[1]?.route||null,records}}
}
