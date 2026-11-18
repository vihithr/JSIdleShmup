# JS Idle Shmup

Language: [English](#english) | [中文](#中文)

---

## English

**Live demo:** https://vihithr.github.io/JSIdleShmup/  
**Repository homepage:** https://vihithr.github.io/JSIdleShmup/

### Overview
An **idle-first** bullet-hell: the AI plays, you watch the collision engine and the learned policy work. Vanilla HTML5 Canvas, no build step, no runtime dependencies. Open `index.html` directly.

### Architecture: bitECS + evolved neural pilot
- **ECS**: built on the mature [bitECS](https://github.com/NateTheGreatt/bitECS) v0.4.0 (MPL-2.0, vendored in `js/vendor/` with its license). Entities are IDs, components are preallocated typed arrays (`Position`, `Velocity`, `Circle`, `Bullet`, `Enemy`, `Particle`, `Popup`, `Item`, `Player`, `Render`), and systems are `query`-driven loops (`movementSystem`, `enemySystem`, `renderSystem`).
- **Learned policy**: `js/brain.js` is a small MLP (18 perception features → 24 tanh hidden → 2 steering outputs). Its weights are evolved offline by `tools/train.mjs` using an elitist evolution strategy over ~3,000 simulated runs, then baked into `js/policy.js`. The AI defaults to `NEURAL`; press `G` to compare against the hand-written `GRAZE` / `EVADE` / `HUNT` baselines.
- In a 25-second headless comparison the learned policy scored **~16k** with 239 grazes, versus ~6k for the best baseline.

### The collision lab
- **Broadphase** — uniform spatial grid over enemy AABBs, generation-stamped de-duplication. Press `B` to switch `HASH` / `BRUTE` live; the HUD shows cull percentage (typically 98%+).
- **Narrowphase with CCD** — bullets keep their previous position; a swept segment-vs-circle test stops 600 px/s bullets tunnelling through the 4 px hitbox.
- **Graze ring** — 30 px ring; bullets inside the ring but outside the hitbox award combo and score.
- **Debug view** (`V`) — grid cells, AABBs, swept segments, candidate links, graze ring and live counters.

### Controls (secondary)
- The AI is the primary player. `G` cycles AI strategies, `N` next stage, `P` pause.
- Manual input takes over instantly: mouse / touch drag or WASD / arrows. `Shift` = focus, `Space` = dash.
- **Drag assist** (`A`, default ON): while dragging or using the keyboard, the trained policy nudges your target away from imminent bullets. You keep control, but dodging is preserved.

### Enemies and stages
- 8 enemy archetypes with distinct movement and bullet patterns (aimed, spread, ring, spiral, delayed mines); bosses switch attacks by HP phase.
- Continuous ambient spawning plus 5 scripted stages, formations, scaling difficulty, a boss per stage. Density knobs `SH.DENSITY` / `SH.FIRE_RATE` currently peak at 300+ enemy bullets on screen.

### Quick Start
```bash
# just open index.html, or serve it:
python -m http.server 8000
```
Press `V` for collisions, `B` to compare broadphases, `G` to compare pilots.

### Project Structure
- `index.html` — markup, styling, bootstrap.
- `js/vendor/bitecs.js` — vendored bitECS v0.4.0 (MPL-2.0).
- `js/ecs-world.js` — component/typed-array definitions.
- `js/core.js` — math, PRNG, spatial hash, input, fixed-step loop.
- `js/brain.js` — MLP perception and forward pass.
- `js/policy.js` — evolved weights (generated).
- `js/background.js` — parallax themes and renderer.
- `js/entities.js` — bitECS render system.
- `js/collision.js` — broadphase, CCD, graze, debug rendering.
- `js/enemies.js` — enemy behaviours and bullet patterns.
- `js/systems.js` — movement and enemy systems.
- `js/stages.js` — stage scripts, formations, wave director.
- `js/game.js` — orchestration, pilot, HUD.
- `tools/train.mjs` — offline policy evolution: `node tools/train.mjs [generations] [population] [seconds]`.

### License
Game code: MIT — see [LICENSE](LICENSE). Vendored bitECS: MPL-2.0 — see `js/vendor/BITECS-LICENSE`.

---

## 中文

**在线试玩：** https://vihithr.github.io/JSIdleShmup/  
**仓库主页：** https://vihithr.github.io/JSIdleShmup/

### 项目简介
一个**放置流**弹幕游戏：AI 负责玩，你主要负责看碰撞引擎和训练出来的策略如何工作。原生 HTML5 Canvas，无构建、无运行时依赖，直接打开 `index.html` 即可。

### 架构：bitECS + 训练出来的神经策略
- **ECS**：基于成熟的 [bitECS](https://github.com/NateTheGreatt/bitECS) v0.4.0（MPL-2.0，已随仓库附带并保留许可证）。实体是 ID，组件是预分配的类型化数组（Position / Velocity / Circle / Bullet / Enemy / Particle / Popup / Item / Player / Render），系统通过 `query` 驱动（`movementSystem`、`enemySystem`、渲染系统）。
- **学习策略**：`js/brain.js` 是一个小型 MLP（18 个感知特征 → 24 个 tanh 隐节点 → 2 个转向输出）。权重由 `tools/train.mjs` 用精英保留的进化策略在约 3000 次模拟中训练，写入 `js/policy.js`。默认 AI 为 `NEURAL`，按 `G` 可与手写的 `GRAZE` / `EVADE` / `HUNT` 基线对比。
- 25 秒无头对比中，训练策略约 **16k** 分、239 次擦弹，最强基线约 6k 分。

### 碰撞实验室
- **宽相**：敌人 AABB 均匀网格 + 世代标记去重。按 `B` 实时切换 `HASH` / `BRUTE`，HUD 显示剔除率（通常 98%+）。
- **窄相 CCD**：子弹保留上一帧坐标，线段-圆扫掠检测防止 600px/s 子弹穿过 4px 判定点。
- **擦弹环**：30px 环，进环不中判定点即累积连击与分数。
- **调试视图**（`V`）：网格、AABB、扫掠线、候选连线、擦弹环与实时计数。

### 操作（次要）
- AI 才是主角。`G` 切换策略，`N` 下一关，`P` 暂停。
- 手动操作会立即接管：鼠标 / 触屏拖拽或 WASD / 方向键。`Shift` 精确模式，`Space` 冲刺。
- **拖拽辅助**（`A`，默认开）：拖拽或键盘操控时，训练好的策略会给目标点一个避弹偏移——你仍在控制，但避弹能力保留。

### 敌人与关卡
- 8 种敌人，独立移动与弹幕（瞄准、散射、环形、螺旋、延时地雷），Boss 按血量换招。
- 环境持续刷怪 + 5 个脚本关卡、编队、难度递增与每关 Boss；密度系数 `SH.DENSITY` / `SH.FIRE_RATE` 当前峰值 300+ 敌弹同屏。

### 快速开始
```bash
python -m http.server 8000
```
按 `V` 看碰撞，`B` 对比宽相，`G` 对比不同 AI。

### 项目结构
- `index.html` — 页面结构、样式与启动代码。
- `js/vendor/bitecs.js` — 内置的 bitECS v0.4.0（MPL-2.0）。
- `js/ecs-world.js` — 组件与类型化数组定义。
- `js/core.js` — 数学、种子随机数、空间哈希、输入、固定步长循环。
- `js/brain.js` — MLP 感知与前向传播。
- `js/policy.js` — 进化得到的权重（生成文件）。
- `js/background.js` — 视差关卡主题与渲染。
- `js/entities.js` — bitECS 渲染系统。
- `js/collision.js` — 宽相、CCD、擦弹、调试渲染。
- `js/enemies.js` — 敌人行为与弹幕算法。
- `js/systems.js` — 移动与敌人系统。
- `js/stages.js` — 关卡脚本、编队、波次调度。
- `js/game.js` — 编排、托管 AI、HUD。
- `tools/train.mjs` — 离线策略进化：`node tools/train.mjs [代数] [种群] [秒数]`。

### 许可
游戏代码：MIT，详见 [LICENSE](LICENSE)。内置 bitECS：MPL-2.0，详见 `js/vendor/BITECS-LICENSE`。
