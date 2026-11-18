# JS Idle Shmup

Language: [English](#english) | [中文](#中文)

---

## English

**Live demo:** https://vihithr.github.io/JSIdleShmup/  
**Repository homepage:** https://vihithr.github.io/JSIdleShmup/

### Overview
An **idle-first** bullet-hell: the AI plays, you watch the collision engine work. Vanilla HTML5 Canvas, no build step, no dependencies, no bundled game assets. Open `index.html` directly.

### The interesting part: the collision lab
The simulation exists mainly to exercise and visualise its collision code:

- **Broadphase** — a uniform spatial grid over enemy AABBs, with generation-stamped de-duplication so an object spanning several cells is returned once without allocating a `Set` each frame. Press `B` to switch between `HASH` and `BRUTE` live; the HUD shows how many pairs were culled.
- **Narrowphase with CCD** — bullets carry their previous position. A swept segment-vs-circle test finds the closest point on the bullet's travel segment, so a 600 px/s bullet cannot tunnel through the 4 px player hitbox.
- **Graze ring** — bullets that pass inside a 30 px ring but outside the hitbox are marked grazed, awarding combo and score. The default AI deliberately flies at that distance.
- **Debug view** — press `V` to draw the grid cells, enemy AABBs, swept segments, candidate links, the graze ring and live counters (pairs / candidates / cull % / narrow checks / hits / grazes).

### Idle AI strategies
The autopilot is the primary player. It uses **predictive threat sampling**: for 17 candidate positions it computes each bullet's closest approach over the next 0.55 s, then picks the safest direction with local search (plus enemy/item attraction and edge avoidance). Press `G` or click **AI** to cycle:

- **GRAZE** (default) — holds near the graze ring, maximising score.
- **EVADE** — larger danger radius and stronger repulsion, maximising survival.
- **HUNT** — minimal dodging, closes on enemies aggressively.

Manual input (mouse / touch / WASD) takes over instantly and the AI resumes when released. `Shift` = focus mode, `Space` = dash, `P` = pause, `N` = next stage.

### Enemies and stages
- 8 enemy archetypes — drifter, weaver, orbiter, sniper, spinner, tank, bomber and boss — each with distinct movement and bullet patterns (aimed, spread, ring, spiral, delayed mines). Bosses switch attacks by HP phase.
- Dense, continuous bullet hell: scripted waves are reinforced by an ambient spawner (up to ~60 enemies), with global density/rate knobs. Peaks at 300+ enemy bullets on screen. The HUD shows the live bullet count.
- 5 data-driven stages with timed waves, four formations, scaling HP/counts, a boss per stage and a clear bonus. Five procedural parallax backdrops: Void / Aqua / Neon City / Shrine / Iron Shaft.

### Quick Start
1. Clone or download this repo.
2. Open `index.html` in a modern browser, or serve it:
   ```bash
   python -m http.server 8000
   ```
3. Watch the AI play. Press `V` to see collisions, `B` to compare broadphases.

### Project Structure
- `index.html` — markup, styling, bootstrap.
- `js/core.js` — math, seeded PRNG, object pool, spatial hash, input, fixed-step loop.
- `js/collision.js` — broadphase, swept narrowphase, graze and debug rendering.
- `js/background.js` — parallax themes and renderer.
- `js/entities.js` — player, bullets, particles, popups, enemy base.
- `js/enemies.js` — enemy behaviours and bullet patterns.
- `js/stages.js` — stage scripts, formations, wave director.
- `js/game.js` — game state, idle AI, HUD wiring.

### Engineering Notes
- Classic `<script>` tags (not ES modules) keep `file://` usage working.
- Fixed 60 Hz timestep with an accumulator; behaviour is refresh-rate independent.
- Bullets/particles are pooled; the spatial hash uses generation stamps instead of per-query allocations.
- Stage layouts use a seeded PRNG; waves are pure data, so new stages need no engine changes.

### License
MIT — see [LICENSE](LICENSE).

---

## 中文

**在线试玩：** https://vihithr.github.io/JSIdleShmup/  
**仓库主页：** https://vihithr.github.io/JSIdleShmup/

### 项目简介
一个**放置流**弹幕游戏：AI 负责玩，你主要负责看碰撞引擎工作。原生 HTML5 Canvas，无构建、无依赖、不含任何游戏素材，直接打开 `index.html` 即可。

### 核心：碰撞实验室
这个模拟主要是为了让碰撞算法有东西可算：

- **宽相**：对敌人 AABB 建立均匀网格，用"世代标记"去重——跨多个格子的物体每帧只返回一次，且不需要每次查询分配 `Set`。按 `B` 可在 `HASH` / `BRUTE` 之间实时切换，HUD 会显示剔除比例。
- **窄相 + CCD**：子弹保存上一帧坐标，用线段与圆的扫掠检测取线段最近点，600px/s 的子弹也不可能穿过 4px 的玩家判定点。
- **擦弹环**：进入 30px 环但没进判定点的子弹会标记为 grazed，累积连击与分数；默认 AI 就故意贴着这个距离飞。
- **调试视图**：按 `V` 画出网格、敌人 AABB、子弹扫掠线段、候选连线、擦弹环，以及实时计数（对数 / 候选 / 剔除率 / 窄相次数 / 命中 / 擦弹）。

### 托管 AI 策略
自动驾驶才是主角。它使用**预测式威胁采样**：对 17 个候选位置分别计算每颗子弹未来 0.55 秒内的最近接近距离，再用局部搜索选最安全的方向（同时考虑敌人/道具吸引与边界回避）。按 `G` 或点击 **AI** 切换：

- **GRAZE**（默认）：贴着擦弹环飞，分数最高。
- **EVADE**：更大的危险半径与斥力，生存优先。
- **HUNT**：少躲避，主动贴近敌人。

手动操作（鼠标 / 触屏 / WASD）会立即接管，松开后 AI 恢复。`Shift` 精确模式，`Space` 冲刺，`P` 暂停，`N` 下一关。

### 敌人与关卡
- 8 种敌人：漂移、织动、环绕、狙击、旋转、重装、投雷、Boss，各有独立移动与弹幕（瞄准、散射、环形、螺旋、延时地雷），Boss 按血量切招。
- 高密度持续弹幕：脚本波次之外还有环境刷怪（同屏最多约 60 敌），密度与射速由全局系数调节，峰值可达 300+ 敌弹；HUD 显示实时弹数。
- 5 个数据驱动关卡，定时波次 + 四种编队，血量与数量递增，每关 Boss 与通关奖励；5 套程序化视差背景：虚空 / 深海 / 霓虹都市 / 遗迹 / 机械井。

### 快速开始
1. 克隆或下载仓库。
2. 用现代浏览器打开 `index.html`，或启动静态服务器：`python -m http.server 8000`
3. 看 AI 玩；按 `V` 看碰撞，按 `B` 对比两种宽相策略。

### 项目结构
- `index.html` — 页面结构、样式与启动代码。
- `js/core.js` — 数学、种子随机数、对象池、空间哈希、输入、固定步长循环。
- `js/collision.js` — 宽相、扫掠窄相、擦弹与调试渲染。
- `js/background.js` — 视差关卡主题与渲染。
- `js/entities.js` — 玩家、子弹、粒子、飘字、敌人基类。
- `js/enemies.js` — 敌人行为与弹幕算法。
- `js/stages.js` — 关卡脚本、编队、波次调度。
- `js/game.js` — 游戏状态、托管 AI、HUD。

### 工程说明
- 传统 `<script>` 标签（非 ES Module），保证 `file://` 直接打开可用。
- 固定 60Hz 步长 + 累加器，行为与刷新率无关。
- 子弹与粒子对象池复用；空间哈希用世代标记代替每次查询分配。
- 关卡布局由种子随机数生成，可复现；波次为纯数据，新增关卡无需改引擎。

### 许可
MIT，详见 [LICENSE](LICENSE)。
