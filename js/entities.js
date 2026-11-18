/* JS Idle Shmup — game entities */
(function (SH) {
  'use strict';
  const W = SH.W, H = SH.H, TAU = SH.TAU;

  SH.Bullet = class Bullet {
    reset(x, y, vx, vy, opts) {
      this.x = x; this.y = y; this.px = x; this.py = y;
      this.vx = vx; this.vy = vy;
      this.grazed = false;
      this.r = opts.r || 4; this.color = opts.color || '#fff';
      this.friendly = !!opts.friendly; this.damage = opts.damage || 1;
      this.shape = opts.shape || 'orb'; this.life = opts.life || 6;
      this.angle = Math.atan2(vy, vx); this.dead = false;
      return this;
    }
    update(dt) {
      this.px = this.x; this.py = this.y;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.life -= dt;
      if (this.life <= 0 || this.x < -30 || this.x > W + 30 || this.y < -30 || this.y > H + 30) this.dead = true;
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = this.color;
      if (this.shape === 'needle') {
        ctx.rotate(this.angle + Math.PI / 2);
        ctx.fillRect(-1.5, -8, 3, 16);
      } else if (this.shape === 'diamond') {
        ctx.rotate(this.angle);
        ctx.beginPath(); ctx.moveTo(this.r * 1.6, 0); ctx.lineTo(0, this.r); ctx.lineTo(-this.r, 0); ctx.lineTo(0, -this.r); ctx.closePath(); ctx.fill();
      } else {
        ctx.shadowColor = this.color; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  };

  SH.Particle = class Particle {
    reset(x, y, vx, vy, life, color, size) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.life = life; this.max = life; this.color = color; this.size = size;
      return this;
    }
    update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= .97; this.vy *= .97; this.life -= dt; }
    draw(ctx) { ctx.globalAlpha = Math.max(0, this.life / this.max); ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, this.size, this.size); ctx.globalAlpha = 1; }
  };

  SH.Popup = class Popup {
    reset(x, y, text, color) { this.x = x; this.y = y; this.text = text; this.color = color; this.life = .9; return this; }
    update(dt) { this.y -= 26 * dt; this.life -= dt; }
    draw(ctx) {
      ctx.globalAlpha = Math.max(0, this.life / .9);
      ctx.fillStyle = this.color;
      ctx.font = '600 12px ui-monospace, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.text, this.x, this.y);
      ctx.globalAlpha = 1;
    }
  };

  SH.Enemy = class Enemy {
    constructor() { this.dead = false; }
    reset(type, x, y, opts) {
      const def = SH.ENEMY_TYPES[type];
      this.type = type; this.def = def;
      this.x = x; this.y = y; this.homeX = x; this.homeY = y;
      this.vx = opts.vx || 0; this.vy = opts.vy || 0;
      this.speed = def.speed || 60;
      this.hp = opts.hp || def.hp; this.maxHp = this.hp;
      this.r = def.r; this.score = def.score; this.color = def.color;
      this.t = 0; this.fire = def.fireDelay ? SH.rand(.2, def.fireDelay) : 0;
      this.phase = 0; this.boss = !!def.boss; this.dead = false;
      this.flash = 0;
      return this;
    }
    hit(dmg) {
      this.hp -= dmg;
      this.flash = .08;
      if (this.hp <= 0) { this.dead = true; return true; }
      return false;
    }
    update(dt, game) {
      this.t += dt;
      if (this.flash > 0) this.flash -= dt;
      this.def.update(this, dt, game);
    }
    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const sprite = SH.ENEMY_SPRITE;
      if (sprite && sprite.complete && sprite.naturalWidth) {
        ctx.drawImage(sprite, -this.r * 1.3, -this.r * 1.3, this.r * 2.6, this.r * 2.6);
        if (this.boss) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(-60, -this.r - 18, 120, 5); ctx.fillStyle = '#f472b6'; ctx.fillRect(-60, -this.r - 18, 120 * Math.max(0, this.hp / this.maxHp), 5); }
        ctx.restore();
        return;
      }
      const c = this.flash > 0 ? '#fff' : this.color;
      ctx.fillStyle = c; ctx.strokeStyle = c;
      const d = this.def;
      if (d.shape === 'diamond') {
        ctx.rotate(this.t * .8);
        ctx.beginPath(); ctx.moveTo(0, -this.r); ctx.lineTo(this.r, 0); ctx.lineTo(0, this.r); ctx.lineTo(-this.r, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(-3, -3, 6, 6);
      } else if (d.shape === 'hex') {
        ctx.rotate(this.t * .35);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; i ? ctx.lineTo(Math.cos(a) * this.r, Math.sin(a) * this.r) : ctx.moveTo(Math.cos(a) * this.r, Math.sin(a) * this.r); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0b1020'; ctx.beginPath(); ctx.arc(0, 0, this.r * .4, 0, TAU); ctx.fill();
      } else if (d.shape === 'core') {
        ctx.shadowColor = c; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, this.r * .62, this.t, this.t + 2.2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, this.r * .9, -this.t * .7, -this.t * .7 + 1.4); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(0, this.r); ctx.lineTo(-this.r, -this.r * .7); ctx.lineTo(this.r, -this.r * .7); ctx.closePath(); ctx.fill();
      }
      if (this.boss) {
        const w = 120, ratio = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(-w / 2, -this.r - 18, w, 5);
        ctx.fillStyle = '#f472b6'; ctx.fillRect(-w / 2, -this.r - 18, w * ratio, 5);
      }
      ctx.restore();
    }
  };

  SH.Player = class Player {
    constructor(sprite) {
      this.sprite = sprite;
      this.reset();
    }
    reset() {
      this.x = W / 2; this.y = H - 70;
      this.vx = 0; this.vy = 0;
      this.r = 4; this.size = 16; this.grazeR = 30;
      this.shield = 3; this.maxShield = 3;
      this.invuln = 0; this.dash = 0; this.dashCd = 0;
      this.fireTimer = 0; this.power = 1; this.combo = 0; this.graze = 0;
      this.lastHit = 0; this.autoX = W / 2; this.autoY = H - 70;
    }
    update(dt, input, game) {
      this.invuln = Math.max(0, this.invuln - dt);
      this.dashCd = Math.max(0, this.dashCd - dt);
      this.lastHit += dt;
      if (this.lastHit > 10 && this.shield < this.maxShield) { this.shield++; this.lastHit = 0; game.popup(this.x, this.y - 24, '+SHIELD', '#a3e635'); }

      const focus = input.focus;
      const axis = input.axis;
      let tx = this.x, ty = this.y;
      if (input.pointer.down) { tx = input.pointer.x; ty = input.pointer.y; }
      else if (axis.x || axis.y) { tx = this.x + axis.x * 100; ty = this.y + axis.y * 100; }
      else { tx = this.autoX; ty = this.autoY; }

      const speed = (focus ? 165 : 330) * (this.dash > 0 ? 3.2 : 1);
      const dx = SH.clamp(tx - this.x, -speed * dt, speed * dt);
      const dy = SH.clamp(ty - this.y, -speed * dt, speed * dt);
      this.vx = SH.lerp(this.vx, dx / dt, .25);
      this.vy = SH.lerp(this.vy, dy / dt, .25);
      this.x = SH.clamp(this.x + dx, this.size, W - this.size);
      this.y = SH.clamp(this.y + dy, this.size, H - this.size);
      if (this.dash > 0) this.dash -= dt;

      if (input.down('Space') && this.dashCd <= 0) {
        this.dash = .16; this.dashCd = 1.6; this.invuln = Math.max(this.invuln, .25);
        game.burst(this.x, this.y, '#22d3ee', 12);
      }

      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = focus ? .085 : .065;
        const n = focus ? Math.max(2, this.power - 1) : this.power;
        const spread = focus ? .10 : .22;
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (n === 1 ? 0 : (i / (n - 1) - .5) * spread * 2);
          game.fireBullet(this.x, this.y - 8, Math.cos(a) * 620, Math.sin(a) * 620, { friendly: true, shape: 'needle', color: '#7dd3fc', r: 3, damage: 1 });
        }
      }
    }
    hit(game) {
      if (this.invuln > 0) return false;
      this.shield--;
      this.combo = 0;
      this.invuln = 1.6;
      this.lastHit = 0;
      game.burst(this.x, this.y, '#f87171', 26);
      game.popup(this.x, this.y - 28, 'HIT!', '#f87171');
      if (this.shield <= 0) { this.shield = this.maxShield; game.popup(this.x, this.y - 50, 'RESPAWN', '#fbbf24'); }
      return true;
    }
    draw(ctx, autoTarget) {
      ctx.save();
      if (this.dash > 0) { ctx.globalAlpha = .5; ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2) ctx.globalAlpha = .35;
      if (this.sprite && this.sprite.complete && this.sprite.naturalWidth) {
        ctx.drawImage(this.sprite, this.x - 15, this.y - 20, 30, 40);
      } else {
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath(); ctx.moveTo(this.x, this.y - 18); ctx.lineTo(this.x - 13, this.y + 13); ctx.lineTo(this.x, this.y + 6); ctx.lineTo(this.x + 13, this.y + 13); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#22d3ee'; ctx.fillRect(this.x - 3, this.y - 8, 6, 10);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(250,204,21,.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.grazeR, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#ff3b3b';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU); ctx.fill();
      if (autoTarget) {
        ctx.strokeStyle = 'rgba(244,114,182,.35)';
        ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(autoTarget.x, autoTarget.y); ctx.stroke();
      }
      ctx.restore();
    }
  };

})(window.SH = window.SH || {});
