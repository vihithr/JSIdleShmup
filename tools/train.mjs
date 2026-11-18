// JS Idle Shmup — offline evolution of the neural idle pilot.
// Usage: node tools/train.mjs [generations] [population] [seconds]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gens = Number(process.argv[2] || 40);
const popSize = Number(process.argv[3] || 14);
const seconds = Number(process.argv[4] || 20);

// --- browser shims so the browser modules can run headlessly ---
globalThis.window = globalThis;
globalThis.document = {
  getElementById: () => null,
  documentElement: { style: { setProperty() {} } }
};
globalThis.addEventListener = () => {};
globalThis.performance = { now: () => Date.now() };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

const files = [
  'js/vendor/bitecs.js', 'js/core.js', 'js/ecs-world.js', 'js/brain.js',
  'js/background.js', 'js/entities.js', 'js/collision.js', 'js/enemies.js',
  'js/systems.js', 'js/stages.js', 'js/policy.js', 'js/game.js'
];
for (const f of files) {
  const code = fs.readFileSync(path.join(root, f), 'utf8');
  vm.runInThisContext(code, { filename: f });
}
const SH = globalThis.SH;

// Deterministic RNG for reproducible training.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(20261118);
const canvas = { getContext: () => ({}), addEventListener() {} };
const game = new SH.Game(canvas);
game.aiMode = 'neural';
const step = 1 / 60, steps = Math.round(seconds / step);

function evaluate(brain) {
  game.brain.setWeights(brain.export());
  game.reset();
  game.aiMode = 'neural';
  let minShield = 3;
  for (let i = 0; i < steps; i++) {
    game.update(step);
    minShield = Math.min(minShield, game.player.shield);
  }
  const p = game.player;
  return {
    fitness: game.score + p.graze * 3 + (p.shield - 1) * 60 + minShield * 25,
    score: game.score, graze: p.graze, shield: p.shield
  };
}

const prototype = new SH.Brain();
let population = Array.from({ length: popSize }, () => prototype.random(random).export());
let best = null, bestFit = -Infinity;
const started = Date.now();

for (let g = 0; g < gens; g++) {
  const sigma = 0.28 * (1 - g / gens) + 0.035;
  const scored = population.map(w => {
    const b = new SH.Brain(w);
    const r = evaluate(b);
    return { w, ...r };
  }).sort((a, b) => b.fitness - a.fitness);

  if (scored[0].fitness > bestFit) { bestFit = scored[0].fitness; best = scored[0]; }
  const elites = scored.slice(0, 3).map(x => x.w);
  population = elites.slice();
  while (population.length < popSize) {
    const parent = elites[(random() * elites.length) | 0];
    population.push(new SH.Brain().mutate(new SH.Brain(parent), sigma, random).export());
  }
  if (g % 5 === 0 || g === gens - 1) {
    console.log(`gen ${String(g).padStart(3)}  best ${Math.round(scored[0].fitness)}  allTime ${Math.round(bestFit)}  score ${scored[0].score}  graze ${scored[0].graze}  shield ${scored[0].shield}  sigma ${sigma.toFixed(3)}`);
  }
}

const out = path.join(root, 'js', 'policy.js');
const body = `/* Evolved by tools/train.mjs — ${gens} generations x ${popSize} agents x ${seconds}s.\n   Fitness ${Math.round(bestFit)} | score ${best.score} | graze ${best.graze} | shield ${best.shield} */\nwindow.SH = window.SH || {};\nSH.POLICY_WEIGHTS = ${JSON.stringify(best.w)};\nSH.POLICY_INFO = { status: 'trained', generations: ${gens}, fitness: ${Math.round(bestFit)}, score: ${best.score}, graze: ${best.graze} };\n`;
fs.writeFileSync(out, body);
console.log(`\nWrote ${out} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
