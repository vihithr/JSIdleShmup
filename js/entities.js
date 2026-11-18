/* JS Idle Shmup — bitECS render system */
(function (SH) {
  'use strict';
  const TAU = SH.TAU;
  const K_BULLET = 1, K_PARTICLE = 2, K_POPUP = 3, K_ITEM = 4, K_ENEMY = 5, K_PLAYER = 6;
  SH.RENDER_KIND = { bullet: K_BULLET, particle: K_PARTICLE, popup: K_POPUP, item: K_ITEM, enemy: K_ENEMY, player: K_PLAYER };

  SH.renderEntities = function (ctx, world) {
    const C = world.components, R = C.Render, P = C.Position, B = C.Bullet,
      PA = C.Particle, PO = C.Popup, E = C.Enemy;
    for (const id of bitECS.query(world, [R])) {
      const kind = R.kind[id];
      if (kind === K_BULLET) {
        ctx.save(); ctx.translate(P.x[id], P.y[id]); ctx.fillStyle = SH.rgbString(B, id);
        if (B.shape[id] === 1) { // needle
          ctx.rotate(Math.atan2(C.Velocity.y[id], C.Velocity.x[id]) + Math.PI / 2);
          ctx.fillRect(-1.5, -8, 3, 16);
        } else if (B.shape[id] === 2) { // diamond
          const r = C.Circle.r[id];
          ctx.rotate(Math.atan2(C.Velocity.y[id], C.Velocity.x[id]));
          ctx.beginPath(); ctx.moveTo(r * 1.6, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.lineTo(0, -r); ctx.closePath(); ctx.fill();
        } else {
          ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(0, 0, C.Circle.r[id], 0, TAU); ctx.fill();
        }
        ctx.restore();
      } else if (kind === K_PARTICLE) {
        ctx.globalAlpha = Math.max(0, PA.life[id] / PA.max[id]);
        ctx.fillStyle = SH.rgbString(PA, id);
        ctx.fillRect(P.x[id], P.y[id], PA.size[id], PA.size[id]);
        ctx.globalAlpha = 1;
      } else if (kind === K_POPUP) {
        ctx.globalAlpha = Math.max(0, PO.life[id] / .9);
        ctx.fillStyle = SH.rgbString(PO, id);
        ctx.font = '600 12px ui-monospace, Consolas, monospace'; ctx.textAlign = 'center';
        ctx.fillText(PO.text[id], P.x[id], P.y[id]);
        ctx.globalAlpha = 1;
      } else if (kind === K_ITEM) {
        ctx.fillStyle = '#a3e635'; ctx.shadowColor = '#a3e635'; ctx.shadowBlur = 12;
        ctx.fillRect(P.x[id] - 6, P.y[id] - 6, 12, 12); ctx.shadowBlur = 0;
      } else if (kind === K_ENEMY) {
        drawEnemy(ctx, C, id);
      } else if (kind === K_PLAYER) {
        drawPlayer(ctx, C.Player[id]);
      }
    }
  };

  function drawEnemy(ctx, C, id) {
    const E = C.Enemy, P = C.Position, r = C.Circle.r[id];
    ctx.save(); ctx.translate(P.x[id], P.y[id]);
    const col = E.flash[id] > 0 ? '#fff' : SH.rgbString(E, id);
    ctx.fillStyle = col; ctx.strokeStyle = col;
    const shape = E.shape[id];
    if (shape === 2) { // diamond
      ctx.rotate(E.t[id] * .8);
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(-3, -3, 6, 6);
    } else if (shape === 3) { // hex
      ctx.rotate(E.t[id] * .35); ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0b1020'; ctx.beginPath(); ctx.arc(0, 0, r * .4, 0, TAU); ctx.fill();
    } else if (shape === 4) { // core
      ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r * .62, E.t[id], E.t[id] + 2.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * .9, -E.t[id] * .7, -E.t[id] * .7 + 1.4); ctx.stroke();
    } else { // tri
      ctx.beginPath(); ctx.moveTo(0, r); ctx.lineTo(-r, -r * .7); ctx.lineTo(r, -r * .7); ctx.closePath(); ctx.fill();
    }
    if (E.boss[id]) {
      const w = 120, ratio = Math.max(0, E.hp[id] / E.maxHp[id]);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(-w / 2, -r - 18, w, 5);
      ctx.fillStyle = '#f472b6'; ctx.fillRect(-w / 2, -r - 18, w * ratio, 5);
    }
    ctx.restore();
  }

  function drawPlayer(ctx, p) {
    ctx.save();
    if (p.dash > 0) { ctx.globalAlpha = .5; ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2) ctx.globalAlpha = .35;
    if (p.sprite && p.sprite.complete && p.sprite.naturalWidth) ctx.drawImage(p.sprite, p.x - 15, p.y - 20, 30, 40);
    else {
      ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.moveTo(p.x, p.y - 18); ctx.lineTo(p.x - 13, p.y + 13); ctx.lineTo(p.x, p.y + 6); ctx.lineTo(p.x + 13, p.y + 13); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#22d3ee'; ctx.fillRect(p.x - 3, p.y - 8, 6, 10);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(250,204,21,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.grazeR, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    ctx.restore();
  }

})(window.SH = window.SH || {});
