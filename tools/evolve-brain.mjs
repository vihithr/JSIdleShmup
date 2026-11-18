// Seed a brain.js network from the evolved MLP weights, then evolve it further.
// Usage: node tools/evolve-brain.mjs [generations] [population] [seconds]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gens = Number(process.argv[2] || 100);
const popSize = Number(process.argv[3] || 16);
const seconds = Number(process.argv[4] || 26);

globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.document = { getElementById: () => null, documentElement: { style: { setProperty() {} } } };
globalThis.addEventListener = () => {};
globalThis.performance = { now: () => Date.now() };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.brain = require(path.join(root, 'js/vendor/brain-browser.js'));

for (const f of [
  'js/vendor/bitecs.js', 'js/core.js', 'js/ecs-world.js', 'js/brain.js',
  'js/background.js', 'js/entities.js', 'js/collision.js', 'js/enemies.js',
  'js/systems.js', 'js/stages.js', 'js/policy.js', 'js/game.js'
]) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
const SH = globalThis.SH;
const canvas = { getContext: () => ({}), addEventListener() {} };
const game = new SH.Game(canvas);
const step = 1 / 60, steps = Math.round(seconds / step);
const IN = 18, HID = 24;

// Build a brain.js JSON identical to the evolved MLP (verified numerically).
function seedJSON() {
  const n = new brain.NeuralNetwork({ activation: 'tanh', hiddenLayers: [HID] });
  n.train([{ input: Array(IN).fill(0), output: [0, 0] }, { input: Array(IN).fill(1), output: [1, 1] }], { iterations: 2 });
  const j = n.toJSON(), w = SH.POLICY_WEIGHTS;
  for (let h = 0; h < HID; h++) {
    j.layers[1].weights[h] = [];
    for (let i = 0; i < IN; i++) j.layers[1].weights[h][i] = w.w1[h * IN + i];
    j.layers[1].biases[h] = w.b1[h];
  }
  for (let k = 0; k < 2; k++) {
    j.layers[2].weights[k] = [];
    for (let h = 0; h < HID; h++) j.layers[2].weights[k][h] = w.w2[k * HID + h];
    j.layers[2].biases[k] = w.b2[k];
  }
  return j;
}

function netFrom(j) { const n = new brain.NeuralNetwork({ activation: 'tanh', hiddenLayers: [HID] }); n.fromJSON(j); return n; }
function fitness(j) {
  game.brainNet = netFrom(j);
  game.reset(); game.aiMode = 'brain';
  for (let i = 0; i < steps; i++) game.update(step);
  const p = game.player;
  return game.score + p.graze * 3 + (p.shield - 1) * 60;
}
function mutate(src, sigma) {
  const j = JSON.parse(JSON.stringify(src));
  for (const layer of j.layers) {
    if (layer.weights && layer.weights.length)
      for (const row of layer.weights) for (let i = 0; i < row.length; i++) row[i] += (Math.random() * 2 - 1) * sigma;
    if (layer.biases) for (let i = 0; i < layer.biases.length; i++) layer.biases[i] += (Math.random() * 2 - 1) * sigma;
  }
  return j;
}

const resume = process.argv[5] === 'resume';
let elite;
if (resume) {
  const src = fs.readFileSync(path.join(root, 'js', 'policy-brain.js'), 'utf8');
  const m = src.match(/SH\.BRAIN_NET_JSON = (\{.*\});/s);
  if (!m) throw 'cannot read existing policy';
  elite = JSON.parse(m[1]);
} else elite = seedJSON();
let bestFit = fitness(elite);
console.log('seed fitness', Math.round(bestFit), resume ? '(resumed)' : '(MLP parity)');
const t0 = Date.now();
for (let g = 0; g < gens; g++) {
  const sigma = .22 * (1 - g / gens) + .02;
  for (let k = 0; k < popSize; k++) {
    const j = mutate(elite, sigma);
    const f = fitness(j);
    if (f > bestFit) { bestFit = f; elite = j; }
  }
  if (g % 10 === 0) console.log(`gen ${g}: fitness ${Math.round(bestFit)} sigma ${sigma.toFixed(3)}`);
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const out = path.join(root, 'js', 'policy-brain.js');
fs.writeFileSync(out, `/* brain.js net seeded from the evolved MLP and evolved ${gens}x${popSize} further by tools/evolve-brain.mjs.\n   Fitness ${Math.round(bestFit)} */\nwindow.SH = window.SH || {};\nSH.BRAIN_NET_JSON = ${JSON.stringify(elite)};\nSH.BRAIN_TANH = true;\n`);
console.log('wrote', out);
