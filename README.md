# JS Idle Shmup

Language: [English](#english) | [中文](#中文)

---

## English

**Live demo:** https://vihithr.github.io/JSIdleShmup/  
**Repository homepage:** https://vihithr.github.io/JSIdleShmup/

### Overview
JS Idle Shmup is a browser-based bullet-hell / idle hybrid built with vanilla HTML5 canvas and JavaScript. Open `index.html` to play, or try the hosted demo.

### Features
- Bullet-hell auto-fire and spread shots; power-ups boost firepower.
- Auto-evade logic that shifts the player away from incoming bullets.
- Enemy waves with varied bullet patterns.
- Pause / resume with button or `P` key.
- Image upload to customize player and enemy sprites (PNG).
- On-screen stats: enemies downed, player hits, power-ups collected.

### Quick Start
1. Clone or download this repo.  
2. Open `index.html` directly in a modern browser **or** start a simple static server:
   ```bash
   # Option A: Python
   python -m http.server 8000
   # Option B: Node
   npx serve .
   ```
3. Visit `http://localhost:8000` (or the shown address) to play.

### Play Guide
- Drag or move the mouse to steer; release to let auto-aim track the nearest enemy.
- Pick up green power-up boxes to boost firepower temporarily.
- Use the pause button or press `P` to pause/resume.
- Upload custom PNGs for player/enemy to personalize visuals.

### Project Structure
- `index.html` — Main page containing styles, canvas, and all game logic.

### Development Notes
- No build step required; everything runs client-side.
- Tested on modern Chromium-based browsers; ensure canvas and FileReader are supported.
- Feel free to modularize the script into separate files (e.g., `js/` and `css/`) if you extend the game.

### License
Specify your license here (e.g., MIT).

---

## 中文

**在线试玩：** https://vihithr.github.io/JSIdleShmup/  
**仓库主页：** https://vihithr.github.io/JSIdleShmup/

### 项目简介
JS Idle Shmup 是一个基于浏览器的弹幕放置混合小游戏，使用原生 HTML5 Canvas 与 JavaScript 编写。直接打开 `index.html` 即可运行，或访问在线示例体验。

### 功能亮点
- 弹幕自动射击与散射，拾取道具后火力提升。
- 自动闪避逻辑，会避开接近的敌方子弹。
- 多种敌人子弹模式的刷新机制。
- 通过按钮或 `P` 键暂停/继续。
- 支持上传 PNG 自定义玩家和敌人贴图。
- 屏显统计：击落数、被击次数、道具获取数。

### 快速开始
1. 克隆或下载本仓库。  
2. 在现代浏览器中直接打开 `index.html`，或启动一个简易静态服务器：
   ```bash
   # 方式 A：Python
   python -m http.server 8000
   # 方式 B：Node
   npx serve .
   ```
3. 在浏览器访问 `http://localhost:8000`（或终端提示的地址）开始游戏。

### 游玩指南
- 拖拽或移动鼠标控制角色，松开后自动瞄准最近的敌人。
- 拾取绿色道具箱可暂时提升火力。
- 点击暂停按钮或按 `P` 键暂停/继续。
- 可上传自定义 PNG 作为玩家和敌人贴图。

### 项目结构
- `index.html` — 主页面，包含样式、画布与完整游戏逻辑。

### 开发提示
- 无需构建步骤，全部在客户端运行。
- 已在现代 Chromium 浏览器验证；需支持 Canvas 与 FileReader。
- 若需扩展，可将脚本与样式拆分至独立文件（如 `js/`、`css/`）。

### 许可
请在此处补充项目许可（例如 MIT）。

