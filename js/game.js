/* JS Idle Shmup — bitECS-driven game orchestration + idle pilot */
(function (SH) {
  'use strict';
  const W = SH.W, H = SH.H, TAU = SH.TAU;
  const K = SH.RENDER_KIND;

  SH.Game = class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.input = new SH.Input(canvas);
      this.world = SH.createGameWorld();
      this.hash = new SH.SpatialHash(100);
      this.collision = new SH.Collision();
      this.bg = new SH.Background();
      this.director = new SH.Director();
      this.brain = new SH.Brain(SH.POLICY_WEIGHTS);
      this.brainNet = null;
      if (SH.BRAIN_NET_JSON && window.brain) {
        this.brainNet = new brain.NeuralNetwork();
        this.brainNet.fromJSON(SH.BRAIN_NET_JSON);
      }
      this.assist = true;
      this.playerId = bitECS.addEntity(this.world);
      bitECS.addComponent(this.world, this.playerId, this.world.components.Player);
      bitECS.addComponent(this.world, this.playerId, this.world.components.Position);
      bitECS.addComponent(this.world, this.playerId, this.world.components.Render);
      this.world.components.Render.kind[this.playerId] = K.player;
      this.paused = false;
      this.reset();
    }

    get player() { return this.world.components.Player[this.playerId]; }
    get enemyIds() { return bitECS.query(this.world, [this.world.components.Enemy]); }
    get itemIds() { return bitECS.query(this.world, [this.world.components.Item]); }
    get bulletIds() { return bitECS.query(this.world, [this.world.components.Bullet]); }

    reset() {
      const C = this.world.components;
      for (const id of [...bitECS.query(this.world, [C.Enemy]), ...bitECS.query(this.world, [C.Bullet]),
                        ...bitECS.query(this.world, [C.Particle]), ...bitECS.query(this.world, [C.Popup]),
                        ...bitECS.query(this.world, [C.Item])]) bitECS.removeEntity(this.world, id);
      C.Player[this.playerId] = {
        x: W / 2, y: H - 70, vx: 0, vy: 0, r: 4, size: 16, grazeR: 30,
        shield: 3, maxShield: 3, invuln: 0, dash: 0, dashCd: 0,
        fireTimer: 0, power: 2, combo: 0, graze: 0, lastHit: 0, lastActionX: 0, lastActionY: 0,
        autoX: W / 2, autoY: H - 70, sprite: null
      };
      C.Position.x[this.playerId] = W / 2; C.Position.y[this.playerId] = H - 70;
      this.score = 0; this.elapsed = 0; this.hits = 0; this.bottomTime = 0;
      this.director.start(0);
      this.bg.setStage(0);
    }

    addPos(id, x, y) {
      const C = this.world.components;
      C.Position.x[id] = x; C.Position.y[id] = y; C.Position.px[id] = x; C.Position.py[id] = y;
      bitECS.addComponent(this.world, id, C.Position);
      bitECS.addComponent(this.world, id, C.Render);
    }
    fireBullet(x, y, vx, vy, o) {
      o = o || {};
      const id = bitECS.addEntity(this.world), C = this.world.components;
      this.addPos(id, x, y);
      bitECS.addComponent(this.world, id, C.Velocity);
      bitECS.addComponent(this.world, id, C.Circle);
      bitECS.addComponent(this.world, id, C.Bullet);
      C.Velocity.x[id] = vx; C.Velocity.y[id] = vy;
      C.Circle.r[id] = o.r || 4;
      const B = C.Bullet;
      B.friendly[id] = o.friendly ? 1 : 0;
      B.damage[id] = o.damage || 1;
      B.grazed[id] = 0; B.fuse[id] = o.fuse || 0;
      B.life[id] = o.life || 6; B.maxLife[id] = o.life || 6;
      B.dead[id] = 0;
      B.shape[id] = o.shape === 'needle' ? 1 : o.shape === 'diamond' ? 2 : 0;
      const c = SH.hexRGB(o.color || '#fff');
      B.cr[id] = c[0]; B.cg[id] = c[1]; B.cb[id] = c[2];
      C.Render.kind[id] = K.bullet;
    }
    spawn(type, x, y, o) {
      o = o || {};
      const id = bitECS.addEntity(this.world), C = this.world.components;
      this.addPos(id, x, y);
      bitECS.addComponent(this.world, id, C.Enemy);
      bitECS.addComponent(this.world, id, C.Circle);
      const def = SH.ENEMY_TYPES[type], E = C.Enemy;
      E.type[id] = SH.ENEMY_INDEX[type]; E.t[id] = 0;
      E.fire[id] = def.fireDelay ? SH.rand(.2, def.fireDelay) : 0;
      E.homeX[id] = x; E.homeY[id] = y;
      E.speed[id] = def.speed || 60;
      E.hp[id] = o.hp || def.hp; E.maxHp[id] = o.hp || def.hp;
      E.score[id] = def.score; E.boss[id] = def.boss ? 1 : 0;
      E.flash[id] = 0; E.dead[id] = 0;
      E.shape[id] = def.shape === 'diamond' ? 2 : def.shape === 'hex' ? 3 : def.shape === 'core' ? 4 : 1;
      const c = SH.hexRGB(def.color);
      E.cr[id] = c[0]; E.cg[id] = c[1]; E.cb[id] = c[2];
      C.Circle.r[id] = def.r;
      C.Render.kind[id] = K.enemy;
    }
    spawnItem(x, y) {
      const id = bitECS.addEntity(this.world), C = this.world.components;
      this.addPos(id, x, y);
      bitECS.addComponent(this.world, id, C.Item);
      C.Render.kind[id] = K.item;
    }
    burst(x, y, color, count) {
      if (SH.HEADLESS) return;
      const c = SH.hexRGB(color);
      const C = this.world.components;
      for (let i = 0; i < count; i++) {
        const id = bitECS.addEntity(this.world);
        this.addPos(id, x, y);
        bitECS.addComponent(this.world, id, C.Velocity);
        bitECS.addComponent(this.world, id, C.Particle);
        const a = Math.random() * TAU, s = SH.rand(40, 190);
        C.Velocity.x[id] = Math.cos(a) * s; C.Velocity.y[id] = Math.sin(a) * s;
        const life = SH.rand(.25, .7);
        C.Particle.life[id] = life; C.Particle.max[id] = life;
        C.Particle.size[id] = SH.rand(2, 5);
        C.Particle.cr[id] = c[0]; C.Particle.cg[id] = c[1]; C.Particle.cb[id] = c[2];
        C.Render.kind[id] = K.particle;
      }
    }
    popup(x, y, text, color) {
      if (SH.HEADLESS) return;
      const c = SH.hexRGB(color), C = this.world.components;
      const id = bitECS.addEntity(this.world);
      this.addPos(id, x, y);
      bitECS.addComponent(this.world, id, C.Popup);
      C.Popup.life[id] = .9; C.Popup.text[id] = text;
      C.Popup.cr[id] = c[0]; C.Popup.cg[id] = c[1]; C.Popup.cb[id] = c[2];
      C.Render.kind[id] = K.popup;
    }
    ringBurst(x, y, count, speed, color) {
      for (let i = 0; i < count; i++) {
        const a = i / count * TAU;
        this.fireBullet(x, y, Math.cos(a) * speed, Math.sin(a) * speed, { color, r: 4, shape: 'diamond' });
      }
    }
    hitPlayer() {
      const p = this.player;
      if (p.invuln > 0) return false;
      p.shield--; p.combo = 0; p.invuln = 1.6; p.lastHit = 0; this.hits++;
      this.burst(p.x, p.y, '#f87171', 26);
      this.popup(p.x, p.y - 28, 'HIT!', '#f87171');
      if (p.shield <= 0) { p.shield = p.maxShield; this.popup(p.x, p.y - 50, 'RESPAWN', '#fbbf24'); }
      return true;
    }

    nextStage() { this.bg.next(); this.director.start(this.bg.index); }
    onStageClear() {
      const bonus = 1000 * (this.bg.index + 1);
      this.score += bonus;
      this.popup(W / 2, H / 2, 'STAGE CLEAR  +' + bonus, '#a3e635');
      this.nextStage();
    }
    togglePause() {
      this.paused = !this.paused;
      const b = document.getElementById('pauseButton');
      if (b) { b.textContent = this.paused ? 'Resume' : 'Pause'; b.setAttribute('aria-pressed', String(this.paused)); }
      const ov = document.getElementById('pauseOverlay'); if (ov) ov.hidden = !this.paused;
    }
    toggleAssist() {
      this.assist = !this.assist;
      const b = document.getElementById('assistButton'); if (b) b.textContent = 'Drag assist: ' + (this.assist ? 'ON' : 'OFF');
      return this.assist;
    }
    toggleDebug() {
      this.collision.toggleDebug();
      const b = document.getElementById('debugButton'); if (b) b.textContent = 'Collisions: ' + (this.collision.debug ? 'ON' : 'OFF');
    }
    toggleBroadphase() {
      this.collision.toggleMode();
      const b = document.getElementById('modeButton'); if (b) b.textContent = 'Broadphase: ' + this.collision.mode.toUpperCase();
    }

    threatAt(x, y, grazeBonus) {
      const C = this.world.components, P = C.Position, B = C.Bullet, V = C.Velocity;
      let s = 0;
      for (const id of this.bulletIds) {
        if (B.friendly[id] || B.dead[id]) continue;
        const vx = V.x[id], vy = V.y[id], l2 = vx * vx + vy * vy;
        let t = l2 ? ((x - P.x[id]) * vx + (y - P.y[id]) * vy) / l2 : 0;
        t = t < 0 ? 0 : t > .55 ? .55 : t;
        const px = P.x[id] + vx * t, py = P.y[id] + vy * t;
        const dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
        if (d2 < 150 * 150) {
          const d = Math.sqrt(d2);
          s += (150 - d) / (d + 12);
          if (grazeBonus && d2 < 34 * 34) s -= grazeBonus;
        }
      }
      return s;
    }

    /* Single pilot: average of the evolved MLP and the evolved brain.js net. */
    autopilot() {
      const p = this.player;
      const f = this.brain.features(this);
      let ax = SH.clamp(m[0], -1, 1), ay = SH.clamp(m[1], -1, 1);
      p.lastActionX = ax; p.lastActionY = ay;
      return { x: p.x + ax * 95, y: p.y + ay * 95 };
    }

    /* Drag assist: the same ensemble nudges the target away from bullets. */
    assistedTarget(tx, ty) {
      if (!this.assist) return { x: tx, y: ty };
      const p = this.player;
      const dir = this.autopilot();
      const ax = SH.clamp((dir.x - p.x) / 95, -1, 1);
      const ay = SH.clamp((dir.y - p.y) / 95, -1, 1);
      const k = Math.min(1, this.threatAt(p.x, p.y, 0) / 12);
      return {
        x: SH.clamp(tx + ax * 70 * k, 24, SH.W - 24),
        y: SH.clamp(ty + ay * 70 * k, SH.H / 2, SH.H - 24)
      };
    }

    updatePlayer(dt) {
      const p = this.player, input = this.input;
      p.invuln = Math.max(0, p.invuln - dt);
      p.dashCd = Math.max(0, p.dashCd - dt);
      p.lastHit += dt;
      if (p.lastHit > 10 && p.shield < p.maxShield) { p.shield++; p.lastHit = 0; this.popup(p.x, p.y - 24, '+SHIELD', '#a3e635'); }

      const focus = input.focus, axis = input.axis;
      let tx, ty;
      if (input.pointer.down) { const t = this.assistedTarget(input.pointer.x, input.pointer.y); tx = t.x; ty = t.y; }
      else if (axis.x || axis.y) { const t = this.assistedTarget(p.x + axis.x * 100, p.y + axis.y * 100); tx = t.x; ty = t.y; }
      else { const t = this.autopilot(); tx = t.x; ty = t.y; }

      const speed = (focus ? 165 : 330) * (p.dash > 0 ? 3.2 : 1);
      const dx = SH.clamp(tx - p.x, -speed * dt, speed * dt);
      const dy = SH.clamp(ty - p.y, -speed * dt, speed * dt);
      p.vx = SH.lerp(p.vx, dx / dt, .25); p.vy = SH.lerp(p.vy, dy / dt, .25);
      p.x = SH.clamp(p.x + dx, p.size, W - p.size);
      p.y = SH.clamp(p.y + dy, p.size, H - p.size);
      if (p.dash > 0) p.dash -= dt;
      if (input.down('Space') && p.dashCd <= 0) {
        p.dash = .16; p.dashCd = 1.6; p.invuln = Math.max(p.invuln, .25);
        this.burst(p.x, p.y, '#22d3ee', 12);
      }
      p.fireTimer -= dt;
      if (p.fireTimer <= 0) {
        p.fireTimer = focus ? .07 : .05;
        const n = focus ? Math.max(2, p.power - 1) : p.power;
        const spread = focus ? .1 : .22;
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (n === 1 ? 0 : (i / (n - 1) - .5) * spread * 2);
          this.fireBullet(p.x, p.y - 8, Math.cos(a) * 620, Math.sin(a) * 620, { friendly: true, shape: 'needle', color: '#7dd3fc', r: 3, damage: 1 });
        }
      }
    }

    update(dt) {
      if (this.paused) return;
      this.elapsed += dt;
      const pl = this.player;
      if (pl.y > SH.H * .78) { this.bottomTime += dt; this.score = Math.max(0, this.score - 220 * dt); }
      if (!SH.HEADLESS) this.bg.update(dt);
      this.updatePlayer(dt);
      this.director.update(dt, this);
      SH.movementSystem(this.world, dt);
      SH.enemySystem(this.world, dt, this);
      this.collision.step(this);

      const C = this.world.components, p = this.player;
      for (const id of this.itemIds) {
        if (Math.hypot(C.Position.x[id] - p.x, C.Position.y[id] - p.y) < 22) {
          p.power = Math.min(8, p.power + 1);
          this.popup(C.Position.x[id], C.Position.y[id], 'POWER UP', '#a3e635');
          bitECS.removeEntity(this.world, id);
        }
      }
      for (const id of this.bulletIds) if (C.Bullet.dead[id]) bitECS.removeEntity(this.world, id);
      for (const id of bitECS.query(this.world, [C.Particle])) if (C.Particle.life[id] <= 0) bitECS.removeEntity(this.world, id);
      for (const id of bitECS.query(this.world, [C.Popup])) if (C.Popup.life[id] <= 0) bitECS.removeEntity(this.world, id);
      for (const id of this.enemyIds) {
        if (C.Enemy.dead[id] || C.Position.y[id] > SH.H + 80) bitECS.removeEntity(this.world, id);
      }
    }

    render() {
      const ctx = this.ctx;
      this.bg.draw(ctx);
      SH.renderEntities(ctx, this.world);
      this.collision.draw(ctx, this);
      const C = this.world.components, p = this.player;
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('enemiesDowned', Math.floor(this.score / 100));
      set('playerHits', p.maxShield - p.shield);
      set('powerUpsCollected', p.power);
      set('scoreValue', this.score.toLocaleString());
      set('shieldValue', p.shield + '/' + p.maxShield);
      set('grazeValue', p.graze);
      set('cullValue', this.collision.stats.culled + '%');
      set('bulletValue', this.bulletIds.reduce((n, id) => n + (C.Bullet.friendly[id] ? 0 : 1), 0));
    }
  };

})(window.SH = window.SH || {});
