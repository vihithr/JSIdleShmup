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
      this.collision = new SH.Collision();
      this.aiMode = 'graze';
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
    cycleAI() {
      this.aiMode = this.aiMode === 'graze' ? 'evade' : this.aiMode === 'evade' ? 'hunt' : 'graze';
      const b = document.getElementById('aiButton');
      if (b) b.textContent = 'AI: ' + this.aiMode.toUpperCase();
      return this.aiMode;
    }
    toggleDebug() {
      this.collision.toggleDebug();
      const b = document.getElementById('debugButton');
      if (b) b.textContent = this.collision.debug ? 'Collisions: ON' : 'Collisions: OFF';
      return this.collision.debug;
    }
    toggleBroadphase() {
      this.collision.toggleMode();
      const b = document.getElementById('modeButton');
      if (b) b.textContent = 'Broadphase: ' + this.collision.mode.toUpperCase();
      return this.collision.mode;
    }
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

    /* --- Idle AI is the primary player -------------------------------------
       Predictive threat sampling: for each candidate position we compute the
       closest approach of every enemy bullet over the next 0.55 s, then pick
       the safest direction with local search. Grazing is rewarded so the AI
       deliberately hugs the danger zone instead of running away.          */
    threatAt(x, y, grazeBonus) {
      let s = 0;
      for (const b of this.bullets.used) {
        if (b.friendly) continue;
        const vx = b.vx, vy = b.vy, l2 = vx * vx + vy * vy;
        let t = l2 ? ((x - b.x) * vx + (y - b.y) * vy) / l2 : 0;
        t = t < 0 ? 0 : t > .55 ? .55 : t;
        const px = b.x + vx * t, py = b.y + vy * t;
        const dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
        if (d2 < 150 * 150) {
          const d = Math.sqrt(d2);
          s += (150 - d) / (d + 12);
          if (grazeBonus && d2 < 34 * 34) s -= grazeBonus;
        }
      }
      return s;
    }

    autopilot(dt) {
      const p = this.player;
      const mode = this.aiMode;
      const sampleR = mode === 'evade' ? 40 : mode === 'graze' ? 28 : 18;
      const threatW = mode === 'evade' ? 1.5 : mode === 'graze' ? 1.0 : .65;
      const grazeW = mode === 'graze' ? .5 : .08;
      const chaseW = mode === 'hunt' ? 1 : mode === 'graze' ? .45 : .25;

      let target = null, best = Infinity;
      for (const e of this.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < best) { best = d; target = e; }
      }
      const panic = this.threatAt(p.x, p.y, 0) > 14 ? 1.5 : 1;
      let bestScore = Infinity, bx = p.x, by = p.y;
      for (let i = -1; i < 16; i++) {
        const a = i / 16 * SH.TAU;
        const x = i < 0 ? p.x : SH.clamp(p.x + Math.cos(a) * sampleR * panic, 24, SH.W - 24);
        const y = i < 0 ? p.y : SH.clamp(p.y + Math.sin(a) * sampleR * panic, SH.H / 2, SH.H - 24);
        let score = this.threatAt(x, y, grazeW) * threatW;
        if (target) score -= (220 - Math.min(220, Math.hypot(target.x - x, target.y - y))) * .012 * chaseW;
        for (const it of this.items) {
          const d = Math.hypot(it.x - x, it.y - y);
          if (d < 160) score -= (160 - d) * .02;
        }
        score += Math.abs(SH.W / 2 - x) * .0006 + Math.abs(SH.H * .72 - y) * .0012;
        if (score < bestScore) { bestScore = score; bx = x; by = y; }
      }
      if (!this.input.pointer.down && !this.input.axis.x && !this.input.axis.y) {
        p.autoX = SH.lerp(p.autoX, bx, .6);
        p.autoY = SH.lerp(p.autoY, by, .6);
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

      this.collision.step(this, dt);

      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        it.y += 90 * dt;
        if (Math.hypot(it.x - this.player.x, it.y - this.player.y) < 22) {
          this.player.power = Math.min(8, this.player.power + 1);
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

    render() {
      const ctx = this.ctx;
      this.bg.draw(ctx);
      this.items.forEach(it => { ctx.fillStyle = '#a3e635'; ctx.shadowColor = '#a3e635'; ctx.shadowBlur = 12; ctx.fillRect(it.x - 6, it.y - 6, 12, 12); ctx.shadowBlur = 0; });
      for (const e of this.enemies) e.draw(ctx);
      for (const b of this.bullets.used) b.draw(ctx);
      for (const p of this.particles.used) p.draw(ctx);
      this.player.draw(ctx, this.target);
      for (const p of this.popups.used) p.draw(ctx);
      this.collision.draw(ctx, this);

      // DOM HUD
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('enemiesDowned', Math.floor(this.score / 100));
      set('playerHits', this.player.maxShield - this.player.shield);
      set('powerUpsCollected', this.player.power);
      set('scoreValue', this.score.toLocaleString());
      set('shieldValue', this.player.shield + '/' + this.player.maxShield);
      set('grazeValue', this.player.graze);
      set('cullValue', this.collision.stats.culled + '%');
      set('bulletValue', this.bullets.used.reduce((n, b) => n + (b.friendly ? 0 : 1), 0));
    }
  };

})(window.SH = window.SH || {});
