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

    /* --- Idle AI: potential-field steering. This is the primary player. ---
       Three strategies trade score against survival:
         graze — hold near the graze ring to farm combo
         evade — stronger repulsion, maximum safety
         hunt  — chase enemies, ignore minor threats                    */
    autopilot(dt) {
      const p = this.player;
      const mode = this.aiMode;
      const danger = mode === 'evade' ? 130 : mode === 'hunt' ? 52 : 92;
      const strength = mode === 'evade' ? 520 : mode === 'hunt' ? 190 : 330;
      let ax = 0, ay = 0;

      for (const b of this.bullets.used) {
        if (b.friendly) continue;
        const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
        if (d > danger || d < .01) continue;
        // Inverse-square-like repulsion, stronger the closer the bullet gets.
        const f = Math.pow(1 - d / danger, 2) * strength;
        ax -= dx / d * f; ay -= dy / d * f;
        if (mode === 'graze' && d > p.r + b.r + 8 && d < p.grazeR) {
          // Hold just outside the hitbox: grazing scores without risking a hit.
          ax += dx / d * f * .45; ay += dy / d * f * .45;
        }
      }

      let target = null, best = Infinity;
      for (const e of this.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < best) { best = d; target = e; }
      }
      const hunt = mode === 'hunt' ? 2.1 : mode === 'graze' ? 1.35 : .7;
      if (target) {
        ax += SH.clamp((target.x - p.x) * hunt, -120, 120);
        ay += SH.clamp((target.y - p.y) * hunt * .35, -45, 45);
      }
      for (const it of this.items) {
        const dx = it.x - p.x, dy = it.y - p.y, d = Math.hypot(dx, dy);
        if (d < 190) { ax += dx / d * 130; ay += dy / d * 130; }
      }
      // Keep away from the screen edges and the bullet-spawning ceiling.
      ax += (W / 2 - p.x) * .22;
      ay += (H * .72 - p.y) * .28;
      ax += Math.sin(this.elapsed * .9) * 18;

      if (!this.input.pointer.down && !this.input.axis.x && !this.input.axis.y) {
        const nx = SH.clamp(p.x + ax * dt, 24, W - 24);
        const ny = SH.clamp(p.y + ay * dt, H / 2, H - 24);
        p.autoX = SH.lerp(p.autoX, nx, .16);
        p.autoY = SH.lerp(p.autoY, ny, .16);
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
    }
  };

})(window.SH = window.SH || {});
