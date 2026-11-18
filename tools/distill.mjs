// Distil a stronger lookahead planner into a brain.js network.
// Usage: node tools/distill.mjs [episodes] [seconds]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const episodes = Number(process.argv[2] || 16);
const seconds = Number(process.argv[3] || 16);

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
const W = SH.W, H = SH.H, TAU = SH.TAU;
const canvas = { getContext: () => ({}), addEventListener() {} };
const game = new SH.Game(canvas);
const step = 1 / 60, steps = Math.round(seconds / step);

/* Oracle: 12-direction local search with a 2-point predictive horizon.
   Pre-filters nearby bullets once per frame, so it stays fast enough to
   generate tens of thousands of demonstrations. */
function oracleDirection() {
  const p = game.player, C = game.world.components;
  const P = C.Position, B = C.Bullet, V = C.Velocity, E = C.Enemy;
  const near = [];
  for (const id of game.bulletIds) {
    if (B.friendly[id] || B.dead[id]) continue;
    const dx = P.x[id] - p.x, dy = P.y[id] - p.y;
    if (dx * dx + dy * dy > 240 * 240) continue;
    near.push([P.x[id], P.y[id], V.x[id], V.y[id]]);
  }
  const R = 36, N = 12;
  let best = -Infinity, dx = 0, dy = 0;
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU;
    const cx = SH.clamp(p.x + Math.cos(a) * R, 24, W - 24);
    const cy = SH.clamp(p.y + Math.sin(a) * R, H / 2, H - 24);
    let score = 0;
    for (const [bx, by, vx, vy] of near) {
      for (const t of [0, .42]) {
        const px = bx + vx * t, py = by + vy * t;
        const ddx = cx - px, ddy = cy - py, d2 = ddx * ddx + ddy * ddy;
        if (d2 < 140 * 140) {
          const d = Math.sqrt(d2) || 1;
          score -= (140 - d) * (140 - d) / (d + 12) * (t === 0 ? 1 : .55);
        }
      }
    }
    let minB = Infinity;
    for (const [bx, by] of near) {
      const d = Math.hypot(bx - cx, by - cy);
      if (d < minB) minB = d;
    }
    if (minB > 16 && minB < 42) score += 22;
    for (const id of game.enemyIds) {
      if (E.dead[id]) continue;
      const d = Math.hypot(P.x[id] - cx, P.y[id] - cy);
      if (d < 320) score += (320 - d) * .06;
    }
    for (const id of game.itemIds) {
      const d = Math.hypot(P.x[id] - cx, P.y[id] - cy);
      if (d < 180) score += (180 - d) * .18;
    }
    score -= Math.abs(W / 2 - cx) * .04 + Math.abs(H * .72 - cy) * .06;
    if (score > best) { best = score; dx = (cx - p.x) / R; dy = (cy - p.y) / R; }
  }
  return [SH.clamp(dx, -1, 1), SH.clamp(dy, -1, 1)];
}
const data = [];
const started = Date.now();
let oracleScore = 0;
let lastDir = [0, -1];
for (let ep = 0; ep < episodes; ep++) {
  game.reset();
  game.aiMode = 'neural';
  for (let i = 0; i < steps; i++) {
    const mlp = game.brain.forward(game.brain.features(game));
    const risk = game.threatAt(game.player.x, game.player.y, 0);
    const oracle = oracleDirection();
    const w = risk > 9 ? .75 : risk > 5 ? .35 : 0;
    const dir = [mlp[0] * (1 - w) + oracle[0] * w, mlp[1] * (1 - w) + oracle[1] * w];
    lastDir = dir;
    if (i % 6 === 0) {
      const f = game.brain.features(game);
      data.push({
        input: Array.from(f, v => (v + 1) / 2),
        output: [(dir[0] + 1) / 2, (dir[1] + 1) / 2]
      });
    }
    game.update(step);
  }
  oracleScore += game.score;
  if (ep % 4 === 0) console.log(`episode ${ep}: samples ${data.length}, score ${game.score}`);
}

console.log(`Collected ${data.length} samples from ${episodes} oracle episodes in ${((Date.now() - started) / 1000).toFixed(1)}s`);
const net = new brain.NeuralNetwork({ hiddenLayers: [32, 32], activation: 'sigmoid' });
const result = net.train(data, {
  iterations: 1500,
  errorThresh: 0.02,
  learningRate: 0.25,
  momentum: 0.1,
  log: false
});
console.log('training:', result);

/* Evolution fine-tuning directly on the brain.js weight arrays. */
function netFrom(json) { const n = new brain.NeuralNetwork(); n.fromJSON(json); return n; }
function fitness(json) {
  game.brainNet = netFrom(json);
  game.reset(); game.aiMode = 'brain';
  for (let i = 0; i < steps; i++) game.update(step);
  const p = game.player;
  return game.score + p.graze * 2 + p.shield * 80;
}
function mutate(src, sigma) {
  const j = JSON.parse(JSON.stringify(src));
  for (const layer of j.layers) {
    if (!layer.weights || !layer.weights.length) continue;
    for (const row of layer.weights) for (let i = 0; i < row.length; i++) row[i] += (Math.random() * 2 - 1) * sigma;
    if (layer.biases) for (let i = 0; i < layer.biases.length; i++) layer.biases[i] += (Math.random() * 2 - 1) * sigma;
  }
  return j;
}
let elite = net.toJSON(), eliteFit = fitness(elite);
console.log('supervised fitness', Math.round(eliteFit));
for (let g = 0; g < 120; g++) {
  const sigma = .25 * (1 - g / 120) + .02;
  let bestJ = elite, bestF = eliteFit;
  for (let k = 0; k < 16; k++) {
    const j = g < 3 && k === 0 ? elite : mutate(elite, sigma);
    const f = fitness(j);
    if (f > bestF) { bestF = f; bestJ = j; }
  }
  if (bestF > eliteFit) { eliteFit = bestF; elite = bestJ; }
  if (g % 10 === 0) console.log(`es gen ${g}: fitness ${Math.round(eliteFit)} sigma ${sigma.toFixed(3)}`);
}

const out = path.join(root, 'js', 'policy-brain.js');
const body = `/* Distilled by tools/distill.mjs — brain.js net imitating a 24-direction, 4-horizon oracle.\n   Samples ${data.length} | ES fitness ${Math.round(eliteFit)} | train error ${result.error.toFixed(5)} */\nwindow.SH = window.SH || {};\nSH.BRAIN_NET_JSON = ${JSON.stringify(elite)};\n`;
fs.writeFileSync(out, body);
console.log(`Wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
