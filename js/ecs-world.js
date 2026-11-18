/* JS Idle Shmup — bitECS world definition (vendored mature ECS, MPL-2.0) */
(function (SH) {
  'use strict';
  const MAX = 4096;
  const f32 = () => new Float32Array(MAX);
  const u8 = () => new Uint8Array(MAX);
  const i32 = () => new Int32Array(MAX);

  SH.hexRGB = function (hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  };
  SH.rgbString = function (C, id) {
    return 'rgb(' + (C.cr[id] * 255 | 0) + ',' + (C.cg[id] * 255 | 0) + ',' + (C.cb[id] * 255 | 0) + ')';
  };

  SH.createGameWorld = function () {
    return bitECS.createWorld({ components: {
      Position: { x: f32(), y: f32(), px: f32(), py: f32() },
      Velocity: { x: f32(), y: f32() },
      Circle: { r: f32() },
      Bullet: { friendly: u8(), damage: f32(), grazed: u8(), fuse: f32(), life: f32(), maxLife: f32(), dead: u8(), shape: u8(), cr: f32(), cg: f32(), cb: f32() },
      Enemy: { type: u8(), t: f32(), fire: f32(), homeX: f32(), homeY: f32(), hp: f32(), maxHp: f32(), score: i32(), boss: u8(), flash: f32(), speed: f32(), shape: u8(), cr: f32(), cg: f32(), cb: f32(), dead: u8() },
      Particle: { life: f32(), max: f32(), size: f32(), cr: f32(), cg: f32(), cb: f32() },
      Popup: { life: f32(), cr: f32(), cg: f32(), cb: f32(), text: [] },
      Item: {},
      Player: [],
      Render: { kind: u8() }
    } });
  };

})(window.SH = window.SH || {});
