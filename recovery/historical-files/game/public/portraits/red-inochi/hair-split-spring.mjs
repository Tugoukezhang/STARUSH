// Q73 candidate. Semi-implicit mass/spring/damper, fixed 120 Hz integration.
// Head movement contributes an inertial impulse; no autonomous sine motion.
export class HairSpring {
  constructor(){this.reset();}
  reset(input=0){this.x=Array(7).fill(0);this.v=Array(7).fill(0);this.input=input;this.accumulator=0;}
  impulse(amount=.65){this.v=this.v.map((v,i)=>v+amount*[4,5,6,2,1.7,2.3,5.4][i]);}
  advance(dt,input){
    if(!Number.isFinite(dt)||!Number.isFinite(input))throw Error('Finite physics input required');
    dt=Math.max(0,Math.min(.05,dt));const change=Math.max(-1,Math.min(1,input-this.input));this.input=input;
    this.v=this.v.map((v,i)=>v-change*[3.8,5.2,6.5,2,1.6,2.2,5.8][i]);
    this.accumulator+=dt;const h=1/120,k=[48,32,22,95,115,85,28],d=[7,5.8,4.8,11,12,10,5.2];
    while(this.accumulator>=h){
      const previous=this.x.slice();
      for(let i=0;i<7;i++){
        const parent=i===1?previous[0]:i===2||i===6?previous[1]:0;
        const acceleration=-k[i]*this.x[i]-d[i]*this.v[i]+(i===1||i===2||i===6?9*parent:0);
        this.v[i]+=acceleration*h;this.x[i]+=this.v[i]*h;
        if(Math.abs(this.x[i])>1){this.x[i]=Math.sign(this.x[i]);if(this.x[i]*this.v[i]>0)this.v[i]=0;}
      }
      this.accumulator-=h;
    }
    return this.x.slice();
  }
  snapshot(){return {position:this.x.slice(),velocity:this.v.slice(),accumulator:this.accumulator,input:this.input};}
}
