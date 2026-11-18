# JS Idle Shmup

Language: [English](#english) | [中文](#中文)

---

## English

**Live demo:** https://vihithr.github.io/JSIdleShmup/  
**Repository homepage:** https://vihithr.github.io/JSIdleShmup/

### Overview
A browser bullet-hell / idle hybrid built with vanilla HTML5 Canvas and a small modular engine. Open `index.html` directly — no build step, no dependencies, no bundled game assets.

### Features
- **Player control**: mouse / touch drag, WASD / arrow keys, `Shift` focus mode (precise hitbox + tight spread), `Space` dash with cooldown and brief invulnerability, 3-shield system with slow regeneration.
- **Idle autopilot**: dodges nearby bullets and drifts toward the nearest enemy. Any manual input takes over immediately and the autopilot resumes on release.
- **8 enemy archetypes**: drifter, weaver, orbiter, sniper, spinner, tank, bomber and boss — each with its own movement and bullet pattern (aimed shots, spreads, rings, spirals, delayed mines).
- **Stage director**: five data-driven stages with timed wave scripts, formations (line / arc / column / random), scaling HP and counts, a boss at the end of each stage and a clear bonus.
- **Procedural parallax backgrounds**: Void / Aqua / Neon City / Shrine / Iron Shaft, with scrolling stars, nebulae, silhouettes, particles and a stage-start banner.
- **Custom visuals**: load your own player sprite, enemy sprite or scrolling PNG/JPEG/WebP background from the options panel. Nothing is shipped with the repo.
- **HUD**: enemies downed, hits, firepower, score and shield, plus a responsive dark UI with a pause overlay.

### Quick Start
1. Clone or download this repo.
2. Open `index.html` in a modern browser, or serve it:
   ```bash
   python -m http.server 8000
   # or: npx serve .
   ```
3. Play at `http://localhost:8000` (or the hosted demo).

### Controls
- **Mouse / touch**: drag to steer. Release to hand control back to the autopilot.
- **WASD / arrows**: keyboard steering.
- **Shift**: focus mode — slower movement, visible hitbox, narrowed shots.
- **Space**: dash (1.6 s cooldown) with a short invulnerability window.
- **P**: pause / resume. **N**: skip to the next stage.
- Green squares restore firepower; shields regenerate slowly if you avoid getting hit.

### Project Structure
- `index.html` — markup, styling and bootstrap.
- `js/core.js` — math, seeded PRNG, object pool, spatial hash, input, fixed-step loop.
- `js/background.js` — parallax themes and background renderer.
- `js/entities.js` — player, bullets, particles, popups, enemy base.
- `js/enemies.js` — enemy behaviours and bullet-pattern algorithms.
- `js/stages.js` — stage scripts, formations and wave director.
- `js/game.js` — game state, collisions, HUD wiring.

### Engineering Notes
- Classic `<script>` tags (not ES modules) keep `file://` usage working.
- Simulation runs at a fixed 60 Hz timestep with an accumulator, so behaviour does not depend on display refresh rate.
- Bullets and particles are recycled through object pools; enemy lookup uses a uniform-grid spatial hash.
- Stage layouts use a seeded PRNG for reproducibility; waves are pure data, so new stages need no engine changes.

### License
MIT — see [LICENSE](LICENSE).

---

## 中文

**在线试玩：** https://vihithr.github.io/JSIdleShmup/  
**仓库主页：** https://vihithr.github.io/JSIdleShmup/

### 项目简介
基于原生 HTML5 Canvas 与小型模块化引擎的浏览器弹幕 / 放置混合小游戏。直接打开 `index.html` 即可运行：无需构建、无外部依赖，也不包含任何游戏素材。

### 功能亮点
- **角色控制**：鼠标 / 触屏拖拽、WASD / 方向键、`Shift` 低速精确模式（显示判定点、收束弹道）、`Space` 冲刺（带冷却和短暂无敌）、3 格护盾与缓慢回血。
- **托管自动驾驶**：自动躲避附近弹幕并靠近最近敌人；任何手动操作都会立即接管，松开后自动恢复。
- **8 种敌人**：漂移机、织动机、环绕机、狙击机、旋转机、重装机、投雷机、Boss，各自拥有独立移动逻辑与弹幕（瞄准、散射、环形、螺旋、延时地雷）。
- **关卡调度器**：5 个数据驱动关卡，包含定时波次、四种编队、随关卡提升的血量与数量、每关 Boss 与通关奖励。
- **程序化视差背景**：虚空 / 深海 / 霓虹都市 / 遗迹 / 机械井，含滚动星空、星云、剪影、粒子与开场关卡横幅。
- **自定义素材**：可在选项面板载入自己的角色图、敌人图和平铺滚动背景，仓库内不含任何游戏素材。
- **HUD**：击落数、受击数、火力、分数、护盾，以及响应式深色界面与暂停遮罩。

### 快速开始
1. 克隆或下载本仓库。
2. 用现代浏览器打开 `index.html`，或启动静态服务器：
   ```bash
   python -m http.server 8000
   # 或：npx serve .
   ```
3. 访问 `http://localhost:8000`（或使用在线演示）。

### 操作说明
- **鼠标 / 触摸**：拖拽操控角色，松开后交还自动驾驶。
- **WASD / 方向键**：键盘移动。
- **Shift**：低速精确模式，显示判定点并收束弹道。
- **Space**：冲刺（1.6 秒冷却），期间短暂无敌。
- **P**：暂停 / 继续。**N**：切换到下一关。
- 绿色方块补充火力；一段时间内不受击会缓慢恢复护盾。

### 项目结构
- `index.html` — 页面结构、样式与启动代码。
- `js/core.js` — 数学工具、种子随机数、对象池、空间哈希、输入、固定步长循环。
- `js/background.js` — 视差关卡主题与背景渲染。
- `js/entities.js` — 玩家、子弹、粒子、飘字、敌人基类。
- `js/enemies.js` — 敌人行为与弹幕算法。
- `js/stages.js` — 关卡脚本、编队与波次调度。
- `js/game.js` — 游戏状态、碰撞与 HUD。

### 工程说明
- 使用传统 `<script>` 标签（非 ES Module），保证 `file://` 直接打开可用。
- 模拟以固定 60Hz 步长运行，行为与显示器刷新率无关。
- 子弹与粒子通过对象池复用，敌人查询使用均匀网格空间哈希。
- 关卡布局由种子随机数生成，可复现；波次为纯数据，新增关卡无需改引擎代码。

### 许可
MIT，详见 [LICENSE](LICENSE)。
