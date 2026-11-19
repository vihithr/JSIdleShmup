// Training worker: runs one simulation episode with a candidate pilot.
import { parentPort } from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
global.window = globalThis;
global.self = globalThis;
global.brain = require(path.join(root, 'js/vendor/brain-browser.js'));
global.document = { getElementById: () => null, documentElement: { style: { setProperty() {} } } };
global.addEventListener = () => {};
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 0;
global.SH = undefined;
for (const f of [
  'js/vendor/bitecs.js', 'js/core.js', 'js/ecs-world.js', 'js/brain.js',
  'js/background.js', 'js/entities.js', 'js/collision.js', 'js/enemies.js',
  'js/systems.js', 'js/stages.js', 'js/policy.js', 'js/policy-brain.js', 'js/game.js'
]) vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
const SH = global.SH;
SH.HEADLESS = true;

const canvas = { getContext: () => ({}), addEventListener() {} };
const game = new SH.Game(canvas);
const step = 1 / 60;

parentPort.on('message', ({ id, kind, data, seconds, curriculum }) => {
  try {
    SH.CURRICULUM = curriculum || 1;
    if (kind === 'mlp') {
      game.brain.setWeights(data);
      game.autopilot = () => {
        const p = game.player;
        const o = game.brain.forward(game.brain.features(game));
        p.lastActionX = o[0]; p.lastActionY = o[1];
        return { x: p.x + o[0] * 95, y: p.y + o[1] * 95 };
      };
    } else if (kind === 'brain') {
      const net = new brain.NeuralNetwork({ activation: 'tanh', hiddenLayers: [data.sizes[1]] });
      net.fromJSON(data);
      game.autopilot = () => {
        const p = game.player;
        const o = net.run(Array.from(game.brain.features(game)));
        return { x: p.x + SH.clamp(o[0], -1, 1) * 95, y: p.y + SH.clamp(o[1], -1, 1) * 95 };
      };
    }
    game.reset();
    const steps = Math.round(seconds / step);
    for (let i = 0; i < steps; i++) game.update(step);
    const p = game.player;
    parentPort.postMessage({ id, score: game.score, graze: p.graze, hits: game.hits, shield: p.shield, bottom: game.bottomTime });
  } catch (e) {
    parentPort.postMessage({ id, error: String(e) + '\n' + e.stack });
  }
});
