/* JS Idle Shmup — stage scripts and wave director */
(function (SH) {
  'use strict';

  /* Each stage is a timeline of waves. `t` is seconds since stage start.
     Scripts are data, so new stages need no engine changes. */
  SH.STAGE_SCRIPTS = [
    { duration: 30, boss: 'boss', waves: [
      { t: 1.5, type: 'drifter', count: 5, formation: 'line' },
      { t: 6,   type: 'weaver',  count: 3, formation: 'arc' },
      { t: 11,  type: 'drifter', count: 7, formation: 'random' },
      { t: 16,  type: 'orbiter', count: 2, formation: 'arc' },
      { t: 21,  type: 'weaver',  count: 4, formation: 'line' },
      { t: 25,  type: 'tank',    count: 1, formation: 'random' }
    ] },
    { duration: 34, boss: 'boss', waves: [
      { t: 1.5, type: 'weaver',  count: 4, formation: 'arc' },
      { t: 6,   type: 'orbiter', count: 3, formation: 'column' },
      { t: 11,  type: 'bomber',  count: 3, formation: 'random' },
      { t: 16,  type: 'spinner', count: 2, formation: 'arc' },
      { t: 21,  type: 'drifter', count: 9, formation: 'line' },
      { t: 26,  type: 'sniper',  count: 3, formation: 'line' },
      { t: 30,  type: 'tank',    count: 2, formation: 'arc' }
    ] },
    { duration: 38, boss: 'boss', waves: [
      { t: 1.5, type: 'sniper',  count: 4, formation: 'line' },
      { t: 6,   type: 'weaver',  count: 5, formation: 'arc' },
      { t: 11,  type: 'spinner', count: 3, formation: 'column' },
      { t: 16,  type: 'orbiter', count: 4, formation: 'random' },
      { t: 21,  type: 'bomber',  count: 5, formation: 'arc' },
      { t: 26,  type: 'tank',    count: 2, formation: 'line' },
      { t: 32,  type: 'spinner', count: 3, formation: 'random' }
    ] },
    { duration: 42, boss: 'boss', waves: [
      { t: 1.5, type: 'orbiter', count: 4, formation: 'arc' },
      { t: 6,   type: 'spinner', count: 3, formation: 'column' },
      { t: 11,  type: 'sniper',  count: 5, formation: 'line' },
      { t: 16,  type: 'bomber',  count: 6, formation: 'random' },
      { t: 21,  type: 'weaver',  count: 6, formation: 'arc' },
      { t: 26,  type: 'tank',    count: 3, formation: 'column' },
      { t: 32,  type: 'spinner', count: 4, formation: 'arc' },
      { t: 37,  type: 'orbiter', count: 5, formation: 'random' }
    ] },
    { duration: 46, boss: 'boss', waves: [
      { t: 1.5, type: 'sniper',  count: 5, formation: 'arc' },
      { t: 6,   type: 'spinner', count: 4, formation: 'column' },
      { t: 11,  type: 'orbiter', count: 5, formation: 'random' },
      { t: 16,  type: 'tank',    count: 3, formation: 'line' },
      { t: 21,  type: 'bomber',  count: 7, formation: 'arc' },
      { t: 26,  type: 'weaver',  count: 7, formation: 'line' },
      { t: 31,  type: 'spinner', count: 5, formation: 'random' },
      { t: 36,  type: 'orbiter', count: 6, formation: 'arc' },
      { t: 41,  type: 'tank',    count: 4, formation: 'column' }
    ] }
  ];

  SH.Director = class Director {
    constructor() { this.stage = 0; }
    get script() { return SH.STAGE_SCRIPTS[this.stage]; }

    start(stage) {
      this.stage = ((stage % SH.STAGE_SCRIPTS.length) + SH.STAGE_SCRIPTS.length) % SH.STAGE_SCRIPTS.length;
      this.elapsed = 0;
      this.wave = 0;
      this.bossSpawned = false;
      this.cleared = false;
      this.rng = SH.rng(9137 + this.stage * 7919);
    }

    update(dt, game) {
      if (this.cleared) return;
      this.elapsed += dt;
      const s = this.script;
      while (this.wave < s.waves.length && s.waves[this.wave].t <= this.elapsed) {
        const w = s.waves[this.wave++];
        const scale = 1 + this.stage * .12;
        const positions = SH.FORMATIONS[w.formation](w.count, -30, this.rng);
        positions.forEach(p => {
          const hp = w.type === 'boss' ? undefined : Math.round((SH.ENEMY_TYPES[w.type].hp) * scale);
          game.spawn(w.type, p.x, p.y, hp ? { hp } : {});
        });
      }
      if (!this.bossSpawned && this.elapsed >= s.duration) {
        this.bossSpawned = true;
        game.spawn(s.boss, SH.W / 2, -60, { hp: Math.round(260 * (1 + this.stage * .25)) });
        game.popup(SH.W / 2, 90, 'WARNING', '#f87171');
      }
      if (this.bossSpawned && !game.enemies.some(e => e.boss) && !this.cleared) {
        this.cleared = true;
        game.onStageClear();
      }
    }
  };

})(window.SH = window.SH || {});
