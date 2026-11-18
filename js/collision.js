/* JS Idle Shmup — collision lab on bitECS arrays */
(function (SH) {
  'use strict';
  const W = SH.W, H = SH.H;

  function circles(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by, r = ar + br;
    return dx * dx + dy * dy <= r * r;
  }
  function segmentCircle(x0, y0, x1, y1, cx, cy, r) {
    const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
    let t = len2 ? ((cx - x0) * dx + (cy - y0) * dy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = x0 + dx * t - cx, py = y0 + dy * t - cy;
    return px * px + py * py <= r * r;
  }

  SH.Collision = class Collision {
    constructor() {
      this.mode = 'hash'; this.debug = false;
      this.lines = [];
      this.stats = { pairs: 0, candidates: 0, culled: 0, narrow: 0, hits: 0, grazes: 0, hitsBlocked: 0 };
    }
    toggleMode() { this.mode = this.mode === 'hash' ? 'brute' : 'hash'; }
    toggleDebug() { this.debug = !this.debug; }

    step(game) {
      const s = this.stats, world = game.world, C = world.components;
      s.pairs = 0; s.candidates = 0; s.narrow = 0; s.hits = 0; s.grazes = 0; s.hitsBlocked = 0;
      this.lines.length = 0;
      const p = C.Player[game.playerId], P = C.Position, B = C.Bullet, E = C.Enemy, CI = C.Circle;

      const enemies = [...bitECS.query(world, [E])].filter(id => !E.dead[id]);
      game.hash.clear();
      for (const id of enemies) game.hash.insertAt(id, P.x[id], P.y[id], CI.r[id]);

      const bullets = [...bitECS.query(world, [B])];
      for (const id of bullets) {
        if (B.dead[id] || !B.friendly[id]) continue;
        let list;
        if (this.mode === 'hash') {
          list = game.hash.queryIds(P.x[id], P.y[id], 48, []).slice();
          s.candidates += list.length;
        } else { list = enemies; s.candidates += enemies.length; }
        s.pairs += enemies.length;
        for (const eid of list) {
          if (E.dead[eid]) continue;
          s.narrow++;
          if (!circles(P.x[id], P.y[id], CI.r[id], P.x[eid], P.y[eid], CI.r[eid]) &&
              !segmentCircle(P.px[id], P.py[id], P.x[id], P.y[id], P.x[eid], P.y[eid], CI.r[eid] + CI.r[id])) continue;
          if (this.debug && this.lines.length < 40) this.lines.push([P.px[id], P.py[id], P.x[id], P.y[id], '#f472b6']);
          B.dead[id] = 1;
          E.hp[eid] -= B.damage[id]; E.flash[eid] = .08;
          game.burst(P.x[id], P.y[id], '#fef08a', 1);
          s.hits++;
          if (E.hp[eid] <= 0) {
            E.dead[eid] = 1;
            const mult = p.y > SH.H * .78 ? 1 : 3;
            game.score += E.score[eid] * mult;
            p.combo++;
            game.popup(P.x[eid], P.y[eid], '+' + (E.score[eid] * mult), '#fde68a');
            game.burst(P.x[eid], P.y[eid], SH.rgbString(E, eid), E.boss[eid] ? 60 : 14);
            if (!E.boss[eid] && Math.random() < .14) game.spawnItem(P.x[eid], P.y[eid]);
          }
          break;
        }
      }

      for (const id of bullets) {
        if (B.dead[id] || B.friendly[id]) continue;
        const rr = CI.r[id] + p.r;
        if (segmentCircle(P.px[id], P.py[id], P.x[id], P.y[id], p.x, p.y, rr)) {
          B.dead[id] = 1;
          if (p.invuln > 0) s.hitsBlocked++;
          else if (game.hitPlayer()) s.hits++;
          continue;
        }
        if (!B.grazed[id] && circles(P.x[id], P.y[id], CI.r[id], p.x, p.y, p.grazeR)) {
          B.grazed[id] = 1; p.graze++;
          game.score += 1;
          if (p.graze % 8 === 0) game.popup(p.x, p.y - 34, 'GRAZE x' + p.graze, '#fde68a');
          game.burst(P.x[id], P.y[id], '#fbbf24', 1);
          s.grazes++;
          if (this.debug && this.lines.length < 40) this.lines.push([P.x[id], P.y[id], p.x, p.y, '#fbbf24']);
        }
      }
      s.culled = s.pairs ? Math.round((1 - s.candidates / s.pairs) * 100) : 0;
      if (s.culled < 0) s.culled = 0;
    }

    draw(ctx, game) {
      if (!this.debug) return;
      const C = game.world.components, P = C.Position, CI = C.Circle, cell = game.hash.cell;
      ctx.save();
      ctx.strokeStyle = 'rgba(148,163,184,.10)'; ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (const id of bitECS.query(game.world, [C.Enemy])) {
        ctx.strokeStyle = 'rgba(244,114,182,.45)';
        ctx.strokeRect(P.x[id] - CI.r[id], P.y[id] - CI.r[id], CI.r[id] * 2, CI.r[id] * 2);
      }
      for (const l of this.lines) { ctx.strokeStyle = l[4]; ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke(); }
      const p = C.Player[game.playerId];
      ctx.strokeStyle = 'rgba(163,230,53,.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.grazeR, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '11px ui-monospace, Consolas, monospace';
      ctx.fillText('BROADPHASE: ' + this.mode.toUpperCase(), 12, 20);
      ctx.fillText('pairs ' + this.stats.pairs + '  candidates ' + this.stats.candidates + '  culled ' + this.stats.culled + '%', 12, 36);
      ctx.fillText('narrow ' + this.stats.narrow + '  hits ' + this.stats.hits + '  graze ' + this.stats.grazes, 12, 52);
      ctx.restore();
    }
  };

})(window.SH = window.SH || {});
