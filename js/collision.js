/* JS Idle Shmup — collision lab: broadphase, swept narrowphase and graze */
(function (SH) {
  'use strict';
  const W = SH.W, H = SH.H;

  /* Squared circle overlap — cheap narrowphase for stationary checks. */
  function circles(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by, r = ar + br;
    return dx * dx + dy * dy <= r * r;
  }

  /* Swept segment vs circle: solves the closest point on a bullet's travel
     segment, so fast bullets cannot tunnel through the tiny player hitbox. */
  function segmentCircle(x0, y0, x1, y1, cx, cy, r) {
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((cx - x0) * dx + (cy - y0) * dy) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = x0 + dx * t - cx, py = y0 + dy * t - cy;
    return px * px + py * py <= r * r;
  }

  SH.Collision = class Collision {
    constructor() {
      this.mode = 'hash';       // 'hash' or 'brute' — compare both live
      this.debug = false;
      this.tmp = [];
      this.lines = [];
      this.stats = { pairs: 0, candidates: 0, narrow: 0, culled: 0, hits: 0, grazes: 0, hitsBlocked: 0 };
    }
    toggleMode() { this.mode = this.mode === 'hash' ? 'brute' : 'hash'; }
    toggleDebug() { this.debug = !this.debug; }

    step(game, dt) {
      const s = this.stats;
      s.pairs = 0; s.candidates = 0; s.narrow = 0; s.hits = 0; s.grazes = 0; s.hitsBlocked = 0;
      this.lines.length = 0;
      const p = game.player;

      // Broadphase: uniform grid of enemy AABBs. 'brute' keeps every pair for comparison.
      game.hash.clear();
      for (const e of game.enemies) game.hash.insert(e);

      // --- friendly bullets vs enemies (swept) ---
      for (const b of game.bullets.used) {
        if (b.dead || !b.friendly) continue;
        let list;
        if (this.mode === 'hash') {
          list = game.hash.query(b.x, b.y, 48, this.tmp).slice();
          s.candidates += list.length;
        } else { list = game.enemies; s.candidates += game.enemies.length; }
        s.pairs += game.enemies.length;
        for (const e of list) {
          if (e.dead) continue;
          s.narrow++;
          if (!circles(b.x, b.y, b.r, e.x, e.y, e.r) &&
              !segmentCircle(b.px, b.py, b.x, b.y, e.x, e.y, e.r + b.r)) continue;
          if (this.debug && this.lines.length < 40) this.lines.push([b.px, b.py, b.x, b.y, '#f472b6']);
          b.dead = true;
          const killed = e.hit(b.damage);
          game.particles.acquire().reset(b.x, b.y, SH.rand(-40, 40), SH.rand(-60, 0), .22, '#fef08a', 3);
          s.hits++;
          if (killed) {
            game.score += e.score;
            p.combo++;
            game.popup(e.x, e.y, '+' + e.score, '#fde68a');
            game.burst(e.x, e.y, e.color, e.boss ? 60 : 14);
            if (!e.boss && Math.random() < .14) game.items.push({ x: e.x, y: e.y });
          }
          break;
        }
      }

      // --- enemy bullets vs player: swept hit test + graze ring ---
      for (const b of game.bullets.used) {
        if (b.dead || b.friendly) continue;
        const rr = b.r + p.r;
        if (segmentCircle(b.px, b.py, b.x, b.y, p.x, p.y, rr)) {
          b.dead = true;
          if (p.invuln > 0) s.hitsBlocked++;
          else if (p.hit(game)) s.hits++;
          continue;
        }
        if (!b.grazed && circles(b.x, b.y, b.r, p.x, p.y, p.grazeR)) {
          b.grazed = true;
          p.graze++;
          game.score += 5 + Math.min(50, p.combo);
          if (p.graze % 8 === 0) game.popup(p.x, p.y - 34, 'GRAZE x' + p.graze, '#fde68a');
          game.particles.acquire().reset(b.x, b.y, SH.rand(-30, 30), SH.rand(-30, 30), .25, '#fbbf24', 2);
          s.grazes++;
          if (this.debug && this.lines.length < 40) this.lines.push([b.x, b.y, p.x, p.y, '#fbbf24']);
        }
      }
      s.culled = s.pairs ? Math.round((1 - s.candidates / s.pairs) * 100) : 0;
      if (s.culled < 0) s.culled = 0;
    }

    draw(ctx, game) {
      if (!this.debug) return;
      const cell = game.hash.cell;
      ctx.save();
      ctx.strokeStyle = 'rgba(148,163,184,.10)'; ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (const e of game.enemies) {
        ctx.strokeStyle = 'rgba(244,114,182,.45)';
        ctx.strokeRect(e.x - e.r, e.y - e.r, e.r * 2, e.r * 2);
      }
      for (const l of this.lines) {
        ctx.strokeStyle = l[4]; ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke();
      }
      const p = game.player;
      ctx.strokeStyle = 'rgba(163,230,53,.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.grazeR, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '11px ui-monospace, Consolas, monospace';
      ctx.fillText('BROADPHASE: ' + this.mode.toUpperCase(), 12, 20);
      ctx.fillText('pairs ' + this.stats.pairs + '  candidates ' + this.stats.candidates + '  culled ' + this.stats.culled + '%', 12, 36);
      ctx.fillText('narrow ' + this.stats.narrow + '  hits ' + this.stats.hits + '  graze ' + this.stats.grazes, 12, 52);
      ctx.restore();
    }
  };

  SH.segmentCircle = segmentCircle;
  SH.circles = circles;

})(window.SH = window.SH || {});
