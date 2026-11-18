# JS Idle Shmup

Language: [English](#english) | [中文](#中文)

---

## English

**Live demo:** https://vihithr.github.io/JSIdleShmup/  
**Repository homepage:** https://vihithr.github.io/JSIdleShmup/

### Overview
An **idle-first** bullet-hell: one trained pilot plays, you watch the collision engine work. Vanilla HTML5 Canvas, no build step, no runtime dependencies. Open `index.html` directly.

### One model: the ensemble pilot
The pilot averages two learned networks, which beat every single network in a headless bake-off (4 x 30 s trials: ensemble **20,966** avg, brain.js-only 20,362, MLP-only 17,438, hand-written baseline 8,326):

- `js/brain.js` — compact MLP (18 perception features → 24 tanh → 2 steering outputs), evolved by `tools/train.mjs` into `js/policy.js`.
- `js/vendor/brain-browser.js` — vendored [brain.js](https://github.com/BrainJS/brain.js) v2 beta (MIT). Its network in `js/policy-brain.js` is seeded from the MLP weights (verified numerically identical) and evolved further by `tools/evolve-brain.mjs` — 250 generations total, fitness 8,227 → 24,085.

Both outputs are averaged every frame; there is only one policy to choose from.

Retrain: `node tools/train.mjs [generations] [population] [seconds]`, then `node tools/evolve-brain.mjs [generations] [population] [seconds] [resume]`.

### The collision lab
- **ECS**: built on [bitECS](https://github.com/NateTheGreatt/bitECS) v0.4.0 (MPL-2.0, vendored). Components are preallocated typed arrays; systems are `query`-driven.
- **Broadphase** — uniform spatial grid with generation-stamped de-duplication. Press `B` to switch `HASH` / `BRUTE` live; HUD shows cull percentage (typically 98%+).
- **Narrowphase with CCD** — bullets keep their previous position; a swept segment-vs-circle test stops 600 px/s bullets tunnelling through the 4 px hitbox.
- **Graze ring** — 30 px ring; bullets inside but not hitting award combo and score.
- **Debug view** (`V`) — grid, AABBs, swept segments, candidate links, graze ring and live counters.

### Controls (secondary)
- The ensemble AI is the only pilot. `N` next stage, `P` pause.
- Manual input takes over instantly: mouse / touch drag or WASD / arrows. `Shift` = focus, `Space` = dash.
- **Drag assist** (`A`, default ON): while steering manually, the same ensemble nudges your target away from imminent bullets.

### Enemies and stages
- 8 enemy archetypes with distinct movement and bullet patterns (aimed, spread, ring, spiral, delayed mines); bosses switch attacks by HP phase.
- Continuous ambient spawning plus 5 scripted stages, formations, scaling difficulty, a boss per stage. Density knobs `SH.DENSITY` / `SH.FIRE_RATE` currently peak at 300+ enemy bullets on screen.

### Quick Start
```bash
python -m http.server 8000
```
Press `V` for collisions, `B` to compare broadphases.

### Project Structure
- `index.html` — markup, styling, bootstrap.
- `js/vendor/bitecs.js` — vendored bitECS v0.4.0 (MPL-2.0).
- `js/vendor/brain-browser.js` — vendored brain.js v2 beta (MIT).
- `js/ecs-world.js` — component/typed-array definitions.
- `js/core.js` — math, PRNG, spatial hash, input, fixed-step loop.
- `js/brain.js` — MLP perception and forward pass.
- `js/policy.js` — evolved MLP weights (generated).
- `js/policy-brain.js` — evolved brain.js weights (generated).
- `js/background.js` — parallax themes and renderer.
- `js/entities.js` — bitECS render system.
- `js/collision.js` — broadphase, CCD, graze, debug rendering.
- `js/enemies.js` — enemy behaviours and bullet patterns.
- `js/systems.js` — movement and enemy systems.
- `js/stages.js` — stage scripts, formations, wave director.
- `js/game.js` — orchestration, ensemble pilot, HUD.
- `tools/train.mjs` — MLP evolution. `tools/evolve-brain.mjs` — brain.js evolution.

### License
Game code: MIT — see [LICENSE](LICENSE). Vendored bitECS: MPL-2.0 (`js/vendor/BITECS-LICENSE`). Vendored brain.js: MIT (`js/vendor/BRAIN-LICENSE`).

---

## 中文

**在线试玩：** https://vihithr.github.io/JSIdleShmup/  
**仓库主页：** https://vihithr.github.io/JSIdleShmup/

### 项目简介
一个**放置流**弹幕游戏：只有一个训练好的策略在玩，你主要负责看碰撞引擎工作。原生 HTML5 Canvas，无构建、无运行时依赖，直接打开 `index.html` 即可。

### 唯一模型：集成策略
集成策略把两个网络输出取平均，在无头对比中（4 次 × 30 秒）胜过任何单模型：集成 **20,966** 分，brain.js 单模型 20,362，MLP 单模型 17,438，手写基线 8,326。

- `js/brain.js`：小型 MLP（18 特征 → 24 tanh → 2 输出），由 `tools/train.mjs` 进化得到 `js/policy.js`。
- `js/vendor/brain-browser.js`：内置的 [brain.js](https://github.com/BrainJS/brain.js) v2 beta（MIT）。`js/policy-brain.js` 里的网络由 MLP 权重初始化（已验证输出完全一致），再用 `tools/evolve-brain.mjs` 继续进化 250 代，适应度 8,227 → 24,085。

每帧只算这两个网络并取平均，没有其他可选策略。

重新训练：`node tools/train.mjs [代数] [种群] [秒数]`，然后 `node tools/evolve-brain.mjs [代数] [种群] [秒数] [resume]`。

### 碰撞实验室
- **ECS**：基于 [bitECS](https://github.com/NateTheGreatt/bitECS) v0.4.0（MPL-2.0，已内置）。组件为预分配类型化数组，系统由 `query` 驱动。
- **宽相**：敌人 AABB 均匀网格 + 世代标记去重。按 `B` 实时切换 `HASH` / `BRUTE`，HUD 显示剔除率（通常 98%+）。
- **窄相 CCD**：子弹保留上一帧坐标，线段-圆扫掠检测防止 600px/s 子弹穿过 4px 判定点。
- **擦弹环**：30px 环，进环不中判定点即累积连击与分数。
- **调试视图**（`V`）：网格、AABB、扫掠线、候选连线、擦弹环与实时计数。

### 操作（次要）
- 集成 AI 是唯一策略。`N` 下一关，`P` 暂停。
- 手动操作立即接管：鼠标 / 触屏拖拽或 WASD / 方向键。`Shift` 精确模式，`Space` 冲刺。
- **拖拽辅助**（`A`，默认开）：手动操控时同一个集成策略会给目标点避弹偏移。

### 敌人与关卡
- 8 种敌人，独立移动与弹幕（瞄准、散射、环形、螺旋、延时地雷），Boss 按血量换招。
- 环境持续刷怪 + 5 个脚本关卡、编队、难度递增与每关 Boss；密度系数 `SH.DENSITY` / `SH.FIRE_RATE` 当前峰值 300+ 敌弹同屏。

### 快速开始
```bash
python -m http.server 8000
```
按 `V` 看碰撞，`B` 对比宽相。

### 项目结构
- `index.html` — 页面结构、样式与启动代码。
- `js/vendor/bitecs.js` — 内置 bitECS v0.4.0（MPL-2.0）。
- `js/vendor/brain-browser.js` — 内置 brain.js v2 beta（MIT）。
- `js/ecs-world.js` — 组件与类型化数组定义。
- `js/core.js` — 数学、种子随机数、空间哈希、输入、固定步长循环。
- `js/brain.js` — MLP 感知与前向传播。
- `js/policy.js` — 进化得到的 MLP 权重（生成文件）。
- `js/policy-brain.js` — 进化得到的 brain.js 权重（生成文件）。
- `js/background.js` — 视差关卡主题与渲染。
- `js/entities.js` — bitECS 渲染系统。
- `js/collision.js` — 宽相、CCD、擦弹、调试渲染。
- `js/enemies.js` — 敌人行为与弹幕算法。
- `js/systems.js` — 移动与敌人系统。
- `js/stages.js` — 关卡脚本、编队、波次调度。
- `js/game.js` — 编排、集成策略、HUD。
- `tools/train.mjs` — MLP 进化。`tools/evolve-brain.mjs` — brain.js 进化。

### 许可
游戏代码：MIT，详见 [LICENSE](LICENSE)。内置 bitECS：MPL-2.0（`js/vendor/BITECS-LICENSE`）。内置 brain.js：MIT（`js/vendor/BRAIN-LICENSE`）。
