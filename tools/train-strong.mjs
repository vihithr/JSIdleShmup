// Strong, parallel training with a huge hit penalty.
// Usage: node tools/train-strong.mjs [generations] [population] [seconds] [workers]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gens = Number(process.argv[2] || 250);
const pop = Number(process.argv[3] || 24);
const seconds = Number(process.argv[4] || 90);
const workers = Number(process.argv[5] || Math.max(2, os.cpus().length - 4));
const trials = Number(process.argv[6] || 1);
const HIT_PENALTY = Number(process.env.HIT_PENALTY || 20000);

global.window = globalThis;
global.self = globalThis;
global.brain = require(path.join(root, 'js/vendor/brain-browser.js'));
global.document = { getElementById: () => null, documentElement: { style: { setProperty() {} } } };
global.addEventListener = () => {};
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0;
for (const f of ['js/vendor/bitecs.js', 'js/core.js', 'js/brain.js', 'js/policy.js'])
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
const SH = global.SH;

/* Hitting anything is catastrophic: a single hit costs 8,000 points,
   roughly a tenth of a perfect 90-second run. Staying untouched pays 10,000. */
function fitness(s) {
  const bottom = (s.bottom || 0) / seconds;
  const bottomPenalty = bottom > .2 ? (bottom - .2) * 300000 : 0;
  return s.score - s.hits * HIT_PENALTY - bottomPenalty - (3 - s.shield) * 1000 + (s.hits === 0 ? 20000 : 0);
}
async function evaluate(kind, data) {
  const rs = [];
  for (let i = 0; i < trials; i++) rs.push(await pool.run({ kind, data, seconds }));
  if (rs.some(r => r.error)) return { error: rs.find(r => r.error).error, score: -1e9, hits: 99, graze: 0, shield: 0 };
  return {
    score: rs.reduce((s, r) => s + r.score, 0) / trials,
    hits: rs.reduce((s, r) => s + r.hits, 0) / trials,
    graze: rs.reduce((s, r) => s + r.graze, 0) / trials,
    shield: rs.reduce((s, r) => s + r.shield, 0) / trials
  };
}

class Pool {
  constructor(n) {
    this.idle = []; this.queue = []; this.pending = new Map(); this.next = 1;
    for (let i = 0; i < n; i++) {
      const w = new Worker(path.join(root, 'tools/train-worker.mjs'));
      w.on('message', msg => {
        const p = this.pending.get(msg.id);
        if (p) { this.pending.delete(msg.id); p(msg); }
        this.idle.push(w); this.dispatch();
      });
      w.on('error', e => console.error('worker error', e));
      this.idle.push(w);
    }
  }
  run(task) {
    return new Promise(resolve => {
      const id = this.next++;
      this.pending.set(id, resolve);
      this.queue.push({ id, ...task });
      this.dispatch();
    });
  }
  dispatch() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop(), task = this.queue.shift();
      w.postMessage(task);
    }
  }
  close() { for (const w of [...this.idle]) w.terminate(); }
}
const pool = new Pool(workers);

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const random = rng(90125);
const clone = o => JSON.parse(JSON.stringify(o));
function mutate(src, sigma, sizes) {
  const j = clone(src);
  const keys = sizes === 'mlp' ? ['w1', 'b1', 'w2', 'b2'] : null;
  if (keys) for (const k of keys) for (let i = 0; i < j[k].length; i++) j[k][i] += (random() * 2 - 1) * sigma;
  else for (const layer of j.layers) {
    if (layer.weights && layer.weights.length) for (const row of layer.weights) for (let i = 0; i < row.length; i++) row[i] += (random() * 2 - 1) * sigma;
    if (layer.biases) for (let i = 0; i < layer.biases.length; i++) layer.biases[i] += (random() * 2 - 1) * sigma;
  }
  return j;
}

/* Simulated-annealing ES: accept worse candidates early with probability
   exp(delta/T), cool T geometrically, and reheat on stagnation. */
async function evolveTracked(kind, elite, label) {
  let current = clone(elite);
  let currentFit = fitness(await evaluate(kind, current));
  let best = clone(current), bestFit = currentFit;
  console.log(`${label} seed fitness ${Math.round(bestFit)}`);
  const T0 = 30000, Tend = 250;
  let reheat = 1, stagnant = 0;
  const t0 = Date.now();
  for (let g = 0; g < gens; g++) {
    const progress = g / gens;
    const T = T0 * Math.pow(Tend / T0, progress) * reheat;
    const sigma = (.25 * (1 - progress) + .03) * reheat;
    const candidates = [clone(current)];
    for (let k = 1; k < pop; k++) {
      const step = k < pop * .25 ? sigma * 3 : sigma;
      const parent = k < pop * .15 ? best : current;
      candidates.push(mutate(parent, step, kind));
    }
    const results = await Promise.all(candidates.map(data => evaluate(kind, data)));
    let genBest = null, genFit = -Infinity;
    results.forEach((r, i) => {
      if (r.error) return;
      const f = fitness(r);
      if (f > genFit) { genFit = f; genBest = candidates[i]; }
    });
    if (genBest) {
      const delta = genFit - currentFit;
      const accept = delta >= 0 || Math.random() < Math.exp(delta / T);
      if (accept) { current = genBest; currentFit = genFit; }
      if (genFit > bestFit) { bestFit = genFit; best = genBest; stagnant = 0; }
      else stagnant++;
    }
    if (stagnant > 25) {
      reheat = Math.min(4, reheat * 1.8);
      current = clone(best); currentFit = bestFit; stagnant = 0;
      console.log(`${label} REHEAT at gen ${g}: T x${reheat.toFixed(1)}`);
    }
    if (g % 20 === 0) console.log(`${label} gen ${g}: best ${Math.round(bestFit)} cur ${Math.round(currentFit)} T ${Math.round(T)} sigma ${sigma.toFixed(3)}`);
  }
  console.log(`${label} done in ${((Date.now() - t0) / 1000).toFixed(1)}s, best ${Math.round(bestFit)}`);
  return { best, bestFit };
}

const mlpElite = clone(SH.POLICY_WEIGHTS);
const a = await evolveTracked('mlp', mlpElite, 'MLP');
fs.writeFileSync(path.join(root, 'js/policy.js'),
  `/* Strong-trained MLP: ${gens} generations x ${pop} agents x ${seconds}s, hit penalty 8000. Fitness ${Math.round(a.bestFit)} */\nwindow.SH = window.SH || {};\nSH.POLICY_WEIGHTS = ${JSON.stringify(a.best)};\nSH.POLICY_INFO = { status: 'strong', fitness: ${Math.round(a.bestFit)} };\n`);

// Seed brain.js net from the new MLP weights (verified parity mapping).
function seedBrain(weights) {
  const IN = weights.w1.length / weights.b1.length, HID = weights.b1.length;
  const n2 = new brain.NeuralNetwork({ activation: 'tanh', hiddenLayers: [HID] });
  n2.train([{ input: Array(IN).fill(0), output: [0, 0] }, { input: Array(IN).fill(1), output: [1, 1] }], { iterations: 2 });
  const j = n2.toJSON();
  j.sizes = [IN, HID, 2];
  j.inputLookupLength = IN; j.outputLookupLength = 2;
  j.layers = [{ weights: [], biases: [] }, { weights: Array.from({length: HID}, () => []), biases: new Array(HID).fill(0) }, { weights: [[], []], biases: [0, 0] }];
  for (let h = 0; h < HID; h++) {
    j.layers[1].weights[h] = [];
    for (let i = 0; i < IN; i++) j.layers[1].weights[h][i] = weights.w1[h * IN + i];
    j.layers[1].biases[h] = weights.b1[h];
  }
  for (let k = 0; k < 2; k++) {
    j.layers[2].weights[k] = [];
    for (let h = 0; h < HID; h++) j.layers[2].weights[k][h] = weights.w2[k * HID + h];
    j.layers[2].biases[k] = weights.b2[k];
  }
  return j;
}
const b = await evolveTracked('brain', seedBrain(a.best), 'brain.js');
fs.writeFileSync(path.join(root, 'js/policy-brain.js'),
  `/* Strong-trained brain.js net: ${gens} generations x ${pop} agents x ${seconds}s. Fitness ${Math.round(b.bestFit)} */\nwindow.SH = window.SH || {};\nSH.BRAIN_NET_JSON = ${JSON.stringify(b.best)};\nSH.BRAIN_TANH = true;\n`);
pool.close();
console.log('saved both policies');
