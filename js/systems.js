/* JS Idle Shmup — bitECS movement and enemy systems */
(function (SH) {
  'use strict';
  const W = SH.W, H = SH.H;

  SH.movementSystem = function (world, dt) {
    const C = world.components, P = C.Position, V = C.Velocity, B = C.Bullet, PA = C.Particle, PO = C.Popup;
    for (const id of bitECS.query(world, [B])) {
      if (B.dead[id]) continue;
      P.px[id] = P.x[id]; P.py[id] = P.y[id];
      P.x[id] += V.x[id] * dt; P.y[id] += V.y[id] * dt;
      B.life[id] -= dt;
      if (B.life[id] <= 0 || P.x[id] < -30 || P.x[id] > W + 30 || P.y[id] < -30 || P.y[id] > H + 30) B.dead[id] = 1;
    }
    if (!SH.HEADLESS) for (const id of bitECS.query(world, [PA])) {
      PA.life[id] -= dt;
      if (PA.life[id] <= 0) continue;
      P.x[id] += V.x[id] * dt; P.y[id] += V.y[id] * dt;
      V.x[id] *= .97; V.y[id] *= .97;
    }
    if (!SH.HEADLESS) for (const id of bitECS.query(world, [PO])) {
      PO.life[id] -= dt;
      P.y[id] -= 26 * dt;
    }
    for (const id of bitECS.query(world, [C.Item])) {
      P.y[id] += 90 * dt;
      if (P.y[id] > H + 20) bitECS.removeEntity(world, id);
    }
  };

  SH.enemySystem = function (world, dt, game) {
    const C = world.components, E = C.Enemy;
    for (const id of bitECS.query(world, [E])) {
      if (E.dead[id]) continue;
      E.t[id] += dt;
      if (E.flash[id] > 0) E.flash[id] -= dt;
      SH.ENEMY_TYPES[SH.ENEMY_LIST[E.type[id]]].update(world, id, dt, game);
    }
  };

})(window.SH = window.SH || {});
