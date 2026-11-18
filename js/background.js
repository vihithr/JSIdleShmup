/* JS Idle Shmup — procedural parallax stages (no game assets bundled) */
(function (SH) {
  'use strict';

  const W = SH.W, H = SH.H, TAU = SH.TAU;

  SH.STAGE_THEMES = [
    { key: 'VOID',    label: 'THE VOID',         sky: ['#030614', '#0b1438'], nebula: ['rgba(56,189,248,.18)', 'rgba(168,85,247,.16)'], star: '#bae6fd', mid: 'pillars', particle: 'sparks',  accent: '#22d3ee' },
    { key: 'AQUA',    label: 'AQUATIC DEPTHS',   sky: ['#02131f', '#063b4d'], nebula: ['rgba(34,211,238,.18)', 'rgba(16,185,129,.14)'], star: '#a5f3fc', mid: 'waves',   particle: 'bubbles', accent: '#2dd4bf' },
    { key: 'CITY',    label: 'NEON CITY',        sky: ['#0a0a1a', '#1b1033'], nebula: ['rgba(244,114,182,.16)', 'rgba(59,130,246,.16)'], star: '#fbcfe8', mid: 'city',    particle: 'rain',    accent: '#f472b6' },
    { key: 'SHRINE',  label: 'FORGOTTEN SHRINE', sky: ['#0b0d12', '#241a16'], nebula: ['rgba(251,191,36,.12)', 'rgba(248,113,113,.12)'], star: '#fde68a', mid: 'shrine',  particle: 'petals',  accent: '#fbbf24' },
    { key: 'IRON',    label: 'IRON SHAFT',       sky: ['#070b12', '#16202b'], nebula: ['rgba(148,163,184,.12)', 'rgba(234,179,8,.10)'], star: '#cbd5e1', mid: 'mech',    particle: 'sparks',  accent: '#94a3b8' }
  ];

  SH.Background = class Background {
    constructor() {
      this.index = 0;
      this.offset = 0;
      this.banner = 0;
      this.stars = []; this.blobs = []; this.bits = []; this.structures = [];
      this.custom = null;
      this.seed(0);
    }
    get theme() { return SH.STAGE_THEMES[this.index]; }

    setCustom(img) {
      this.custom = img;
      this.banner = 60;
    }

    seed(i) {
      const t = SH.STAGE_THEMES[i];
      document.documentElement.style.setProperty('--cyan', t.accent);
      this.stars = Array.from({ length: 90 }, () => ({ x: SH.rand(0, W), y: SH.rand(0, H), s: SH.rand(.6, 1.8), sp: SH.rand(3, 22), a: SH.rand(.25, .9) }));
      this.blobs = Array.from({ length: 7 }, (_, k) => ({ x: SH.rand(0, W), y: SH.rand(0, H), r: SH.rand(120, 260), c: t.nebula[k % 2], sp: SH.rand(.6, 3.6) }));
      this.bits = Array.from({ length: 46 }, () => ({ x: SH.rand(0, W), y: SH.rand(0, H), r: SH.rand(1, 3.2), sp: SH.rand(30, 130), a: SH.rand(.25, .8), rot: SH.rand(0, TAU) }));
      this.structures = [];
      if (t.mid === 'city') {
        let x = -40;
        while (x < W + 80) { const w = SH.rand(38, 86); this.structures.push({ x, w, h: SH.rand(90, 260), lit: Math.random() > .5 }); x += w + SH.rand(6, 22); }
      } else if (t.mid === 'pillars' || t.mid === 'shrine') {
        for (let x = -60; x < W + 120; x += SH.rand(110, 170)) this.structures.push({ x, w: SH.rand(16, 34), h: SH.rand(180, 420), lit: Math.random() > .6 });
      } else if (t.mid === 'mech') {
        for (let y = 40; y < H; y += SH.rand(52, 82)) this.structures.push({ y, h: SH.rand(14, 28), lit: Math.random() > .7 });
      }
    }

    next() {
      this.index = (this.index + 1) % SH.STAGE_THEMES.length;
      this.banner = 2.2;
      this.seed(this.index);
      return this.index;
    }

    setStage(i) {
      this.index = ((i % SH.STAGE_THEMES.length) + SH.STAGE_THEMES.length) % SH.STAGE_THEMES.length;
      this.banner = 2.2;
      this.seed(this.index);
    }

    update(dt) {
      this.offset += dt * 60;
      if (this.banner > 0) this.banner = Math.max(0, this.banner - dt);
    }

    drawMid(ctx, t) {
      ctx.save();
      const off = this.offset;
      if (t.mid === 'city') {
        const glow = ctx.createLinearGradient(0, H - 300, 0, H);
        glow.addColorStop(0, 'rgba(244,114,182,0)');
        glow.addColorStop(1, 'rgba(244,114,182,.14)');
        ctx.fillStyle = glow; ctx.fillRect(0, H - 300, W, 300);
        this.structures.forEach(b => {
          const by = H - b.h + (off * .25) % 60;
          ctx.fillStyle = '#080b18'; ctx.fillRect(b.x, by, b.w, b.h);
          ctx.fillStyle = b.lit ? 'rgba(250,204,21,.42)' : 'rgba(56,189,248,.28)';
          for (let wy = by + 10; wy < H - 8; wy += 14)
            for (let wx = b.x + 6; wx < b.x + b.w - 5; wx += 12)
              if ((wx + wy) % 5 < 2) ctx.fillRect(wx, wy, 3, 5);
        });
      } else if (t.mid === 'waves') {
        for (let k = 0; k < 5; k++) {
          const base = H - 80 + k * 34, phase = off * .01 + k;
          ctx.beginPath(); ctx.moveTo(0, H);
          for (let x = 0; x <= W; x += 16) ctx.lineTo(x, base + Math.sin(x / 70 + phase) * (10 + k * 3));
          ctx.lineTo(W, H); ctx.closePath();
          ctx.fillStyle = `rgba(8,${60 + k * 12},${90 + k * 14},${.32 + k * .1})`; ctx.fill();
        }
      } else if (t.mid === 'pillars' || t.mid === 'shrine') {
        this.structures.forEach(p => {
          const py = (off * .3 + p.x) % (H + 200) - 100;
          ctx.fillStyle = t.mid === 'shrine' ? 'rgba(24,16,14,.92)' : 'rgba(10,14,26,.9)';
          ctx.fillRect(p.x, py - p.h * .3, p.w, p.h);
          if (t.mid === 'shrine') {
            ctx.fillStyle = 'rgba(251,191,36,.35)'; ctx.fillRect(p.x - 8, py + 40, p.w + 16, 6);
            ctx.beginPath(); ctx.arc(p.x + p.w / 2, py + 84, 3, 0, TAU); ctx.fill();
          } else {
            ctx.fillStyle = 'rgba(56,189,248,.22)'; ctx.fillRect(p.x, py - p.h * .3, 2, p.h);
          }
        });
      } else if (t.mid === 'mech') {
        this.structures.forEach(s => {
          const sy = (s.y + off * .35) % H;
          ctx.fillStyle = 'rgba(140,155,175,.12)'; ctx.fillRect(0, sy, W, s.h);
          ctx.fillStyle = 'rgba(8,12,18,.85)'; ctx.fillRect(0, sy + s.h - 4, W, 4);
          if (s.lit) { ctx.fillStyle = 'rgba(250,204,21,.5)'; ctx.fillRect(W - 40, sy + 4, 22, 4); }
        });
      }
      ctx.restore();
    }

    draw(ctx) {
      const t = this.theme, off = this.offset;
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, t.sky[0]); sky.addColorStop(1, t.sky[1]);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      if (this.custom && this.custom.complete && this.custom.naturalWidth) {
        ctx.save(); ctx.globalAlpha = .22;
        const th = Math.min(600, this.custom.naturalHeight), ty = (off * .12) % th;
        for (let y = -th + ty; y < H; y += th) ctx.drawImage(this.custom, 0, y, W, th);
        ctx.restore();
      }
      this.blobs.forEach(b => {
        const by = (b.y + off * b.sp) % (H + b.r * 2) - b.r;
        const g = ctx.createRadialGradient(b.x, by, 0, b.x, by, b.r);
        g.addColorStop(0, b.c); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(b.x - b.r, by - b.r, b.r * 2, b.r * 2);
      });
      ctx.fillStyle = t.star;
      this.stars.forEach(s => {
        s.y = (s.y + s.sp * (1 / 60)) % H;
        ctx.globalAlpha = s.a; ctx.fillRect(s.x, s.y, s.s, s.s);
      });
      ctx.globalAlpha = 1;
      this.drawMid(ctx, t);

      this.bits.forEach(b => {
        if (t.particle === 'bubbles') {
          b.y -= b.sp / 60; if (b.y < -6) { b.y = H + 6; b.x = SH.rand(0, W); }
          ctx.strokeStyle = `rgba(165,243,252,${b.a * .6})`; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
        } else if (t.particle === 'rain') {
          b.y += b.sp / 12; if (b.y > H) { b.y = -20; b.x = SH.rand(0, W); }
          ctx.strokeStyle = `rgba(203,213,225,${b.a * .35})`; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - 3, b.y + 14); ctx.stroke();
        } else if (t.particle === 'petals') {
          b.y += b.sp / 90; b.x += Math.sin(b.rot += .02) * .5; if (b.y > H) { b.y = -6; b.x = SH.rand(0, W); }
          ctx.fillStyle = `rgba(253,224,71,${b.a * .7})`; ctx.fillRect(b.x, b.y, b.r * 2, b.r);
        } else {
          b.y += b.sp / 30; if (b.y > H) { b.y = -6; b.x = SH.rand(0, W); }
          ctx.fillStyle = `rgba(255,255,255,${b.a})`; ctx.fillRect(b.x, b.y, b.r, b.r);
        }
      });

      const v = ctx.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, H * .85);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

      if (this.banner > 0) {
        const a = Math.min(1, this.banner / .6);
        ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
        ctx.fillStyle = t.accent;
        ctx.font = '600 14px ui-monospace, Consolas, monospace';
        ctx.fillText('STAGE ' + String(this.index + 1).padStart(2, '0'), W / 2, H / 2 - 16);
        ctx.font = '600 30px ui-monospace, Consolas, monospace';
        ctx.fillText(t.label, W / 2, H / 2 + 22);
        ctx.restore();
      }
    }
  };

})(window.SH = window.SH || {});
