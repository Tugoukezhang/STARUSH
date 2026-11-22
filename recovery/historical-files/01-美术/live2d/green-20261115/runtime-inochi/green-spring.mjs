// Q82 original 12-channel inertia response. No autonomous oscillation.
export const channels=['Hair:: Upper','Hair:: Middle','Hair:: Tip','Hair:: Fringe Center','Hair:: Fringe Right','Hair:: Cheek','Hair:: Side','Cloth:: Left Hem','Cloth:: Right Hem','Cloth:: Left Tip','Cloth:: Right Tip','Cloth:: Wrist Ribbon'];
export const stiffness=[58,35,24,110,95,88,75,30,38,24,32,48];
export const damping=[8.8,6.3,5.2,13,11.8,11,10,6.6,7.5,5.8,6.5,8.5];
const inertia=[3.5,4.8,5.8,1.4,1.6,1.7,2,3.4,3.8,4.9,4.6,3.1];
export class GreenSpring {
 constructor(){this.reset()}
 reset(input=Array(12).fill(0)){this.x=Array(12).fill(0);this.v=Array(12).fill(0);this.input=input.slice();this.accumulator=0}
 move(input){if(input.length!==12||!input.every(Number.isFinite))throw Error('Twelve finite inputs required');for(let i=0;i<12;i++)this.v[i]-=Math.max(-1,Math.min(1,input[i]-this.input[i]))*inertia[i];this.input=input.slice()}
 impulse(amount=.65){if(!Number.isFinite(amount))throw Error('Finite impulse required');for(let i=0;i<12;i++)this.v[i]+=Math.max(-1,Math.min(1,amount))*inertia[i]}
 advance(dt){if(!Number.isFinite(dt))throw Error('Finite dt required');this.accumulator+=Math.max(0,Math.min(.05,dt));const h=1/120;while(this.accumulator+1e-12>=h){const old=this.x.slice();for(let i=0;i<12;i++){const parent=i===1?old[0]:i===2?old[1]:0;this.v[i]+=(-stiffness[i]*this.x[i]-damping[i]*this.v[i]+7*parent)*h;this.x[i]+=this.v[i]*h;if(Math.abs(this.x[i])>1){this.x[i]=Math.sign(this.x[i]);if(this.x[i]*this.v[i]>0)this.v[i]=0}}this.accumulator-=h}if(!this.moving()){this.x.fill(0);this.v.fill(0);this.accumulator=0}return this.x.slice()}
 moving(){return this.x.some((x,i)=>Math.abs(x)>.0001||Math.abs(this.v[i])>.0001)}
 snapshot(){return {position:this.x.slice(),velocity:this.v.slice(),input:this.input.slice(),accumulator:this.accumulator}}
}
