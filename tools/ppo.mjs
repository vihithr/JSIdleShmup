// PPO training for JS Idle Shmup. Runs on CPU (tf.js) — the net is tiny.
// Usage: node tools/ppo.mjs [iterations] [episodesPerIter] [seconds]
import * as tf from '@tensorflow/tfjs';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iters = Number(process.argv[2] || 120);
const episodes = Number(process.argv[3] || 8);
const seconds = Number(process.argv[4] || 40);

global.window = globalThis;
global.document = { getElementById: () => null, documentElement: { style: { setProperty() {} } } };
global.addEventListener = () => {};
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0;
for (const f of ['js/vendor/bitecs.js', 'js/core.js', 'js/ecs-world.js', 'js/brain.js',
                 'js/background.js', 'js/entities.js', 'js/collision.js', 'js/enemies.js',
                 'js/systems.js', 'js/stages.js', 'js/policy.js', 'js/game.js'])
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
const SH = global.SH;
SH.HEADLESS = true;
const canvas = { getContext: () => ({}), addEventListener() {} };
const game = new SH.Game(canvas);
const IN = game.brain.IN, HID = game.brain.HID;
console.log('PPO net', IN, '->', HID, '-> 2');

// ---- networks ----
const actor = tf.sequential();
actor.add(tf.layers.dense({ inputShape: [IN], units: HID, activation: 'tanh' }));
actor.add(tf.layers.dense({ units: 2, activation: 'tanh' }));
const critic = tf.sequential();
critic.add(tf.layers.dense({ inputShape: [IN], units: HID, activation: 'tanh' }));
critic.add(tf.layers.dense({ units: 1 }));
const logStd = tf.variable(tf.tensor1d([-.5, -.5]));

function pushWeights() {
  const w = game.brain.export();
  const k1 = new Float32Array(IN * HID), b1 = new Float32Array(HID);
  for (let i = 0; i < IN; i++) for (let h = 0; h < HID; h++) k1[i * HID + h] = w.w1[h * IN + i];
  b1.set(w.b1);
  const k2 = new Float32Array(HID * 2), b2 = new Float32Array(2);
  for (let h = 0; h < HID; h++) for (let k = 0; k < 2; k++) k2[h * 2 + k] = w.w2[k * HID + h];
  b2.set(w.b2);
  actor.setWeights([tf.tensor2d(k1, [IN, HID]), tf.tensor1d(b1), tf.tensor2d(k2, [HID, 2]), tf.tensor1d(b2)]);
}
function pullWeights() {
  const [k1, b1, k2, b2] = actor.getWeights();
  const a1 = k1.dataSync(), a2 = k2.dataSync();
  const w = { w1: new Array(IN * HID), b1: Array.from(b1.dataSync()), w2: new Array(HID * 2), b2: Array.from(b2.dataSync()) };
  for (let h = 0; h < HID; h++) for (let i = 0; i < IN; i++) w.w1[h * IN + i] = a1[i * HID + h];
  for (let k = 0; k < 2; k++) for (let h = 0; h < HID; h++) w.w2[k * HID + h] = a2[h * 2 + k];
  game.brain.setWeights(w);
  return w;
}
pushWeights();

const actorOpt = tf.train.adam(3e-4), criticOpt = tf.train.adam(1e-3);
const GAMMA = .99, LAMBDA = .95, CLIP = .2;

function logprob(mean, std, actions) {
  const z = tf.sub(actions, mean).div(std);
  return tf.sum(tf.add(tf.add(tf.mul(tf.square(z), -.5), tf.log(std).neg()), tf.scalar(-.918939)), 1);
}

function rollout() {
  pushWeights();
  const data = { states: [], actions: [], logps: [], rewards: [], dones: [], values: [], scores: [], hits: [], bottoms: [] };
  const steps = Math.round(seconds / (1 / 60));
  for (let ep = 0; ep < episodes; ep++) {
    game.reset();
    let prevScore = 0, prevHits = 0;
    for (let i = 0; i < steps; i++) {
      const f = game.brain.features(game);
      const mean = game.brain.forward(f);
      const std = [Math.exp(-.5) + .05, Math.exp(-.5) + .05];
      const a = [0, 1].map(k => {
        const u = Math.max(1e-6, Math.random()), v = Math.random();
        const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        return Math.max(-1, Math.min(1, mean[k] + std[k] * n));
      });
      const lp = a.reduce((s, x, k) => s - .5 * ((x - mean[k]) / std[k]) ** 2 - Math.log(std[k]) - .918939, 0);
      const val = tf.tidy(() => critic.predict(tf.tensor2d([Array.from(f)])).dataSync()[0]);
      const p = game.player;
      const ax = a[0], ay = a[1];
      game.autopilot = () => ({
        x: Math.max(24, Math.min(SH.W - 24, p.x + ax * 95)),
        y: Math.max(SH.H / 2, Math.min(SH.H - 24, p.y + ay * 95))
      });
      game.input.pointer.down = false; game.input.keys.clear();
      game.update(1 / 60);
      const ds = game.score - prevScore;
      const hit = game.hits - prevHits;
      const bottom = p.y > SH.H * .78 ? 1 : 0;
      const r = ds / 200 - 2 * hit - .05 * bottom;
      data.states.push(Array.from(f)); data.actions.push(a); data.logps.push(lp);
      data.rewards.push(r); data.dones.push(0); data.values.push(val);
      prevScore = game.score; prevHits = game.hits;
    }
    data.dones[data.dones.length - 1] = 1;
    data.scores.push(game.score); data.hits.push(game.hits);
    data.bottoms.push(game.bottomTime);
  }
  return data;
}

function gae(data) {
  const adv = new Array(data.rewards.length).fill(0);
  let last = 0;
  for (let t = data.rewards.length - 1; t >= 0; t--) {
    const next = data.dones[t] ? 0 : data.values[t + 1] || 0;
    const delta = data.rewards[t] + GAMMA * next - data.values[t];
    last = delta + GAMMA * LAMBDA * (data.dones[t] ? 0 : last);
    adv[t] = last;
  }
  const ret = adv.map((a, i) => a + data.values[i]);
  const mean = adv.reduce((s, x) => s + x, 0) / adv.length;
  const sd = Math.sqrt(adv.reduce((s, x) => s + (x - mean) ** 2, 0) / adv.length) + 1e-8;
  return { adv: adv.map(x => (x - mean) / sd), ret };
}

function update(data, adv, ret) {
  const N = data.states.length, batch = 512;
  const idx = Array.from({ length: N }, (_, i) => i);
  for (let epoch = 0; epoch < 8; epoch++) {
    for (let i = N - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [idx[i], idx[j]] = [idx[j], idx[i]]; }
    for (let s = 0; s < N; s += batch) {
      const ids = idx.slice(s, s + batch);
      const st = tf.tensor2d(ids.map(i => data.states[i]));
      const ac = tf.tensor2d(ids.map(i => data.actions[i]));
      const old = tf.tensor1d(ids.map(i => data.logps[i]));
      const ad = tf.tensor1d(ids.map(i => adv[i]));
      const rt = tf.tensor1d(ids.map(i => ret[i]));
      actorOpt.minimize(() => {
        const mean = actor.apply(st);
        const std = tf.add(tf.softplus(logStd), .05);
        const lp = logprob(mean, std, ac);
        const ratio = tf.exp(tf.sub(lp, old));
        const surr = tf.minimum(tf.mul(ratio, ad), tf.mul(tf.clipByValue(ratio, 1 - CLIP, 1 + CLIP), ad));
        const entropy = tf.mean(tf.add(tf.log(std), .918939));
        return tf.sub(tf.neg(tf.mean(surr)), tf.mul(tf.scalar(.01), entropy));
      });
      criticOpt.minimize(() => tf.mean(tf.square(tf.sub(critic.apply(st), rt))));
      st.dispose(); ac.dispose(); old.dispose(); ad.dispose(); rt.dispose();
    }
  }
}

const started = Date.now();
let best = -Infinity, bestWeights = null;
for (let it = 0; it < iters; it++) {
  const data = rollout();
  const { adv, ret } = gae(data);
  update(data, adv, ret);
  const w = pullWeights();
  const avgScore = data.scores.reduce((s, x) => s + x, 0) / episodes;
  const avgHits = data.hits.reduce((s, x) => s + x, 0) / episodes;
  const avgBottom = data.bottoms.reduce((s, x) => s + x, 0) / episodes;
  const fit = avgScore - avgHits * 20000 - avgBottom * 4000;
  if (fit > best) { best = fit; bestWeights = JSON.parse(JSON.stringify(w)); }
  if (it % 5 === 0) console.log(`iter ${it}: score ${Math.round(avgScore)} hits ${avgHits.toFixed(1)} bottom ${avgBottom.toFixed(1)} fit ${Math.round(fit)} (${((Date.now()-started)/1000).toFixed(0)}s)`);
}
fs.writeFileSync(path.join(root, 'js/policy.js'),
  `/* PPO-trained policy: ${iters} iterations. Fitness ${Math.round(best)} */\nwindow.SH = window.SH || {};\nSH.POLICY_WEIGHTS = ${JSON.stringify(bestWeights)};\nSH.POLICY_INFO = { status: 'ppo', fitness: ${Math.round(best)} };\n`);
console.log('wrote js/policy.js');
