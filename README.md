# JS Idle Shmup

Language: [English](#english) | [中文](#中文)

---

## English

**Live demo:** https://vihithr.github.io/JSIdleShmup/  
**Repository homepage:** https://vihithr.github.io/JSIdleShmup/

### Overview
An **idle-first bullet-hell and RL testbed**: one trained pilot plays while you watch the collision engine work. Vanilla HTML5 Canvas + bitECS at runtime; evolution / imitation / PPO training tools live in `tools/`. Open `index.html` directly.

### One model: the ensemble pilot
The pilot blends two learned networks (20% MLP / 80% brain.js). Scoring now rewards **area suppression**: each kill is worth 3x its base score and clears nearby enemy bullets (a bullet-cancel), while grazing is only +1 — killing enemies simply leaves fewer shooters on screen. Camping at the bottom of the screen drains score. The training objective adds a large bottom-time penalty: `score - hits*12000 - bottomRatio*15000 - missingShield*1000 + 15000` for a flawless run.

- `js/brain.js` — compact MLP (18 perception features → 24 tanh → 2 steering outputs), evolved by `tools/train.mjs` into `js/policy.js`.
- `js/vendor/brain-browser.js` — vendored [brain.js](https://github.com/BrainJS/brain.js) v2 beta (MIT). Its network in `js/policy-brain.js` is seeded from the MLP weights (verified numerically identical) and evolved further by `tools/evolve-brain.mjs` — 250 generations total, fitness 8,227 → 24,085.

Both outputs are blended every frame; there is only one policy to choose from.

Retrain (parallel, CPU): `node tools/train-strong.mjs [generations] [population] [seconds] [workers]`. The trainer spawns a worker pool across CPU cores, runs 90-second episodes with visual work disabled (`SH.HEADLESS`), and uses a harsh objective: `score + graze*2 - hits*8000 - missingShield*2000 + 10000` for a flawless run. A single hit wipes out most of a run's score, so avoiding damage dominates.

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
- Continuous ambient spawning plus 5 scripted stages, formations, scaling difficulty, a boss per stage. Density knobs `SH.DENSITY` / `SH.FIRE_RATE` are tuned down to 1.5 / 1.8 with a slower ambient spawner, prioritising survivability over spectacle.

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
- `tools/imitate.mjs` — behaviour cloning from a predictive planner (24k demos).
- `tools/train-strong.mjs` + `train-worker.mjs` — parallel, hit-penalised evolution of both networks.
- `tools/train-curriculum.mjs` — survival-first curriculum: few enemies -> full density.
- `tools/evolve-brain-v2.mjs` — brain.js-only evolution seeded from the MLP weights.

### License
Game code: MIT — see [LICENSE](LICENSE). Vendored bitECS: MPL-2.0 (`js/vendor/BITECS-LICENSE`). Vendored brain.js: MIT (`js/vendor/BRAIN-LICENSE`).

---

## 中文

**在线试玩：** https://vihithr.github.io/JSIdleShmup/  
**仓库主页：** https://vihithr.github.io/JSIdleShmup/

### 项目简介
一个**放置流弹幕游戏 + RL 试验场**：训练好的策略负责玩，你主要负责看碰撞引擎工作。运行时是原生 HTML5 Canvas + bitECS；进化 / 模仿 / PPO 训练工具在 `tools/` 里。直接打开 `index.html` 即可。

### 唯一模型：集成策略
集成策略按 20% MLP / 80% brain.js 混合两个网络输出。计分改为奖励**压制版面**：击破得分 ×3 敌人少了自然就少发弹），擦弹只给 +1；缩在屏幕底部会持续扣分。训练目标也加入底部惩罚：`分数 - 中弹*12000 - 底部时间比例*15000 - 缺失护盾*1000 + 无伤奖励15000`。

- `js/brain.js`：小型 MLP（18 特征 → 24 tanh → 2 输出），由 `tools/train.mjs` 进化得到 `js/policy.js`。
- `js/vendor/brain-browser.js`：内置的 [brain.js](https://github.com/BrainJS/brain.js) v2 beta（MIT）。`js/policy-brain.js` 里的网络由 MLP 权重初始化（已验证输出完全一致），再用 `tools/evolve-brain.mjs` 继续进化 250 代，适应度 8,227 → 24,085。

每帧只算这两个网络并按上述比例混合，没有其他可选策略。

重新训练（CPU 并行）：`node tools/train-strong.mjs [代数] [种群] [秒数] [worker数]`。训练器在多个 CPU 核心上开 worker 池，跑 90 秒回合并关闭纯视觉计算（`SH.HEADLESS`）；目标函数非常严厉：`分数 + 擦弹*2 - 中弹*8000 - 缺失护盾*2000 + 无伤奖励10000`，一次中弹会抹掉大部分得分，因此避伤是首要目标。

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
- 环境持续刷怪 + 5 个脚本关卡、编队、难度递增与每关 Boss；密度系数 `SH.DENSITY` / `SH.FIRE_RATE` 已下调到 1.5 / 1.8，环境刷怪也更慢，优先保证生存性。

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
