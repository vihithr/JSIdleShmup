/* JS Idle Shmup — central game object tying all systems together */
(function (SH) {
  'use strict';
  const W = SH.W, H = SH.H, TAU = SH.TAU;

  SH.Game = class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.input = new SH.Input(canvas);
      this.bg = new SH.Background();
      this.director = new SH.Director();
      this.hash = new SH.SpatialHash(100);
      this.bullets = new SH.Pool(() => new SH.Bullet());
      this.particles = new SH.Pool(() => new SH.Particle());
      this.popups = new SH.Pool(() => new SH.Popup());
      this.enemies = [];
      this.items = [];
      this.sprite = null;
      this.player = new SH.Player(this.sprite);
      this.paused = false;
      this.reset();
    }

    reset() {
      this.enemies.length = 0; this.items.length = 0;
      this.bullets.releaseAll(); this.particles.releaseAll(); this.popups.releaseAll();
      this.player.reset();
      this.score = 0;
      this.elapsed = 0;
      this.director.start(0);
      this.bg.setStage(0);
    }

    setSprite(img) { this.sprite = img; this.player.sprite = img; }
    setCustomBg(img) { this.bg.setCustom(img); }

    /* --- spawning helpers --- */
    fireBullet(x, y, vx, vy, opts) { this.bullets.acquire().reset(x, y, vx, vy, opts || {}); }
    popup(x, y, text, color) { this.popups.acquire().reset(x, y, text, color); }
    burst(x, y, color, count) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU, s = SH.rand(40, 190);
        this.particles.acquire().reset(x, y, Math.cos(a) * s, Math.sin(a) * s, SH.rand(.25, .7), color, SH.rand(2, 5));
      }
    }
    spawn(type, x, y, opts) { this.enemies.push(new SH.Enemy().reset(type, x, y, opts || {})); }
    ringBurst(x, y, count, speed, color) {
      for (let i = 0; i < count; i++) {
        const a = i / count * TAU;
        this.fireBullet(x, y, Math.cos(a) * speed, Math.sin(a) * speed, { color, r: 4, shape: 'diamond' });
      }
    }

    nextStage() { this.bg.next(); this.director.start(this.bg.index); }
    onStageClear() {
      this.score += 1000 * (this.bg.index + 1);
      this.popup(W / 2, H / 2, 'STAGE CLEAR  +' + 1000 * (this.bg.index + 1), '#a3e635');
      this.nextStage();
    }
    togglePause() {
      this.paused = !this.paused;
      const b = document.getElementById('pauseButton');
      b.textContent = this.paused ? 'Resume' : 'Pause';
      b.setAttribute('aria-pressed', String(this.paused));
      document.getElementById('pauseOverlay').hidden = !this.paused;
    }

    /* --- idle auto-pilot: dodge nearby bullets, drift toward weakest enemy --- */
    autopilot(dt) {
      const p = this.player;
      let ax = 0, ay = 0;
      for (const b of this.bullets.used) {
        if (b.friendly) continue;
        const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
        if (d < 95 && d > .1) { const f = (95 - d) / 95 * 320; ax -= dx / d * f; ay -= dy / d * f; }
      }
      let target = null, best = Infinity;
      for (const e of this.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < best) { best = d; target = e; }
      }
      if (!this.input.pointer.down && !this.input.axis.x && !this.input.axis.y) {
        if (target) { ax += SH.clamp((target.x - p.x) * 1.5, -90, 90); ay += SH.clamp((target.y - p.y) * .35, -40, 40); }
        const desiredX = SH.clamp(p.x + ax * dt, 20, W - 20);
        const desiredY = SH.clamp(p.y + ay * dt, H / 2, H - 20);
        p.autoX = SH.lerp(p.autoX, desiredX, .18);
        p.autoY = SH.lerp(p.autoY, desiredY, .18);
      }
      return target;
    }

    update(dt) {
      if (this.paused) return;
      this.elapsed += dt;
      this.bg.update(dt);
      const target = this.autopilot(dt);
      this.player.update(dt, this.input, this);
      this.director.update(dt, this);

      for (const e of this.enemies) e.update(dt, this);
      for (const b of this.bullets.used) {
        b.update(dt);
        if (b.fuse && b.life <= .14 && !b.dead) { b.dead = true; this.ringBurst(b.x, b.y, 12, 170, '#fbbf24'); }
      }
      for (const p of this.particles.used) p.update(dt);
      for (const p of this.popups.used) p.update(dt);

      this.collide();

      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        it.y += 90 * dt;
        if (Math.hypot(it.x - this.player.x, it.y - this.player.y) < 22) {
          this.player.power = Math.min(6, this.player.power + 1);
          this.popup(it.x, it.y, 'POWER UP', '#a3e635');
          this.items.splice(i, 1);
        } else if (it.y > H + 20) this.items.splice(i, 1);
      }

      this.enemies = this.enemies.filter(e => !e.dead);
      this.bullets.sweep(b => !b.dead);
      this.particles.sweep(p => p.life > 0);
      this.popups.sweep(p => p.life > 0);
      this.target = target;
    }

    collide() {
      this.hash.clear();
      for (const e of this.enemies) this.hash.insert(e);
      const p = this.player;

      for (const b of this.bullets.used) {
        if (b.dead || b.friendly) continue;
        const dx = b.x - p.x, dy = b.y - p.y;
        if (dx * dx + dy * dy < (b.r + p.r) * (b.r + p.r)) {
          b.dead = true;
          if (p.hit(this)) break;
        }
      }

      for (const b of this.bullets.used) {
        if (b.dead || !b.friendly) continue;
        for (const e of this.hash.query(b.x, b.y, 40)) {
          if (e.dead) continue;
          const dx = b.x - e.x, dy = b.y - e.y, rr = b.r + e.r;
          if (dx * dx + dy * dy > rr * rr) continue;
          b.dead = true;
          const killed = e.hit(b.damage);
          this.particles.acquire().reset(b.x, b.y, SH.rand(-40, 40), SH.rand(-60, 0), .22, '#fef08a', 3);
          if (killed) {
            this.score += e.score;
            p.combo++;
            this.popup(e.x, e.y, '+' + e.score, '#fde68a');
            this.burst(e.x, e.y, e.color, e.boss ? 60 : 14);
            if (!e.boss && Math.random() < .14) this.items.push({ x: e.x, y: e.y });
          }
          break;
        }
      }
    }

    render() {
      const ctx = this.ctx;
      this.bg.draw(ctx);
      this.items.forEach(it => { ctx.fillStyle = '#a3e635'; ctx.shadowColor = '#a3e635'; ctx.shadowBlur = 12; ctx.fillRect(it.x - 6, it.y - 6, 12, 12); ctx.shadowBlur = 0; });
      for (const e of this.enemies) e.draw(ctx);
      for (const b of this.bullets.used) b.draw(ctx);
      for (const p of this.particles.used) p.draw(ctx);
      this.player.draw(ctx, this.target);
      for (const p of this.popups.used) p.draw(ctx);

      // DOM HUD
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('enemiesDowned', Math.floor(this.score / 100));
      set('playerHits', this.player.maxShield - this.player.shield);
      set('powerUpsCollected', this.player.power);
      set('scoreValue', this.score.toLocaleString());
      set('shieldValue', this.player.shield + '/' + this.player.maxShield);
    }
  };

})(window.SH = window.SH || {});
