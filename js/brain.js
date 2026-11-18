/* JS Idle Shmup — compact neural policy for the idle pilot.
   Inputs: 18 hand-built perception features. Output: 2D steering direction.
   Weights are evolved offline by tools/train.mjs and baked into policy.js. */
(function (SH) {
  'use strict';
  const W = SH.W, H = SH.H, TAU = SH.TAU;

  SH.Brain = class Brain {
    constructor(weights) {
      this.IN = 18; this.HID = 24; this.OUT = 2;
      this.w1 = new Float32Array(this.IN * this.HID);
      this.b1 = new Float32Array(this.HID);
      this.w2 = new Float32Array(this.HID * this.OUT);
      this.b2 = new Float32Array(this.OUT);
      this.h = new Float32Array(this.HID);
      this.out = new Float32Array(this.OUT);
      if (weights) this.setWeights(weights);
    }
    setWeights(p) {
      this.w1.set(p.w1); this.b1.set(p.b1); this.w2.set(p.w2); this.b2.set(p.b2);
    }
    export() {
      return { w1: Array.from(this.w1), b1: Array.from(this.b1), w2: Array.from(this.w2), b2: Array.from(this.b2) };
    }
    random(rng) {
      for (let i = 0; i < this.w1.length; i++) this.w1[i] = (rng() * 2 - 1) * .6;
      for (let i = 0; i < this.b1.length; i++) this.b1[i] = (rng() * 2 - 1) * .3;
      for (let i = 0; i < this.w2.length; i++) this.w2[i] = (rng() * 2 - 1) * .6;
      for (let i = 0; i < this.b2.length; i++) this.b2[i] = (rng() * 2 - 1) * .3;
      return this;
    }
    mutate(other, sigma, rng) {
      for (let i = 0; i < this.w1.length; i++) this.w1[i] = other.w1[i] + (rng() * 2 - 1) * sigma;
      for (let i = 0; i < this.b1.length; i++) this.b1[i] = other.b1[i] + (rng() * 2 - 1) * sigma;
      for (let i = 0; i < this.w2.length; i++) this.w2[i] = other.w2[i] + (rng() * 2 - 1) * sigma;
      for (let i = 0; i < this.b2.length; i++) this.b2[i] = other.b2[i] + (rng() * 2 - 1) * sigma;
      return this;
    }

    /* 8 directional threat sensors + target/item/shield/velocity features. */
    features(game) {
      const world = game.world, C = world.components;
      const P = C.Position, B = C.Bullet, V = C.Velocity;
      const p = C.Player[game.playerId];
      const f = new Float32Array(18);
      const sectors = new Float32Array(8);
      let bullets = 0;
      for (const id of bitECS.query(world, [B])) {
        if (B.friendly[id] || B.dead[id]) continue;
        bullets++;
        const dx = P.x[id] - p.x, dy = P.y[id] - p.y, d2 = dx * dx + dy * dy;
        if (d2 > 160 * 160) continue;
        const d = Math.sqrt(d2) || 1;
        const ang = Math.atan2(dy, dx);
        const sec = ((ang + SH.TAU) % SH.TAU) / (SH.TAU / 8) | 0;
        const toward = (V.x[id] * -dx + V.y[id] * -dy) / (Math.hypot(V.x[id], V.y[id]) * d + 1);
        const v = (1 - d / 160) * (1 + Math.max(0, toward));
        if (v > sectors[sec]) sectors[sec] = v;
      }
      for (let i = 0; i < 8; i++) f[i] = Math.tanh(sectors[i]);

      let enemy = -1, ed = Infinity;
      for (const id of bitECS.query(world, [C.Enemy])) {
        if (C.Enemy.dead[id]) continue;
        const d = Math.hypot(P.x[id] - p.x, P.y[id] - p.y);
        if (d < ed) { ed = d; enemy = id; }
      }
      if (enemy >= 0) {
        f[8] = SH.clamp((P.x[enemy] - p.x) / 300, -1, 1);
        f[9] = SH.clamp((P.y[enemy] - p.y) / 300, -1, 1);
        f[16] = Math.tanh(200 / (ed + 50));
      }
      let item = -1, idist = Infinity;
      for (const id of bitECS.query(world, [C.Item])) {
        const d = Math.hypot(P.x[id] - p.x, P.y[id] - p.y);
        if (d < idist) { idist = d; item = id; }
      }
      if (item >= 0) {
        f[10] = SH.clamp((P.x[item] - p.x) / 250, -1, 1);
        f[11] = SH.clamp((P.y[item] - p.y) / 250, -1, 1);
        f[17] = Math.tanh(150 / (idist + 40));
      }
      f[12] = p.shield / p.maxShield * 2 - 1;
      f[13] = SH.clamp(p.vx / 330, -1, 1);
      f[14] = SH.clamp(p.vy / 330, -1, 1);
      f[15] = Math.tanh(bullets / 180);
      return f;
    }
    forward(f) {
      const { IN, HID, OUT } = this;
      for (let j = 0; j < HID; j++) {
        let s = this.b1[j];
        const base = j * IN;
        for (let i = 0; i < IN; i++) s += f[i] * this.w1[base + i];
        this.h[j] = Math.tanh(s);
      }
      for (let k = 0; k < OUT; k++) {
        let s = this.b2[k];
        const base = k * HID;
        for (let j = 0; j < HID; j++) s += this.h[j] * this.w2[base + j];
        this.out[k] = Math.tanh(s);
      }
      return this.out;
    }
  };

})(window.SH = window.SH || {});
