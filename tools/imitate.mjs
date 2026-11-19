// Imitation pretraining for the v2 MLP: copy a predictive planner's steering.
// Usage: node tools/imitate.mjs [episodes] [seconds]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const episodes = Number(process.argv[2] || 40);
const seconds = Number(process.argv[3] || 45);
global.window = globalThis;
global.document = { getElementById: () => null, documentElement: { style: { setProperty() {} } } };
global.addEventListener = () => {};
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0;
for (const f of ['js/vendor/bitecs.js', 'js/core.js', 'js/ecs-world.js', 'js/brain.js',
                 'js/background.js', 'js/entities.js', 'js/collision.js', 'js/enemies.js',
                 'js/systems.js', 'js/stages.js', 'js/game.js'])
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
const SH = global.SH;
SH.HEADLESS = true;
SH.POLICY_WEIGHTS = null;
SH.BRAIN_NET_JSON = null;
const canvas = { getContext: () => ({}), addEventListener() {} };
const game = new SH.Game(canvas);
const step = 1 / 60, steps = Math.round(seconds / step);

/* Teacher: 17-candidate predictive search over bullet closest-approach. */
function teacher() {
  const p = game.player;
  let score0 = Infinity, bx = p.x, by = p.y;
  for (let i = -1; i < 16; i++) {
    const a = i / 16 * SH.TAU;
    const x = i < 0 ? p.x : SH.clamp(p.x + Math.cos(a) * 30, 24, SH.W - 24);
    const y = i < 0 ? p.y : SH.clamp(p.y + Math.sin(a) * 30, SH.H / 2, SH.H - 24);
    let score = game.threatAt(x, y, .45);
    for (const id of game.enemyIds) {
      const d = Math.hypot(game.world.components.Position.x[id] - x, game.world.components.Position.y[id] - y);
      if (d < 300) score -= (300 - d) * .005;
    }
    score += Math.abs(SH.W / 2 - x) * .0006 + Math.abs(SH.H * .72 - y) * .0012;
    if (score < score0) { score0 = score; bx = x; by = y; }
  }
  return { x: bx, y: by };
}

const data = [];
for (let ep = 0; ep < episodes; ep++) {
  game.reset();
  game.autopilot = teacher;
  for (let i = 0; i < steps; i++) {
    const dir = teacher();
    if (i % 3 === 0) {
      const f = game.brain.features(game);
      data.push({ f: Array.from(f), y: [SH.clamp((dir.x - game.player.x) / 95, -1, 1), SH.clamp((dir.y - game.player.y) / 95, -1, 1)] });
    }
    game.update(step);
  }
  if (ep % 10 === 0) console.log(`episode ${ep}: ${data.length} samples, score ${game.score}, hits ${game.hits}`);
}
console.log(`collected ${data.length} demonstrations`);

let seed = 123456;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const net = new SH.Brain().random(rng);
const IN = net.IN, HID = net.HID;
const dw1 = new Float64Array(net.w1.length), db1 = new Float64Array(HID),
      dw2 = new Float64Array(net.w2.length), db2 = new Float64Array(2);
const order = Array.from({ length: data.length }, (_, i) => i);
for (let epoch = 0; epoch < 200; epoch++) {
  for (let i = order.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
  let loss = 0;
  for (const idx of order) {
    const { f, y } = data[idx];
    const out = net.forward(f);
    const e0 = (out[0] - y[0]) * (1 - out[0] * out[0]);
    const e1 = (out[1] - y[1]) * (1 - out[1] * out[1]);
    loss += (out[0] - y[0]) ** 2 + (out[1] - y[1]) ** 2;
    const eh = new Float64Array(HID);
    for (let j = 0; j < HID; j++) {
      const err = e0 * net.w2[j] + e1 * net.w2[HID + j];
      eh[j] = err * (1 - net.h[j] * net.h[j]);
    }
    for (let j = 0; j < HID; j++) {
      db1[j] += eh[j];
      for (let i2 = 0; i2 < IN; i2++) dw1[j * IN + i2] += eh[j] * f[i2];
    }
    db2[0] += e0; db2[1] += e1;
    for (let i2 = 0; i2 < HID; i2++) { dw2[i2] += e0 * net.h[i2]; dw2[HID + i2] += e1 * net.h[i2]; }
  }
  const lr = 0.08 / Math.sqrt(epoch / 4 + 1);
  const n = data.length;
  for (let i = 0; i < net.w1.length; i++) { net.w1[i] -= lr * dw1[i] / n; dw1[i] = 0; }
  for (let i = 0; i < HID; i++) { net.b1[i] -= lr * db1[i] / n; db1[i] = 0; }
  for (let i = 0; i < net.w2.length; i++) { net.w2[i] -= lr * dw2[i] / n; dw2[i] = 0; }
  for (let i = 0; i < 2; i++) { net.b2[i] -= lr * db2[i] / n; db2[i] = 0; }
  if (epoch % 6 === 0) console.log(`epoch ${epoch}: loss ${(loss / n).toFixed(4)}`);
}
const out = path.join(root, 'js/policy.js');
fs.writeFileSync(out, `/* Imitation-pretrained v2 MLP (${IN}->${HID}->2), ${data.length} demonstrations. */\nwindow.SH = window.SH || {};\nSH.POLICY_WEIGHTS = ${JSON.stringify(net.export())};\nSH.POLICY_INFO = { status: 'imitation', samples: ${data.length} };\n`);
console.log('wrote', out);
