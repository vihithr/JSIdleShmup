import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gens = Number(process.argv[2] || 100), pop = Number(process.argv[3] || 16),
      seconds = Number(process.argv[4] || 60), trials = Number(process.argv[5] || 2);
global.window = globalThis; global.self = globalThis;
global.brain = require(path.join(root, 'js/vendor/brain-browser.js'));
global.document = { getElementById: () => null, documentElement: { style: { setProperty() {} } } };
global.addEventListener = () => {};
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0;
for (const f of ['js/vendor/bitecs.js','js/core.js','js/brain.js','js/policy.js'])
  vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'), {filename:f});
const SH = global.SH;

function fitness(s){ return s.score + s.graze*.5 - s.hits*12000 - (3-s.shield)*1500 + (s.hits===0?15000:0); }
class Pool {
  constructor(n){ this.idle=[];this.queue=[];this.pending=new Map();this.next=1;
    for(let i=0;i<n;i++){ const w=new Worker(path.join(root,'tools/train-worker.mjs'));
      w.on('message',m=>{const p=this.pending.get(m.id);if(p){this.pending.delete(m.id);p(m);}this.idle.push(w);this.dispatch();});
      this.idle.push(w); } }
  run(task){return new Promise(r=>{const id=this.next++;this.pending.set(id,r);this.queue.push({id,...task});this.dispatch();});}
  dispatch(){while(this.idle.length&&this.queue.length){const w=this.idle.pop(),t=this.queue.shift();w.postMessage(t);}}
  close(){for(const w of [...this.idle])w.terminate();}
}
const pool = new Pool(Math.max(2, os.cpus().length-4));
async function evalCand(data){const rs=[];for(let i=0;i<trials;i++)rs.push(await pool.run({kind:'brain',data,seconds}));
  if(rs.some(r=>r.error))return{score:-1e9,hits:99,graze:0,shield:0};
  return {score:rs.reduce((s,r)=>s+r.score,0)/trials,hits:rs.reduce((s,r)=>s+r.hits,0)/trials,graze:rs.reduce((s,r)=>s+r.graze,0)/trials,shield:rs.reduce((s,r)=>s+r.shield,0)/trials};}
function clone(o){return JSON.parse(JSON.stringify(o));}
let seed=777;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
function mutate(src,sigma){const j=clone(src);for(const l of j.layers){if(l.weights&&l.weights.length)for(const row of l.weights)for(let i=0;i<row.length;i++)row[i]+=(rng()*2-1)*sigma;if(l.biases)for(let i=0;i<l.biases.length;i++)l.biases[i]+=(rng()*2-1)*sigma;}return j;}

const w=SH.POLICY_WEIGHTS, IN=w.w1.length/w.b1.length, HID=w.b1.length;
const tmp=new brain.NeuralNetwork({activation:'tanh',hiddenLayers:[HID]});
tmp.train([{input:Array(IN).fill(0),output:[0,0]},{input:Array(IN).fill(1),output:[1,1]}],{iterations:2});
let best=tmp.toJSON();
best.sizes=[IN,HID,2];best.inputLookupLength=IN;best.outputLookupLength=2;
best.layers=[{weights:[],biases:[]},{weights:Array.from({length:HID},()=>[]),biases:new Array(HID).fill(0)},{weights:[[],[]],biases:[0,0]}];
for(let h=0;h<HID;h++){best.layers[1].weights[h]=[];for(let i=0;i<IN;i++)best.layers[1].weights[h][i]=w.w1[h*IN+i];best.layers[1].biases[h]=w.b1[h];}
for(let k=0;k<2;k++){best.layers[2].weights[k]=[];for(let h=0;h<HID;h++)best.layers[2].weights[k][h]=w.w2[k*HID+h];best.layers[2].biases[k]=w.b2[k];}
let bestFit=fitness(await evalCand(best));
console.log('seed', Math.round(bestFit), 'sizes', best.sizes);
for(let g=0;g<gens;g++){
  const sigma=.22*(1-g/gens)+.015;
  const cands=[clone(best)];
  for(let k=1;k<pop;k++)cands.push(mutate(best,k<pop*.2?sigma*3:sigma));
  const rs=await Promise.all(cands.map(evalCand));
  rs.forEach((r,i)=>{const f=fitness(r);if(f>bestFit){bestFit=f;best=cands[i];}});
  if(g%10===0)console.log(`gen ${g}: ${Math.round(bestFit)} sigma ${sigma.toFixed(3)}`);
}
fs.writeFileSync(path.join(root,'js/policy-brain.js'),`/* V2 brain.js net: ${gens}x${pop}x${seconds}s, hit penalty 12000. Fitness ${Math.round(bestFit)} */\nwindow.SH = window.SH || {};\nSH.BRAIN_NET_JSON = ${JSON.stringify(best)};\nSH.BRAIN_TANH = true;\n`);
pool.close();
console.log('wrote v2 brain net');
