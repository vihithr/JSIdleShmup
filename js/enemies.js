/* JS Idle Shmup — enemy catalogue, movement and bullet-pattern algorithms */
(function (SH) {
  'use strict';
  const W = SH.W, H = SH.H, TAU = SH.TAU;
  // Global density knobs: raise bullet volume without touching every pattern.
  SH.DENSITY = 2.4;
  SH.FIRE_RATE = 2.4;

  function aimed(game, e, speed, count, spread, color, shape) {
    count = Math.max(1, Math.round(count * SH.DENSITY));
    const a0 = Math.atan2(game.player.y - e.y, game.player.x - e.x);
    for (let i = 0; i < count; i++) {
      const a = a0 + (count === 1 ? 0 : (i / (count - 1) - .5) * spread);
      game.fireBullet(e.x, e.y, Math.cos(a) * speed, Math.sin(a) * speed,
        { color: color || '#fb7185', r: 4, shape: shape || 'orb' });
    }
  }
  function ring(game, e, count, speed, color, offset) {
    count = Math.max(2, Math.round(count * SH.DENSITY));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + (offset || 0);
      game.fireBullet(e.x, e.y, Math.cos(a) * speed, Math.sin(a) * speed,
        { color: color || '#f472b6', r: 4, shape: 'diamond' });
    }
  }
  function spiral(game, e, arms, speed, spin, color) {
    arms = Math.max(2, Math.round(arms * SH.DENSITY));
    for (let i = 0; i < arms; i++) {
      const a = spin + i / arms * TAU;
      game.fireBullet(e.x, e.y, Math.cos(a) * speed, Math.sin(a) * speed,
        { color: color || '#c084fc', r: 3.5, shape: 'orb' });
    }
  }
  function mine(game, e) {
    game.fireBullet(e.x, e.y, SH.rand(-25, 25), 45, { color: '#fbbf24', r: 7, shape: 'orb', life: 1.1, fuse: 1.1 });
  }

  SH.ENEMY_TYPES = {
    drifter: {
      hp: 3, r: 14, score: 100, color: '#f472b6', shape: 'tri', speed: 105,
      update(e, dt) {
        e.y += e.speed * dt;
        e.x += Math.sin(e.t * 2 + e.homeX) * 24 * dt;
        if (e.y > H + 40) e.dead = true;
      }
    },
    weaver: {
      hp: 4, r: 15, score: 150, color: '#38bdf8', shape: 'diamond', fireDelay: 1.4,
      update(e, dt, game) {
        e.y += 82 * dt;
        e.x = e.homeX + Math.sin(e.t * 1.9) * 110;
        e.fire -= dt;
        if (e.fire <= 0) { e.fire = 1.4 / SH.FIRE_RATE; aimed(game, e, 210, 1, 0, '#7dd3fc'); }
        if (e.y > H + 40) e.dead = true;
      }
    },
    orbiter: {
      hp: 6, r: 16, score: 220, color: '#a78bfa', shape: 'hex', fireDelay: 1.8,
      update(e, dt, game) {
        e.y += 58 * dt;
        e.x = e.homeX + Math.cos(e.t * 1.6) * 78;
        e.fire -= dt;
        if (e.fire <= 0) { e.fire = 1.8 / SH.FIRE_RATE; ring(game, e, 10, 145, '#c4b5fd', e.t); }
        if (e.y > H + 40) e.dead = true;
      }
    },
    sniper: {
      hp: 3, r: 13, score: 180, color: '#facc15', shape: 'tri', fireDelay: 1.6,
      update(e, dt, game) {
        if (e.y < 130) e.y += 120 * dt;
        else e.x += Math.sin(e.t * 1.2) * 70 * dt;
        e.fire -= dt;
        if (e.fire <= 0 && e.y >= 130) { e.fire = 1.6 / SH.FIRE_RATE; aimed(game, e, 255, 3, .34, '#fde047', 'needle'); }
        if (e.t > 16) e.dead = true;
      }
    },
    spinner: {
      hp: 9, r: 17, score: 300, color: '#c084fc', shape: 'hex', fireDelay: .16,
      update(e, dt, game) {
        e.y += 42 * dt;
        e.x += Math.sin(e.t * 1.1) * 34 * dt;
        e.fire -= dt;
        if (e.fire <= 0) { e.fire = .16 / SH.FIRE_RATE; spiral(game, e, 3, 165, e.t * 3.1); }
        if (e.y > H + 40) e.dead = true;
      }
    },
    tank: {
      hp: 20, r: 24, score: 500, color: '#94a3b8', shape: 'core', fireDelay: 2.2,
      update(e, dt, game) {
        e.y += 34 * dt;
        e.fire -= dt;
        if (e.fire <= 0) { e.fire = 2.2 / SH.FIRE_RATE; ring(game, e, 14, 120, '#cbd5e1', e.t); aimed(game, e, 190, 5, .5, '#fb7185'); }
        if (e.y > H + 40) e.dead = true;
      }
    },
    bomber: {
      hp: 5, r: 15, score: 260, color: '#fb923c', shape: 'diamond', fireDelay: 1.5,
      update(e, dt, game) {
        e.y += 66 * dt;
        e.x += Math.cos(e.t * 1.4) * 46 * dt;
        e.fire -= dt;
        if (e.fire <= 0) { e.fire = 1.5 / SH.FIRE_RATE; mine(game, e); }
        if (e.y > H + 40) e.dead = true;
      }
    },
    boss: {
      hp: 260, r: 42, score: 5000, color: '#f472b6', shape: 'core', boss: true, fireDelay: 1,
      update(e, dt, game) {
        if (e.y < 120) e.y += 70 * dt;
        else e.x = W / 2 + Math.sin(e.t * .7) * 190;
        const ratio = e.hp / e.maxHp;
        e.fire -= dt;
        if (e.y >= 120 && e.fire <= 0) {
          if (ratio > .66) { e.fire = 1.1 / SH.FIRE_RATE; ring(game, e, 16, 150, '#f9a8d4', e.t); aimed(game, e, 240, 3, .3, '#fb7185'); }
          else if (ratio > .33) { e.fire = .13 / SH.FIRE_RATE; spiral(game, e, 4, 190, e.t * 4.4); }
          else { e.fire = .7 / SH.FIRE_RATE; ring(game, e, 20, 175, '#f472b6', -e.t); aimed(game, e, 300, 7, .9, '#fde047', 'needle'); }
        }
      }
    }
  };

  /* Wave formations — pure placement algorithms used by the stage director. */
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
