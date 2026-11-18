/* JS Idle Shmup — enemy catalogue and bullet patterns (bitECS component access) */
(function (SH) {
  'use strict';
  const W = SH.W, H = SH.H, TAU = SH.TAU;
  SH.DENSITY = 2.4;
  SH.FIRE_RATE = 2.4;

  function aimed(game, x, y, speed, count, spread, color, shape) {
    count = Math.max(1, Math.round(count * SH.DENSITY));
    const p = game.player;
    const a0 = Math.atan2(p.y - y, p.x - x);
    for (let i = 0; i < count; i++) {
      const a = a0 + (count === 1 ? 0 : (i / (count - 1) - .5) * spread);
      game.fireBullet(x, y, Math.cos(a) * speed, Math.sin(a) * speed, { color, r: 4, shape: shape || 'orb' });
    }
  }
  function ring(game, x, y, count, speed, color, offset) {
    count = Math.max(2, Math.round(count * SH.DENSITY));
    for (let i = 0; i < count; i++) {
      const a = i / count * TAU + (offset || 0);
      game.fireBullet(x, y, Math.cos(a) * speed, Math.sin(a) * speed, { color, r: 4, shape: 'diamond' });
    }
  }
  function spiral(game, x, y, arms, speed, spin, color) {
    arms = Math.max(2, Math.round(arms * SH.DENSITY));
    for (let i = 0; i < arms; i++) {
      const a = spin + i / arms * TAU;
      game.fireBullet(x, y, Math.cos(a) * speed, Math.sin(a) * speed, { color, r: 3.5, shape: 'orb' });
    }
  }
  function mine(game, x, y) {
    game.fireBullet(x, y, SH.rand(-25, 25), 45, { color: '#fbbf24', r: 7, shape: 'orb', life: 1.1, fuse: 1.1 });
  }

  SH.ENEMY_INDEX = { drifter: 0, weaver: 1, orbiter: 2, sniper: 3, spinner: 4, tank: 5, bomber: 6, boss: 7 };
  SH.ENEMY_LIST = ['drifter', 'weaver', 'orbiter', 'sniper', 'spinner', 'tank', 'bomber', 'boss'];

  // update(world, eid, dt, game); components read from world.components
  SH.ENEMY_TYPES = {
    drifter: {
      hp: 3, r: 14, score: 100, color: '#f472b6', shape: 'tri', speed: 105, fireDelay: 0,
      update(w, id, dt, game) {
        const C = w.components, P = C.Position, E = C.Enemy;
        P.y[id] += E.speed[id] * dt;
        P.x[id] += Math.sin(E.t[id] * 2 + E.homeX[id]) * 24 * dt;
        if (P.y[id] > H + 40) E.dead[id] = 1;
      }
    },
    weaver: {
      hp: 4, r: 15, score: 150, color: '#38bdf8', shape: 'diamond', speed: 82, fireDelay: 1.4,
      update(w, id, dt, game) {
        const C = w.components, P = C.Position, E = C.Enemy;
        P.y[id] += 82 * dt;
        P.x[id] = E.homeX[id] + Math.sin(E.t[id] * 1.9) * 110;
        E.fire[id] -= dt;
        if (E.fire[id] <= 0) { E.fire[id] = 1.4 / SH.FIRE_RATE; aimed(game, P.x[id], P.y[id], 210, 1, 0, '#7dd3fc'); }
        if (P.y[id] > H + 40) E.dead[id] = 1;
      }
    },
    orbiter: {
      hp: 6, r: 16, score: 220, color: '#a78bfa', shape: 'hex', speed: 58, fireDelay: 1.8,
      update(w, id, dt, game) {
        const C = w.components, P = C.Position, E = C.Enemy;
        P.y[id] += 58 * dt;
        P.x[id] = E.homeX[id] + Math.cos(E.t[id] * 1.6) * 78;
        E.fire[id] -= dt;
        if (E.fire[id] <= 0) { E.fire[id] = 1.8 / SH.FIRE_RATE; ring(game, P.x[id], P.y[id], 10, 145, '#c4b5fd', E.t[id]); }
        if (P.y[id] > H + 40) E.dead[id] = 1;
      }
    },
    sniper: {
      hp: 3, r: 13, score: 180, color: '#facc15', shape: 'tri', speed: 120, fireDelay: 1.6,
      update(w, id, dt, game) {
        const C = w.components, P = C.Position, E = C.Enemy;
        if (P.y[id] < 130) P.y[id] += 120 * dt; else P.x[id] += Math.sin(E.t[id] * 1.2) * 70 * dt;
        E.fire[id] -= dt;
        if (E.fire[id] <= 0 && P.y[id] >= 130) { E.fire[id] = 1.6 / SH.FIRE_RATE; aimed(game, P.x[id], P.y[id], 255, 3, .34, '#fde047', 'needle'); }
        if (E.t[id] > 16) E.dead[id] = 1;
      }
    },
    spinner: {
      hp: 9, r: 17, score: 300, color: '#c084fc', shape: 'hex', speed: 42, fireDelay: .16,
      update(w, id, dt, game) {
        const C = w.components, P = C.Position, E = C.Enemy;
        P.y[id] += 42 * dt;
        P.x[id] += Math.sin(E.t[id] * 1.1) * 34 * dt;
        E.fire[id] -= dt;
        if (E.fire[id] <= 0) { E.fire[id] = .16 / SH.FIRE_RATE; spiral(game, P.x[id], P.y[id], 3, 165, E.t[id] * 3.1); }
        if (P.y[id] > H + 40) E.dead[id] = 1;
      }
    },
    tank: {
      hp: 20, r: 24, score: 500, color: '#94a3b8', shape: 'core', speed: 34, fireDelay: 2.2,
      update(w, id, dt, game) {
        const C = w.components, P = C.Position, E = C.Enemy;
        P.y[id] += 34 * dt;
        E.fire[id] -= dt;
        if (E.fire[id] <= 0) { E.fire[id] = 2.2 / SH.FIRE_RATE; ring(game, P.x[id], P.y[id], 14, 120, '#cbd5e1', E.t[id]); aimed(game, P.x[id], P.y[id], 190, 5, .5, '#fb7185'); }
        if (P.y[id] > H + 40) E.dead[id] = 1;
      }
    },
    bomber: {
      hp: 5, r: 15, score: 260, color: '#fb923c', shape: 'diamond', speed: 66, fireDelay: 1.5,
      update(w, id, dt, game) {
        const C = w.components, P = C.Position, E = C.Enemy;
        P.y[id] += 66 * dt;
        P.x[id] += Math.cos(E.t[id] * 1.4) * 46 * dt;
        E.fire[id] -= dt;
        if (E.fire[id] <= 0) { E.fire[id] = 1.5 / SH.FIRE_RATE; mine(game, P.x[id], P.y[id]); }
        if (P.y[id] > H + 40) E.dead[id] = 1;
      }
    },
    boss: {
      hp: 260, r: 42, score: 5000, color: '#f472b6', shape: 'core', speed: 70, fireDelay: 1, boss: true,
      update(w, id, dt, game) {
        const C = w.components, P = C.Position, E = C.Enemy;
        if (P.y[id] < 120) P.y[id] += 70 * dt; else P.x[id] = W / 2 + Math.sin(E.t[id] * .7) * 190;
        const ratio = E.hp[id] / E.maxHp[id];
        E.fire[id] -= dt;
        if (P.y[id] >= 120 && E.fire[id] <= 0) {
          if (ratio > .66) { E.fire[id] = 1.1 / SH.FIRE_RATE; ring(game, P.x[id], P.y[id], 16, 150, '#f9a8d4', E.t[id]); aimed(game, P.x[id], P.y[id], 240, 3, .3, '#fb7185'); }
          else if (ratio > .33) { E.fire[id] = .13 / SH.FIRE_RATE; spiral(game, P.x[id], P.y[id], 4, 190, E.t[id] * 4.4); }
          else { E.fire[id] = .7 / SH.FIRE_RATE; ring(game, P.x[id], P.y[id], 20, 175, '#f472b6', -E.t[id]); aimed(game, P.x[id], P.y[id], 300, 7, .9, '#fde047', 'needle'); }
        }
      }
    }
  };

  SH.FORMATIONS = {
    line(count, y, rng) {
      const out = [], gap = (W - 160) / Math.max(1, count - 1);
      for (let i = 0; i < count; i++) out.push({ x: 80 + i * gap, y: y - i * 14 });
      return out;
    },
    arc(count, y, rng) {
      const out = [];
      for (let i = 0; i < count; i++) {
        const a = Math.PI * (.15 + .7 * (count === 1 ? .5 : i / (count - 1)));
        out.push({ x: W / 2 - Math.cos(a) * 260, y: y - Math.sin(a) * 90 });
      }
      return out;
    },
    column(count, y, rng) {
      const out = [], x = 120 + rng() * (W - 240);
      for (let i = 0; i < count; i++) out.push({ x: x + Math.sin(i * 1.7) * 30, y: y - i * 52 });
      return out;
    },
    random(count, y, rng) {
      const out = [];
      for (let i = 0; i < count; i++) out.push({ x: 70 + rng() * (W - 140), y: y - rng() * 140 });
      return out;
    }
  };

})(window.SH = window.SH || {});
