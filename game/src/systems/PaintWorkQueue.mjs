export function finishPaintWork(work) {
  let result;
  do { result=work.next(); } while(!result.done);
  return result.value;
}

// Battle update owns the budget; explicit checkpoint capture owns the urgent drain.
export class PaintWorkQueue {
  constructor({clock=()=>performance.now(),budgetMs=4}={}) {
    this.clock=clock;this.budgetMs=budgetMs;this.jobs=[];this.head=0;this.disposed=false;this.pressureFlushes=0;
  }
  get pending() { return this.jobs.length-this.head; }
  add(work) {
    if(this.disposed)return false;
    if(typeof work?.next!=='function')throw new TypeError('Paint work must be an iterator');
    // Under sustained overload, preserve accepted strokes and bounded memory over the frame budget.
    if(this.pending>=64){
      finishPaintWork(this.jobs[this.head]);this.jobs[this.head++]=null;this.pressureFlushes++;this.compact();
    }
    this.jobs.push(work);return true;
  }
  step() {
    if(this.disposed||!this.pending)return;
    const start=this.clock();let chunks=0;
    do{
      if(this.jobs[this.head].next().done)this.jobs[this.head++]=null;
      chunks++;
    }while(this.pending&&chunks<128&&this.clock()-start<this.budgetMs);
    this.compact();
  }
  drain() {
    if(this.disposed)return;
    while(this.pending){finishPaintWork(this.jobs[this.head]);this.jobs[this.head++]=null;}
    this.compact();
  }
  compact() {
    if(this.head===this.jobs.length){this.jobs.length=0;this.head=0;}
    else if(this.head>=64){this.jobs=this.jobs.slice(this.head);this.head=0;}
  }
  destroy() {
    if(this.disposed)return;
    this.disposed=true;
    for(let i=this.head;i<this.jobs.length;i++)this.jobs[i].return?.();
    this.jobs.length=0;this.head=0;
  }
}
