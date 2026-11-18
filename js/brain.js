/* JS Idle Shmup — v2 neural policy.
   36 perception features (16 threat sectors, local threat gradient, bullet
   kinematics, targets, history) -> 64 tanh -> 2 steering outputs. */
(function (SH) {
  'use strict';

  SH.Brain = class Brain {
    constructor(weights) {
      this.IN = weights ? (weights.w1.length / (weights.b1.length || 1)) : 38;
      this.HID = weights ? weights.b1.length : 64;
      this.OUT = 2;
      this.w1 = new Float32Array(this.IN * this.HID);
      this.b1 = new Float32Array(this.HID);
      this.w2 = new Float32Array(this.HID * this.OUT);
      this.b2 = new Float32Array(this.OUT);
      this.h = new Float32Array(this.HID);
      this.out = new Float32Array(this.OUT);
      if (weights) this.setWeights(weights);
    }
    setWeights(p) {
      const IN = p.w1.length / p.b1.length, HID = p.b1.length;
      if (this.h.length !== HID || this.w1.length !== p.w1.length) {
        this.IN = IN; this.HID = HID;
        this.w1 = new Float32Array(p.w1.length); this.b1 = new Float32Array(HID);
        this.w2 = new Float32Array(HID * 2); this.b2 = new Float32Array(2);
        this.h = new Float32Array(HID); this.out = new Float32Array(2);
      }
      this.w1.set(p.w1); this.b1.set(p.b1); this.w2.set(p.w2); this.b2.set(p.b2);
    }
    export() { return { w1: Array.from(this.w1), b1: Array.from(this.b1), w2: Array.from(this.w2), b2: Array.from(this.b2) }; }
    random(rng) {
      for (let i = 0; i < this.w1.length; i++) this.w1[i] = (rng() * 2 - 1) * .5;
      for (let i = 0; i < this.b1.length; i++) this.b1[i] = (rng() * 2 - 1) * .2;
      for (let i = 0; i < this.w2.length; i++) this.w2[i] = (rng() * 2 - 1) * .5;
      for (let i = 0; i < this.b2.length; i++) this.b2[i] = (rng() * 2 - 1) * .2;
      return this;
    }
    mutate(other, sigma, rng) {
      for (let i = 0; i < this.w1.length; i++) this.w1[i] = other.w1[i] + (rng() * 2 - 1) * sigma;
      for (let i = 0; i < this.b1.length; i++) this.b1[i] = other.b1[i] + (rng() * 2 - 1) * sigma;
      for (let i = 0; i < this.w2.length; i++) this.w2[i] = other.w2[i] + (rng() * 2 - 1) * sigma;
      for (let i = 0; i < this.b2.length; i++) this.b2[i] = other.b2[i] + (rng() * 2 - 1) * sigma;
      return this;
    }

    features(game) {
      const world = game.world, C = world.components;
      const P = C.Position, B = C.Bullet, V = C.Velocity, E = C.Enemy;
      const p = C.Player[game.playerId];
      const f = new Float32Array(38);
      const sectors = new Float32Array(16);
      let worst = null, worstV = -Infinity, bullets = 0, boss = -1;
      for (const id of game.bulletIds) {
        if (B.friendly[id] || B.dead[id]) continue;
        bullets++;
        const dx = P.x[id] - p.x, dy = P.y[id] - p.y, d2 = dx * dx + dy * dy;
        if (d2 > 200 * 200) continue;
        const d = Math.sqrt(d2) || 1;
        const ang = Math.atan2(dy, dx);
        const sec = ((ang + SH.TAU) % SH.TAU) / (SH.TAU / 16) | 0;
        const toward = (V.x[id] * -dx + V.y[id] * -dy) / (Math.hypot(V.x[id], V.y[id]) * d + 1);
        const v = (1 - d / 200) * (1 + Math.max(0, toward));
        if (v > sectors[sec]) sectors[sec] = v;
        // Time-to-collision style score: close + approaching fast is worst.
        const score = (1 - d / 200) * 2 + Math.max(0, toward);
        if (score > worstV) { worstV = score; worst = id; }
      }
      for (let i = 0; i < 16; i++) f[i] = Math.tanh(sectors[i]);

      // Local threat gradient: how danger changes if we step in each direction.
      const base = game.threatAt(p.x, p.y, 0);
      f[16] = SH.clamp((game.threatAt(p.x + 34, p.y, 0) - base) / 6, -1, 1);
      f[17] = SH.clamp((game.threatAt(p.x - 34, p.y, 0) - base) / 6, -1, 1);
      f[18] = SH.clamp((game.threatAt(p.x, p.y + 34, 0) - base) / 6, -1, 1);
      f[19] = SH.clamp((game.threatAt(p.x, p.y - 34, 0) - base) / 6, -1, 1);

      if (worst !== null) {
        f[20] = SH.clamp((P.x[worst] - p.x) / 220, -1, 1);
        f[21] = SH.clamp((P.y[worst] - p.y) / 220, -1, 1);
        f[22] = SH.clamp(V.x[worst] / 400, -1, 1);
        f[23] = SH.clamp(V.y[worst] / 400, -1, 1);
      }

      let enemy = -1, ed = Infinity;
      for (const id of game.enemyIds) {
        if (E.dead[id]) continue;
        const d = Math.hypot(P.x[id] - p.x, P.y[id] - p.y);
        if (d < ed) { ed = d; enemy = id; }
        if (E.boss[id]) boss = 1;
      }
      if (enemy >= 0) {
        f[24] = SH.clamp((P.x[enemy] - p.x) / 300, -1, 1);
        f[25] = SH.clamp((P.y[enemy] - p.y) / 300, -1, 1);
        f[26] = Math.tanh(200 / (ed + 50));
      }
      let item = -1, idist = Infinity;
      for (const id of game.itemIds) {
        const d = Math.hypot(P.x[id] - p.x, P.y[id] - p.y);
        if (d < idist) { idist = d; item = id; }
      }
      if (item >= 0) {
        f[27] = SH.clamp((P.x[item] - p.x) / 250, -1, 1);
        f[28] = SH.clamp((P.y[item] - p.y) / 250, -1, 1);
      }
      f[29] = p.shield / p.maxShield * 2 - 1;
      f[30] = SH.clamp(p.vx / 330, -1, 1);
      f[31] = SH.clamp(p.vy / 330, -1, 1);
      f[32] = Math.tanh(bullets / 200);
      f[33] = p.lastActionX || 0;
      f[34] = p.lastActionY || 0;
      f[35] = boss;
      // Absolute position matters: the trainer heavily penalises bottom camping.
      f[36] = SH.clamp((p.y - SH.H / 2) / (SH.H / 2), -1, 1);
      f[37] = SH.clamp((p.x - SH.W / 2) / (SH.W / 2), -1, 1);
      return f;
    }

    forward(f) {
      const { IN, HID, OUT } = this;
      for (let j = 0; j < HID; j++) {
        let s = this.b1[j], base = j * IN;
        for (let i = 0; i < IN; i++) s += f[i] * this.w1[base + i];
        this.h[j] = Math.tanh(s);
      }
      for (let k = 0; k < OUT; k++) {
        let s = this.b2[k], base = k * HID;
        for (let j = 0; j < HID; j++) s += this.h[j] * this.w2[base + j];
        this.out[k] = Math.tanh(s);
      }
      return this.out;
    }
  };

})(window.SH = window.SH || {});
