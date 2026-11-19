// Curriculum training: survival first with few enemies, then ramp density.
// Usage: node tools/train-curriculum.mjs [gensPerPhase] [population] [seconds] [workers] [trials]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const require = await import('node:module').then(m => m.createRequire(import.meta.url));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gens = Number(process.argv[2] || 60), pop = Number(process.argv[3] || 16),
      seconds = Number(process.argv[4] || 45), trials = Number(process.argv[5] || 4),
      nWorkers = Number(process.argv[6] || Math.max(2, os.cpus().length - 4));
global.window = globalThis; global.self = globalThis;
global.document = { getElementById: () => null, documentElement: { style: { setProperty() {} } } };
global.addEventListener = () => {};
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0;
for (const f of ['js/vendor/bitecs.js','js/core.js','js/ecs-world.js','js/brain.js','js/policy.js'])
  vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'), {filename:f});
const SH = global.SH;

class Pool {
  constructor(n){ this.idle=[];this.queue=[];this.pending=new Map();this.next=1;
    for(let i=0;i<n;i++){ const w=new Worker(path.join(root,'tools/train-worker.mjs'));
      w.on('message',m=>{const p=this.pending.get(m.id);if(p){this.pending.delete(m.id);p(m);}this.idle.push(w);this.dispatch();});
      w.on('error',e=>console.error('worker error',e)); this.idle.push(w); } }
  run(task){return new Promise(r=>{const id=this.next++;this.pending.set(id,r);this.queue.push({id,...task});this.dispatch();});}
  dispatch(){while(this.idle.length&&this.queue.length){const w=this.idle.pop(),t=this.queue.shift();w.postMessage(t);}}
  close(){for(const w of [...this.idle])w.terminate();}
}
const pool=new Pool(nWorkers);
let seed=777; const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const clone=o=>JSON.parse(JSON.stringify(o));
function mutate(src,sigma){
  const j=clone(src);
  for(const k of ['w1','b1','w2','b2']) for(let i=0;i<j[k].length;i++) j[k][i]+=(rng()*2-1)*sigma;
  return j;
}
function fitness(s,survival){
  const bottom=(s.bottom||0)/seconds;
  const bp=bottom>.15?(bottom-.15)*200000:0;
  if (survival === true) return -s.hits*40000 - bp + s.score*.2;
  if (survival === 'score') return s.score*2 - s.hits*20000 - bp - (3-s.shield)*1000;
  return s.score*.2 - s.hits*40000 - bp - (3-s.shield)*1000 + (s.hits===0?50000:0);
}
async function evalW(w,level){
  const rs=[];for(let i=0;i<trials;i++)rs.push(await pool.run({kind:'mlp',data:w,seconds,curriculum:level}));
  if(rs.some(r=>r.error))return{score:-1e9,hits:99,shield:0,bottom:seconds};
  return {score:rs.reduce((s,r)=>s+r.score,0)/trials,hits:rs.reduce((s,r)=>s+r.hits,0)/trials,
          shield:rs.reduce((s,r)=>s+r.shield,0)/trials,bottom:rs.reduce((s,r)=>s+r.bottom,0)/trials};
}
let best=clone(SH.POLICY_WEIGHTS);
const phases=process.env.FINAL_ONLY ? [{level:1,survival:true}] : [{level:.25,survival:true},{level:.5,survival:true},{level:.75,survival:true},{level:1,survival:true}];
const t0=Date.now();
for(const ph of phases){
  let cur=clone(best), curFit=fitness(await evalW(cur,ph.level),ph.survival), bestFit=curFit;
  console.log(`\nPHASE level=${ph.level} survival=${ph.survival} seed=${Math.round(bestFit)}`);
  let reheat=1,stagnant=0;
  const T0=25000,Tend=300;
  for(let g=0;g<gens;g++){
    const progress=g/gens, T=T0*Math.pow(Tend/T0,progress)*reheat, sigma=(.2*(1-progress)+.015)*reheat;
    const cands=[clone(cur)];
    for(let k=1;k<pop;k++)cands.push(mutate(k<pop*.2?best:cur,k<pop*.25?sigma*3:sigma));
    const rs=await Promise.all(cands.map(w=>evalW(w,ph.level)));
    let genBest=null,genFit=-Infinity;
    rs.forEach((r,i)=>{const f=fitness(r,ph.survival);if(f>genFit){genFit=f;genBest=cands[i];}});
    if(genBest){
      if(genFit>=curFit||Math.random()<Math.exp((genFit-curFit)/T)){cur=genBest;curFit=genFit;}
      if(genFit>bestFit){bestFit=genFit;best=genBest;stagnant=0;}else stagnant++;
    }
    if(stagnant>25){reheat=Math.min(4,reheat*1.8);cur=clone(best);curFit=bestFit;stagnant=0;console.log(' REHEAT',g);}
    if(g%20===0)console.log(` gen ${g}: best ${Math.round(bestFit)} cur ${Math.round(curFit)} T ${Math.round(T)}`);
  }
  const full=await evalW(best,1);
  console.log(` phase done: full-density score ${Math.round(full.score)} hits ${full.hits} bottom ${full.bottom.toFixed(1)} (${((Date.now()-t0)/1000).toFixed(0)}s)`);
}
fs.writeFileSync(path.join(root,'js/policy.js'),`/* Curriculum-trained MLP. */\nwindow.SH = window.SH || {};\nSH.POLICY_WEIGHTS = ${JSON.stringify(best)};\nSH.POLICY_INFO = { status: 'curriculum' };\n`);
pool.close();
console.log('wrote js/policy.js');
