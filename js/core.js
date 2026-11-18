/* JS Idle Shmup — core utilities, pooling, input and fixed-step loop */
(function (SH) {
  'use strict';

  SH.W = 800;
  SH.H = 600;
  SH.TAU = Math.PI * 2;

  SH.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  SH.lerp = (a, b, t) => a + (b - a) * t;
  SH.rand = (a, b) => a + Math.random() * (b - a);
  SH.pick = arr => arr[(Math.random() * arr.length) | 0];

  // Deterministic PRNG so a stage layout can be replayed.
  SH.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* Object pool: bullets and particles are recycled, not churned by the GC. */
  SH.Pool = class Pool {
    constructor(factory) { this.factory = factory; this.free = []; this.used = []; }
    acquire() {
      const o = this.free.pop() || this.factory();
      this.used.push(o);
      return o;
    }
    release(o) {
      const i = this.used.indexOf(o);
      if (i !== -1) this.used.splice(i, 1);
      this.free.push(o);
    }
    releaseAll() { while (this.used.length) this.free.push(this.used.pop()); }
    sweep(alive) {
      for (let i = this.used.length - 1; i >= 0; i--) {
        const o = this.used[i];
        if (!alive(o)) { this.used.splice(i, 1); this.free.push(o); }
      }
    }
  };

  /* Uniform-grid spatial hash narrows bullet/enemy tests to nearby cells. */
  SH.SpatialHash = class SpatialHash {
    constructor(cell = 90) { this.cell = cell; this.map = new Map(); }
    key(x, y) { return ((x / this.cell) | 0) + ',' + ((y / this.cell) | 0); }
    clear() { this.map.clear(); }
    insert(obj) {
      const r = obj.r || 10;
      for (let y = obj.y - r; y <= obj.y + r; y += this.cell)
        for (let x = obj.x - r; x <= obj.x + r; x += this.cell) {
          const k = this.key(x, y);
          let bucket = this.map.get(k);
          if (!bucket) this.map.set(k, bucket = []);
          bucket.push(obj);
        }
    }
    query(x, y, radius) {
      const out = [], seen = new Set();
      for (let dy = -radius; dy <= radius; dy += this.cell)
        for (let dx = -radius; dx <= radius; dx += this.cell) {
          const bucket = this.map.get(this.key(x + dx, y + dy));
          if (!bucket) continue;
          for (const o of bucket) if (!seen.has(o)) { seen.add(o); out.push(o); }
        }
      return out;
    }
  };

  /* Keyboard + pointer unified into a single steering input. */
  SH.Input = class Input {
    constructor(canvas) {
      this.keys = new Set();
      this.pointer = { x: SH.W / 2, y: SH.H - 60, down: false, active: false };
      const mapped = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyP']);
      addEventListener('keydown', e => { if (mapped.has(e.code)) e.preventDefault(); this.keys.add(e.code); });
      addEventListener('keyup', e => this.keys.delete(e.code));
      addEventListener('blur', () => this.keys.clear());
      const pos = e => {
        const r = canvas.getBoundingClientRect();
        this.pointer.x = (e.clientX - r.left) * (SH.W / r.width);
        this.pointer.y = (e.clientY - r.top) * (SH.H / r.height);
        this.pointer.active = true;
      };
      canvas.addEventListener('pointerdown', e => { pos(e); this.pointer.down = true; if (e.pointerType === 'mouse') canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', pos);
      canvas.addEventListener('pointerup', () => { this.pointer.down = false; });
      canvas.addEventListener('pointercancel', () => { this.pointer.down = false; });
      canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') this.pointer.down = false; });
    }
    down(code) { return this.keys.has(code); }
    get focus() { return this.down('ShiftLeft') || this.down('ShiftRight'); }
    get axis() {
      let x = 0, y = 0;
      if (this.down('ArrowLeft') || this.down('KeyA')) x--;
      if (this.down('ArrowRight') || this.down('KeyD')) x++;
      if (this.down('ArrowUp') || this.down('KeyW')) y--;
      if (this.down('ArrowDown') || this.down('KeyS')) y++;
      const m = Math.hypot(x, y);
      return m ? { x: x / m, y: y / m } : { x: 0, y: 0 };
    }
  };

  /* Fixed timestep keeps simulation stable at any refresh rate. */
  SH.Loop = class Loop {
    constructor(step, update, render) {
      this.step = step; this.update = update; this.render = render;
      this.acc = 0; this.last = 0; this.running = false;
    }
    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      const frame = now => {
        if (!this.running) return;
        this.acc += Math.min((now - this.last) / 1000, .1);
        this.last = now;
        let n = 0;
        while (this.acc >= this.step && n++ < 5) { this.update(this.step); this.acc -= this.step; }
        this.render(this.acc / this.step);
        this.id = requestAnimationFrame(frame);
      };
      this.id = requestAnimationFrame(frame);
    }
    stop() { this.running = false; cancelAnimationFrame(this.id); }
  };

})(window.SH = window.SH || {});
