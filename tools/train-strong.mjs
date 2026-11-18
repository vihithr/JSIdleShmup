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
  return s.score + s.graze * .5 - s.hits * 12000 - (3 - s.shield) * 1500 + (s.hits === 0 ? 15000 : 0);
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

async function evolveTracked(kind, elite, label) {
  let best = clone(elite);
  let seedStat = await evaluate(kind, best);
  let bestFit = fitness(seedStat);
  console.log(`${label} seed fitness ${Math.round(bestFit)} (score ${seedStat.score}, hits ${seedStat.hits})`);
  const t0 = Date.now();
  let stagnating = 0, boost = 1;
  for (let g = 0; g < gens; g++) {
    const sigma = (.22 * (1 - g / gens) + .015) * boost;
    const candidates = [clone(best)];
    for (let k = 1; k < pop; k++) {
      // 20% exploration with a much wider step to escape local optima.
      candidates.push(mutate(best, k < pop * .2 ? sigma * 3 : sigma, kind));
    }
    const results = await Promise.all(candidates.map(data => evaluate(kind, data)));
    let improved = false;
    results.forEach((r, i) => {
      if (r.error) return;
      const f = fitness(r);
      if (f > bestFit) { bestFit = f; best = candidates[i]; improved = true; }
    });
    stagnating = improved ? 0 : stagnating + 1;
    if (stagnating > 20) { boost = Math.min(3, boost * 1.5); stagnating = 0; }
    if (improved) boost = 1;
    if (g % 10 === 0) console.log(`${label} gen ${g}: fitness ${Math.round(bestFit)} sigma ${sigma.toFixed(3)} boost ${boost}`);
  }
  console.log(`${label} done in ${((Date.now() - t0) / 1000).toFixed(1)}s, fitness ${Math.round(bestFit)}`);
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
